import 'server-only'

import type { PayloadRequest } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { WithdrawalStatus } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { berlinDateKey, formatBerlin } from '@/lib/time'
import type { Order, Withdrawal } from '@/payload-types'

// Daten der Ansicht „Widerrufe“ `/widerrufe` und `/widerrufe/:id` (PLAN P5.19, KONZEPT §7.10, DATENMODELL §6.11). Nur
// lesend; Notizen über `POST /api/withdrawals/:id/notes`. Aktionen (Zuordnen, Ware zurück, Erstatten, Abschließen)
// folgen in P6.9/P6.10. Nie automatisch ablehnen (R-094).

const DAY = 86_400_000
/** Offen (SEED-SPEC §17 „Widerrufe offen“): noch nicht erstattet, abgeschlossen oder abgelehnt. */
export const OPEN_WITHDRAWAL_STATUSES = [
  'received',
  'goods_returned',
] as const satisfies readonly WithdrawalStatus[]
/** Ab diesem Tag nach Eingang ist die Erstattungsfrist rot markiert (KONZEPT §7.10). */
export const REFUND_WARN_DAY = 10

const dateTime = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), "dd.MM.yyyy, HH:mm 'Uhr'") : ''
const date = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : ''

/** Berliner Kalendertage seit `from` (Eingangstag = 0). */
function berlinDaysSince(from: Date, now: Date): number {
  const a = Date.parse(`${berlinDateKey(from)}T00:00:00Z`)
  const b = Date.parse(`${berlinDateKey(now)}T00:00:00Z`)
  return Math.round((b - a) / DAY)
}

const orderIdOf = (v: Withdrawal['order']): number | null =>
  typeof v === 'number' ? v : v && typeof v === 'object' ? v.id : null

export interface WithdrawalCard {
  id: number
  reference: string
  receivedAt: string
  name: string
  orderNumber: string | null
  matchLabel: string
  channelLabel: string
  status: WithdrawalStatus
  statusLabel: string
  open: boolean
  refundDue: string
  /** Tag ≥ 10 nach Eingang (offen) → rot. */
  refundUrgent: boolean
  daysSinceReceipt: number
}

function card(w: Withdrawal, orderNumbers: Map<number, string>, now: Date): WithdrawalCard {
  const orderId = orderIdOf(w.order)
  const open = (OPEN_WITHDRAWAL_STATUSES as readonly string[]).includes(w.status)
  const days = berlinDaysSince(new Date(w.receivedAt), now)
  return {
    id: w.id,
    reference: w.reference,
    receivedAt: dateTime(w.receivedAt),
    name: w.name ?? '',
    orderNumber: orderId ? (orderNumbers.get(orderId) ?? null) : null,
    matchLabel: ENUM_LABELS.WITHDRAWAL_MATCH_STATUSES[w.matchStatus].de,
    channelLabel: ENUM_LABELS.WITHDRAWAL_CHANNELS[w.channel].de,
    status: w.status,
    statusLabel: ENUM_LABELS.WITHDRAWAL_STATUSES[w.status].de,
    open,
    refundDue: date(w.refundDueAt),
    refundUrgent: open && days >= REFUND_WARN_DAY,
    daysSinceReceipt: days,
  }
}

