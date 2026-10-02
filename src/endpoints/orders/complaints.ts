import type { Endpoint } from 'payload'

import { adminOrderAction } from './_action'

// Reklamationsakte aus dem Bestell-Detail (PLAN P6.11, KONZEPT §7.8, R-110–R-112; nur `isAdmin`, Rahmen `_action`):
// `POST /api/orders/:id/complaint` `{ kind?, receivedAt?, description?, affectedItemIds? }` → Akte anlegen;
// `POST /api/orders/:id/complaint-reply` `{ complaintId }` → M12 und `repairChoiceSentAt` („Reklamation beantworten“);
// `POST /api/orders/:id/complaint-dispute` `{ complaintId }` → M13 und `vsbgNoticeSentAt`
// („Streitbeilegungshinweis senden“). Mails über die Outbox, Zustellung direkt nach dem Commit.

const service = () => import('@/lib/legal/complaints')

const deliverAfterCommit =
  (req: Parameters<Endpoint['handler']>[0], jobId: number | string | null, now: Date) =>
  async () => {
    const { runEmailJobNow } = await import('@/lib/email/outbox')
    await runEmailJobNow(req.payload, jobId, { now })
  }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

export const createComplaintEndpoint = adminOrderAction(
  'complaint',
  async ({ req, order, body }) => {
    const { createComplaint } = await service()
    const ids = Array.isArray(body.affectedItemIds) ? body.affectedItemIds.map(String) : []
    const complaint = await createComplaint(req, order, {
      kind: (body.kind as never) ?? undefined,
      receivedAt: str(body.receivedAt),
      description: str(body.description),
      affectedItemIds: ids.slice(0, 50),
    })
    return { doc: order, extra: { complaintId: complaint.id } }
  },
)

export const complaintReplyEndpoint = adminOrderAction(
  'complaint-reply',
  async ({ req, order, body, now }) => {
    const { sendRepairChoice } = await service()
    const res = await sendRepairChoice(req, order, body.complaintId, now)
    return {
      doc: order,
      unchanged: res.unchanged,
      afterCommit: deliverAfterCommit(req, res.jobId, now),
    }
  },
)

export const complaintDisputeEndpoint = adminOrderAction(
  'complaint-dispute',
  async ({ req, order, body, now }) => {
    const { sendVsbgNotice } = await service()
    const res = await sendVsbgNotice(req, order, body.complaintId, now)
    return {
      doc: order,
      unchanged: res.unchanged,
      afterCommit: deliverAfterCommit(req, res.jobId, now),
    }
  },
)

export const orderComplaintEndpoints: Endpoint[] = [
  createComplaintEndpoint,
  complaintReplyEndpoint,
  complaintDisputeEndpoint,
]
