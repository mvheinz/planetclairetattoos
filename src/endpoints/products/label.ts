import type { Endpoint } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, pdfResponse } from '@/endpoints/adminResponse'
import { createLogger } from '@/lib/monitoring/logger'

// `GET /api/products/:id/label.pdf` (PLAN P5.12, R-203): Etikett und Beileger eines Stücks als PDF, nur Verwaltung.

const log = createLogger()
const error = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: ADMIN_NO_STORE })

export const productLabelEndpoint: Endpoint = {
  path: '/:id/label.pdf',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) return error(403, 'Nicht erlaubt.')
    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id < 1) return error(404, 'Unbekanntes Stück.')
    try {
      const { renderProductLabel } = await import('@/lib/pdf/packingDocs')
      const pdf = await renderProductLabel(req, id)
      if (!pdf) return error(404, 'Unbekanntes Stück.')
      return pdfResponse(pdf, `etikett-${String(id)}.pdf`)
    } catch (err) {
      log.error('products.label_failed', { productId: id, reason: (err as Error)?.message })
      return error(500, 'Etikett konnte nicht erstellt werden.')
    }
  },
}
