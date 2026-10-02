import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { getEnv } from '@/lib/env'
import type { FulfillmentMethod, Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import { checkoutReturnUrl } from '@/lib/payments/checkoutSession'
import type { Checkout } from '@/payload-types'

import { findCheckoutByToken } from './checkout'
import { transitionCheckout } from './checkoutTransitions'
import { STRIPE_EXPIRY_OFFSET_MINUTES } from './deadlines'
import { ShippingError } from './shipping'
import { computeTotals, type TotalsSettings } from './totals'

// Lieferart der laufenden Kasse wechseln (KONZEPT §4.2/§4.4, DATENMODELL §6.25.1, PLAN P4.10b) und Rückkehr nach einem
// gescheiterten Zahlungsversuch (`reopenCheckout`, S8). Der Wechsel rechnet Versand und Summen neu aus
// `settings.shipping.rates` (die Stückpreise bleiben der Snapshot, S7; neue Tarife wirken nur durch einen Wechsel,
// AK-4-03). Reservierung (`reservationRef`, `expiresAt`) bleibt unverändert. Die Zahlungs-Session bekommt den neuen
// Versand per `updateShipping`; meldet der Adapter `recreate_required`, wird die alte Session beendet und eine neue für
// **dieselbe** Reservierung mit `sessionSeq + 1` angelegt (ARCHITEKTUR §3.5, Spike B-07). Schlägt das fehl, bleibt die
// Kasse ohne Session (nur Vorkasse, S13).

const log = createLogger()

export type ChangeDeliveryCode =
  'not_found' | 'not_open' | 'expired' | 'invalid' | 'pickup_only' | 'shipping'

export type ChangeDeliveryResult =
  | {
      ok: true
      changed: boolean
      fulfillmentMethod: FulfillmentMethod
      shippingCents: number
      totalCents: number
      /** Zahlungs-Session: angepasst, neu angelegt, ohne (S13) oder unverändert. */
      session: 'updated' | 'recreated' | 'none' | 'unchanged'
    }
  | { ok: false; code: ChangeDeliveryCode; message?: string }

export interface ChangeDeliveryDeps {
  payload?: Payload
  payments?: PaymentsAdapter
}

const MINUTE = 60_000

/**
 * Ablauf einer neu angelegten Session: wie bisher, mindestens aber Stripes 30-Minuten-Minimum (+ 1 min wie beim Start).
 * Liegt das über dem Ende der Reservierung, beendet der Ablauf-Job die Session vor der Freigabe (S3).
 */
export function recreatedSessionExpiry(previous: Date | null, now: Date): Date {
  const minimum = now.getTime() + (30 + STRIPE_EXPIRY_OFFSET_MINUTES) * MINUTE
  const at = Math.max(previous?.getTime() ?? 0, minimum)
  return new Date(Math.ceil(at / 1000) * 1000)
}

type Obj = Record<string, unknown>

/** Lieferart der Kasse zum Token wechseln (Ablauf siehe Kopfkommentar). */
export async function changeCheckoutDelivery(
  input: { token: string | null | undefined; method: string; now: Date },
  deps: ChangeDeliveryDeps = {},
): Promise<ChangeDeliveryResult> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const { now } = input
  const checkout = await findCheckoutByToken(payload, input.token)
  if (!checkout) return { ok: false, code: 'not_found' }
  if (checkout.status !== 'open') return { ok: false, code: 'not_open' }
  if (new Date(checkout.expiresAt).getTime() <= now.getTime()) return { ok: false, code: 'expired' }
  if (input.method !== 'shipping' && input.method !== 'pickup')
    return { ok: false, code: 'invalid' }
  const method = input.method as FulfillmentMethod
  if (method === 'shipping' && checkout.items.some((i) => i.shippingClass === 'nur_abholung')) {
    return { ok: false, code: 'pickup_only' }
  }
  if (method === checkout.fulfillmentMethod) {
    return {
      ok: true,
      changed: false,
      fulfillmentMethod: method,
      shippingCents: checkout.shippingCents,
      totalCents: checkout.totalCents,
      session: 'unchanged',
    }
  }

  const locale = checkout.locale as Locale
  const raw = (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
    locale,
  })) as unknown as Obj
  let totals: ReturnType<typeof computeTotals>
  try {
    totals = computeTotals(
      { items: checkout.items, fulfillmentMethod: method, at: now },
      raw as unknown as TotalsSettings,
    )
  } catch (err) {
    if (err instanceof ShippingError) return { ok: false, code: 'shipping', message: err.message }
    throw err
  }

  const checkoutId = checkout.id as number
  const at = now.toISOString()
  const req = await createLocalReq({ context: { system: true, now: at } }, payload)
  const stillOpen = await inTransaction(req, async () => {
    const db = await dbFor(req)
    const locked = await db.execute(
      sql`SELECT status FROM checkouts WHERE id = ${checkoutId} FOR UPDATE`,
    )
    if (locked.rows[0]?.status !== 'open') return false
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'checkouts',
        id: checkoutId,
        data: {
          fulfillmentMethod: method,
          shippingZone: totals.shipping.zone ?? null,
          shippingClass: totals.shipping.shippingClass,
          shippingCents: totals.shippingCents,
          totalCents: totals.subtotalCents + totals.shippingCents,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, now: at },
      }),
    )
    return true
  })
  if (!stillOpen) return { ok: false, code: 'not_open' }

  const shipping = { label: totals.shipping.label[locale], amountCents: totals.shippingCents }
  const session = await syncSession(
    payload,
    checkout,
    input.token as string,
    shipping,
    now,
    deps.payments,
  )
  return {
    ok: true,
    changed: true,
    fulfillmentMethod: method,
    shippingCents: totals.shippingCents,
    totalCents: totals.subtotalCents + totals.shippingCents,
    session,
  }
}

