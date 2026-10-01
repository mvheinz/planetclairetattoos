import 'server-only'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { revalidateProduct } from '@/lib/cache/revalidate'
import { dbFor } from '@/lib/db/tx'
import { getEnv } from '@/lib/env'
import type {
  CheckoutCloseReason,
  FulfillmentMethod,
  Locale,
  ShippingClass,
  VatCategory,
} from '@/lib/enums'
import { jobAlarm } from '@/lib/jobs/alarm'
import { createLogger } from '@/lib/monitoring/logger'
import { pickPublicSettings, toPublicPayload } from '@/lib/payload/public'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import { checkoutReturnUrl } from '@/lib/payments/checkoutSession'
import { buildCharacteristics, type CharacteristicsInput } from '@/lib/products/characteristics'
import { pickLocale, type LocalizedValue } from '@/lib/products/localized'
import { ipHash } from '@/lib/security/ipHash'
import { hit } from '@/lib/security/rateLimit'
import { createToken, hashToken, TOKEN_RE } from '@/lib/security/tokens'
import { pickShopDisplaySettings } from '@/lib/shop/displaySettings'
import type { Checkout } from '@/payload-types'

import type { CartCookie } from './cartCookie'
import { isLocalHost } from './cartCookie'
import { reservationTimes } from './deadlines'
import {
  releaseExpiredFor,
  releaseReservation,
  ReservationConflictError,
  reserveProducts,
  type ReleaseOutcome,
} from './reservation'
import { ShippingError } from './shipping'
import { computeTotals, type TotalsSettings } from './totals'

// Kassenstart „Zur Kasse“ (KONZEPT §4.2/§4.6/§4.11, DATENMODELL §6.25/§8.1, PLAN P4.6). Ablauf:
// (1) Shop geöffnet, Korb prüfen (öffentlich, `available`, ≤ `settings.shop.maxItemsPerCheckout`); eine offene Kasse
//     desselben `pc_checkout` mit gleicher Stückliste wird wiederverwendet und nie verlängert (S14), sonst `replaced`;
// (2) „lazy release“ abgelaufener Reservierungen der angefragten Stücke (Session beim Anbieter zuerst beenden);
// (3) eine Transaktion: Kasse `open` mit Snapshot anlegen, dann atomar reservieren (alles oder nichts, S1);
// (4) nach dem Commit Zahlungs-Session anlegen – Fehler ⇒ Kasse bleibt `open` ohne Session, nur Vorkasse (S13);
// (5) Job-Wecker vorziehen und Stückseiten sofort erneuern.
// Der Kassen-Token steht nur im Cookie `pc_checkout` und in der `return_url`; gespeichert wird sein SHA-256.

const log = createLogger()

export const CHECKOUT_COOKIE = 'pc_checkout'
/** 1 Stunde (ARCHITEKTUR §8.7). */
export const CHECKOUT_COOKIE_MAX_AGE = 3600
/** Standard von `settings.shop.maxItemsPerCheckout` (DATENMODELL §7.1). */
export const DEFAULT_MAX_ITEMS_PER_CHECKOUT = 10

export interface CheckoutCookieAttributes {
  path: '/'
  sameSite: 'lax'
  secure: boolean
  maxAge: number
  httpOnly: true
}

/** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` (ARCHITEKTUR §8.7; `Secure` außer auf localhost). */
export function checkoutCookieAttributes(
  host: string | null | undefined,
): CheckoutCookieAttributes {
  return {
    path: '/',
    sameSite: 'lax',
    secure: !isLocalHost(host),
    maxAge: CHECKOUT_COOKIE_MAX_AGE,
    httpOnly: true,
  }
}

export type StartCheckoutCode =
  'shop_closed' | 'empty' | 'too_many' | 'unavailable' | 'reserved' | 'payment_running' | 'shipping'

