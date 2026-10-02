import 'server-only'

import type { PayloadRequest } from 'payload'

import { adminRecipient, enqueueEmail } from '@/lib/email/outbox'
import { preservingReq } from '@/lib/payload/localReq'
import type { Order, Withdrawal } from '@/payload-types'

// „Kopie an mich“ der Eingangsbestätigung M08 (PLAN P6.19, KONZEPT §6.1 „M08 nur als Kopie an Jutta“): dieselbe
// Vorlage mit den gespeicherten Angaben der Erklärung, Empfänger immer die Verwaltungs-Adresse
// (`settings.adminNotificationEmail` bzw. `ADMIN_NOTIFY_EMAIL`) – nie die Adresse der Kundin, auch nicht auf Wunsch
// im Aufruf. Jeder Klick ist eine neue Kopie (Idempotenz je Klick über den `Idempotency-Key`).

export class WithdrawalCopyError extends Error {
  readonly status = 404
  constructor() {
    super('Unbekannter Widerruf.')
    this.name = 'WithdrawalCopyError'
  }
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

export async function sendWithdrawalReceiptCopy(
  req: PayloadRequest,
  id: number,
  clickKey: string,
  now: Date,
): Promise<{ withdrawal: Withdrawal; jobId: number | string | null; to: string }> {
  const w = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'withdrawals',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as Withdrawal | null
  if (!w) throw new WithdrawalCopyError()
  const orderId = idOf(w.order)
  const order = orderId
    ? ((await preservingReq(req, () =>
        req.payload.findByID({
          collection: 'orders',
          id: orderId,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
          req,
        }),
      )) as Order | null)
    : null
  const affected = new Set(Array.isArray(w.affectedItemIds) ? (w.affectedItemIds as string[]) : [])
  const items = (order?.items ?? [])
    .filter((i) => i.id && affected.has(i.id))
    .map((i) => ({
      itemNumber: i.itemNumber,
      title: (i.titleDe || `Nr. ${i.itemNumber}`).slice(0, 200),
    }))
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )
  const to = await adminRecipient(req)
  const key = clickKey.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || String(now.getTime())
  const res = await enqueueEmail(req, {
    template: 'withdrawal_receipt',
    to,
    locale: 'de',
    data: {
      withdrawalId: w.id,
      reference: w.reference,
      receivedAt: w.receivedAt,
      refundDueAt: w.refundDueAt,
      name: w.name,
      contractIdentification: w.contractIdentification,
      email: w.email || 'keine Angabe',
      itemsText: w.itemsText ?? null,
      items,
      reason: w.reason ?? null,
      unpaidOrderCancelled: order?.status === 'cancelled' && !order.timestamps?.paidAt,
      returnAddress: settings.business?.returnAddress ?? null,
    },
    idempotencyKey: `withdrawal_receipt:${w.id}:copy:${key}`,
    relations: { withdrawal: w.id },
  })
  return { withdrawal: w, jobId: res.jobId, to }
}
