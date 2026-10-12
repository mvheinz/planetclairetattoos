import 'server-only'

import type { OrderCancelReason, OrderStatus } from '@/lib/enums'

import { TransitionError } from './transitionError'

// Statusautomat der Bestellung (DATENMODELL §6.8.5, KONZEPT §5.3). Die Anlage (O1, O2, O19) läuft über
// createOrderFromCheckout() (P4), nicht über diese Tabelle.

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  awaiting_prepayment: ['paid', 'cancelled'], // O3, O4
  cancelled: ['paid'], // O5: nur cancelReason = payment_timeout
  paid: [
    'packed',
    'shipped',
    'ready_for_pickup',
    'withdrawal_received',
    'refunded',
    'partially_refunded',
    'disputed',
  ], // O6, O7, O8, O11, O15, O16
  packed: ['shipped', 'withdrawal_received', 'refunded', 'partially_refunded', 'disputed'], // O7, O11, O15, O16
  shipped: ['delivered', 'withdrawal_received', 'refunded', 'partially_refunded', 'disputed'], // O10, O11, O15, O16
  delivered: ['withdrawal_received', 'refunded', 'partially_refunded', 'disputed'], // O11, O15, O16
  ready_for_pickup: [
    'picked_up',
    'withdrawal_received',
    'refunded',
    'partially_refunded',
    'disputed',
  ], // O9, O11, O15, O16
  picked_up: ['withdrawal_received', 'refunded', 'partially_refunded', 'disputed'], // O11, O15, O16
  withdrawal_received: ['return_received', 'refunded', 'partially_refunded', 'disputed'], // + O20
  return_received: ['refunded', 'partially_refunded', 'disputed'], // O13, O14, O16
  partially_refunded: ['refunded', 'disputed'], // O21, O16; + O6–O10 Rest-Lieferung (restDeliveryAllowed)
  refunded: [],
  disputed: ['refunded'], // O18; + O17 → statusBeforeDispute
}

/** Anlage-Status mit Übergangs-ID (O1, O2, O19). */
export const ORDER_INITIAL: Readonly<Partial<Record<OrderStatus, OrderTransitionId>>> = {
  paid: 'O1',
  awaiting_prepayment: 'O2',
  refunded: 'O19',
}

export type OrderTransitionId = `O${number}`

/** Zeitstempel je Zielstatus (`timestamps.*`). */
export const ORDER_TIMESTAMP_FIELD: Readonly<Partial<Record<OrderStatus, string>>> = {
  paid: 'paidAt',
  packed: 'packedAt',
  shipped: 'shippedAt',
  delivered: 'deliveredAt',
  ready_for_pickup: 'readyForPickupAt',
  picked_up: 'pickedUpAt',
  withdrawal_received: 'withdrawalReceivedAt',
  return_received: 'returnReceivedAt',
  refunded: 'refundedAt',
  cancelled: 'cancelledAt',
  disputed: 'disputedAt',
}

/** Endstatus für `timestamps.finalStatusAt` (Fristbeginn L-05, LOESCHKONZEPT §3.1). */
export const ORDER_FINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'delivered',
  'picked_up',
  'refunded',
  'cancelled',
])

export interface OrderTransitionFacts {
  statusBeforeDispute?: OrderStatus | null
  statusBeforeWithdrawal?: OrderStatus | null
  cancelReason?: OrderCancelReason | null
  /** Positionen mit `status = active` (Rest-Lieferung aus `partially_refunded`, siehe `restDeliveryAllowed`). */
  activeItemCount?: number | null
  /** Bisherige Liefer-Zeitstempel (`timestamps.*`) – nur für die Rest-Lieferung. */
  shippedAt?: string | null
  deliveredAt?: string | null
  readyForPickupAt?: string | null
  pickedUpAt?: string | null
}

const BEFORE_FULFILMENT_END = new Set<OrderStatus>([
  'paid',
  'packed',
  'shipped',
  'delivered',
  'ready_for_pickup',
  'picked_up',
])

/** Übergangs-ID (O3…O21) eines Tabellen-Übergangs. */
function tableId(from: OrderStatus, to: OrderStatus): OrderTransitionId {
  if (from === 'awaiting_prepayment') return to === 'paid' ? 'O3' : 'O4'
  if (from === 'cancelled') return 'O5'
  if (to === 'packed') return 'O6'
  if (to === 'shipped') return 'O7'
  if (to === 'ready_for_pickup') return 'O8'
  if (to === 'picked_up') return 'O9'
  if (to === 'delivered') return 'O10'
  if (to === 'withdrawal_received') return 'O11'
  if (to === 'return_received') return 'O12'
  if (to === 'disputed') return 'O16'
  if (from === 'disputed') return 'O18'
  if (from === 'partially_refunded') return 'O21'
  if (BEFORE_FULFILMENT_END.has(from)) return 'O15'
  return to === 'refunded' ? 'O13' : 'O14'
}

