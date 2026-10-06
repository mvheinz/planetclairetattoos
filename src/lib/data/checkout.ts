import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import { reopenCheckout } from '@/lib/commerce/changeDelivery'
import { findCheckoutByToken, type CartNoticeCode } from '@/lib/commerce/checkout'
import { prepaymentDeadlines } from '@/lib/commerce/deadlines'
import { ShippingError } from '@/lib/commerce/shipping'
import { paymentOptionsFor, type CheckoutPaymentOptions } from '@/lib/commerce/submitCheckout'
import { computeTotals, type TotalsSettings } from '@/lib/commerce/totals'
import { getEnv } from '@/lib/env'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { pickPublicSettings } from '@/lib/payload/public'
import { getPaymentsAdapter } from '@/lib/payments'
import { pickShopDisplaySettings, type ShopDisplaySettings } from '@/lib/shop/displaySettings'
import type { Checkout, Media } from '@/payload-types'

import { getCartMedia } from './cart'
import { dbGate } from '@/lib/db/buildGate'

// Daten der Kasse R07 (KONZEPT §4.4–§4.7, PLAN P4.9): Kasse zum Token aus `pc_checkout` (Hash-Suche), Einstellungen,
// Zahlwege, Fotos, Versandpreise beider Lieferarten und – nur mit `PAYMENTS_DRIVER=stripe` – das Client-Secret der
// Session (bei jedem Laden frisch vom Anbieter, nie gespeichert). Eine Kasse in `confirming`, deren Session noch offen
// ist, kehrt beim Laden auf `open` zurück (Zahlung abgebrochen/abgelehnt, S8/S9). Beendete Kassen führen zurück in
// den Korb (307 mit Hinweis). Ungecacht (dynamische Seite).

const log = createLogger()

export type CheckoutPageData =
  | { state: 'redirect'; notice: CartNoticeCode }
  | {
      state: 'ok'
      checkout: Checkout
      /** Eine Zahlung läuft noch (Session abgeschlossen, Ergebnis ausstehend) – Bestellen gesperrt. */
      paymentRunning: boolean
      /** Reservierung (Countdown) schon abgelaufen. */
      expired: boolean
      settings: Record<string, unknown>
      display: ShopDisplaySettings
      studioDistrict: string
      options: CheckoutPaymentOptions
      /** Versandpreis je Lieferart (null = nicht berechenbar bzw. nicht wählbar). */
      quotes: { shipping: number | null; pickup: number }
      /** Zahlungsfrist, falls jetzt per Vorkasse bestellt wird. */
      prepaymentDueAt: Date | null
      media: Map<number, Media>
      imageOf: Map<number, number>
      payment:
        | { driver: 'mock' }
        | { driver: 'stripe'; clientSecret: string; publishableKey: string }
        | { driver: 'preview' }
        | { driver: 'none' }
    }

const idOf = (v: unknown): number =>
  typeof v === 'object' && v !== null ? (v as { id: number }).id : (v as number)

