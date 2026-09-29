import { berlinDateKey } from '@/lib/time'

// Reine Logik der Admin-Komponente „Aktionen“ an der Bestellung (PLAN P4.20): welche Knöpfe je Status, Endpunkt je
// Aktion und Resttage bis zum automatischen Storno (Berliner Kalendertage). Ohne React/Payload, im Unit-Test prüfbar.

export type OrderActionKind = 'prepaymentReceived' | 'cancel' | 'reactivate' | 'refundTransferDone'

export interface OrderActionFacts {
  status: string | null | undefined
  cancelReason?: string | null
  paymentMethod?: string | null
}

export function availableOrderActions(o: OrderActionFacts): OrderActionKind[] {
  if (o.status === 'awaiting_prepayment') return ['prepaymentReceived', 'cancel']
  if (o.status === 'cancelled' && o.cancelReason === 'payment_timeout') {
    return ['reactivate', 'refundTransferDone']
  }
  return []
}

export const ORDER_ACTION_ENDPOINT: Record<
  OrderActionKind,
  { path: string; body?: Record<string, unknown> }
> = {
  prepaymentReceived: { path: 'prepayment-received' },
  cancel: { path: 'cancel' },
  reactivate: { path: 'late-payment', body: { action: 'reactivate' } },
  refundTransferDone: { path: 'late-payment', body: { action: 'refund_transfer_done' } },
}

/** Berliner Kalendertage von heute bis zum Tag der Frist (0 = Frist endet heute, < 0 = abgelaufen). */
export function daysUntilCancel(dueAt: string | Date, now: Date): number {
  const due = new Date(dueAt)
  if (due.getTime() < now.getTime()) return -1
  const a = Date.parse(`${berlinDateKey(now)}T00:00:00Z`)
  const b = Date.parse(`${berlinDateKey(due)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}
