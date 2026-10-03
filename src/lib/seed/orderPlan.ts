import 'server-only'

import { prepaymentDeadlines, type DeadlineSettings } from '@/lib/commerce/deadlines'
import {
  evaluateOrderTransition,
  ORDER_FINAL_STATUSES,
  type OrderTransitionId,
} from '@/lib/commerce/orderTransitions'
import type { ActorType, OrderStatus, ReservationReleaseReason } from '@/lib/enums'
import {
  isDue,
  L_02_RESERVATIONS,
  L_03_CHECKOUTS,
  L_05_ORDERS_STAGE_D,
  L_05_SHIPPED_FINAL_STATUS_FALLBACK,
  retainUntil,
} from '@/lib/retention/policy'

import type { OrderSeed, OrderTimelineKey } from './schemas'
import { resolveSeedDate } from './time'

// Reine Ableitungen einer Beispiel-Bestellung (SEED-SPEC §7, §8; ohne Datenbank, damit Unit-Tests sie direkt auf den
// Datendateien prüfen): Statusverlauf aus der Zeitleiste über denselben Statusautomaten wie die Verwaltung
// (`evaluateOrderTransition`), Fristen (Vorkasse aus `prepaymentDeadlines`), `finalStatusAt`/`retainUntil` wie der
// Hook der Bestellung, die Kasse (T0 = placedAt − 4 min, DATENMODELL §8.1) und die Reservierungen – nur, was bei `N`
// nach den Löschfristen L-02/L-03 noch existiert (SE-12).

const MIN = 60_000

export interface HistoryEntry {
  from: OrderStatus | null
  to: OrderStatus
  at: Date
  actorType: ActorType
  transition: OrderTransitionId
}

export interface OrderPlan {
  key: string
  history: HistoryEntry[]
  timestamps: Partial<Record<OrderTimelineKey | 'finalStatusAt', Date>>
  /** Erstellungszeit der Bestellung (O1 = Zahlung, O2 = Absenden). */
  createdAt: Date
  statusBeforeDispute: OrderStatus | null
  statusBeforeWithdrawal: OrderStatus | null
  retainUntil: Date | null
  prepayment: { dueAt: Date; reminderDueAt: Date } | null
  checkout: CheckoutPlan | null
  reservation: ReservationPlan | null
}

export interface CheckoutPlan {
  key: string
  createdAt: Date
  displayExpiresAt: Date
  sessionExpiresAt: Date
  expiresAt: Date
  submittedAt: Date
  confirmingAt: Date | null
  completedAt: Date
}

export interface ReservationPlan {
  key: string
  source: 'checkout_session' | 'prepayment'
  status: 'active' | 'converted' | 'released'
  createdAt: Date
  expiresAt: Date
  displayExpiresAt: Date | null
  convertedAt: Date | null
  releasedAt: Date | null
  releaseReason: ReservationReleaseReason | null
}

/** Reihenfolge der Schritte nach der Zahlung; `refundedAt` endet in `refunded` bzw. `partially_refunded`. */
const STEPS: readonly [OrderTimelineKey, OrderStatus | 'refund'][] = [
  ['packedAt', 'packed'],
  ['shippedAt', 'shipped'],
  ['deliveredAt', 'delivered'],
  ['readyForPickupAt', 'ready_for_pickup'],
  ['pickedUpAt', 'picked_up'],
  ['withdrawalReceivedAt', 'withdrawal_received'],
  ['returnReceivedAt', 'return_received'],
  ['refundedAt', 'refund'],
  ['cancelledAt', 'cancelled'],
  ['disputedAt', 'disputed'],
]