/**
 * Rest-Lieferung nach einer Teil-Erstattung (Bruch, Kulanz, erstatteter Teil-Widerruf; DATENMODELL §6.8.5
 * Umsetzungsnotiz, KONZEPT §5.3): aus `partially_refunded` gehen O6–O10 wie aus `paid`, `ready_for_pickup` bzw.
 * `shipped` – nur solange noch mindestens eine Position `active` ist und nichts abgeholt wurde. „Gepackt“, „Versendet“
 * und „Bereit zur Abholung“ nur vor Versand und Abholbereitschaft, „Abgeholt“ nur nach „abholbereit“, „Zugestellt“ nur
 * nach dem Versand (Teil-Erstattung während des Transports) und nur einmal.
 */
export function restDeliveryAllowed(to: OrderStatus, facts: OrderTransitionFacts = {}): boolean {
  if ((facts.activeItemCount ?? 0) < 1 || facts.pickedUpAt) return false
  switch (to) {
    case 'packed':
    case 'shipped':
    case 'ready_for_pickup':
      return !facts.shippedAt && !facts.readyForPickupAt
    case 'picked_up':
      return !facts.shippedAt && !!facts.readyForPickupAt
    case 'delivered':
      return !!facts.shippedAt && !facts.deliveredAt
    default:
      return false
  }
}

/** Angaben für `restDeliveryAllowed` aus einer geladenen Bestellung (Positionen und Zeitstempel). */
export function deliveryFacts(order: {
  items?: readonly { status?: string | null }[] | null
  timestamps?: {
    shippedAt?: string | null
    deliveredAt?: string | null
    readyForPickupAt?: string | null
    pickedUpAt?: string | null
  } | null
}): OrderTransitionFacts {
  const t = order.timestamps ?? {}
  return {
    activeItemCount: (order.items ?? []).filter((i) => (i.status ?? 'active') === 'active').length,
    shippedAt: t.shippedAt ?? null,
    deliveredAt: t.deliveredAt ?? null,
    readyForPickupAt: t.readyForPickupAt ?? null,
    pickedUpAt: t.pickedUpAt ?? null,
  }
}

type DeliveryOrder = Parameters<typeof deliveryFacts>[0]

/** Rest-Lieferung (`partially_refunded`) steht noch aus: „Versendet melden“ geht noch („Zu packen“, „Heute“). */
export function restShipmentPending(order: DeliveryOrder): boolean {
  return restDeliveryAllowed('shipped', deliveryFacts(order))
}

/** Rest-Abholung (`partially_refunded`) steht noch aus: „Bereit zur Abholung“ bzw. „Abgeholt“ („Abholung“, „Heute“). */
export function restPickupPending(order: DeliveryOrder): boolean {
  const facts = deliveryFacts(order)
  return restDeliveryAllowed('ready_for_pickup', facts) || restDeliveryAllowed('picked_up', facts)
}

/**
 * Übergangs-ID für `from → to` oder eine deutsche Begründung, warum der Wechsel nicht erlaubt ist. O17 (Anfechtung
 * gewonnen) und O20 (Widerruf ohne Erstattung) springen auf den gemerkten Vorstatus zurück; aus `partially_refunded`
 * gehen O6–O10 unter den Bedingungen von `restDeliveryAllowed`.
 */
export function evaluateOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  facts: OrderTransitionFacts = {},
): { ok: true; id: OrderTransitionId } | { ok: false; message: string } {
  if (ORDER_TRANSITIONS[from]?.includes(to)) {
    if (from === 'cancelled' && facts.cancelReason !== 'payment_timeout') {
      return {
        ok: false,
        message:
          '„Nachträglich bezahlt“ geht nur bei Bestellungen, die wegen abgelaufener Zahlungsfrist storniert wurden.',
      }
    }
    return { ok: true, id: tableId(from, to) }
  }
  if (from === 'partially_refunded' && restDeliveryAllowed(to, facts)) {
    return { ok: true, id: tableId(from, to) }
  }
  if (from === 'disputed' && facts.statusBeforeDispute && to === facts.statusBeforeDispute) {
    return { ok: true, id: 'O17' }
  }
  if (
    from === 'withdrawal_received' &&
    facts.statusBeforeWithdrawal &&
    to === facts.statusBeforeWithdrawal
  ) {
    return { ok: true, id: 'O20' }
  }
  return { ok: false, message: `Die Bestellung kann nicht von „${from}“ nach „${to}“ wechseln.` }
}

/** Wirft `TransitionError`, wenn `from → to` nicht erlaubt ist; liefert sonst die Übergangs-ID. */
export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  facts: OrderTransitionFacts = {},
): OrderTransitionId {
  const result = evaluateOrderTransition(from, to, facts)
  if (!result.ok) throw new TransitionError(result.message)
  return result.id
}
