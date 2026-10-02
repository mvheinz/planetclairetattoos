import 'server-only'

import type { PayloadRequest } from 'payload'

import type { ComplaintKind, ComplaintRemedy } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { addBerlinDays, addBerlinMonths } from '@/lib/time'

// Fristen einer Reklamation (DATENMODELL §6.29, R-100, R-110, R-111):
// - `carrierClaimDueAt` (nur Transportschaden): Zustellung (`order.timestamps.deliveredAt`, sonst Eingang der
//   Reklamation) + 7 Tage – bis dahin bei DHL reklamieren (§ 438 HGB).
// - `warrantyEndsAt`: Zustellung bzw. Abholung + 2 Jahre; + 12 Monate, wenn die Kund:in Reparatur gewählt hat.
// Dieselbe Regel speist das virtuelle Feld `orders.warrantyEndsAt` (§6.8.1).

/** Frist für die Reklamation beim Versanddienst (Tage ab Zustellung). */
export const CARRIER_CLAIM_DAYS = 7
/** Gesetzliche Gewährleistung (Monate ab Übergabe, § 438 Abs. 1 Nr. 3 BGB). */
export const WARRANTY_MONTHS = 24
/** Verlängerung nach gewählter Reparatur (R-111). */
export const REPAIR_EXTENSION_MONTHS = 12

const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

export interface OrderHandover {
  deliveredAt?: string | Date | null
  pickedUpAt?: string | Date | null
}

/** Übergabe an die Kund:in: Zustellung, sonst Abholung. */
export function handoverAt(ts: OrderHandover | null | undefined): Date | null {
  return toDate(ts?.deliveredAt) ?? toDate(ts?.pickedUpAt)
}

/** Ende der Gewährleistung (ohne Übergabe `null`). */
export function warrantyEndsAt(
  ts: OrderHandover | null | undefined,
  repairChosen: boolean,
): Date | null {
  const base = handoverAt(ts)
  if (!base) return null
  return addBerlinMonths(base, WARRANTY_MONTHS + (repairChosen ? REPAIR_EXTENSION_MONTHS : 0))
}

export interface ComplaintDeadlineInput {
  kind: ComplaintKind
  receivedAt: string | Date
  customerChoice?: ComplaintRemedy | null
  order: OrderHandover | null | undefined
}

export function complaintDeadlines(input: ComplaintDeadlineInput): {
  carrierClaimDueAt: Date | null
  warrantyEndsAt: Date | null
} {
  const delivered = toDate(input.order?.deliveredAt) ?? toDate(input.receivedAt)
  return {
    carrierClaimDueAt:
      input.kind === 'transport_damage' && delivered
        ? addBerlinDays(delivered, CARRIER_CLAIM_DAYS)
        : null,
    warrantyEndsAt: warrantyEndsAt(input.order, input.customerChoice === 'repair'),
  }
}

/** Hat die Kund:in in einer Reklamation zur Bestellung Reparatur gewählt? */
export async function repairChosenForOrder(
  req: PayloadRequest,
  orderId: number | string,
): Promise<boolean> {
  if (!req.payload.collections['complaints']) return false
  const res = await preservingReq(req, () =>
    req.payload.count({
      collection: 'complaints',
      where: { and: [{ order: { equals: orderId } }, { customerChoice: { equals: 'repair' } }] },
      overrideAccess: true,
      req,
    }),
  )
  return res.totalDocs > 0
}
