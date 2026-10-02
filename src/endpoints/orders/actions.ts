import { APIError, ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { adminActionResponse } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { writeAudit } from '@/lib/audit'
import type { PrepaymentErrorCode } from '@/lib/commerce/prepayment'
import { loadOrder, updateOrderFields } from '@/lib/commerce/transitionOrder'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import { formatBerlin } from '@/lib/time'
import type { Order } from '@/payload-types'

// Admin-Endpunkte der Vorkasse (PLAN P4.20, KONZEPT §5.3 O3/O4/O5, nur `isAdmin`):
// `POST /api/orders/:id/prepayment-received` `{ amountCents, receivedAt?, confirmMismatch? }` → O3,
// `POST /api/orders/:id/cancel` `{ reason }` → O4 (`admin`),
// `POST /api/orders/:id/late-payment` `{ action: 'reactivate' | 'refund_transfer_done', note? }` → O5 bzw. Notiz.
// Doppeltippen: ist die Bestellung schon im Zielzustand desselben Übergangs, antwortet der Endpunkt 200 mit
// `alreadyDone: true` ohne Nebenwirkungen (keine zweite Rechnung, keine zweite Mail); der Knopf schickt je Klick einen
// Idempotenz-Schlüssel (`Idempotency-Key`), der im Log landet.

const log = createLogger()

// Dynamisch: der Vorkasse-Dienst lädt (über die Reservierung) die Payload-Konfiguration, die diese Collection enthält.
const prepayment = () => import('@/lib/commerce/prepayment')

/** Eingabefehler bzw. abgelehnter Schritt (gleiche Form wie `PrepaymentError`). */
class ActionError extends Error {
  constructor(
    readonly code: PrepaymentErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PrepaymentError'
  }
}

const isPrepaymentError = (err: unknown): err is ActionError =>
  err instanceof Error && err.name === 'PrepaymentError' && 'code' in err
const noStore = { 'cache-control': 'private, no-store' }

/** Text der 409 bei O5, wenn ein Stück nicht mehr frei ist (KONZEPT §4.8). */
export const LATE_PAYMENT_SOLD_MESSAGE = 'Stück inzwischen verkauft – bitte Geld zurücküberweisen'
export const REFUND_TRANSFER_NOTE = 'Rücküberweisung erledigt'

const STATUS_BY_CODE: Record<PrepaymentErrorCode, number> = {
  prepayment_disabled: 409,
  checkout_not_open: 409,
  reservation_lost: 409,
  wrong_status: 409,
  amount_mismatch: 409,
  items_unavailable: 409,
  invalid_input: 400,
}

function errorResponse(err: unknown): Response {
  if (isPrepaymentError(err)) {
    const message = err.code === 'items_unavailable' ? LATE_PAYMENT_SOLD_MESSAGE : err.message
    return Response.json(
      { error: message, code: err.code },
      { status: STATUS_BY_CODE[err.code], headers: noStore },
    )
  }
  if (err instanceof ValidationError) {
    return Response.json(
      { error: err.message, errors: err.data?.errors ?? [] },
      { status: 400, headers: noStore },
    )
  }
  if (err instanceof APIError) {
    return Response.json({ error: err.message }, { status: err.status, headers: noStore })
  }
  log.error('orders.action_failed', { reason: (err as Error)?.message })
  return Response.json({ error: 'Unerwarteter Fehler.' }, { status: 500, headers: noStore })
}

type Result = { doc: Order; alreadyDone?: boolean; afterCommit?: () => Promise<void> }
type Handler = (
  req: PayloadRequest,
  order: Order,
  body: Record<string, unknown>,
  now: Date,
) => Promise<Result>

const lastTransition = (order: Order) => order.statusHistory?.at(-1)?.transition ?? null

function orderAction(path: string, handler: Handler): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) {
        return Response.json({ error: 'Nicht erlaubt.' }, { status: 403, headers: noStore })
      }
      const id = Number(req.routeParams?.id)
      if (!Number.isSafeInteger(id) || id < 1) {
        return Response.json({ error: 'Unbekannte Bestellung.' }, { status: 404, headers: noStore })
      }
      const order = (await req.payload.findByID({
        collection: 'orders',
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })) as Order | null
      if (!order) {
        return Response.json({ error: 'Unbekannte Bestellung.' }, { status: 404, headers: noStore })
      }
      const key = req.headers.get('idempotency-key')?.slice(0, 100) ?? null
      try {
        const result = await handler(req, order, await readJsonBody(req), requestNow(req))
        if (result.afterCommit) await result.afterCommit()
        log.info('orders.action', { orderId: id, path, key, alreadyDone: !!result.alreadyDone })
        // `unchanged` (P5.1, einheitlich für alle Verwaltungs-Aktionen); `alreadyDone` bleibt für die P4-Aufrufer.
        return adminActionResponse(
          { doc: result.doc, unchanged: result.alreadyDone === true },
          { alreadyDone: result.alreadyDone === true },
        )
      } catch (err) {
        return errorResponse(err)
      }
    },
  }
}