export type StartCheckoutResult =
  | {
      ok: true
      /** Dieselbe Kasse wie zuvor (S14) – Token und Ablauf unverändert. */
      reused: boolean
      checkoutId: number
      /** Klartext-Token für das Cookie `pc_checkout` (nie loggen). */
      token: string
      reservationRef: string
      expiresAt: Date
      displayExpiresAt: Date
      /** `false` ⇒ Anbieter beim Start nicht erreichbar, nur Vorkasse (S13). */
      paymentSession: boolean
    }
  | {
      ok: false
      code: StartCheckoutCode
      /** Betroffene Stücknummern (`reserved`, `unavailable`). */
      itemNumbers?: number[]
      /** Höchstzahl bei `too_many`. */
      max?: number
      /** `settings.shop.closedMessage` bei `shop_closed` bzw. Text des Rechenkerns bei `shipping`. */
      message?: string | null
    }

export interface StartCheckoutInput {
  cart: CartCookie
  locale: Locale
  /** Wert von `pc_checkout` (fehlt → neue Kasse). */
  existingToken?: string | null
  now: Date
}

export interface CheckoutDeps {
  payload?: Payload
  payments?: PaymentsAdapter
  /** Aufruf aus einer Server-Action (Cache-Erneuerung per `updateTag`). */
  inServerAction?: boolean
}

type Obj = Record<string, unknown>

const fail = (
  code: StartCheckoutCode,
  extra: Omit<Extract<StartCheckoutResult, { ok: false }>, 'ok' | 'code'> = {},
): StartCheckoutResult => ({ ok: false, code, ...extra })

const sameItems = (a: readonly number[], b: readonly number[]) => {
  if (a.length !== b.length) return false
  const x = [...a].sort((m, n) => m - n)
  const y = [...b].sort((m, n) => m - n)
  return x.every((v, i) => v === y[i])
}

const itemIdsOf = (checkout: Checkout): number[] =>
  checkout.items.map((i) => (typeof i.product === 'number' ? i.product : i.product.id))

