import 'server-only'

import type { PayloadRequest } from 'payload'

import { trackingTemplatesFromSettings, type CarrierCode } from '@/lib/carrier'
import { createManualCarrierAdapter } from '@/lib/carrier/manual'
import type { DeadlineSettings } from '@/lib/commerce/deadlines'
import { defaultTemplateFor, type PackagingSettings } from '@/lib/commerce/packing'
import { computeShipping, type ShippingSettings } from '@/lib/commerce/shipping'
import {
  LEGAL_TEXT_VERSION_KEYS,
  LEGAL_TEXT_VERSION_TYPES,
  type LegalTextVersionKey,
} from '@/fields/legalTextVersions'
import type { FulfillmentMethod, Locale, ShippingClass } from '@/lib/enums'
import { getActiveLegalText } from '@/lib/legal/getActive'
import { LEGAL_SNIPPET_DRAFT_VERSION, sha256Text } from '@/lib/legal/snippets'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import type { MockSession, MockState } from '@/lib/payments/mock/state'
import { MOCK_STATE_VERSION } from '@/lib/payments/mock/state'
import { buildCharacteristics, type CharacteristicsInput } from '@/lib/products/characteristics'
import { pickLocale, type LocalizedValue } from '@/lib/products/localized'
import { sealToken } from '@/lib/security/tokens'
import { getTaxModeAt, type TaxSettings } from '@/lib/tax'

import { seedOp } from './context'
import type { SeedData } from './loader'
import {
  keepCheckout,
  keepReservation,
  planOrder,
  seedReservationRef,
  seedStripeIds,
} from './orderPlan'
import type { SeedReport } from './report'
import type { OrderSeed } from './schemas'
import { resolveSeedDate } from './time'
import { seedToken, seedTokenHash } from './tokens'
import { findBySeedKey, upsertBySeedKey } from './upsert'

// Bestellungen, Kassen und Reservierungen des Beispielbestands (SEED-SPEC §6–§8, PLAN P8.4). Kassen-Modell: Vorgänge
// ohne Bestellung sind Kassen (KS1 abgelaufen, KS2 offen), jede Bestellung hat ihre Kasse, solange diese nach L-03 noch
// existiert. Bestellungen entstehen im Seed-Kontext direkt mit Endstatus; Snapshot-Felder rechnet der Seed mit
// denselben Funktionen wie die Kasse (`buildCharacteristics`, `computeShipping`, Verpackungsvorlage, Rechtstexte).
// Token nur deterministisch aus dem seedKey (`seedToken`, §2.5). Alles create-only (§1.3).

type Obj = Record<string, unknown>

export interface OrderImportOptions {
  report: SeedReport
  now: Date
  appEnv: string
}

type Settings = ShippingSettings & DeadlineSettings & PackagingSettings & TaxSettings & Obj

async function settingsOf(req: PayloadRequest): Promise<Settings> {
  return (await req.payload.findGlobal({ slug: 'settings', ...seedOp(req) })) as unknown as Settings
}

async function idOf(req: PayloadRequest, seedKey: string): Promise<number> {
  const collection = seedKey.slice(0, seedKey.indexOf(':')) as Parameters<typeof findBySeedKey>[1]
  const doc = await findBySeedKey(req, collection, seedKey)
  if (!doc) throw new Error(`Verweis ${seedKey} fehlt – bitte zuerst ${collection} importieren.`)
  return doc.id as number
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined)

function compact<T extends Obj>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

// ---------------------------------------------------------------------------------------------------------------
// Snapshot (wie Kasse und Bestellanlage, SEED-SPEC §2.6)

interface Snapshot {
  rows: Obj[]
  products: (Obj & CharacteristicsInput)[]
  subtotalCents: number
  shippingCents: number
  totalCents: number
  shippingClass: ShippingClass
  shippingZone: string | null
  shippingLabel: string
}

