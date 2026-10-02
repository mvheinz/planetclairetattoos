import 'server-only'

import type { PayloadRequest } from 'payload'

import type { ComplaintKind, ComplaintRemedy } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { addBerlinDays, addBerlinMonths } from '@/lib/time'
import type { Complaint as ComplaintDoc, Order as OrderDoc } from '@/payload-types'

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

// --- Aktionen der Reklamationsakte (PLAN P6.11, KONZEPT §7.8) ---------------------------------------------------
// Anlegen aus dem Bestell-Detail bzw. „Reklamation (Bruch)“ in „Versendet“; „Reklamation beantworten“ (M12) und
// „Streitbeilegungshinweis senden“ (M13) reihen die Mail über die Outbox ein und setzen in derselben Transaktion den
// Zeitstempel der Akte. Zustandsbasiert idempotent: ist der Zeitstempel schon gesetzt, passiert nichts (`unchanged`).

/** Fachlicher Fehler einer Reklamations-Aktion (Status + deutsche Meldung für die Verwaltung). */
export class ComplaintActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ComplaintActionError'
  }
}

export interface CreateComplaintInput {
  kind?: ComplaintKind
  receivedAt?: string | null
  description?: string | null
  affectedItemIds?: string[]
}

const isKind = (v: unknown): v is ComplaintKind => v === 'transport_damage' || v === 'defect'

/** Reklamation zu einer bezahlten Bestellung anlegen (Fristen und Audit setzen die Hooks der Collection). */
export async function createComplaint(
  req: PayloadRequest,
  order: OrderDoc,
  input: CreateComplaintInput,
): Promise<ComplaintDoc> {
  if (input.kind !== undefined && !isKind(input.kind)) {
    throw new ComplaintActionError(400, 'Unbekannte Art der Reklamation.')
  }
  const known = new Set((order.items ?? []).map((i) => String(i.id)))
  const items = (input.affectedItemIds ?? []).map(String)
  if (items.some((id) => !known.has(id))) {
    throw new ComplaintActionError(400, 'Ein gewähltes Stück gehört nicht zu dieser Bestellung.')
  }
  return (await preservingReq(req, () =>
    req.payload.create({
      collection: 'complaints',
      data: {
        order: order.id,
        kind: input.kind ?? 'transport_damage',
        ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
        description: input.description?.trim() || undefined,
        affectedItemIds: items,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as ComplaintDoc
}

async function loadComplaintOfOrder(
  req: PayloadRequest,
  order: OrderDoc,
  complaintId: unknown,
): Promise<ComplaintDoc> {
  const id = Number(complaintId)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ComplaintActionError(400, 'Bitte eine Reklamation wählen.')
  }
  const complaint = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'complaints',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as ComplaintDoc | null
  const orderOf = complaint
    ? typeof complaint.order === 'object'
      ? complaint.order?.id
      : complaint.order
    : null
  if (!complaint || orderOf !== order.id) {
    throw new ComplaintActionError(404, 'Reklamation zu dieser Bestellung nicht gefunden.')
  }
  return complaint
}

/** Betroffene Stücke der Akte (ohne Auswahl: alle Stücke der Bestellung) für M12. */
function affectedItems(order: OrderDoc, complaint: ComplaintDoc) {
  const ids = Array.isArray(complaint.affectedItemIds)
    ? (complaint.affectedItemIds as unknown[]).map(String)
    : []
  const rows = (order.items ?? []).filter((i) => ids.length === 0 || ids.includes(String(i.id)))
  return rows.map((i) => ({
    itemNumber: i.itemNumber,
    title:
      ((order.locale === 'en' ? i.titleEn || i.titleDe : i.titleDe) ?? '').slice(0, 200) ||
      `Nr. ${i.itemNumber}`,
  }))
}

export interface ComplaintMailResult {
  complaint: ComplaintDoc
  unchanged: boolean
  jobId: number | string | null
}

async function sendComplaintMail(
  req: PayloadRequest,
  order: OrderDoc,
  complaintId: unknown,
  now: Date,
  kind: 'repair_choice' | 'vsbg',
): Promise<ComplaintMailResult> {
  const complaint = await loadComplaintOfOrder(req, order, complaintId)
  const field = kind === 'repair_choice' ? 'repairChoiceSentAt' : 'vsbgNoticeSentAt'
  if (complaint[field]) return { complaint, unchanged: true, jobId: null }
  if (!order.customer?.email) {
    throw new ComplaintActionError(409, 'Die Bestellung hat keine E-Mail-Adresse mehr.')
  }
  const { enqueueEmail } = await import('@/lib/email/outbox')
  const base = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    complaintId: complaint.id,
    customerName: order.customer.name ?? null,
    receivedAt: new Date(complaint.receivedAt).toISOString(),
  }
  const template = kind === 'repair_choice' ? 'complaint_repair_choice' : 'dispute_vsbg'
  const mail = await enqueueEmail(req, {
    template,
    to: order.customer.email,
    locale: order.locale,
    data:
      kind === 'repair_choice'
        ? { ...base, kind: complaint.kind, items: affectedItems(order, complaint) }
        : base,
    idempotencyKey: `${template}:${complaint.id}:1`,
    relations: { order: order.id },
  })
  const updated = (await preservingReq(req, () =>
    req.payload.update({
      collection: 'complaints',
      id: complaint.id,
      data: { [field]: now.toISOString() } as never,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as ComplaintDoc
  return { complaint: updated, unchanged: false, jobId: mail.jobId }
}

/** „Reklamation beantworten“: M12 `complaint_repair_choice` einreihen, `repairChoiceSentAt` setzen (R-111). */
export function sendRepairChoice(
  req: PayloadRequest,
  order: OrderDoc,
  complaintId: unknown,
  now: Date,
): Promise<ComplaintMailResult> {
  return sendComplaintMail(req, order, complaintId, now, 'repair_choice')
}

/** „Streitbeilegungshinweis senden“: M13 `dispute_vsbg` einreihen, `vsbgNoticeSentAt` setzen (R-112). */
export function sendVsbgNotice(
  req: PayloadRequest,
  order: OrderDoc,
  complaintId: unknown,
  now: Date,
): Promise<ComplaintMailResult> {
  return sendComplaintMail(req, order, complaintId, now, 'vsbg')
}
