import 'server-only'

import type { PayloadRequest } from 'payload'

import type {
  CheckoutStatus,
  OrderItemStatus,
  ProductStatus,
  RefundReason,
  RefundStatus,
  ReservationSource,
  SoldChannel,
} from '@/lib/enums'
import { getPaymentsAdapter } from '@/lib/payments'
import { requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'

import { TransitionError } from './transitionError'

// Statusautomat der Stücke (DATENMODELL §6.6.7, KONZEPT §5.1 P1–P15, ARCHITEKTUR §2.1). Die Tabelle ist die einzige
// Quelle für erlaubte Übergänge; der Speicher-Hook der Collection prüft sie bei jeder `status`-Änderung, der Service
// `transitionProduct` zusätzlich die Vorbedingungen und setzt die Nebenwirkungen. Die atomare SQL-Reservierung (P4,
// §8.1) nutzt dieselben Namen (`reserve`, `release`, `sell`).

export type ProductTransition =
  | 'publish'
  | 'unpublish'
  | 'reserve'
  | 'release'
  | 'convertToPrepayment'
  | 'sell'
  | 'sellOffline'
  | 'returnToStock'
  | 'archive'
  | 'archiveAfterReturn'
  | 'restore'

export type ProductActor = 'admin' | 'system'

export interface ProductTransitionDef {
  /** Ausgangsstatus → Übergangs-ID (P2 … P14). */
  from: Readonly<Partial<Record<ProductStatus, string>>>
  to: ProductStatus
  actors: readonly ProductActor[]
}

export const PRODUCT_TRANSITIONS: Readonly<Record<ProductTransition, ProductTransitionDef>> = {
  publish: { from: { draft: 'P2' }, to: 'available', actors: ['admin', 'system'] },
  unpublish: { from: { available: 'P3' }, to: 'draft', actors: ['admin', 'system'] },
  reserve: { from: { available: 'P4' }, to: 'reserved', actors: ['system'] },
  release: { from: { reserved: 'P5' }, to: 'available', actors: ['system'] },
  convertToPrepayment: { from: { reserved: 'P6' }, to: 'reserved', actors: ['system'] },
  sell: { from: { reserved: 'P7', available: 'P8' }, to: 'sold', actors: ['system', 'admin'] },
  sellOffline: { from: { available: 'P9', reserved: 'P10' }, to: 'sold', actors: ['admin'] },
  returnToStock: { from: { sold: 'P11' }, to: 'available', actors: ['admin', 'system'] },
  archive: { from: { draft: 'P12', available: 'P12' }, to: 'archived', actors: ['admin'] },
  archiveAfterReturn: { from: { sold: 'P13' }, to: 'archived', actors: ['admin'] },
  restore: { from: { archived: 'P14' }, to: 'draft', actors: ['admin'] },
}

export const PRODUCT_TRANSITION_NAMES = Object.keys(PRODUCT_TRANSITIONS) as ProductTransition[]

export function isProductTransition(name: unknown): name is ProductTransition {
  return typeof name === 'string' && Object.hasOwn(PRODUCT_TRANSITIONS, name)
}

/** Übergangs-ID, wenn `transition` von `from` nach `to` führt (Prüfung im Speicher-Hook), sonst `null`. */
export function productTransitionId(
  transition: string,
  from: ProductStatus,
  to: ProductStatus,
): string | null {
  if (!isProductTransition(transition)) return null
  const def = PRODUCT_TRANSITIONS[transition]
  return def.to === to ? (def.from[from] ?? null) : null
}

/** Fakten für die Vorbedingungen (vom Service aus der Datenbank geladen, im Unit-Test direkt übergeben). */
export interface ProductTransitionFacts {
  actor: ProductActor
  soldChannel?: SoldChannel | null
  reservationRef?: string | null
  /** P3/P12: Gibt es (trotz Status `available`/`draft`) eine aktive Reservierung? Dann kein Offline-Nehmen/Ausblenden. */
  activeReservation?: boolean
  /** Aktive Reservierung des Stücks mit Kassenstatus. */
  reservation?: {
    ref: string
    source: ReservationSource
    checkoutStatus?: CheckoutStatus | null
  } | null
  /** Bezugsbestellung (`currentOrder`) und die Position dieses Stücks. */
  order?: {
    itemStatus?: OrderItemStatus | null
    returnReceivedAt?: string | null
    shippedAt?: string | null
    pickedUpAt?: string | null
    refunds?: readonly { reason: RefundReason; status?: RefundStatus | null }[]
  } | null
}

export interface ProductTransitionInput {
  /** Standard: `admin` bei angemeldeter Verwaltung, sonst `system`. */
  actor?: ProductActor
  /** P4–P7: Reservierung, zu der der Aufruf gehört. */
  reservationRef?: string
  /** P4, P6: Ende der Reservierung. */
  reservedUntil?: string | Date
  /** P6–P8: Bestellung. */
  orderId?: number
  /** P7/P8: `online` (Versand) oder `pickup`. */
  channel?: 'online' | 'pickup'
  /** P9/P10: Dialog „Offline verkauft“. */
  note?: string | null
  /** P9/P10 (U-60): Markt-Termin des Verkaufs und erzielter Preis in Cent (zählt im Umsatz-Wächter). */
  tourDateId?: number | null
  priceCents?: number | null
  showInArchive?: boolean
  confirmReservedCheckout?: boolean
  /** Zusätzliche Felder im selben Speichervorgang (z. B. `adminAttention` beim Widerruf einer Erklärung). */
  patch?: Record<string, unknown>
  /** Notiz fürs Audit. */
  summary?: string
}

export type ProductTransitionResult =
  { ok: true; id: string; from: ProductStatus; to: ProductStatus } | { ok: false; message: string }

const succeeded = (facts: ProductTransitionFacts, reason: RefundReason) =>
  (facts.order?.refunds ?? []).some((r) => r.reason === reason && r.status === 'succeeded')
const refundedAndReturned = (facts: ProductTransitionFacts) =>
  facts.order?.itemStatus === 'refunded' && !!facts.order?.returnReceivedAt

/** Prüft Übergang und Vorbedingungen (reine Funktion, DM-PROD-10). */
export function evaluateProductTransition(
  from: ProductStatus,
  transition: ProductTransition,
  facts: ProductTransitionFacts,
  input: ProductTransitionInput = {},
): ProductTransitionResult {
  const def = PRODUCT_TRANSITIONS[transition]
  const id = def?.from[from]
  if (!def || !id) {
    return { ok: false, message: `Dieser Schritt ist im Status „${from}“ nicht möglich.` }
  }
  if (!def.actors.includes(facts.actor)) {
    return { ok: false, message: 'Dieser Schritt läuft nur automatisch durch das System.' }
  }
  const no = (message: string): ProductTransitionResult => ({ ok: false, message })
  switch (id) {
    case 'P3':
    case 'P12':
      if (facts.activeReservation) {
        return no(
          'Das Stück liegt gerade in einer Kasse – bitte warten, bis die Reservierung endet.',
        )
      }
      break
    case 'P4':
      if (!input.reservationRef || !input.reservedUntil) return no('Reservierung fehlt.')
      break
    case 'P5':
    case 'P6':
    case 'P7':
      if (!input.reservationRef || input.reservationRef !== facts.reservationRef) {
        return no('Die Reservierung gehört nicht zu diesem Vorgang.')
      }
      if (id === 'P6' && (!input.orderId || !input.reservedUntil)) return no('Bestellung fehlt.')
      if (id === 'P7' && (!input.orderId || !input.channel)) return no('Bestellung fehlt.')
      break
    case 'P8':
      if (!input.orderId || !input.channel) return no('Bestellung fehlt.')
      break
    case 'P10':
      if (facts.reservation?.source === 'prepayment') {
        return no(
          'Das Stück ist für eine Vorkasse-Bestellung reserviert – „Offline verkauft“ ist gesperrt.',
        )
      }
      if (!input.confirmReservedCheckout) {
        return no(
          'Das Stück liegt gerade in einer Kasse. Bitte bestätigen, dass du es trotzdem offline verkauft hast.',
        )
      }
      if (facts.reservation?.checkoutStatus === 'confirming') {
        return no('Zahlung läuft gerade – bitte in ein paar Minuten noch einmal versuchen.')
      }
      if (facts.reservation?.checkoutStatus !== 'open') {
        return no('Die Kasse zu diesem Stück ist nicht mehr offen.')
      }
      break
    case 'P11':
      if (
        facts.soldChannel !== 'offline' &&
        !refundedAndReturned(facts) &&
        !(
          succeeded(facts, 'admin_cancellation') &&
          !facts.order?.shippedAt &&
          !facts.order?.pickedUpAt
        )
      ) {
        return no(
          '„Wieder verkaufen“ geht nur nach einem Offline-Verkauf, nach Erstattung mit Rücksendung oder nach Storno vor dem Versand.',
        )
      }
      break
    case 'P13':
      if (!refundedAndReturned(facts) && !succeeded(facts, 'breakage')) {
        return no(
          '„Ausblenden“ geht bei verkauften Stücken nur nach Erstattung mit Rücksendung oder nach Erstattung wegen Bruch.',
        )
      }
      break
  }
  return { ok: true, id, from, to: def.to }
}

type Doc = Record<string, unknown>
const idOf = (v: unknown): number | null =>
  v && typeof v === 'object' ? Number((v as { id: unknown }).id) : v == null ? null : Number(v)

/** Fakten für die Vorbedingungen aus der Datenbank (auch für die Knöpfe in „Meine Stücke“, P5.8). */
export async function loadProductTransitionFacts(
  req: PayloadRequest,
  product: Doc,
  actor: ProductActor,
): Promise<
  ProductTransitionFacts & { checkoutId?: number | null; checkoutSession?: string | null }
> {
  const facts: ProductTransitionFacts & {
    checkoutId?: number | null
    checkoutSession?: string | null
  } = {
    actor,
    soldChannel: (product.soldChannel as SoldChannel | null) ?? null,
    reservationRef: (product.reservationRef as string | null) ?? null,
  }
  if (product.status === 'available' || product.status === 'draft') {
    const active = await preservingReq(req, () =>
      req.payload.count({
        collection: 'reservations',
        where: {
          and: [
            { product: { equals: product.id } },
            { status: { equals: 'active' } },
            { expiresAt: { greater_than: requestNow(req).toISOString() } },
          ],
        },
        overrideAccess: true,
        req,
      }),
    )
    facts.activeReservation = active.totalDocs > 0
  }
  if (product.status === 'reserved') {
    const res = await preservingReq(req, () =>
      req.payload.find({
        collection: 'reservations',
        where: { and: [{ product: { equals: product.id } }, { status: { equals: 'active' } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    const r = res.docs[0]
    if (r) {
      const checkoutId = idOf(r.checkout)
      const checkout = checkoutId
        ? await preservingReq(req, () =>
            req.payload.findByID({
              collection: 'checkouts',
              id: checkoutId,
              depth: 0,
              overrideAccess: true,
              disableErrors: true,
              req,
            }),
          )
        : null
      facts.reservation = {
        ref: r.ref,
        source: r.source,
        checkoutStatus: (checkout?.status as CheckoutStatus | undefined) ?? null,
      }
      facts.checkoutId = checkoutId
      facts.checkoutSession = checkout?.stripe?.checkoutSessionId ?? null
    }
  }
  const orderId = idOf(product.currentOrder)
  if (product.status === 'sold' && orderId) {
    const order = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )
    if (order) {
      const item = order.items.find((i) => idOf(i.product) === Number(product.id))
      facts.order = {
        itemStatus: item?.status ?? null,
        returnReceivedAt: order.timestamps?.returnReceivedAt ?? null,
        shippedAt: order.timestamps?.shippedAt ?? null,
        pickedUpAt: order.timestamps?.pickedUpAt ?? null,
        refunds: (order.refunds ?? []).map((r) => ({ reason: r.reason, status: r.status })),
      }
    }
  }
  return facts
}

const iso = (d: string | Date | undefined) =>
  d === undefined ? undefined : (d instanceof Date ? d : new Date(d)).toISOString()

/** Nebenwirkungen je Übergang (§6.6.7 Spalte „Nebenwirkung“). */
function sideEffects(
  id: string,
  product: Doc,
  input: ProductTransitionInput,
  now: string,
): Record<string, unknown> {
  const clearReservation = { reservedUntil: null, reservationRef: null }
  const clearSale = {
    soldAt: null,
    soldChannel: null,
    currentOrder: null,
    // U-60: Ein rückgängig gemachter Verkauf zählt nicht mehr im Umsatz-Wächter (die Notiz bleibt als Verlauf).
    offlineSalePriceCents: null,
  }
  switch (id) {
    case 'P2':
      return { firstPublishedAt: product.firstPublishedAt ?? now, archivedAt: null }
    case 'P4':
      return { reservedUntil: iso(input.reservedUntil), reservationRef: input.reservationRef }
    case 'P5':
      return clearReservation
    case 'P6':
      return { reservedUntil: iso(input.reservedUntil), currentOrder: input.orderId }
    case 'P7':
    case 'P8':
      return {
        ...clearReservation,
        soldAt: now,
        soldChannel: input.channel,
        currentOrder: input.orderId,
      }
    case 'P9':
    case 'P10':
      return {
        ...clearReservation,
        soldAt: now,
        soldChannel: 'offline',
        currentOrder: null,
        offlineSaleNote: input.note?.trim() || null,
        offlineSaleTourDate: input.tourDateId ?? null,
        offlineSalePriceCents: input.priceCents ?? null,
        ...(typeof input.showInArchive === 'boolean'
          ? { showInArchiveAfterSale: input.showInArchive }
          : {}),
      }
    case 'P11':
      return { ...clearSale, archivedAt: null }
    case 'P12':
      return { archivedAt: now }
    case 'P13':
      return { ...clearSale, archivedAt: now }
    case 'P14':
      return { archivedAt: null }
    default:
      return {}
  }
}

/**
 * P10 vorbereiten: Stripe-Session beenden (meldet der Anbieter „bezahlt“, bricht die Aktion ab und `fulfillCheckout`
 * übernimmt), Reservierungen der Kasse freigeben (`admin`), Kasse `cancelled` (`sold_offline`), übrige Stücke der
 * Kasse per P5 zurück.
 */
async function cancelCheckoutForOfflineSale(
  req: PayloadRequest,
  productId: number,
  facts: Awaited<ReturnType<typeof loadProductTransitionFacts>>,
): Promise<void> {
  if (facts.checkoutSession) {
    const result = await getPaymentsAdapter().expireCheckoutSession(facts.checkoutSession)
    if (result === 'already_complete_paid') {
      throw new TransitionError(
        'Die Zahlung ist gerade eingegangen – die Bestellung wird angelegt. Bitte nicht offline verkaufen.',
      )
    }
  }
  const now = requestNow(req).toISOString()
  const reservations = await preservingReq(req, () =>
    req.payload.find({
      collection: 'reservations',
      where: {
        and: [{ checkout: { equals: facts.checkoutId } }, { status: { equals: 'active' } }],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )
  for (const r of reservations.docs) {
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'reservations',
        id: r.id,
        data: { status: 'released', releaseReason: 'admin', releasedAt: now },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, transition: 'release' },
      }),
    )
  }
  if (facts.checkoutId) {
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'checkouts',
        id: facts.checkoutId!,
        data: { status: 'cancelled', closeReason: 'sold_offline' },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, transition: 'cancel' },
      }),
    )
  }
  for (const r of reservations.docs) {
    const other = idOf(r.product)
    if (other && other !== productId) {
      await transitionProduct(req, other, 'release', { actor: 'system', reservationRef: r.ref })
    }
  }
}

/**
 * Führt einen Übergang aus (eine Transaktion): prüft Tabelle und Vorbedingungen, setzt die Nebenwirkungen und
 * speichert mit `context.transition`. Audit `product_status_changed` und Revalidierung übernimmt der Hook.
 */
export async function transitionProduct(
  req: PayloadRequest,
  id: number,
  transition: ProductTransition,
  input: ProductTransitionInput = {},
) {
  return inTransaction(req, async () => {
    const actor: ProductActor =
      input.actor ?? (req.user?.collection === 'users' ? 'admin' : 'system')
    const product = (await preservingReq(req, () =>
      req.payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true, req }),
    )) as unknown as Doc
    const from = product.status as ProductStatus
    const facts = await loadProductTransitionFacts(req, product, actor)
    const result = evaluateProductTransition(from, transition, facts, input)
    if (!result.ok) throw new TransitionError(result.message)
    if (result.id === 'P10') await cancelCheckoutForOfflineSale(req, id, facts)
    const now = requestNow(req).toISOString()
    const data = {
      ...(input.patch ?? {}),
      ...sideEffects(result.id, product, input, now),
      status: result.to,
    }
    return preservingReq(req, () =>
      req.payload.update({
        collection: 'products',
        id,
        data: data as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: {
          ...req.context,
          transition,
          system: actor === 'system',
          ...(input.summary ? { note: input.summary } : {}),
        },
      }),
    )
  })
}