async function snapshot(
  req: PayloadRequest,
  productKeys: readonly string[],
  method: FulfillmentMethod,
  locale: Locale,
  settings: Settings,
): Promise<Snapshot> {
  const rows: Obj[] = []
  const products: (Obj & CharacteristicsInput)[] = []
  for (const key of productKeys) {
    const id = await idOf(req, key)
    const p = (await req.payload.findByID({
      collection: 'products',
      id,
      locale: 'all',
      ...seedOp(req),
      depth: 1,
    })) as unknown as Obj & CharacteristicsInput
    products.push(p)
    rows.push({
      product: id,
      itemNumber: p.itemNumber,
      titleDe: pickLocale(p.title as LocalizedValue, 'de'),
      titleEn: pickLocale(p.title as LocalizedValue, 'en') || undefined,
      category: p.category,
      priceCents: p.priceCents,
      vatCategory: p.vatCategory,
      shippingClass: p.shippingClass,
      characteristicsDe: buildCharacteristics(p, 'de'),
      characteristicsEn: buildCharacteristics(p, 'en'),
      ...(p.hasDeviation
        ? { deviationText: pickLocale(p.deviationDescription as LocalizedValue, 'de') }
        : {}),
    })
  }
  const shipping = computeShipping(
    rows.map((r) => ({
      itemNumber: r.itemNumber as number,
      shippingClass: r.shippingClass as ShippingClass,
    })),
    method,
    settings,
  )
  const subtotalCents = rows.reduce((s, r) => s + (r.priceCents as number), 0)
  const label = shipping.label as unknown
  return {
    rows,
    products,
    subtotalCents,
    shippingCents: shipping.shippingCents,
    totalCents: subtotalCents + shipping.shippingCents,
    shippingClass: shipping.shippingClass,
    shippingZone: shipping.zone ?? null,
    shippingLabel:
      typeof label === 'string' ? label : ((label as Record<Locale, string>)?.[locale] ?? ''),
  }
}

/** Rechtstext-Fassungen beim Absenden (`legalTextVersions`, R-012): die aktiven Platzhalter v1. */
async function legalVersions(
  req: PayloadRequest,
  at: Date,
): Promise<Record<LegalTextVersionKey, number>> {
  const out = {} as Record<LegalTextVersionKey, number>
  for (const key of LEGAL_TEXT_VERSION_KEYS) {
    const doc = await getActiveLegalText(LEGAL_TEXT_VERSION_TYPES[key], at, { req })
    if (!doc) throw new Error(`Rechtstext ${key} fehlt – zuerst pnpm seed:base.`)
    out[key] = doc.id as number
  }
  return out
}

/** Arbeitsfassung `draft-1` der in der Übersicht angezeigten Bausteine (SEED-SPEC §7.1, DATENMODELL §6.8.1). */
export function seedSnippetVersions(input: {
  shipping: boolean
  prepayment: boolean
  deviation: boolean
}): Record<string, { version: string; sha256: string }> {
  const keys = [
    'checkout.legalNotice',
    'withdrawal.returnCostsNote',
    ...(input.shipping ? ['checkout.dhlEmailConsent'] : []),
    ...(input.prepayment ? ['checkout.vorkasseInfo'] : []),
    ...(input.deviation ? ['checkout.deviationAgreement'] : []),
  ] as (keyof typeof LEGAL_SNIPPET_SEED)[]
  return Object.fromEntries(
    keys.map((k) => [
      k,
      { version: LEGAL_SNIPPET_DRAFT_VERSION, sha256: sha256Text(LEGAL_SNIPPET_SEED[k].de) },
    ]),
  )
}

function addressOf(customer: SeedData['customers'][number]): Obj {
  if (!customer.address) throw new Error(`${customer.key}: Adresse fehlt`)
  return { name: customer.name, ...customer.address, country: 'DE' }
}