export async function loadCheckoutPage(input: {
  token: string | null | undefined
  locale: Locale
  now: Date
}): Promise<CheckoutPageData> {
  const payload = (await dbGate(), await getPayload({ config }))
  const { now } = input
  let checkout = await findCheckoutByToken(payload, input.token)
  if (!checkout) return { state: 'redirect', notice: 'no_checkout' }
  if (checkout.status === 'expired') return { state: 'redirect', notice: 'expired' }
  if (checkout.status === 'cancelled') {
    return {
      state: 'redirect',
      notice: checkout.closeReason === 'cart_changed' ? 'cart_changed' : 'checkout_ended',
    }
  }
  if (checkout.status === 'completed' || checkout.status === 'failed') {
    return { state: 'redirect', notice: 'checkout_ended' }
  }

  const env = getEnv()
  const payments = getPaymentsAdapter()
  const sessionId = checkout.stripe?.checkoutSessionId ?? null
  let sessionState: Awaited<ReturnType<typeof payments.getCheckoutSession>> | null = null
  if (sessionId) {
    try {
      sessionState = await payments.getCheckoutSession(sessionId)
    } catch (err) {
      log.warn('checkout.session_state_failed', {
        checkoutId: checkout.id,
        error: (err as Error)?.name,
      })
    }
  }
  let paymentRunning = false
  if (checkout.status === 'confirming') {
    if (sessionState && sessionState.status === 'open') {
      // Zurück von einer abgebrochenen oder abgelehnten Zahlung: Kasse wieder offen, Reservierung läuft weiter.
      const reopened = await reopenCheckout({ token: input.token, now }, { payload, payments })
      if (reopened.ok) checkout = (await findCheckoutByToken(payload, input.token)) ?? checkout
      else paymentRunning = true
    } else {
      paymentRunning = true
    }
  }

  const settings = (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
    locale: input.locale,
  })) as unknown as Record<string, unknown>
  const display = pickShopDisplaySettings(pickPublicSettings(settings, now))
  const district = (settings.tattoo as { studioDistrict?: string | null } | undefined)
    ?.studioDistrict
  const options = paymentOptionsFor(checkout, settings as never)

  const quote = (method: 'shipping' | 'pickup'): number | null => {
    try {
      return computeTotals(
        { items: checkout!.items, fulfillmentMethod: method, at: now },
        settings as unknown as TotalsSettings,
      ).shippingCents
    } catch (err) {
      if (err instanceof ShippingError) return null
      throw err
    }
  }
  const pickupOnly = checkout.items.some((i) => i.shippingClass === 'nur_abholung')
  const quotes = {
    shipping: pickupOnly
      ? null
      : checkout.fulfillmentMethod === 'shipping'
        ? checkout.shippingCents
        : quote('shipping'),
    pickup: 0,
  }

  let prepaymentDueAt: Date | null = null
  if (options.prepaymentEnabled) {
    try {
      prepaymentDueAt = prepaymentDeadlines(now, settings as never).dueAt
    } catch {
      prepaymentDueAt = null
    }
  }

  // Erstes Foto je Stück (öffentliche Medien).
  const productIds = checkout.items.map((i) => idOf(i.product))
  const products = await payload.find({
    collection: 'products',
    where: { id: { in: productIds } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { images: true },
  })
  const imageOf = new Map<number, number>()
  for (const p of products.docs as { id: number; images?: unknown[] | null }[]) {
    const first = p.images?.[0]
    if (first !== undefined && first !== null) imageOf.set(p.id, idOf(first))
  }
  const media = await getCartMedia([...imageOf.values()])

  let payment: Extract<CheckoutPageData, { state: 'ok' }>['payment'] = { driver: 'none' }
  if (env.PREVIEW_EXPORT) payment = { driver: 'preview' }
  else if (sessionId && options.choices.includes('stripe')) {
    if (payments.driver === 'mock') payment = { driver: 'mock' }
    else if (sessionState?.status === 'open' && sessionState.clientSecret) {
      payment = {
        driver: 'stripe',
        clientSecret: sessionState.clientSecret,
        publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
      }
    }
  }
  // Ohne erreichbare Session nur Vorkasse (S13).
  const choices = options.choices.filter((c) => c !== 'stripe' || payment.driver !== 'none')

  return {
    state: 'ok',
    checkout,
    paymentRunning,
    expired: new Date(checkout.displayExpiresAt).getTime() <= now.getTime(),
    settings,
    display,
    studioDistrict: district?.trim() || '[Bezirk folgt]',
    options: { ...options, choices },
    quotes,
    prepaymentDueAt,
    media,
    imageOf,
    payment,
  }
}

/**
 * Laufende Kasse dieser Person für den Countdown im Korb (KO-13, V-17): nur `open`/`confirming` mit aktiver
 * Reservierung (`expiresAt > now`) und laufendem Countdown; Zeitbasis `displayExpiresAt` derselben Kasse.
 */
export async function activeCheckoutCountdown(
  token: string | null | undefined,
  now: Date,
): Promise<{ displayExpiresAt: Date } | null> {
  if (!token) return null
  try {
    const payload = (await dbGate(), await getPayload({ config }))
    const checkout = await findCheckoutByToken(payload, token)
    if (!checkout || (checkout.status !== 'open' && checkout.status !== 'confirming')) return null
    if (new Date(checkout.expiresAt).getTime() <= now.getTime()) return null
    // Nach Ablauf des Countdowns zeigt der Korb keinen mehr (V-17).
    if (new Date(checkout.displayExpiresAt).getTime() <= now.getTime()) return null
    return { displayExpiresAt: new Date(checkout.displayExpiresAt) }
  } catch (err) {
    log.warn('cart.countdown_failed', { reason: (err as Error).message })
    return null
  }
}
