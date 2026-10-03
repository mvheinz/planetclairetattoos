import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { OrderStatus, RefundReason } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import type { PaymentsAdapter } from '@/lib/payments'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Setting, Withdrawal } from '@/payload-types'

import { checkRefundAmount, proposeRefund, type RefundProposal } from './refundAmount'
import {
  DIALOG_REFUND_REASONS,
  finalizeRefund,
  newRefundEffects,
  type RefundEffects,
} from './refundFinalize'
import { executeRefund, runRefundEffects } from './refunds'
import { lockOrder, loadOrder, updateOrderFields } from './transitionOrder'

// Dialog „Erstatten“ (PLAN P6.10, KONZEPT §5.3/§7.10, R-072): im Widerrufs-Detail (Grund `withdrawal`, W4) und im
// Bestell-Detail (O15/O21 mit Pflicht-Grund `admin_cancellation`, `breakage`, `goodwill`, `complaint`). Positionen
// wählen, Betrag nach `proposeRefund` vorberechnet, nur erhöhbar (mit Notiz), nie über den Rest. Karte/PayPal: Eintrag
// `pending` → nach dem Commit `payments.refund` (Mock bzw. Stripe, Idempotenz `refund:<orderId>:<Nr>`) → bei Erfolg
// GS, Status, M09 (`refundFinalize.ts`); Fehlschlag → `failed` + A08. Vorkasse: „Erstattung überwiesen“ bestätigt
// Jutta selbst (`manualTransferConfirmedAt`) → sofort GS + M09. Keine Kund:innen-IBAN (V-23).

export class RefundRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'RefundRequestError'
  }
}

/** Bestellstatus, aus denen „Erstatten“ geht (O13/O14 aus dem Widerruf, O15, O21). */
export const REFUNDABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'paid',
  'packed',
  'shipped',
  'delivered',
  'ready_for_pickup',
  'picked_up',
  'withdrawal_received',
  'return_received',
  'partially_refunded',
]

const OPEN_WITHDRAWAL = ['received', 'goods_returned', 'partially_refunded']

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

/** Erfolgreiche und laufende Erstattungen (zählen gegen den Rest). */
const committedCents = (order: Pick<Order, 'refunds'>) =>
  (order.refunds ?? [])
    .filter((r) => r.status === 'succeeded' || r.status === 'pending')
    .reduce((n, r) => n + r.amountCents, 0)

async function shippingSettings(req: PayloadRequest): Promise<Setting> {
  return (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )) as Setting
}

/** Vorschlag für eine Auswahl (Dialog und Server rechnen gleich). */
export function proposalFor(
  order: Order,
  settings: Setting,
  selectedIds: readonly string[],
): RefundProposal {
  return proposeRefund({
    items: order.items.map((i) => ({
      id: String(i.id),
      priceCents: i.priceCents,
      shippingClass: i.shippingClass,
      itemNumber: i.itemNumber,
      status: i.status,
    })),
    selectedIds,
    shippingCents: order.shippingCents ?? 0,
    fulfillmentMethod: order.fulfillmentMethod,
    country: order.shippingAddress?.country ?? 'DE',
    settings: settings as never,
    totalCents: order.totalCents,
    refundedCents: committedCents(order),
  })
}

export interface RefundDialogData {
  orderId: number
  orderNumber: string
  paymentMethod: Order['paymentMethod']
  prepayment: boolean
  status: OrderStatus
  items: {
    id: string
    label: string
    priceCents: number
    refunded: boolean
    preselected: boolean
  }[]
  /** Vorschlag je Auswahl wird im Dialog per `GET …/refund-proposal` neu berechnet; hier der Start. */
  proposal: RefundProposal
  pending: boolean
  refundable: boolean
}

/** Startdaten des Dialogs; im Widerruf sind dessen Positionen (bzw. alle offenen) vorgewählt. */
export async function refundDialogData(
  req: PayloadRequest,
  orderId: number,
  withdrawal?: Pick<Withdrawal, 'affectedItemIds'> | null,
): Promise<RefundDialogData> {
  const [order, settings] = await Promise.all([loadOrder(req, orderId), shippingSettings(req)])
  const own = Array.isArray(withdrawal?.affectedItemIds)
    ? (withdrawal!.affectedItemIds as unknown[]).map(String)
    : []
  const open = order.items.filter((i) => i.status !== 'refunded').map((i) => String(i.id))
  const pre = withdrawal ? (own.length > 0 ? own.filter((id) => open.includes(id)) : open) : []
  return {
    orderId,
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    prepayment: order.paymentMethod === 'prepayment',
    status: order.status,
    items: order.items.map((i) => ({
      id: String(i.id),
      label: `Nr. ${i.itemNumber} · ${i.titleDe}`,
      priceCents: i.priceCents,
      refunded: i.status === 'refunded',
      preselected: pre.includes(String(i.id)),
    })),
    proposal: proposalFor(order, settings, pre),
    pending: (order.refunds ?? []).some((r) => r.status === 'pending'),
    refundable: REFUNDABLE_ORDER_STATUSES.includes(order.status),
  }
}

export async function refundProposal(
  req: PayloadRequest,
  orderId: number,
  selectedIds: readonly string[],
): Promise<RefundProposal> {
  const [order, settings] = await Promise.all([loadOrder(req, orderId), shippingSettings(req)])
  return proposalFor(order, settings, selectedIds)
}