function mockState(input: {
  ref: string
  appEnv: string
  sessionId: string
  status: MockSession['status']
  paid: boolean
  locale: Locale
  snap: Snapshot
  createdAt: Date
  expiresAt: Date
  completedAt?: Date | null
  order?: OrderSeed
}): MockState {
  const ids = input.order ? seedStripeIds(input.order.orderNumber) : null
  const type = input.order?.payment.methodType
  const session: MockSession = {
    sessionId: input.sessionId,
    status: input.status,
    paymentStatus: input.paid ? 'paid' : 'unpaid',
    locale: input.locale,
    amountSubtotalCents: input.snap.subtotalCents,
    shippingCents: input.snap.shippingCents,
    shippingLabel: input.snap.shippingLabel,
    amountTotalCents: input.snap.totalCents,
    createdAt: input.createdAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    ...(input.paid && ids
      ? {
          paymentIntentId: ids.paymentIntentId,
          chargeId: ids.chargeId,
          paymentMethod:
            type === 'paypal'
              ? { type: 'paypal' as const }
              : type === 'apple_pay' || type === 'google_pay'
                ? { type: 'card' as const, wallet: type }
                : { type: 'card' as const },
          completedAt: input.completedAt?.toISOString(),
        }
      : {}),
  }
  return {
    v: MOCK_STATE_VERSION,
    checkoutRef: input.ref,
    appEnv: input.appEnv,
    sessions: [session],
    refunds: [],
    disputes: [],
    events: [],
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Kassen (§7.3)

export async function importCheckouts(
  req: PayloadRequest,
  data: SeedData,
  options: OrderImportOptions,
): Promise<void> {
  const { now } = options
  const settings = await settingsOf(req)
  const t = (expr: string | undefined) => (expr ? resolveSeedDate(expr, now) : undefined)
  const customers = new Map(data.customers.map((c) => [`customers:${c.key}`, c]))

  // Kassen ohne Bestellung (KS1, KS2) – nur, solange sie nach L-03 noch existieren
  for (const c of data.orders.checkouts) {
    if (!keepCheckout(t(c.createdAt)!, now)) continue
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'checkouts',
      seedKey: `checkouts:${c.key}`,
      group: 'process',
      create: async () => {
        const snap = await snapshot(req, c.items, c.fulfillmentMethod, c.locale, settings)
        const customer = c.customer ? customers.get(c.customer) : undefined
        const shipping = c.fulfillmentMethod === 'shipping'
        const submittedAt = t(c.submittedAt)
        return compact({
          tokenHash: seedTokenHash(`checkouts:${c.key}`, 'checkout'),
          status: c.status,
          locale: c.locale,
          reservationRef: c.reservationRef,
          items: snap.rows,
          fulfillmentMethod: c.fulfillmentMethod,
          shippingZone: snap.shippingZone ?? undefined,
          shippingClass: snap.shippingClass,
          subtotalCents: snap.subtotalCents,
          shippingCents: snap.shippingCents,
          totalCents: snap.totalCents,
          expiresAt: iso(t(c.expiresAt)),
          displayExpiresAt: iso(t(c.displayExpiresAt)),
          paymentChoice: c.paymentChoice,
          ...(customer
            ? {
                customer: { email: customer.email },
                ...(shipping
                  ? { shippingAddress: addressOf(customer) }
                  : { billingAddress: addressOf(customer) }),
                billingAddressDiffers: false,
                carrierEmailConsent: shipping && c.carrierEmailConsent === true,
              }
            : {}),
          ...(submittedAt
            ? {
                submittedAt: iso(submittedAt),
                legalTextVersions: await legalVersions(req, submittedAt),
                legalSnippetVersions: seedSnippetVersions({
                  shipping,
                  prepayment: c.paymentChoice === 'prepayment',
                  deviation: snap.rows.some((r) => r.deviationText),
                }),
              }
            : {}),
          closeReason: c.closeReason,
          stripe: {
            checkoutSessionId: c.stripe.checkoutSessionId,
            sessionExpiresAt: iso(t(c.stripe.sessionExpiresAt)),
            sessionSeq: c.stripe.sessionSeq,
            livemode: false,
          },
          mock: {
            state: mockState({
              ref: c.reservationRef,
              appEnv: options.appEnv,
              sessionId: c.stripe.checkoutSessionId,
              status: c.status === 'open' ? 'open' : 'expired',
              paid: false,
              locale: c.locale,
              snap,
              createdAt: t(c.createdAt)!,
              expiresAt: t(c.stripe.sessionExpiresAt)!,
            }),
          },
          timestamps: compact({
            confirmingAt: iso(t(c.confirmingAt)),
            expiredAt: iso(t(c.expiredAt)),
          }),
          createdAt: iso(t(c.createdAt)),
        })
      },
    })
  }

  // Kassen der Bestellungen (abgeschlossen, Zeitwerte aus T0 = placedAt − 4 min)
  for (const order of data.orders.orders) {
    const plan = planOrder(order, now, settings)
    const cp = plan.checkout
    if (!cp) continue
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'checkouts',
      seedKey: `checkouts:${order.key}`,
      group: 'process',
      create: async () => {
        const customer = customers.get(order.customer)!
        const shipping = order.fulfillmentMethod === 'shipping'
        const prepaid = order.payment.method === 'prepayment'
        const snap = await snapshot(
          req,
          order.items.map((i) => i.product),
          order.fulfillmentMethod,
          order.locale,
          settings,
        )
        const ref = seedReservationRef(order.key)
        const sessionId = seedStripeIds(order.orderNumber).checkoutSessionId
        return compact({
          tokenHash: seedTokenHash(`checkouts:${order.key}`, 'checkout'),
          status: 'completed',
          locale: order.locale,
          reservationRef: ref,
          items: snap.rows,
          fulfillmentMethod: order.fulfillmentMethod,
          shippingZone: snap.shippingZone ?? undefined,
          shippingClass: snap.shippingClass,
          subtotalCents: snap.subtotalCents,
          shippingCents: snap.shippingCents,
          totalCents: snap.totalCents,
          expiresAt: cp.expiresAt.toISOString(),
          displayExpiresAt: cp.displayExpiresAt.toISOString(),
          paymentChoice: prepaid ? 'prepayment' : 'stripe',
          customer: { email: customer.email },
          ...(shipping
            ? { shippingAddress: addressOf(customer) }
            : { billingAddress: addressOf(customer) }),
          billingAddressDiffers: false,
          carrierEmailConsent: shipping && order.carrierEmailConsent,
          deviationAgreements: snap.rows
            .filter((r) => r.deviationText)
            .map((r) => ({ product: r.product, agreedAt: cp.submittedAt.toISOString() })),
          legalTextVersions: await legalVersions(req, cp.submittedAt),
          legalSnippetVersions: seedSnippetVersions({
            shipping,
            prepayment: prepaid,
            deviation: snap.rows.some((r) => r.deviationText),
          }),
          submittedAt: cp.submittedAt.toISOString(),
          stripe: {
            checkoutSessionId: sessionId,
            sessionExpiresAt: cp.sessionExpiresAt.toISOString(),
            sessionSeq: 1,
            livemode: false,
          },
          mock: {
            state: mockState({
              ref,
              appEnv: options.appEnv,
              sessionId,
              status: prepaid ? 'expired' : 'complete',
              paid: !prepaid,
              locale: order.locale,
              snap,
              createdAt: cp.createdAt,
              expiresAt: cp.sessionExpiresAt,
              completedAt: cp.completedAt,
              order,
            }),
          },
          timestamps: compact({
            confirmingAt: iso(cp.confirmingAt),
            completedAt: cp.completedAt.toISOString(),
          }),
          createdAt: cp.createdAt.toISOString(),
        })
      },
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Bestellungen (§7.1, §7.2) – in Reihenfolge `placedAt`

export function ordersByPlacedAt(data: SeedData, now: Date): OrderSeed[] {
  return [...data.orders.orders].sort(
    (a, b) =>
      resolveSeedDate(a.timeline.placedAt!, now).getTime() -
      resolveSeedDate(b.timeline.placedAt!, now).getTime(),
  )
}

export async function importOrders(
  req: PayloadRequest,
  data: SeedData,
  options: OrderImportOptions,
): Promise<void> {
  const { now } = options
  const settings = await settingsOf(req)
  const customers = new Map(data.customers.map((c) => [`customers:${c.key}`, c]))
  // Link aus den Vorlagen der Einstellungen (DM-12) – reine Funktion des Treibers `manual`, kein Adapter-Aufruf (AK-SEED-05)
  const carrier = createManualCarrierAdapter(
    trackingTemplatesFromSettings(settings as Parameters<typeof trackingTemplatesFromSettings>[0]),
  )

  for (const order of ordersByPlacedAt(data, now)) {
    const plan = planOrder(order, now, settings)
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'orders',
      seedKey: `orders:${order.key}`,
      group: 'process',
      create: async () => {
        const customer = customers.get(order.customer)!
        const shipping = order.fulfillmentMethod === 'shipping'
        const prepaid = order.payment.method === 'prepayment'
        const snap = await snapshot(
          req,
          order.items.map((i) => i.product),
          order.fulfillmentMethod,
          order.locale,
          settings,
        )
        const ts = plan.timestamps
        const placedAt = ts.placedAt!
        const items = snap.rows.map((row, i) => {
          const p = snap.products[i]!
          const first = (p.images as unknown[] | undefined)?.[0] as
            (Obj & { id: number; url?: string; sizes?: { card?: { url?: string } } }) | undefined
          const seed = order.items[i]!
          return compact({
            id: `${order.key}-L${i + 1}`,
            ...row,
            ...(first
              ? { coverImage: first.id, coverImageUrl: first.sizes?.card?.url ?? first.url }
              : {}),
            ...(p.foodContact ? { foodContact: p.foodContact } : {}),
            ...(row.deviationText ? { deviationAgreedAt: placedAt.toISOString() } : {}),
            status: seed.status ?? 'active',
            refundedCents: seed.refundedCents ?? 0,
          })
        })
        const ids = seedStripeIds(order.orderNumber)
        const paidAt = ts.paidAt
        const token = seedToken(`orders:${order.key}`, 'status')
        const packed = ts.packedAt
        const template = packed ? defaultTemplateFor(snap.shippingClass, settings) : null
        if (packed && !template) throw new Error(`${order.key}: keine Verpackungsvorlage`)
        if (order.packaging && order.packaging.templateKey !== template?.key) {
          throw new Error(
            `${order.key}: Verpackung ${order.packaging.templateKey} ≠ Standard ${template?.key ?? '–'} (§7.1)`,
          )
        }
        const checkout = plan.checkout
          ? await findBySeedKey(req, 'checkouts', `checkouts:${order.key}`)
          : null
        if (plan.checkout && !checkout) {
          throw new Error(
            `Kasse checkouts:${order.key} fehlt – bitte zuerst checkouts importieren.`,
          )
        }
        const packingPhotos = order.packingPhotos
          ? await Promise.all(order.packingPhotos.map((k) => idOf(req, k)))
          : undefined
        return compact({
          orderNumber: order.orderNumber,
          status: order.status,
          checkout: checkout?.id ?? null,
          locale: order.locale,
          customer: { name: customer.name, email: customer.email },
          fulfillmentMethod: order.fulfillmentMethod,
          ...(shipping
            ? { shippingAddress: addressOf(customer) }
            : { billingAddress: addressOf(customer) }),
          billingAddressDiffers: false,
          shippingZone: shipping ? snap.shippingZone : null,
          shippingClass: snap.shippingClass,
          items,
          subtotalCents: snap.subtotalCents,
          shippingCents: snap.shippingCents,
          totalCents: snap.totalCents,
          currency: 'EUR',
          taxModeAtOrder: getTaxModeAt(settings, placedAt),
          paymentMethod: order.payment.method,
          paymentProvider: order.payment.provider,
          ...(prepaid
            ? {
                prepayment: compact({
                  dueAt: plan.prepayment!.dueAt.toISOString(),
                  reminderDueAt: plan.prepayment!.reminderDueAt.toISOString(),
                  reminderSentAt: order.prepayment?.reminderSentAt
                    ? resolveSeedDate(order.prepayment.reminderSentAt, now).toISOString()
                    : undefined,
                  receivedAt: iso(paidAt),
                  receivedAmountCents: paidAt ? snap.totalCents : undefined,
                }),
              }
            : {
                stripe: compact({
                  checkoutSessionId: ids.checkoutSessionId,
                  paymentIntentId: ids.paymentIntentId,
                  chargeId: ids.chargeId,
                  paymentMethodType: order.payment.methodType,
                  livemode: false,
                  amountReceivedCents: snap.totalCents,
                  feeCents: order.payment.feeCents,
                }),
              }),
          ...(order.shipment
            ? {
                shipment: compact({
                  carrier: order.shipment.carrier,
                  trackingNumber: order.shipment.trackingNumber,
                  trackingUrl:
                    carrier.trackingUrl(
                      order.shipment.carrier as CarrierCode,
                      order.shipment.trackingNumber,
                      order.locale,
                    ) ?? undefined,
                  deliveredSource: ts.deliveredAt
                    ? (order.shipment.deliveredSource ?? 'manual')
                    : undefined,
                }),
              }
            : {}),
          ...(template
            ? {
                packaging: {
                  templateKey: template.key,
                  templateName: template.name,
                  components: template.components.map((c) => ({ ...c })),
                  recordedAt: packed!.toISOString(),
                },
              }
            : {}),
          packingPhotos,
          legalTextVersions: await legalVersions(req, placedAt),
          legalSnippetVersions: seedSnippetVersions({
            shipping,
            prepayment: prepaid,
            deviation: snap.rows.some((r) => r.deviationText),
          }),
          carrierEmailConsent: shipping && order.carrierEmailConsent,
          refunds: order.refunds?.map((r, k) =>
            compact({
              amountCents: r.amountCents,
              reason: r.reason,
              itemIds: r.itemIds,
              includesShipping: r.includesShipping,
              status: r.status,
              stripeRefundId: prepaid ? undefined : ids.refundId(k + 1),
              createdAt: resolveSeedDate(r.createdAt, now).toISOString(),
            }),
          ),
          cancelReason: order.cancelReason,
          statusBeforeDispute: plan.statusBeforeDispute ?? undefined,
          statusBeforeWithdrawal: plan.statusBeforeWithdrawal ?? undefined,
          dispute: order.dispute ?? { status: 'none' },
          adminAttention: order.adminAttention,
          timestamps: Object.fromEntries(
            Object.entries(ts).map(([k, v]) => [k, (v as Date).toISOString()]),
          ),
          statusHistory: plan.history.map((h) => ({
            from: h.from,
            to: h.to,
            at: h.at.toISOString(),
            actorType: h.actorType,
            transition: h.transition,
          })),
          statusTokenHash: seedTokenHash(`orders:${order.key}`, 'status'),
          statusTokenSealed: sealToken(token),
          statusTokenIssuedAt: plan.createdAt.toISOString(),
          notes: order.notes,
          retainUntil: iso(plan.retainUntil),
          createdAt: plan.createdAt.toISOString(),
        })
      },
    })
    if (res.outcome !== 'created') continue
    // Verknüpfungen (§1.7 Schritt 5): Kasse → Bestellung, Stücke → aktuelle Bestellung, Packfotos → Bestellung
    const checkoutId = res.doc.checkout as number | null | undefined
    if (checkoutId) {
      await req.payload.update({
        collection: 'checkouts',
        id: checkoutId,
        data: { order: res.doc.id } as never,
        ...seedOp(req),
      })
    }
    await linkProducts(req, order, res.doc)
    for (const key of order.packingPhotos ?? []) {
      await req.payload.update({
        collection: 'private-uploads',
        id: await idOf(req, key),
        data: { relatedOrder: res.doc.id } as never,
        ...seedOp(req),
      })
    }
  }
}