function parseReceivedAt(value: unknown, now: Date): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime() + 60_000) {
    throw new ActionError(
      'invalid_input',
      'Bitte ein gültiges Eingangsdatum (nicht in der Zukunft).',
    )
  }
  return d
}

export const prepaymentReceivedEndpoint = orderAction(
  'prepayment-received',
  async (req, order, body, now) => {
    if (order.status === 'paid' && lastTransition(order) === 'O3') {
      return { doc: order, alreadyDone: true }
    }
    const amountCents = body.amountCents
    if (typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new ActionError('invalid_input', 'Bitte den eingegangenen Betrag in Cent angeben.')
    }
    const { markPrepaymentPaid } = await prepayment()
    const res = await markPrepaymentPaid(order.id, req, {
      now,
      amountCents,
      receivedAt: parseReceivedAt(body.receivedAt, now),
      confirmMismatch: body.confirmMismatch === true,
    })
    return { doc: res.order, afterCommit: res.afterCommit }
  },
)

export const cancelOrderEndpoint = orderAction('cancel', async (req, order, body, now) => {
  if (order.status === 'cancelled' && order.cancelReason === 'admin') {
    return { doc: order, alreadyDone: true }
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < 3 || reason.length > 300) {
    throw new ActionError(
      'invalid_input',
      'Bitte kurz begründen, warum storniert wird (3–300 Zeichen).',
    )
  }
  if (order.status !== 'awaiting_prepayment') {
    throw new ActionError(
      'wrong_status',
      'Stornieren geht hier nur bei offener Vorkasse – bezahlte Bestellungen bitte erstatten.',
    )
  }
  const { cancelPrepaymentOrder } = await prepayment()
  const res = await cancelPrepaymentOrder(req, order.id, { now, reason: 'admin', note: reason })
  return { doc: res.order, afterCommit: res.afterCommit }
})

export const latePaymentEndpoint = orderAction('late-payment', async (req, order, body, now) => {
  const action = body.action
  if (action !== 'reactivate' && action !== 'refund_transfer_done') {
    throw new ActionError('invalid_input', 'Unbekannte Aktion.')
  }
  if (action === 'reactivate' && order.status === 'paid' && lastTransition(order) === 'O5') {
    return { doc: order, alreadyDone: true }
  }
  if (order.status !== 'cancelled' || order.cancelReason !== 'payment_timeout') {
    throw new ActionError(
      'wrong_status',
      '„Nachträglich bezahlt“ geht nur bei Bestellungen, die wegen abgelaufener Zahlungsfrist storniert wurden.',
    )
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
  if (action === 'reactivate') {
    const { markPrepaymentPaid } = await prepayment()
    const res = await markPrepaymentPaid(order.id, req, {
      now,
      amountCents: order.totalCents,
      late: true,
    })
    return { doc: res.order, afterCommit: res.afterCommit }
  }
  // Rücküberweisung erledigt: nur Notiz und Audit, keine Rechnung, kein Statuswechsel
  if ((order.notes ?? '').includes(REFUND_TRANSFER_NOTE)) return { doc: order, alreadyDone: true }
  const doc = await inTransaction(req, async () => {
    const line = `${formatBerlin(now, 'dd.MM.yyyy')}: ${REFUND_TRANSFER_NOTE}${note ? ` – ${note}` : ''}`
    const notes = [order.notes?.trim(), line].filter(Boolean).join('\n').slice(-2000)
    await updateOrderFields(req, order.id, { notes }, now)
    await writeAudit(req, {
      action: 'order_refund_created',
      entityCollection: 'orders',
      entityId: order.id,
      summary: `Bestellung ${order.orderNumber}: ${REFUND_TRANSFER_NOTE} (verspätete Vorkasse-Zahlung)`,
    })
    return loadOrder(req, order.id)
  })
  return { doc }
})

export const orderActionEndpoints: Endpoint[] = [
  prepaymentReceivedEndpoint,
  cancelOrderEndpoint,
  latePaymentEndpoint,
]
