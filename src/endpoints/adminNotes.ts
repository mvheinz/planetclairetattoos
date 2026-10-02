import { ValidationError, type CollectionSlug, type Endpoint } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { createLogger } from '@/lib/monitoring/logger'

// `POST /api/<collection>/:id/notes` `{ adminNotes }` (PLAN P5.19/P5.20): interne Notizen separat speichern – nur das
// Feld `adminNotes`, alle anderen Angaben bleiben unberührt (Widerrufe: Erklärung unveränderlich, DM-WDR-03). Nur
// angemeldete Verwaltung; gleicher Text → `{ unchanged: true }`.

const log = createLogger()

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: ADMIN_NO_STORE })

export function adminNotesEndpoint(
  collection: Extract<CollectionSlug, 'withdrawals' | 'inquiries'>,
  maxLength: number,
): Endpoint {
  return {
    path: '/:id/notes',
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
      const id = Number(req.routeParams?.id)
      if (!Number.isSafeInteger(id) || id < 1) return json(404, 'Nicht gefunden.')
      const body = await readJsonBody(req)
      const raw = body.adminNotes
      if (raw !== null && raw !== undefined && typeof raw !== 'string') {
        return json(400, 'Bitte einen Text angeben.')
      }
      const adminNotes = (raw ?? '').trim()
      if (adminNotes.length > maxLength) {
        return json(400, `Höchstens ${maxLength} Zeichen.`)
      }
      const doc = await req.payload.findByID({
        collection,
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })
      if (!doc) return json(404, 'Nicht gefunden.')
      if ((doc.adminNotes ?? '') === adminNotes)
        return adminActionResponse({ doc, unchanged: true })
      try {
        const updated = await req.payload.update({
          collection,
          id,
          data: { adminNotes: adminNotes || null },
          depth: 0,
          overrideAccess: true,
          req,
        })
        return adminActionResponse({ doc: updated })
      } catch (err) {
        if (err instanceof ValidationError) return json(400, err.message)
        log.error('admin_notes.save_failed', { collection, id, reason: (err as Error)?.message })
        return json(500, 'Speichern hat nicht geklappt. Bitte noch einmal versuchen.')
      }
    },
  }
}
