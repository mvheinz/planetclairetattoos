import 'server-only'

import type { WithdrawalStatus } from '@/lib/enums'

// Statusautomat der Widerrufe (DATENMODELL §6.11, KONZEPT §5.4 W1–W7). Die Zuordnung zu einer Bestellung (W2)
// ändert den Status nicht. Nebenwirkungen (Mails, Bestellung O4/O11/O20) folgen mit den Services in P6.

export const WITHDRAWAL_TRANSITIONS: Readonly<
  Record<WithdrawalStatus, readonly WithdrawalStatus[]>
> = {
  received: ['goods_returned', 'refunded', 'partially_refunded', 'closed', 'rejected'], // W3, W4, W5, W7
  goods_returned: ['refunded', 'partially_refunded', 'closed'], // W4, W5
  partially_refunded: ['refunded', 'closed'], // W6, W5
  refunded: [],
  closed: [],
  rejected: [],
}

/** Zeitstempel je Zielstatus. */
export const WITHDRAWAL_TIMESTAMP_FIELD: Readonly<Partial<Record<WithdrawalStatus, string>>> = {
  goods_returned: 'goodsReturnedAt',
  refunded: 'refundedAt',
  closed: 'closedAt',
  rejected: 'rejectedAt',
}

export function canTransitionWithdrawal(from: WithdrawalStatus, to: WithdrawalStatus): boolean {
  return WITHDRAWAL_TRANSITIONS[from]?.includes(to) ?? false
}
