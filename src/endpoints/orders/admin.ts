import type { Endpoint } from 'payload'

import { pdfResponse } from '@/endpoints/adminResponse'
import { createLogger, errorSummary } from '@/lib/monitoring/logger'

import { adminOrderAction, loadAdminOrder, OrderActionError, orderActionError } from './_action'

// Bestell-Aktionen der Verwaltung über den Aktions-Rahmen (`_action.ts`, PLAN P5.9–P5.12):
// `POST /api/orders/:id/resend-email` `{ template, dialogKey }` – M01/M02/M05/M06/M07 erneut senden (P5.9),
// `POST /api/orders/:id/packed` `{ packaging? }` – „Gepackt“ (O6) mit Verpackungserfassung (P5.10/P5.11),
// `POST /api/orders/:id/packing` `{ checklist?, packaging?, packingPhotos? }` – Packen speichern (P5.11),
// `POST /api/orders/:id/withdraw-carrier-consent` `{ confirmationMail? }` – DHL-Einwilligung widerrufen (P5.10, R-101),
// auf Wunsch mit Bestätigung M16 (P6.18),
// `POST /api/orders/:id/ship` `{ carrier?, trackingNumber?, confirmWithoutPackingPhoto?, packaging? }` – O7 mit
// Versandmail M06 (P5.11/P5.15),
// `POST /api/orders/:id/delivered` – „Zugestellt“ (O10, manuell, P5.16),
// `POST /api/orders/:id/tracking` `{ carrier?, trackingNumber, resendMail }` – Sendungsnummer korrigieren (P5.16),
// `POST /api/orders/:id/pickup-ready` `{ messageText }` – „Bereit zur Abholung“ (O8, M07, P5.17),
// `POST /api/orders/:id/picked-up` – „Abgeholt“ (O9, P5.17),
// `GET /api/orders/:id/packing-slip.pdf` – Packzettel ohne Preise (P5.12),
// `POST /api/orders/:id/attention-done` – „Erledigt“ für eine Markierung von Hand (V-31, P20.6); Markierungen des
// Systems (Anfechtung, gescheiterte Erstattung, Betrag stimmt nicht …, auch „Stücke zuordnen“ eines offenen
// Teil-Widerrufs) bleiben, bis die Ursache behoben ist.
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
  async ({ req, order, body, now }) => {
    const { withdrawCarrierConsent } = await import('@/lib/commerce/carrierConsent')
    const res = await withdrawCarrierConsent(req, order, now, {
      confirmationMail: body.confirmationMail === true,
    })
    return {
      doc: res.order,
      unchanged: res.unchanged,
      afterCommit: async () => {
        const { runEmailJobNow } = await import('@/lib/email/outbox')
        await runEmailJobNow(req.payload, res.mailJobId, { now })
      },
    }
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
  return {
    doc: res.order,
    unchanged: res.unchanged,
    afterCommit: async () => {
      const { runEmailJobNow } = await import('@/lib/email/outbox')
      await runEmailJobNow(req.payload, res.mailJobId, { now })
    },
  }
})

const deliveredEndpoint = adminOrderAction('delivered', async ({ req, order, now }) => {
  const { markDeliveredByAdmin } = await import('@/lib/commerce/shipped')
  const res = await markDeliveredByAdmin(req, order, now)
  return { doc: res.order, unchanged: res.unchanged }
})

const trackingEndpoint = adminOrderAction('tracking', async ({ req, order, body, now }) => {
  const { fixTrackingNumber } = await import('@/lib/commerce/shipped')
  const res = await fixTrackingNumber(
    req,
    order,
    { carrier: body.carrier, trackingNumber: body.trackingNumber, resendMail: body.resendMail },
    now,
  )
  return {
    doc: res.order,
    unchanged: res.unchanged,
    extra: { mailQueued: res.mailJobId !== null },
    afterCommit: async () => {
      const { runEmailJobNow } = await import('@/lib/email/outbox')
      await runEmailJobNow(req.payload, res.mailJobId, { now })
    },
  }
})

const pickupReadyEndpoint = adminOrderAction('pickup-ready', async ({ req, order, body, now }) => {
  const { markReadyForPickup } = await import('@/lib/commerce/pickup')
  const res = await markReadyForPickup(req, order, { messageText: body.messageText }, now)
  return {
    doc: res.order,
    unchanged: res.unchanged,
    afterCommit: async () => {
      const { runEmailJobNow } = await import('@/lib/email/outbox')
      await runEmailJobNow(req.payload, res.mailJobId, { now })
    },
  }
})

const pickedUpEndpoint = adminOrderAction('picked-up', async ({ req, order, now }) => {
  const { markPickedUp } = await import('@/lib/commerce/pickup')
  const res = await markPickedUp(req, order, now)
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
        reason: errorSummary(err),
      })
      return orderActionError(500, 'Packzettel konnte nicht erstellt werden.')
    }
  },
}

const attentionDoneEndpoint = adminOrderAction('attention-done', async ({ req, order }) => {
  const a = order.adminAttention
  if (!a?.flag) return { doc: order, unchanged: true }
  if (a.reason !== 'manual') {
    throw new OrderActionError(
      409,
      'Diese Markierung hat das System gesetzt – sie verschwindet, sobald die Ursache behoben ist.',
    )
  }
  // „Stücke zuordnen“ eines offenen Teil-Widerrufs: auch mit Grund `manual` vom System gesetzt – verschwindet beim
  // Zuordnen von selbst (sonst ginge der Hinweis verloren, solange Packen und Versand noch gesperrt sind).
  const { isUnassignedWithdrawalHint, unassignedWithdrawalOf } =
    await import('@/lib/commerce/withdrawalHold')
  const ref = await unassignedWithdrawalOf(req, order.id)
  if (isUnassignedWithdrawalHint(a, ref)) {
    throw new OrderActionError(
      409,
      `Dieser Hinweis verschwindet von selbst, sobald du beim Widerruf ${ref} die Stücke zugeordnet hast (Widerrufe → ${ref} → „Stücke zuordnen“).`,
    )
  }
  const doc = await req.payload.update({
    collection: 'orders',
    id: order.id,
    data: { adminAttention: { flag: false, reason: null, note: null } },
    depth: 0,
    overrideAccess: true,
    req,
  })
  return { doc }
})

export const orderAdminEndpoints: Endpoint[] = [
  resendEmailEndpoint,
  packedEndpoint,
  packingEndpoint,
  withdrawConsentEndpoint,
  shipEndpoint,
  deliveredEndpoint,
  trackingEndpoint,
  pickupReadyEndpoint,
  pickedUpEndpoint,
  packingSlipEndpoint,
  attentionDoneEndpoint,
]