async function saveStripe(payload: Payload, checkoutId: number, stripe: Obj, now: Date) {
  await payload.update({
    collection: 'checkouts',
    id: checkoutId,
    data: { stripe } as never,
    depth: 0,
    overrideAccess: true,
    context: { system: true, now: now.toISOString() },
  })
}

/** Versand der Session anpassen bzw. Session für dieselbe Reservierung neu anlegen (`sessionSeq + 1`). */
async function syncSession(
  payload: Payload,
  checkout: Checkout,
  /** Klartext-Token (nur für die `return_url` einer neuen Session, DATENMODELL §6.25.2). */
  token: string,
  shipping: { label: string; amountCents: number },
  now: Date,
  injected?: PaymentsAdapter,
): Promise<'updated' | 'recreated' | 'none'> {
  const checkoutId = checkout.id as number
  const sessionId = checkout.stripe?.checkoutSessionId
  if (!sessionId) return 'none'
  const payments = injected ?? getPaymentsAdapter()
  try {
    if ((await payments.updateShipping(sessionId, shipping)) === 'updated') return 'updated'
  } catch (err) {
    log.warn('checkout.update_shipping_failed', { checkoutId, error: (err as Error)?.name })
  }

  // recreate_required: alte Session beenden (bezahlt? dann nichts anfassen – der Webhook klärt), neue anlegen.
  const locale = checkout.locale as Locale
  try {
    const ended = await payments.expireCheckoutSession(sessionId)
    if (ended === 'already_complete_paid' || ended === 'already_complete_unpaid') {
      log.warn('checkout.recreate_skipped_paid', { checkoutId, result: ended })
      return 'none'
    }
    const seq = (checkout.stripe?.sessionSeq ?? 1) + 1
    const env = getEnv()
    const previous = checkout.stripe?.sessionExpiresAt
      ? new Date(checkout.stripe.sessionExpiresAt)
      : null
    const handle = await payments.createCheckoutSession({
      checkoutRef: checkout.reservationRef,
      sessionSeq: seq,
      locale,
      lineItems: checkout.items.map((i) => ({
        productId: typeof i.product === 'number' ? i.product : i.product.id,
        name: (locale === 'en' ? i.titleEn : undefined) ?? i.titleDe,
        amountCents: i.priceCents,
      })),
      shipping,
      expiresAt: recreatedSessionExpiry(previous, now),
      returnUrl: checkoutReturnUrl(env.NEXT_PUBLIC_SITE_URL, locale, token),
      metadata: { checkoutRef: checkout.reservationRef, appEnv: env.APP_ENV },
    })
    await saveStripe(
      payload,
      checkoutId,
      {
        checkoutSessionId: handle.sessionId,
        sessionExpiresAt: handle.expiresAt.toISOString(),
        sessionSeq: seq,
        livemode: payments.mode === 'live',
      },
      now,
    )
    return 'recreated'
  } catch (err) {
    log.warn('checkout.recreate_session_failed', { checkoutId, error: (err as Error)?.name })
    await saveStripe(
      payload,
      checkoutId,
      { checkoutSessionId: null, sessionExpiresAt: null, livemode: false },
      now,
    )
    return 'none'
  }
}

export type ReopenCheckoutCode = 'not_found' | 'not_confirming' | 'expired' | 'payment_complete'

/**
 * Zahlungsversuch gescheitert oder abgebrochen (Karte abgelehnt, S8; PayPal zurück, S9): Kasse `confirming → open`,
 * solange die Reservierung gilt und die Session nicht abgeschlossen ist. Reservierung und `expiresAt` bleiben.
 */
export async function reopenCheckout(
  input: { token: string | null | undefined; now: Date },
  deps: ChangeDeliveryDeps = {},
): Promise<{ ok: true; checkoutId: number } | { ok: false; code: ReopenCheckoutCode }> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const checkout = await findCheckoutByToken(payload, input.token)
  if (!checkout) return { ok: false, code: 'not_found' }
  const checkoutId = checkout.id as number
  if (checkout.status !== 'confirming') return { ok: false, code: 'not_confirming' }
  if (new Date(checkout.expiresAt).getTime() <= input.now.getTime()) {
    return { ok: false, code: 'expired' }
  }
  const sessionId = checkout.stripe?.checkoutSessionId
  if (sessionId) {
    const payments = deps.payments ?? getPaymentsAdapter()
    const state = await payments.getCheckoutSession(sessionId)
    if (state.status === 'complete') return { ok: false, code: 'payment_complete' }
  }
  const req = await createLocalReq(
    { context: { system: true, now: input.now.toISOString() } },
    payload,
  )
  await transitionCheckout(req, checkoutId, 'open', { now: input.now })
  return { ok: true, checkoutId }
}
