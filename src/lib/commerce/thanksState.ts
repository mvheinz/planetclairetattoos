import 'server-only'

import config from '@payload-config'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { createLogger } from '@/lib/monitoring/logger'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import { hashToken, matchesHash, TOKEN_RE } from '@/lib/security/tokens'
import type { Checkout, Order } from '@/payload-types'

import { findCheckoutByToken } from './checkout'
import { transitionCheckout } from './checkoutTransitions'
import { confirmedPaymentFromSession, fulfillCheckout } from './fulfillCheckout'

// Zustand der Danke-Seite R08 und des Endpunkts `GET /api/checkout/[token]/state` (KONZEPT §4.12, §4.10 Rückfall 2,
// PLAN P4.17). Der Token wird zuerst gegen `checkouts.tokenHash`, dann gegen `orders.statusTokenHash` geprüft
// (ARCHITEKTUR §8.6); gesucht wird über den Hash, bestätigt in konstanter Zeit. Bei einer Kasse `confirming` ohne
// Bestellung fragt die Funktion höchstens einmal je Aufruf beim Zahlungsanbieter nach: bezahlt → `fulfillCheckout`
// (Rückfall 2); Session `open` → Kasse `confirming → open` („nicht bezahlt“, S9); sonst „wartet“ (S10). Klartext-Token
// nie loggen.

const log = createLogger()

/** Zustandscodes (Antwort des Endpunkts, keine Personendaten). */
export const THANKS_CODES = ['waiting', 'paid', 'prepayment', 'gone', 'unpaid'] as const
export type ThanksCode = (typeof THANKS_CODES)[number]

export type ThanksState =
  | {
      code: 'waiting' | 'unpaid'
      via: 'checkout'
      checkout: Checkout
      /** „Zurück zur Kasse“ nur bei Kasse `open` mit gültiger Reservierung, sonst „Zum Korb“. */
      backToCheckout: boolean
    }
  | {
      code: 'paid' | 'prepayment' | 'gone'
      via: 'checkout' | 'order'
      order: Order
      checkout: Checkout | null
    }

