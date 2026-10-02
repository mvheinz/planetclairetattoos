import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { orderActionErrorResponse } from '@/endpoints/orders/_action'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import type { Withdrawal } from '@/payload-types'

// Admin-Endpunkte des Widerrufs-Posteingangs (PLAN P6.9, KONZEPT §7.10, R-094; nur `isAdmin`, sonst 403):
// `POST /api/withdrawals/:id/match` `{ orderId, itemIds? }` (W2) · `/goods-returned` `{ note?, photoIds? }` (W3/O12) ·
// `/return-proof` · `/close` `{ closeReason, closeNote? }` (W5/O20) · `/reject` `{ closeNote }` (W7) ·
// `/spam` `{ reason }` · `GET /api/withdrawals/order-search?q=` (Zuordnen) · `POST /api/withdrawals/manual` (manuelle
// Erfassung per Mail/Brief). Zustandsbasiert idempotent (`unchanged: true`); Mails nach dem Commit.

const log = createLogger()

// Dynamisch: die Dienste laden die Payload-Konfiguration, die diese Collection enthält.
const inbox = () => import('@/lib/legal/withdrawalInbox')
const service = () => import('@/lib/legal/withdrawal')
const outbox = () => import('@/lib/email/outbox')

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: ADMIN_NO_STORE })

function errorResponse(err: unknown, path: string): Response {
  const e = err as { name?: string; status?: number; message?: string }
  if (
    (e?.name === 'WithdrawalActionError' || e?.name === 'ManualWithdrawalError') &&
    typeof e.status === 'number'
  ) {
    return json(e.status, e.message ?? 'Fehler.')
  }
  return orderActionErrorResponse(err, `withdrawals/${path}`)
}

type Handler = (
  req: PayloadRequest,
  id: number,
  body: Record<string, unknown>,
  now: Date,
) => Promise<{ doc: Withdrawal; unchanged?: boolean; afterCommit?: () => Promise<void> }>

function withdrawalAction(path: string, handler: Handler): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
      const id = Number(req.routeParams?.id)
      if (!Number.isSafeInteger(id) || id < 1) return json(404, 'Unbekannter Widerruf.')
      try {
        const body = await readJsonBody(req)
        const now = requestNow(req)
        const result = await inTransaction(req, () => handler(req, id, body, now))
        await result
          .afterCommit?.()
          .catch((e: unknown) =>
            log.error('withdrawals.after_commit_failed', {
              id,
              path,
              reason: (e as Error)?.message,
            }),
          )
        log.info('withdrawals.admin_action', { id, path, unchanged: !!result.unchanged })
        return adminActionResponse({ doc: result.doc, unchanged: result.unchanged })
      } catch (err) {
        return errorResponse(err, path)
      }
    },
  }
}

export const withdrawalMatchEndpoint = withdrawalAction('match', async (req, id, body, now) =>
  (await inbox()).matchWithdrawalOrder(
    req,
    id,
    { orderId: body.orderId, itemIds: body.itemIds },
    now,
  ),
)
export const withdrawalGoodsReturnedEndpoint = withdrawalAction(
  'goods-returned',
  async (req, id, body, now) =>
    (await inbox()).markGoodsReturned(req, id, { note: body.note, photoIds: body.photoIds }, now),
)
export const withdrawalReturnProofEndpoint = withdrawalAction(
  'return-proof',
  async (req, id, _body, now) => (await inbox()).markReturnProof(req, id, now),
)
export const withdrawalCloseEndpoint = withdrawalAction('close', async (req, id, body, now) =>
  (await inbox()).closeWithoutRefund(
    req,
    id,
    { closeReason: body.closeReason, closeNote: body.closeNote },
    now,
  ),
)
export const withdrawalRejectEndpoint = withdrawalAction('reject', async (req, id, body, now) =>
  (await inbox()).rejectWithdrawal(req, id, { closeNote: body.closeNote }, now),
)
export const withdrawalSpamEndpoint = withdrawalAction('spam', async (req, id, body, now) =>
  (await inbox()).markWithdrawalSpam(req, id, { reason: body.reason }, now),
)

export const withdrawalOrderSearchEndpoint: Endpoint = {
  path: '/order-search',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
    const q = typeof req.query?.q === 'string' ? req.query.q : ''
    const orders = await (await inbox()).searchOrdersForWithdrawal(req, q)
    return Response.json({ orders }, { headers: ADMIN_NO_STORE })
  },
}

/** Manuell erfasster Widerruf (Kanal `email`/`letter`/`other`, Zugangszeitpunkt von Jutta). */
export const withdrawalManualEndpoint: Endpoint = {
  path: '/manual',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
    try {
      const body = await readJsonBody(req)
      const now = requestNow(req)
      const { recordManualWithdrawal } = await service()
      const result = await inTransaction(req, () => recordManualWithdrawal(req, body, now))
      await result
        .afterCommit?.()
        .catch((e: unknown) =>
          log.error('withdrawals.manual_after_commit_failed', { reason: (e as Error)?.message }),
        )
      const { runEmailJobNow } = await outbox()
      for (const job of result.jobs) {
        await runEmailJobNow(req.payload, job, { now }).catch((e: unknown) =>
          log.error('withdrawals.manual_mail_failed', { reason: (e as Error)?.message }),
        )
      }
      return Response.json({ doc: result.doc }, { status: 201, headers: ADMIN_NO_STORE })
    } catch (err) {
      return errorResponse(err, 'manual')
    }
  },
}

export const WITHDRAWAL_ADMIN_ENDPOINTS: Endpoint[] = [
  withdrawalOrderSearchEndpoint,
  withdrawalManualEndpoint,
  withdrawalMatchEndpoint,
  withdrawalGoodsReturnedEndpoint,
  withdrawalReturnProofEndpoint,
  withdrawalCloseEndpoint,
  withdrawalRejectEndpoint,
  withdrawalSpamEndpoint,
]