export interface RefundRequestInput {
  reason: unknown
  itemIds?: unknown
  amountCents: unknown
  note?: unknown
  withdrawalId?: unknown
  /** Vorkasse: Jutta hat überwiesen („Erstattung überwiesen“). */
  manualTransferConfirmed?: unknown
}

export interface RefundRequestResult {
  order: Order
  index: number
  unchanged?: boolean
  afterCommit?: () => Promise<void>
}

/**
 * Legt die Erstattung in der Transaktion von `req` an (Zeile gesperrt). Doppelklick: läuft schon eine Erstattung mit
 * denselben Angaben bzw. wurde dieselbe Vorkasse-Erstattung eben bestätigt → `unchanged` ohne zweite Wirkung.
 */
export async function requestRefund(
  req: PayloadRequest,
  orderId: number,
  input: RefundRequestInput,
  now: Date,
  options: { payload?: Payload; payments?: PaymentsAdapter } = {},
): Promise<RefundRequestResult> {
  const effects: RefundEffects = newRefundEffects()
  const result = await inTransaction(req, async () => {
    await lockOrder(req, orderId)
    const order = await loadOrder(req, orderId)
    const reason = input.reason as RefundReason
    if (!(DIALOG_REFUND_REASONS as readonly string[]).includes(String(reason))) {
      throw new RefundRequestError(400, 'Bitte einen Grund für die Erstattung wählen.', 'reason')
    }
    if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
      throw new RefundRequestError(409, `Bei Status „${order.status}“ geht hier keine Erstattung.`)
    }
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 300) : ''
    const known = new Map(order.items.map((i) => [String(i.id), i]))
    const itemIds = [
      ...new Set((Array.isArray(input.itemIds) ? input.itemIds : []).map(String)),
    ].filter((id) => known.has(id) && known.get(id)!.status !== 'refunded')

    let withdrawalId: number | null = null
    if (reason === 'withdrawal') {
      withdrawalId = Number(input.withdrawalId)
      const w = Number.isSafeInteger(withdrawalId)
        ? ((await preservingReq(req, () =>
            req.payload.findByID({
              collection: 'withdrawals',
              id: withdrawalId!,
              depth: 0,
              overrideAccess: true,
              disableErrors: true,
              req,
            }),
          )) as Withdrawal | null)
        : null
      if (!w || idOf(w.order) !== orderId) {
        throw new RefundRequestError(
          400,
          'Die Erstattung gehört zu keinem Widerruf dieser Bestellung.',
        )
      }
      if (!OPEN_WITHDRAWAL.includes(w.status)) {
        throw new RefundRequestError(409, 'Dieser Widerruf ist schon abgeschlossen.')
      }
    }

    const amountCents = input.amountCents
    const same = (r: NonNullable<Order['refunds']>[number]) =>
      r.amountCents === amountCents &&
      r.reason === reason &&
      idOf(r.withdrawal) === withdrawalId &&
      JSON.stringify([...((r.itemIds as string[] | null) ?? [])].sort()) ===
        JSON.stringify([...itemIds].sort())
    const rows = order.refunds ?? []
    const pendingIndex = rows.findIndex((r) => r.status === 'pending')
    if (pendingIndex >= 0) {
      if (same(rows[pendingIndex]!)) return { order, index: pendingIndex, unchanged: true }
      throw new RefundRequestError(
        409,
        'Eine Erstattung läuft noch – bitte warte, bis sie fertig ist.',
      )
    }
    const recentIndex = rows.findIndex(
      (r) =>
        r.status === 'succeeded' &&
        same(r) &&
        now.getTime() - new Date(r.createdAt).getTime() < 2 * 60_000,
    )
    if (recentIndex >= 0) return { order, index: recentIndex, unchanged: true }

    const proposal = proposalFor(order, await shippingSettings(req), itemIds)
    const check = checkRefundAmount(amountCents, proposal, note)
    if (!check.ok) throw new RefundRequestError(400, check.message, check.code)

    const prepayment = order.paymentMethod === 'prepayment'
    if (prepayment && input.manualTransferConfirmed !== true) {
      throw new RefundRequestError(
        400,
        'Bei Vorkasse bitte erst überweisen und dann „Erstattung überwiesen“ bestätigen.',
        'transfer_unconfirmed',
      )
    }
    const index = rows.length
    const row = {
      amountCents: amountCents as number,
      reason,
      itemIds,
      includesShipping: proposal.shippingCents > 0 || (amountCents as number) > proposal.itemsCents,
      status: prepayment ? ('succeeded' as const) : ('pending' as const),
      ...(prepayment ? { manualTransferConfirmedAt: now.toISOString() } : {}),
      ...(withdrawalId ? { withdrawal: withdrawalId } : {}),
      ...(note ? { note } : {}),
      createdAt: now.toISOString(),
    }
    let updated = await updateOrderFields(req, orderId, { refunds: [...rows, row] }, now)
    if (prepayment) {
      await finalizeRefund(req, orderId, index, now, effects)
      updated = await loadOrder(req, orderId)
    }
    return { order: updated, index, prepayment }
  })
  if (result.unchanged) return { order: result.order, index: result.index, unchanged: true }
  const payload = options.payload ?? req.payload
  const { index } = result
  return {
    order: result.order,
    index,
    afterCommit:
      'prepayment' in result && result.prepayment
        ? () => runRefundEffects(payload, effects, now)
        : async () => {
            await executeRefund(payload, orderId, index, {
              now,
              reason: String(input.reason),
              payments: options.payments,
            })
          },
  }
}
