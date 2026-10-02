import type { Endpoint } from 'payload'

import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { createLogger } from '@/lib/monitoring/logger'

import { adminOrderAction, loadAdminOrder, orderActionError } from './_action'

// Dialog „Erstatten“ (PLAN P6.10, KONZEPT §5.3/§7.10, R-072; nur `isAdmin`):
// `GET /api/orders/:id/refund-proposal?items=<id>,<id>` → Vorschlag (gleiche Rechnung wie beim Absenden),
// `POST /api/orders/:id/refund` `{ reason, itemIds, amountCents, note?, withdrawalId?, manualTransferConfirmed? }`.
// Karte/PayPal: Anbieter-Erstattung nach dem Commit; Vorkasse: „Erstattung überwiesen“ → sofort Gutschrift und M09.

const log = createLogger()
const service = () => import('@/lib/commerce/refundOrder')

export const refundProposalEndpoint: Endpoint = {
  path: '/:id/refund-proposal',
  method: 'get',
  handler: async (req) => {
    const order = await loadAdminOrder(req)
    if (order instanceof Response) return order
    const raw = typeof req.query?.items === 'string' ? req.query.items : ''
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)
    try {
      const proposal = await (await service()).refundProposal(req, order.id, ids)
      return Response.json({ proposal }, { headers: ADMIN_NO_STORE })
    } catch (err) {
      log.error('orders.refund_proposal_failed', { reason: (err as Error)?.message })
      return orderActionError(500, 'Vorschlag gerade nicht berechenbar.')
    }
  },
}

export const refundEndpoint = adminOrderAction('refund', async ({ req, order, body, now }) => {
  const { requestRefund } = await service()
  const res = await requestRefund(req, order.id, body as never, now)
  return {
    doc: res.order,
    unchanged: res.unchanged,
    afterCommit: res.afterCommit,
    extra: { refundIndex: res.index },
  }
})

export const orderRefundEndpoints: Endpoint[] = [refundProposalEndpoint, refundEndpoint]
