import type { Endpoint } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, pdfResponse } from '@/endpoints/adminResponse'
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'

// `GET /api/admin/compliance/template.pdf?category=<Kategorie>` (PLAN P5.13, RECHT R-203, ARCHITEKTUR §2.5): Vorlage
// „Technische Unterlagen je Kategorie“ als PDF – nur Verwaltung (sonst 403), unbekannte Kategorie 400.

const log = createLogger()
const error = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: ADMIN_NO_STORE })

const isCategory = (v: unknown): v is ProductCategory =>
  (PRODUCT_CATEGORIES as readonly string[]).includes(String(v))

export const complianceTemplateEndpoint: Endpoint = {
  path: '/admin/compliance/template.pdf',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) return error(403, 'Nicht erlaubt.')
    const category = req.searchParams.get('category')
    if (!isCategory(category)) return error(400, 'Bitte eine gültige Kategorie wählen.')
    try {
      const { renderComplianceTemplate } = await import('@/lib/pdf/ComplianceTemplate')
      const pdf = await renderComplianceTemplate(req, category)
      return pdfResponse(pdf, `technische-unterlagen-${category}.pdf`)
    } catch (err) {
      log.error('compliance.template_failed', { category, reason: (err as Error)?.message })
      return error(500, 'Vorlage konnte nicht erstellt werden.')
    }
  },
}