/** Kasse zum Token (Hash-Suche) oder `null`. */
export async function findCheckoutByToken(
  payload: Payload,
  token: string | null | undefined,
): Promise<Checkout | null> {
  if (!token || !TOKEN_RE.test(token)) return null
  const res = await payload.find({
    collection: 'checkouts',
    where: { tokenHash: { equals: hashToken(token) } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  return (res.docs[0] as Checkout | undefined) ?? null
}

/** Rate-Limit `checkout_start` (10 / 10 min und 30 / Tag je IP-Hash, ARCHITEKTUR §8.5). */
export async function checkoutStartAllowed(
  ip: string | null,
  now: Date,
  payload?: Payload,
): Promise<boolean> {
  payload ??= await getPayload({ config })
  const key = ipHash(ip ?? 'unknown', { now: () => now })
  const short = await hit('checkout_start', key, now, payload)
  const day = await hit('checkout_start_day', key, now, payload)
  return short.allowed && day.allowed
}

async function itemNumbersOf(payload: Payload, ids: readonly number[]): Promise<number[]> {
  if (ids.length === 0) return []
  const res = await payload.find({
    collection: 'products',
    where: { id: { in: [...ids] } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { itemNumber: true },
  })
  return res.docs.map((d) => d.itemNumber).sort((a, b) => a - b)
}

/**
 * Bricht eine offene Kasse ab (S6 `cart_changed`, S14 `replaced`): Session beenden, Reservierungen freigeben
 * (`customer_cancelled`), Kasse `cancelled`. Nur für Kassen in `open`; sonst `not_open`.
 */
export async function cancelCheckout(
  checkoutId: number,
  closeReason: Extract<CheckoutCloseReason, 'cart_changed' | 'replaced'>,
  now: Date,
  deps: CheckoutDeps = {},
): Promise<ReleaseOutcome | { status: 'not_open'; checkoutId: number }> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const checkout = (await payload.findByID({
    collection: 'checkouts',
    id: checkoutId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as Checkout | null
  if (!checkout || checkout.status !== 'open') return { status: 'not_open', checkoutId }
  return releaseReservation(checkout.reservationRef, 'customer_cancelled', now, {
    ...deps,
    payload,
    closeReason,
  })
}

interface LoadedProduct extends Obj {
  id: number
  itemNumber: number
  status: string
  priceCents: number
  category: string
  vatCategory: VatCategory
  shippingClass: ShippingClass
  reservedUntil?: string | null
  isCustomCommission?: boolean | null
}

/** Startet die Kasse für den Korb (Ablauf siehe Kopfkommentar). Setzt kein Cookie – das macht die Server-Action. */
export async function startCheckout(
  input: StartCheckoutInput,
  deps: CheckoutDeps = {},
): Promise<StartCheckoutResult> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const { cart, locale, now } = input
  const ids = [...new Set(cart.items.map((i) => i.id))]

  // (1) Shop und Korb – Einstellungen frisch aus der DB (auch eine veraltete Seite wird abgelehnt).
  const raw = (await payload.findGlobal({
    slug: 'settings',
    overrideAccess: true,
    depth: 0,
    locale,
  })) as unknown as Obj
  const shop = pickShopDisplaySettings(pickPublicSettings(raw, now))
  if (!shop.isOpen) return fail('shop_closed', { message: shop.closedMessage })
  if (ids.length === 0) return fail('empty')
  const configuredMax = (raw.shop as Obj | undefined)?.maxItemsPerCheckout
  const max =
    typeof configuredMax === 'number' && configuredMax >= 1
      ? configuredMax
      : DEFAULT_MAX_ITEMS_PER_CHECKOUT
  if (ids.length > max) return fail('too_many', { max })

  // Kasse desselben Cookies: gleiche Stückliste → wiederverwenden (nie verlängern), sonst ersetzen.
  const existing = await findCheckoutByToken(payload, input.existingToken)
  if (existing && (existing.status === 'open' || existing.status === 'confirming')) {
    // Reservierung gehalten (`expiresAt`) und Countdown läuft noch (`displayExpiresAt`) → wiederverwenden (S14). Nach dem
    // Countdown („Nochmal reservieren“, KO-15) wird die noch gehaltene Reservierung ersetzt.
    const held = new Date(existing.expiresAt).getTime() > now.getTime()
    const current = held && new Date(existing.displayExpiresAt).getTime() > now.getTime()
    if (current && sameItems(itemIdsOf(existing), ids)) {
      return {
        ok: true,
        reused: true,
        checkoutId: existing.id as number,
        token: input.existingToken as string,
        reservationRef: existing.reservationRef,
        expiresAt: new Date(existing.expiresAt),
        displayExpiresAt: new Date(existing.displayExpiresAt),
        paymentSession: Boolean(existing.stripe?.checkoutSessionId),
      }
    }
    if (existing.status === 'confirming') return fail('payment_running')
    if (held) {
      const cancelled = await cancelCheckout(existing.id as number, 'replaced', now, {
        ...deps,
        payload,
      })
      if (cancelled.status !== 'released' && cancelled.status !== 'not_open') {
        return fail('payment_running')
      }
    }
  }

  // Öffentliche Leseregel (DATENMODELL §1.4) mit beiden Sprachen für den Snapshot.
  const found = await toPublicPayload(payload).find({
    collection: 'products',
    where: { id: { in: ids } },
    locale: 'all',
    depth: 0,
    pagination: false,
  })
  const byId = new Map((found.docs as unknown as LoadedProduct[]).map((d) => [d.id, d] as const))
  const gone = ids.filter((id) => {
    const p = byId.get(id)
    return (
      !p || (p.status !== 'available' && p.status !== 'reserved') || p.isCustomCommission === true
    )
  })
  if (gone.length > 0) {
    return fail('unavailable', { itemNumbers: await itemNumbersOf(payload, gone) })
  }

  // (2) Lazy release abgelaufener Reservierungen dieser Stücke.
  const expired = ids.filter((id) => {
    const p = byId.get(id)!
    return (
      p.status === 'reserved' &&
      !!p.reservedUntil &&
      new Date(p.reservedUntil).getTime() < now.getTime()
    )
  })
  if (expired.length > 0) await releaseExpiredFor(expired, now, { ...deps, payload })

  // Snapshot und Summen (immer DB-Preise; `nur_abholung` erzwingt Abholung).
  const products = ids.map((id) => byId.get(id)!)
  const items = products.map((p) => {
    const deviation = p.hasDeviation
      ? pickLocale(p.deviationDescription as LocalizedValue, locale)
      : undefined
    return {
      product: p.id,
      itemNumber: p.itemNumber,
      titleDe: pickLocale(p.title as LocalizedValue, 'de') ?? `Nr. ${p.itemNumber}`,
      titleEn: pickLocale(p.title as LocalizedValue, 'en', false) ?? undefined,
      category: p.category,
      priceCents: p.priceCents,
      vatCategory: p.vatCategory,
      shippingClass: p.shippingClass,
      characteristicsDe: buildCharacteristics(p as CharacteristicsInput, 'de'),
      characteristicsEn: buildCharacteristics(p as CharacteristicsInput, 'en'),
      ...(deviation ? { deviationText: deviation } : {}),
    }
  })
  const fulfillmentMethod: FulfillmentMethod = items.some((i) => i.shippingClass === 'nur_abholung')
    ? 'pickup'
    : cart.delivery
  let totals: ReturnType<typeof computeTotals>
  try {
    totals = computeTotals(
      {
        items: items.map((i, n) => ({
          ...i,
          foodContact: (products[n]!.foodContact as string | null | undefined) ?? null,
        })),
        fulfillmentMethod,
        at: now,
      },
      raw as unknown as TotalsSettings,
    )
  } catch (err) {
    if (err instanceof ShippingError) return fail('shipping', { message: err.message })
    throw err
  }
  const times = reservationTimes(now, raw as never)
  const token = createToken()
  const reservationRef = randomUUID()

  // (3) Eine Transaktion: Kasse anlegen, dann atomar reservieren.
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  let checkoutId: number
  try {
    checkoutId = await inTransaction(req, async () => {
      const created = await payload.create({
        collection: 'checkouts',
        data: {
          tokenHash: hashToken(token),
          status: 'open',
          locale,
          reservationRef,
          items,
          fulfillmentMethod,
          ...(totals.shipping.zone ? { shippingZone: totals.shipping.zone } : {}),
          shippingClass: totals.shipping.shippingClass,
          subtotalCents: totals.subtotalCents,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          expiresAt: times.expiresAt.toISOString(),
          displayExpiresAt: times.displayExpiresAt.toISOString(),
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: req.context,
      })
      const id = created.id as number
      await reserveProducts(await dbFor(req), {
        productIds: ids,
        ref: reservationRef,
        checkoutId: id,
        expiresAt: times.expiresAt,
        displayExpiresAt: times.displayExpiresAt,
        now,
      })
      return id
    })
  } catch (err) {
    if (err instanceof ReservationConflictError) {
      return fail('reserved', { itemNumbers: await itemNumbersOf(payload, err.productIds) })
    }
    throw err
  }

  // (4) Zahlungs-Session nach dem Commit (nie in der Transaktion).
  const payments = deps.payments ?? getPaymentsAdapter()
  let paymentSession = false
  try {
    const env = getEnv()
    const session = await payments.createCheckoutSession({
      checkoutRef: reservationRef,
      sessionSeq: 1,
      locale,
      lineItems: items.map((i) => ({
        productId: i.product,
        name: (locale === 'en' ? i.titleEn : undefined) ?? i.titleDe,
        amountCents: i.priceCents,
      })),
      shipping: {
        label: totals.shipping.label[locale],
        amountCents: totals.shippingCents,
      },
      expiresAt: times.stripeExpiresAt,
      returnUrl: checkoutReturnUrl(env.NEXT_PUBLIC_SITE_URL, locale, token),
      metadata: { checkoutRef: reservationRef, appEnv: env.APP_ENV },
    })
    await payload.update({
      collection: 'checkouts',
      id: checkoutId,
      data: {
        stripe: {
          checkoutSessionId: session.sessionId,
          sessionExpiresAt: session.expiresAt.toISOString(),
          sessionSeq: 1,
          livemode: payments.mode === 'live',
        },
      } as never,
      depth: 0,
      overrideAccess: true,
      context: { system: true, now: now.toISOString() },
    })
    paymentSession = true
  } catch (err) {
    // S13: Kasse bleibt offen, nur Vorkasse. Kein Token im Log.
    log.warn('checkout.payment_session_failed', {
      checkoutId,
      error: (err as Error)?.name,
      message: (err as Error)?.message,
    })
  }

  // (5) Wecker und Cache.
  try {
    await jobAlarm.bump(times.expiresAt)
  } catch (err) {
    log.error('checkout.job_alarm_failed', { checkoutId, error: (err as Error)?.message })
  }
  for (const id of ids) {
    revalidateProduct(id, { immediate: true, inServerAction: deps.inServerAction })
  }

  return {
    ok: true,
    reused: false,
    checkoutId,
    token,
    reservationRef,
    expiresAt: times.expiresAt,
    displayExpiresAt: times.displayExpiresAt,
    paymentSession,
  }
}

// Hinweis auf der Korbseite nach einer Ablehnung (Weiterleitung 303 zurück auf R06, ohne JavaScript bedienbar):
// `?hinweis=reserved&nr=17,23` bzw. `?hinweis=too_many&max=10`. Texte: `cart.notes.<code>` (i18n).

export const CART_NOTICE_PARAM = 'hinweis'
export const CART_NOTICE_ITEMS_PARAM = 'nr'
export const CART_NOTICE_MAX_PARAM = 'max'

export type CartNoticeCode =
  | StartCheckoutCode
  | 'pickup_only'
  | 'rate_limited'
  | 'invalid'
  // Rückweg von der Kasse R07 (307, P4.9): Kasse beendet, Korb geändert (S6), Reservierung abgelaufen, keine Kasse.
  | 'checkout_ended'
  | 'cart_changed'
  | 'expired'
  | 'no_checkout'
export const CART_NOTICE_CODES: readonly CartNoticeCode[] = [
  'shop_closed',
  'empty',
  'too_many',
  'unavailable',
  'reserved',
  'payment_running',
  'shipping',
  'pickup_only',
  'rate_limited',
  'invalid',
  'checkout_ended',
  'cart_changed',
  'expired',
  'no_checkout',
]

export interface CartNotice {
  code: CartNoticeCode
  itemNumbers: number[]
  max: number | null
}

/** Suchteil (`?…`) für die Weiterleitung auf die Korbseite. */
export function cartNoticeSearch(
  code: CartNoticeCode,
  extra: { itemNumbers?: readonly number[]; max?: number } = {},
): string {
  const params = new URLSearchParams({ [CART_NOTICE_PARAM]: code })
  if (extra.itemNumbers?.length) params.set(CART_NOTICE_ITEMS_PARAM, extra.itemNumbers.join(','))
  if (typeof extra.max === 'number') params.set(CART_NOTICE_MAX_PARAM, String(extra.max))
  return `?${params.toString()}`
}

/** Liest den Hinweis tolerant (unbekannt → `null`; nur Nummern 1–99999, höchstens 20). */
export function parseCartNotice(search: URLSearchParams): CartNotice | null {
  const code = search.get(CART_NOTICE_PARAM) as CartNoticeCode | null
  if (!code || !CART_NOTICE_CODES.includes(code)) return null
  const itemNumbers = (search.get(CART_NOTICE_ITEMS_PARAM) ?? '')
    .split(',')
    .filter((s) => /^\d{1,5}$/.test(s))
    .map(Number)
    .filter((n) => n >= 1)
    .slice(0, 20)
  const rawMax = search.get(CART_NOTICE_MAX_PARAM)
  const max = rawMax && /^\d{1,2}$/.test(rawMax) ? Number(rawMax) : null
  return { code, itemNumbers, max }
}
