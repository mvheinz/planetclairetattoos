import 'server-only'

import type { PayloadRequest } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { ComplaintKind, ComplaintRemedy, ComplaintStatus } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { formatBerlin } from '@/lib/time'
import type { Complaint, Order } from '@/payload-types'

// Reklamationsakten einer Bestellung für das Bestell-Detail (PLAN P6.11, KONZEPT §7.8): Art, Eingang, Status,
// betroffene Stücke, Frist „bis {Datum} bei DHL reklamieren“, Gewährleistungsende und die versendeten Mails M12/M13.
// Nur lesend; Aktionen über `src/endpoints/orders/complaints.ts`, alle Felder in der Akte (Collection `complaints`).

const day = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : null

export interface ComplaintCard {
  id: number
  kind: ComplaintKind
  kindLabel: string
  statusLabel: string
  receivedAt: string
  items: string[]
  description: string | null
  carrierClaimDueAt: string | null
  carrierClaimFiledAt: string | null
  warrantyEndsAt: string | null
  remedyLabel: string | null
  customerChoiceLabel: string | null
  repairChoiceSentAt: string | null
  vsbgNoticeSentAt: string | null
  photoCount: number
}

export interface OrderComplaints {
  /** Reklamationen gibt es nur zu bezahlten Bestellungen. */
  allowed: boolean
  items: { id: string; label: string }[]
  complaints: ComplaintCard[]
}

export async function loadOrderComplaints(
  req: PayloadRequest,
  orderId: number,
): Promise<OrderComplaints | null> {
  const order = (await req.payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Order | null
  if (!order) return null
  const items = (order.items ?? []).map((i) => ({
    id: String(i.id),
    label: `${formatItemNumber(i.itemNumber, 'de')} ${i.titleDe ?? ''}`.trim(),
  }))
  const res = await req.payload.find({
    collection: 'complaints',
    where: { order: { equals: order.id } },
    sort: '-receivedAt',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    req,
  })
  const labelOf = new Map(items.map((i) => [i.id, i.label]))
  const complaints = (res.docs as Complaint[]).map((c) => {
    const ids = Array.isArray(c.affectedItemIds) ? (c.affectedItemIds as unknown[]).map(String) : []
    const remedy = (r: ComplaintRemedy | null | undefined) =>
      r ? ENUM_LABELS.COMPLAINT_REMEDIES[r].de : null
    return {
      id: c.id,
      kind: c.kind as ComplaintKind,
      kindLabel: ENUM_LABELS.COMPLAINT_KINDS[c.kind as ComplaintKind].de,
      statusLabel: ENUM_LABELS.COMPLAINT_STATUSES[c.status as ComplaintStatus].de,
      receivedAt: day(c.receivedAt) ?? '',
      items: ids.map((id) => labelOf.get(id) ?? id),
      description: c.description ?? null,
      carrierClaimDueAt: day(c.carrierClaimDueAt),
      carrierClaimFiledAt: day(c.carrierClaimFiledAt),
      warrantyEndsAt: day(c.warrantyEndsAt),
      remedyLabel: remedy(c.remedy as ComplaintRemedy | null),
      customerChoiceLabel: remedy(c.customerChoice as ComplaintRemedy | null),
      repairChoiceSentAt: day(c.repairChoiceSentAt),
      vsbgNoticeSentAt: day(c.vsbgNoticeSentAt),
      photoCount: Array.isArray(c.photos) ? c.photos.length : 0,
    }
  })
  return { allowed: Boolean(order.timestamps?.paidAt), items, complaints }
}
