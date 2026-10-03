import 'server-only'

import type { PayloadRequest } from 'payload'

import { canTransitionWithdrawal } from '@/lib/commerce/withdrawalTransitions'
import { enqueueEmail } from '@/lib/email/outbox'
import { money } from '@/lib/email/templates/kit'
import type { RefundReason, WithdrawalStatus } from '@/lib/enums'
import { createCreditNote } from '@/lib/invoices/create'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import type { Invoice, Order, Withdrawal } from '@/payload-types'

import { loadOrder, transitionOrder, updateOrderFields } from './transitionOrder'

// Abschluss einer erfolgreichen Erstattung aus dem Dialog „Erstatten“ (PLAN P6.10, KONZEPT §5.3 O13/O14/O15/O21,
// §5.4 W4/W6, R-072, R-121): Gutschrift GS zur Rechnung mit demselben Grund, Positionen `refunded`, Bestellung
// `refunded` (Summe erreicht `totalCents`) bzw. `partially_refunded`, zugehöriger Widerruf W4/W6, Mail M09 mit der
// Gutschrift. Läuft in der Transaktion, in der die Erstattung `succeeded` wird (Mock-Antwort, Webhook oder „Erstattung
// überwiesen“); idempotent über `refunds[].creditNote`. Erstattungen aus S4 (`item_unavailable`) und Anfechtungen
// (`dispute`) haben eigene Wege und werden hier nicht abgeschlossen.

const log = createLogger()

/** Gründe des Dialogs „Erstatten“ (DATENMODELL `REFUND_REASONS` ohne `item_unavailable`/`dispute`). */
export const DIALOG_REFUND_REASONS = [
  'withdrawal',
  'goodwill',
  'complaint',
  'breakage',
  'admin_cancellation',
] as const satisfies readonly RefundReason[]

export type JobId = number | string

/** Nach dem Commit auszuführen: erst die PDFs (Gutschrift), dann die Mails (M09 braucht das PDF als Anhang). */
export interface RefundEffects {
  pdfJobs: JobId[]
  mailJobs: JobId[]
}

export const newRefundEffects = (): RefundEffects => ({ pdfJobs: [], mailJobs: [] })

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

type RefundRow = NonNullable<Order['refunds']>[number]

const isDialogReason = (r: unknown): boolean =>
  (DIALOG_REFUND_REASONS as readonly string[]).includes(String(r))

/** Erstattete Summe (nur erfolgreich). */
export const succeededCents = (order: Pick<Order, 'refunds'>): number =>
  (order.refunds ?? [])
    .filter((r) => r.status === 'succeeded')
    .reduce((n, r) => n + r.amountCents, 0)

export async function finalizeRefund(
  req: PayloadRequest,
  orderId: number,
  index: number,
  now: Date,
  effects: RefundEffects,
): Promise<void> {
  const order = await loadOrder(req, orderId)
  const row = order.refunds?.[index] as RefundRow | undefined
  if (!row || row.status !== 'succeeded' || !isDialogReason(row.reason)) return
  if (idOf(row.creditNote) !== null) return

  // 1. Gutschrift GS zur Rechnung (R-121)
  const invoiceId = idOf(order.invoice)
  let creditNote: Invoice | null = null
  if (invoiceId !== null) {
    const invoice = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'invoices',
        id: invoiceId,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Invoice
    const credit = await createCreditNote(req, invoice, {
      amountCents: row.amountCents,
      reason: row.reason as RefundReason,
      now,
    })
    creditNote = credit.invoice
    if (credit.jobId !== null && credit.jobId !== undefined) effects.pdfJobs.push(credit.jobId)
  } else {
    log.warn('refund.no_invoice', { orderId, refundSeq: index + 1 })
  }

  // 2. Positionen und Erstattungszeile
  const itemIds = new Set(Array.isArray(row.itemIds) ? (row.itemIds as unknown[]).map(String) : [])
  const items = order.items.map((i) =>
    itemIds.has(String(i.id)) ? { ...i, status: 'refunded' as const } : i,
  )
  const refunds = (order.refunds ?? []).map((r, i) =>
    i === index ? { ...r, ...(creditNote ? { creditNote: creditNote.id } : {}) } : r,
  )
  const full = succeededCents(order) >= order.totalCents
  const target = full ? 'refunded' : 'partially_refunded'
  const note = `Erstattung ${index + 1}: ${money(row.amountCents, 'de')}`
  if (order.status !== target && order.status !== 'refunded' && order.status !== 'disputed') {
    await transitionOrder(req, orderId, target, { now, note, data: { items, refunds } })
  } else {
    await updateOrderFields(req, orderId, { items, refunds }, now)
  }

  // 3. Widerruf W4/W6
  const withdrawalId = idOf(row.withdrawal)
  let withdrawal: Withdrawal | null = null
  if (withdrawalId !== null) {
    withdrawal = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'withdrawals',
        id: withdrawalId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )) as Withdrawal | null
    if (withdrawal) {
      const own = Array.isArray(withdrawal.affectedItemIds)
        ? (withdrawal.affectedItemIds as unknown[]).map(String)
        : []
      const ownItems = own.length > 0 ? items.filter((i) => own.includes(String(i.id))) : items
      const done = full || ownItems.every((i) => i.status === 'refunded')
      const to: WithdrawalStatus = done ? 'refunded' : 'partially_refunded'
      if (withdrawal.status !== to && canTransitionWithdrawal(withdrawal.status, to)) {
        await preservingReq(req, () =>
          req.payload.update({
            collection: 'withdrawals',
            id: withdrawalId,
            data: { status: to },
            depth: 0,
            overrideAccess: true,
            req,
            context: {
              ...req.context,
              system: true,
              transition: withdrawal!.status === 'partially_refunded' ? 'W6' : 'W4',
              now: now.toISOString(),
            },
          }),
        )
      }
    }
  }

  // 4. M09 mit Gutschrift (nur mit GS – der Anhang ist Pflicht)
  if (creditNote) {
    const titles = new Map(order.items.map((i) => [String(i.id), i]))
    const m09 = await enqueueEmail(req, {
      template: 'refund_confirmation',
      to: order.customer.email,
      locale: order.locale,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customer.name ?? null,
        amountCents: row.amountCents,
        shippingCents: row.includesShipping
          ? Math.min(
              order.shippingCents ?? 0,
              Math.max(
                0,
                row.amountCents -
                  [...itemIds].reduce((n, id) => n + (titles.get(id)?.priceCents ?? 0), 0),
              ),
            )
          : 0,
        paymentMethod: order.paymentMethod,
        items: [...itemIds]
          .map((id) => titles.get(id))
          .filter((i): i is Order['items'][number] => !!i)
          .map((i) => ({
            itemNumber: i.itemNumber,
            title:
              ((order.locale === 'en' ? i.titleEn || i.titleDe : i.titleDe) ?? '').slice(0, 200) ||
              `Nr. ${i.itemNumber}`,
          })),
        withdrawalReference: withdrawal?.reference ?? null,
        creditNoteId: creditNote.id,
        creditNoteNumber: creditNote.number,
      },
      idempotencyKey: `refund_confirmation:${orderId}:${index + 1}`,
      relations: { order: orderId, ...(withdrawalId ? { withdrawal: withdrawalId } : {}) },
    })
    if (m09.jobId !== null) effects.mailJobs.push(m09.jobId)
  }
}