/** `checkouts.reservationRef` = `reservations.ref` (SEED-SPEC §2.5): O07 → …-000000090007, KS1 → …-000000090101. */
export function seedReservationRef(checkoutKey: string): string {
  const m = /^(?:O(\d{2})|KS(\d))$/.exec(checkoutKey)
  if (!m) throw new Error(`Kein Kassen-Schlüssel: ${checkoutKey}`)
  const n = m[1] ? 90000 + Number(m[1]) : 90100 + Number(m[2])
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

/** Mock-/Stripe-IDs der Beispiel-Bestellung (SEED-SPEC §2.5). */
export function seedStripeIds(orderNumber: string) {
  const nn = orderNumber.slice(-5)
  return {
    checkoutSessionId: `cs_seed_${nn}`,
    paymentIntentId: `pi_seed_${nn}`,
    chargeId: `ch_seed_${nn}`,
    refundId: (k: number) => `re_seed_${nn}_${k}`,
  }
}

/** Auslöser je Übergang (SEED-SPEC §7.1): Webhook bei O1/O16, Job bei O4 und O10 mit `auto`, Kund:in bei O2. */
function actorFor(id: OrderTransitionId, order: OrderSeed): ActorType {
  if (id === 'O1' || id === 'O16') return 'webhook'
  if (id === 'O4') return 'job'
  if (id === 'O10' && order.shipment?.deliveredSource === 'auto') return 'job'
  if (id === 'O2') return 'customer'
  return 'admin'
}

export function planOrder(
  order: OrderSeed,
  now: Date,
  settings: DeadlineSettings | null | undefined,
): OrderPlan {
  const at = (k: OrderTimelineKey) => {
    const expr = order.timeline[k]
    return expr ? resolveSeedDate(expr, now) : null
  }
  const placedAt = at('placedAt')!
  const paidAt = at('paidAt')
  const prepaid = order.payment.method === 'prepayment'
  const history: HistoryEntry[] = []
  let current: OrderStatus | null = null
  let statusBeforeDispute: OrderStatus | null = null
  let statusBeforeWithdrawal: OrderStatus | null = null
  const push = (to: OrderStatus, when: Date, initial?: OrderTransitionId) => {
    let id: OrderTransitionId
    if (initial) id = initial
    else {
      const res = evaluateOrderTransition(current!, to, {
        statusBeforeDispute,
        statusBeforeWithdrawal,
        cancelReason: order.cancelReason ?? null,
      })
      if (!res.ok) throw new Error(`${order.key}: ${res.message}`)
      id = res.id
    }
    const last = history.at(-1)
    if (last && when.getTime() < last.at.getTime()) {
      throw new Error(`${order.key}: Zeitleiste nicht monoton (${to} vor ${last.to})`)
    }
    if (to === 'disputed') statusBeforeDispute = current
    if (to === 'withdrawal_received') statusBeforeWithdrawal = current
    history.push({ from: current, to, at: when, actorType: actorFor(id, order), transition: id })
    current = to
  }

  if (prepaid) {
    push('awaiting_prepayment', placedAt, 'O2')
    if (paidAt) push('paid', paidAt)
  } else {
    if (!paidAt) throw new Error(`${order.key}: Online-Zahlung ohne paidAt`)
    push('paid', paidAt, 'O1')
  }
  for (const [k, status] of STEPS) {
    const when = at(k)
    if (!when) continue
    const to: OrderStatus =
      status === 'refund'
        ? order.status === 'partially_refunded'
          ? 'partially_refunded'
          : 'refunded'
        : status
    push(to, when)
  }
  if (current !== order.status) {
    throw new Error(`${order.key}: Zeitleiste endet in ${current}, erwartet ${order.status}`)
  }

  // finalStatusAt/retainUntil wie der Hook der Bestellung (stampStatus, DATENMODELL §6.8.3 Nr. 5)
  const timestamps: OrderPlan['timestamps'] = {}
  for (const [k] of [['placedAt'], ['paidAt'], ...STEPS] as [OrderTimelineKey][]) {
    const when = at(k)
    if (when) timestamps[k] = when
  }
  let keepUntil: Date | null = null
  for (const h of history) {
    let final: Date | null = null
    if (ORDER_FINAL_STATUSES.has(h.to)) final = h.at
    else if (h.to === 'shipped') final = retainUntil(L_05_SHIPPED_FINAL_STATUS_FALLBACK, h.at)
    if (final) {
      timestamps.finalStatusAt = final
      keepUntil = retainUntil(L_05_ORDERS_STAGE_D, final)
    }
  }

  const prepayment = prepaid ? prepaymentDeadlines(placedAt, settings) : null

  // Kasse (§7.3): T0 = placedAt − 4 min; nur, wenn sie bei N noch existiert (L-03)
  const t0 = new Date(placedAt.getTime() - 4 * MIN)
  const checkout: CheckoutPlan | null = isDue(L_03_CHECKOUTS, t0, now)
    ? null
    : {
        key: order.key,
        createdAt: t0,
        displayExpiresAt: new Date(t0.getTime() + 30 * MIN),
        sessionExpiresAt: new Date(t0.getTime() + 31 * MIN),
        expiresAt: new Date(t0.getTime() + 36 * MIN),
        submittedAt: placedAt,
        confirmingAt: prepaid ? null : placedAt,
        completedAt: prepaid ? placedAt : paidAt!,
      }

  // Reservierung (§8): Kasse → `checkout_session` bis T0 + 36 min, Vorkasse → `prepayment` bis `dueAt`
  let reservation: ReservationPlan | null = null
  if (checkout) {
    const cancelledAt = at('cancelledAt')
    const r: ReservationPlan = prepaid
      ? {
          key: order.key,
          source: 'prepayment',
          status: paidAt ? 'converted' : cancelledAt ? 'released' : 'active',
          createdAt: t0,
          expiresAt: prepayment!.dueAt,
          displayExpiresAt: null,
          convertedAt: paidAt,
          releasedAt: paidAt ? null : cancelledAt,
          releaseReason: !paidAt && cancelledAt ? 'prepayment_overdue' : null,
        }
      : {
          key: order.key,
          source: 'checkout_session',
          status: 'converted',
          createdAt: t0,
          expiresAt: checkout.expiresAt,
          displayExpiresAt: checkout.displayExpiresAt,
          convertedAt: paidAt,
          releasedAt: null,
          releaseReason: null,
        }
    const ended = r.convertedAt ?? r.releasedAt
    reservation =
      r.status === 'active' || (ended && !isDue(L_02_RESERVATIONS, ended, now)) ? r : null
  }

  return {
    key: order.key,
    history,
    timestamps,
    createdAt: history[0]!.at,
    statusBeforeDispute,
    statusBeforeWithdrawal,
    retainUntil: keepUntil,
    prepayment,
    checkout,
    reservation,
  }
}

/** Reservierung einer Kasse ohne Bestellung bleibt nur, solange sie bei `N` noch existieren würde (L-02). */
export function keepReservation(
  r: { status: string; convertedAt?: Date | null; releasedAt?: Date | null },
  now: Date,
): boolean {
  const ended = r.convertedAt ?? r.releasedAt
  return r.status === 'active' || (!!ended && !isDue(L_02_RESERVATIONS, ended, now))
}

/** Kasse ohne Bestellung bleibt nur bis 30 Tage nach der Anlage (L-03). */
export function keepCheckout(createdAt: Date, now: Date): boolean {
  return !isDue(L_03_CHECKOUTS, createdAt, now)
}
