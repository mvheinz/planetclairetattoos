import 'server-only'

import type { CheckoutStatus } from '@/lib/enums'

import { TransitionError } from './transitionError'

// Statusautomat der Kasse (DATENMODELL §6.25.3, KONZEPT §5.2). Die Services mit Nebenwirkungen (`startCheckout`,
// `submitCheckout`, `fulfillCheckout`) folgen in P4/P5; hier nur die Tabelle und die Prüfung.

/** Erlaubte Übergänge; alle anderen werden abgelehnt. Anlage immer mit `open`. */
export const CHECKOUT_TRANSITIONS: Readonly<Record<CheckoutStatus, readonly CheckoutStatus[]>> = {
  open: ['confirming', 'completed', 'expired', 'cancelled'],
  confirming: ['open', 'completed', 'expired', 'failed'],
  completed: [],
  expired: [],
  cancelled: [],
  failed: [],
}

export const CHECKOUT_INITIAL_STATUS: CheckoutStatus = 'open'

/** Zeitstempel je Zielstatus (`timestamps.*`). */
export const CHECKOUT_TIMESTAMP_FIELD: Readonly<Partial<Record<CheckoutStatus, string>>> = {
  confirming: 'confirmingAt',
  completed: 'completedAt',
  expired: 'expiredAt',
  cancelled: 'cancelledAt',
  failed: 'failedAt',
}

/** Zielstatus, bei denen `closeReason` Pflicht ist. */
export const CHECKOUT_CLOSE_REASON_REQUIRED: ReadonlySet<CheckoutStatus> = new Set([
  'expired',
  'cancelled',
  'failed',
])

export function canTransitionCheckout(from: CheckoutStatus, to: CheckoutStatus): boolean {
  return CHECKOUT_TRANSITIONS[from]?.includes(to) ?? false
}

/** Wirft `TransitionError`, wenn `from → to` nicht erlaubt ist. */
export function assertCheckoutTransition(from: CheckoutStatus, to: CheckoutStatus): void {
  if (!canTransitionCheckout(from, to)) {
    throw new TransitionError(`Die Kasse kann nicht von „${from}“ nach „${to}“ wechseln.`)
  }
}