/** `products.currentOrder` für Stücke, die an dieser Bestellung hängen (verkauft bzw. für Vorkasse reserviert). */
async function linkProducts(
  req: PayloadRequest,
  order: OrderSeed,
  doc: { id: number | string },
): Promise<void> {
  for (const item of order.items) {
    const product = await findBySeedKey(req, 'products', item.product)
    if (!product || product.seed !== true) continue
    if (product.status !== 'sold' && product.status !== 'reserved') continue
    if (product.soldChannel === 'offline') continue
    if (product.currentOrder) continue
    await req.payload.update({
      collection: 'products',
      id: product.id,
      data: { currentOrder: doc.id } as never,
      ...seedOp(req),
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Reservierungen (§8)

export async function importReservations(
  req: PayloadRequest,
  data: SeedData,
  options: OrderImportOptions,
): Promise<void> {
  const { now } = options
  const settings = await settingsOf(req)
  const t = (expr: string | undefined) => (expr ? resolveSeedDate(expr, now) : undefined)

  for (const r of data.orders.reservations) {
    const releasedAt = t(r.releasedAt)
    const convertedAt = t(r.convertedAt)
    if (!keepReservation({ status: r.status, releasedAt, convertedAt }, now)) continue
    const checkout = data.orders.checkouts.find((c) => `checkouts:${c.key}` === r.checkout)!
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'reservations',
      seedKey: `reservations:${r.key}`,
      group: 'process',
      create: async () =>
        compact({
          ref: checkout.reservationRef,
          checkout: await idOf(req, r.checkout),
          product: await idOf(req, r.product),
          source: r.source,
          status: r.status,
          expiresAt: iso(t(r.expiresAt)),
          displayExpiresAt: iso(t(r.displayExpiresAt)),
          convertedAt: iso(convertedAt),
          releasedAt: iso(releasedAt),
          releaseReason: r.releaseReason,
          createdAt: iso(t(r.createdAt)),
        }),
    })
  }

  for (const order of data.orders.orders) {
    const plan = planOrder(order, now, settings)
    const rp = plan.reservation
    if (!rp) continue
    // eine Reservierung je Stück mit gleicher `ref` (bei mehreren Stücken `<Kasse>:<Stück>`)
    for (const item of order.items) {
      const key =
        order.items.length > 1
          ? `${order.key}:${item.product.slice('products:'.length)}`
          : order.key
      await upsertBySeedKey({
        req,
        report: options.report,
        collection: 'reservations',
        seedKey: `reservations:${key}`,
        group: 'process',
        create: async () =>
          compact({
            ref: seedReservationRef(order.key),
            checkout: await idOf(req, `checkouts:${order.key}`),
            order: await idOf(req, `orders:${order.key}`),
            product: await idOf(req, item.product),
            source: rp.source,
            status: rp.status,
            expiresAt: rp.expiresAt.toISOString(),
            displayExpiresAt: iso(rp.displayExpiresAt),
            convertedAt: iso(rp.convertedAt),
            releasedAt: iso(rp.releasedAt),
            releaseReason: rp.releaseReason ?? undefined,
            createdAt: rp.createdAt.toISOString(),
          }),
      })
    }
  }
}