async function orderNumbersOf(req: PayloadRequest, ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (ids.length === 0) return map
  const res = await req.payload.find({
    collection: 'orders',
    where: { id: { in: ids } },
    select: { orderNumber: true },
    limit: ids.length,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const o of res.docs as Pick<Order, 'id' | 'orderNumber'>[]) map.set(o.id, o.orderNumber)
  return map
}

export interface WithdrawalList {
  open: WithdrawalCard[]
  done: WithdrawalCard[]
}

/** Offene Widerrufe (älteste zuerst, also dringendste Erstattung oben) und die letzten 50 erledigten. */
export async function loadWithdrawalList(req: PayloadRequest, now: Date): Promise<WithdrawalList> {
  const [openRes, doneRes] = await Promise.all([
    req.payload.find({
      collection: 'withdrawals',
      where: { status: { in: [...OPEN_WITHDRAWAL_STATUSES] } },
      sort: 'receivedAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'withdrawals',
      where: { status: { not_in: [...OPEN_WITHDRAWAL_STATUSES] } },
      sort: '-receivedAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  ])
  const docs = [...openRes.docs, ...doneRes.docs] as Withdrawal[]
  const numbers = await orderNumbersOf(req, [
    ...new Set(docs.map((w) => orderIdOf(w.order)).filter((v): v is number => v !== null)),
  ])
  return {
    open: (openRes.docs as Withdrawal[]).map((w) => card(w, numbers, now)),
    done: (doneRes.docs as Withdrawal[]).map((w) => card(w, numbers, now)),
  }
}

export interface WithdrawalDeclaration {
  channelLabel: string
  receivedAt: string
  name: string
  email: string | null
  contractIdentification: string
  itemsText: string | null
  reason: string | null
  localeLabel: string
}

export interface WithdrawalOrder {
  id: number
  orderNumber: string
  statusLabel: string
  paymentLabel: string
  items: { nr: string; title: string; priceCents: number }[]
  totalCents: number
  /** Reguläre Widerrufsfrist (Zustellung bzw. Übergabe + 14 Tage), nur Info – nie automatisch ablehnen (R-094). */
  regularDeadline: string | null
  regularDeadlineEstimated: boolean
}

export interface WithdrawalDetail {
  card: WithdrawalCard
  declaration: WithdrawalDeclaration
  order: WithdrawalOrder | null
  adminNotes: string
}

type Snapshot = Partial<Record<keyof WithdrawalDeclaration | 'receivedAtBerlin', string | null>>

export async function loadWithdrawalDetail(
  req: PayloadRequest,
  id: number,
  now: Date,
): Promise<WithdrawalDetail | null> {
  const w = (await req.payload.findByID({
    collection: 'withdrawals',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Withdrawal | null
  if (!w) return null
  const orderId = orderIdOf(w.order)
  const order = orderId
    ? ((await req.payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })) as Order | null)
    : null
  const numbers = new Map<number, string>(order ? [[order.id, order.orderNumber]] : [])
  // Unveränderliche Erklärung: Snapshot beim Eingang (Rückfall auf die – ebenfalls gesperrten – Felder)
  const snap = (
    w.submissionSnapshot && typeof w.submissionSnapshot === 'object' ? w.submissionSnapshot : {}
  ) as Snapshot
  const declaration: WithdrawalDeclaration = {
    channelLabel: ENUM_LABELS.WITHDRAWAL_CHANNELS[w.channel].de,
    receivedAt: snap.receivedAtBerlin ?? dateTime(w.receivedAt),
    name: snap.name ?? w.name ?? '',
    email: snap.email ?? w.email ?? null,
    contractIdentification: snap.contractIdentification ?? w.contractIdentification ?? '',
    itemsText: snap.itemsText ?? w.itemsText ?? null,
    reason: snap.reason ?? w.reason ?? null,
    localeLabel: w.locale ? ENUM_LABELS.LOCALES[w.locale].de : '–',
  }
  let orderView: WithdrawalOrder | null = null
  if (order) {
    const handover = order.timestamps?.deliveredAt ?? order.timestamps?.pickedUpAt ?? null
    orderView = {
      id: order.id,
      orderNumber: order.orderNumber,
      statusLabel: ENUM_LABELS.ORDER_STATUSES[order.status].de,
      paymentLabel: ENUM_LABELS.PAYMENT_METHODS[order.paymentMethod].de,
      items: order.items.map((i) => ({
        nr: formatItemNumber(i.itemNumber, 'de'),
        title: i.titleDe,
        priceCents: i.priceCents,
      })),
      totalCents: order.totalCents,
      regularDeadline: handover
        ? date(new Date(Date.parse(handover) + 14 * DAY).toISOString())
        : null,
      regularDeadlineEstimated:
        Boolean(order.timestamps?.deliveredAt) && order.shipment?.deliveredSource === 'auto',
    }
  }
  return {
    card: card(w, numbers, now),
    declaration,
    order: orderView,
    adminNotes: w.adminNotes ?? '',
  }
}
