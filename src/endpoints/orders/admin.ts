import type { Endpoint } from 'payload'

import { pdfResponse } from '@/endpoints/adminResponse'
import { createLogger } from '@/lib/monitoring/logger'

import { adminOrderAction, loadAdminOrder, orderActionError } from './_action'

// Bestell-Aktionen der Verwaltung über den Aktions-Rahmen (`_action.ts`, PLAN P5.9–P5.12):
// `POST /api/orders/:id/resend-email` `{ template, dialogKey }` – M01/M02/M05/M06/M07 erneut senden (P5.9),
// `POST /api/orders/:id/packed` `{ packaging? }` – „Gepackt“ (O6) mit Verpackungserfassung (P5.10/P5.11),
// `POST /api/orders/:id/packing` `{ checklist?, packaging?, packingPhotos? }` – Packen speichern (P5.11),
// `POST /api/orders/:id/withdraw-carrier-consent` – DHL-Einwilligung widerrufen (P5.10, R-101),
// `POST /api/orders/:id/ship` `{ carrier?, trackingNumber?, confirmWithoutPackingPhoto?, packaging? }` – O7 (P5.11;
// Mail M06 ergänzt P5.15),
// `GET /api/orders/:id/packing-slip.pdf` – Packzettel ohne Preise (P5.12).
// Dienste werden dynamisch geladen (sie hängen über die Outbox bzw. die Reservierung an der Payload-Konfiguration).

const log = createLogger()

const resendEmailEndpoint = adminOrderAction('resend-email', async ({ req, order, body }) => {
  const { resendOrderEmail } = await import('@/lib/commerce/resendEmail')
  const res = await resendOrderEmail(req, order, body.template, body.dialogKey)
  return {
    doc: order,
    unchanged: res.unchanged,
    extra: { emailLogId: res.emailLogId, status: res.status },
    afterCommit: async () => {
      const { runEmailJobNow } = await import('@/lib/email/outbox')
      await runEmailJobNow(req.payload, res.jobId)
    },
  }
})

const packedEndpoint = adminOrderAction('packed', async ({ req, order, body, now }) => {
  const { markPacked } = await import('@/lib/commerce/packOrder')
  const res = await markPacked(req, order, { packaging: packagingOf(body) }, now)
  return { doc: res.order, unchanged: res.unchanged }
})

const packingEndpoint = adminOrderAction('packing', async ({ req, order, body, now }) => {
  const { savePacking } = await import('@/lib/commerce/packOrder')
  const doc = await savePacking(
    req,
    order,
    {
      checklist: body.checklist,
      packaging: packagingOf(body),
      packingPhotos: body.packingPhotos,
    },
    now,
  )
  return { doc }
})

const withdrawConsentEndpoint = adminOrderAction(
  'withdraw-carrier-consent',
  async ({ req, order, now }) => {
    const { withdrawCarrierConsent } = await import('@/lib/commerce/carrierConsent')
    const res = await withdrawCarrierConsent(req, order, now)
    return { doc: res.order, unchanged: res.unchanged }
  },
)

const shipEndpoint = adminOrderAction('ship', async ({ req, order, body, now }) => {
  const { shipOrder } = await import('@/lib/commerce/shipOrder')
  const res = await shipOrder(
    req,
    order,
    {
      carrier: body.carrier,
      trackingNumber: body.trackingNumber,
      confirmWithoutPackingPhoto: body.confirmWithoutPackingPhoto,
      packaging: packagingOf(body),
    },
    now,
  )
  return { doc: res.order, unchanged: res.unchanged }
})

function packagingOf(body: Record<string, unknown>) {
  const p = body.packaging
  return p && typeof p === 'object' && !Array.isArray(p)
    ? (p as { templateKey?: unknown; components?: unknown })
    : null
}

const packingSlipEndpoint: Endpoint = {
  path: '/:id/packing-slip.pdf',
  method: 'get',
  handler: async (req) => {
    const order = await loadAdminOrder(req)
    if (order instanceof Response) return order
    try {
      const { renderPackingSlip } = await import('@/lib/pdf/packingDocs')
      const pdf = await renderPackingSlip(req, order)
      return pdfResponse(pdf, `packzettel-${order.orderNumber}.pdf`)
    } catch (err) {
      log.error('orders.packing_slip_failed', {
        orderId: order.id,
        reason: (err as Error)?.message,
      })
      return orderActionError(500, 'Packzettel konnte nicht erstellt werden.')
    }
  },
}

export const orderAdminEndpoints: Endpoint[] = [
  resendEmailEndpoint,
  packedEndpoint,
  packingEndpoint,
  withdrawConsentEndpoint,
  shipEndpoint,
  packingSlipEndpoint,
]
