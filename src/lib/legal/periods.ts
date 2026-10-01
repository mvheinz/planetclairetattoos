import 'server-only'

import { addBerlinDays, berlinDayStart } from '@/lib/time'

// Fristen ab Erhalt der Ware (PLAN P5.17, RECHT R-083/R-094/R-102, § 356 Abs. 2 Nr. 1 BGB): Zustellung
// (`timestamps.deliveredAt`) bzw. bei Abholung die Übergabe (`timestamps.pickedUpAt`). Widerrufsfrist: 14 Tage, Ende des
// Berliner Tages. Grundlage des virtuellen Felds `withdrawalDeadline` (P6) und des Gewährleistungsbeginns.

export const WITHDRAWAL_PERIOD_DAYS = 14

export interface ReceiptTimes {
  fulfillmentMethod?: string | null
  timestamps?: { deliveredAt?: string | null; pickedUpAt?: string | null } | null
}

const toDate = (v: string | null | undefined): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Erhalt der Ware: Übergabe bei Abholung, sonst Zustellung; `null`, solange noch nicht erhalten. */
export function goodsReceivedAt(order: ReceiptTimes): Date | null {
  const ts = order.timestamps ?? {}
  return order.fulfillmentMethod === 'pickup' ? toDate(ts.pickedUpAt) : toDate(ts.deliveredAt)
}

/** Beginn der Gewährleistung (R-102): Erhalt der Ware. */
export function warrantyStart(order: ReceiptTimes): Date | null {
  return goodsReceivedAt(order)
}

/** Ende der Widerrufsfrist: Erhalt + 14 Tage, 23:59:59.999 Berliner Zeit; `null` ohne Erhalt. */
export function withdrawalPeriodEnd(order: ReceiptTimes): Date | null {
  const received = goodsReceivedAt(order)
  if (!received) return null
  const nextDay = addBerlinDays(berlinDayStart(received), WITHDRAWAL_PERIOD_DAYS + 1)
  return new Date(nextDay.getTime() - 1)
}
