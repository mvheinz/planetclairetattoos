import type { Endpoint } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'

// „Erstatten“ für Zahlungen ohne Bestellung (U-58 a, J-26/J-27; nur Verwaltung):
// `POST /api/checkouts/:id/refund-stray-payment` `{ paymentIntentId }` → `{ unchanged, status }`. Zustandsbasiert
// idempotent (läuft/erstattet → `unchanged: true`), Audit `stray_payment_refunded` je Versuch.

const log = createLogger()

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: ADMIN_NO_STORE })

export const refundStrayPaymentEndpoint: Endpoint = {
  path: '/:id/refund-stray-payment',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json({ error: 'Nur für die Verwaltung.' }, 403)
    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Unbekannte Kasse.' }, 404)
    const body = await readJsonBody(req)
    const paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId : ''
    if (!/^[A-Za-z0-9_-]{3,255}$/.test(paymentIntentId)) {
      return json({ error: 'Welche Zahlung? (paymentIntentId fehlt)' }, 400)
    }
    const { refundStrayPayment, StrayRefundError } = await import('@/lib/commerce/strayPayments')
    try {
      const res = await refundStrayPayment(req, {
        checkoutId: id,
        paymentIntentId,
        now: requestNow(req),
      })
      return json({
        unchanged: res.unchanged,
        status: res.status,
        message: res.unchanged
          ? undefined
          : res.status === 'succeeded'
            ? 'Erstattet.'
            : 'Erstattung angestoßen – der Zahlungsanbieter meldet sich.',
      })
    } catch (err) {
      if (err instanceof StrayRefundError) return json({ error: err.message }, err.status)
      log.error('stray_refund.failed', { reason: (err as Error)?.message })
      return json({ error: 'Gerade nicht möglich – bitte später noch einmal versuchen.' }, 500)
    }
  },
}

export const strayPaymentEndpoints: Endpoint[] = [refundStrayPaymentEndpoint]