export interface ThanksDeps {
  payload?: Payload
  payments?: PaymentsAdapter
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

/** Bestellung → Zustand: Vorkasse offen, „leider schon weg“ (O19) oder bezahlt/später. */
export function orderThanksCode(order: Pick<Order, 'status' | 'statusHistory'>): ThanksCode {
  if (order.status === 'awaiting_prepayment') return 'prepayment'
  if (
    order.status === 'refunded' &&
    (order.statusHistory ?? []).some((h) => h.transition === 'O19')
  )
    return 'gone'
  return 'paid'
}

async function loadOrder(payload: Payload, id: number): Promise<Order | null> {
  return (await payload.findByID({
    collection: 'orders',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as Order | null
}

/** Bestellung zum Status-Token (Hash-Suche, Bestätigung in konstanter Zeit) oder `null`. */
export async function findOrderByStatusToken(
  payload: Payload,
  token: string | null | undefined,
): Promise<Order | null> {
  if (!token || !TOKEN_RE.test(token)) return null
  const res = await payload.find({
    collection: 'orders',
    where: { statusTokenHash: { equals: hashToken(token) } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const order = (res.docs[0] as Order | undefined) ?? null
  return order && matchesHash(token, order.statusTokenHash) ? order : null
}

const reservationValid = (checkout: Checkout, now: Date) =>
  checkout.status === 'open' && new Date(checkout.expiresAt).getTime() > now.getTime()

const fromOrder = (
  order: Order,
  via: 'checkout' | 'order',
  checkout: Checkout | null,
): ThanksState => ({
  code: orderThanksCode(order) as 'paid' | 'prepayment' | 'gone',
  via,
  order,
  checkout,
})

/** Kasse `confirming` ohne Bestellung: höchstens eine Anbieter-Abfrage (Rückfall 2 bzw. S9/S10). */
async function reconcile(
  payload: Payload,
  payments: PaymentsAdapter,
  checkout: Checkout,
  now: Date,
): Promise<ThanksState> {
  const waiting: ThanksState = { code: 'waiting', via: 'checkout', checkout, backToCheckout: false }
  const sessionId = checkout.stripe?.checkoutSessionId
  if (!sessionId) return waiting
  try {
    const state = await payments.getCheckoutSession(sessionId)
    if (state.status === 'complete' && state.paymentStatus === 'paid') {
      const req = await createLocalReq(
        { context: { system: true, now: now.toISOString() } },
        payload,
      )
      const result = await fulfillCheckout(checkout.id, req, {
        now,
        payment: confirmedPaymentFromSession(state, {
          driver: payments.driver,
          livemode: payments.mode === 'live',
          paidAt: now,
        }),
      })
      await result.afterCommit()
      const fresh = await reload(payload, checkout.id)
      const orderId = idOf(fresh?.order) ?? result.orderId
      const order = orderId === null ? null : await loadOrder(payload, orderId)
      return order ? fromOrder(order, 'checkout', fresh) : waiting
    }
    if (state.status === 'open') {
      const req = await createLocalReq(
        { context: { system: true, now: now.toISOString() } },
        payload,
      )
      const reopened = await transitionCheckout(req, checkout.id, 'open', { now })
      return {
        code: 'unpaid',
        via: 'checkout',
        checkout: reopened,
        backToCheckout: reservationValid(reopened, now),
      }
    }
  } catch (err) {
    // Anbieter nicht erreichbar oder Übergang zwischenzeitlich erledigt: weiter warten, der Job gleicht ab (S10).
    log.warn('thanks.reconcile_failed', {
      checkoutId: checkout.id,
      error: (err as Error)?.message,
    })
  }
  return waiting
}

async function reload(payload: Payload, id: number): Promise<Checkout | null> {
  return (await payload.findByID({
    collection: 'checkouts',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as Checkout | null
}

/**
 * Zustand zur Danke-URL (Kassen- oder Status-Token) bzw. `null` (unbekannt → 404; auch nach dem Löschen der Kasse nach
 * 30 Tagen mit dem Kassen-Token, L-03).
 */
export async function getThanksState(
  token: string,
  now: Date,
  deps: ThanksDeps = {},
): Promise<ThanksState | null> {
  if (!TOKEN_RE.test(token)) return null
  const payload = deps.payload ?? (await getPayload({ config }))
  const checkout = await findCheckoutByToken(payload, token)
  if (checkout && matchesHash(token, checkout.tokenHash)) {
    const orderId = idOf(checkout.order)
    if (orderId !== null) {
      const order = await loadOrder(payload, orderId)
      if (order) return fromOrder(order, 'checkout', checkout)
    }
    switch (checkout.status) {
      case 'confirming':
        return reconcile(payload, deps.payments ?? getPaymentsAdapter(), checkout, now)
      case 'open':
      case 'failed':
      case 'expired':
      case 'cancelled':
        return {
          code: 'unpaid',
          via: 'checkout',
          checkout,
          backToCheckout: reservationValid(checkout, now),
        }
      default:
        return { code: 'waiting', via: 'checkout', checkout, backToCheckout: false }
    }
  }
  const order = await findOrderByStatusToken(payload, token)
  return order ? fromOrder(order, 'order', null) : null
}

/**
 * Gibt es zur Danke-URL schon eine Bestellung? Dann löscht die Seite `pc_cart` und `pc_checkout` (KONZEPT §4.12). Ohne
 * Anbieter-Abfrage und ohne Zustandswechsel.
 */
export async function thanksTokenHasOrder(token: string, deps: ThanksDeps = {}): Promise<boolean> {
  if (!TOKEN_RE.test(token)) return false
  const payload = deps.payload ?? (await getPayload({ config }))
  const checkout = await findCheckoutByToken(payload, token)
  if (checkout && matchesHash(token, checkout.tokenHash)) return idOf(checkout.order) !== null
  return (await findOrderByStatusToken(payload, token)) !== null
}
