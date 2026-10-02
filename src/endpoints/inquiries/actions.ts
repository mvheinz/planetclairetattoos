import { ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { writeAudit } from '@/lib/audit'
import { INQUIRY_STATUSES, type InquiryStatus } from '@/lib/enums'
import { canTransitionInquiry, inquiryTransitionId } from '@/lib/inquiries/transitions'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import { writeDeletionLog } from '@/lib/retention/log'
import { formatBerlin } from '@/lib/time'
import type { Inquiry, PrivateUpload } from '@/payload-types'

// Aktionen der Ansicht „Anfragen“ (PLAN P5.20, KONZEPT §7.11, nur angemeldete Verwaltung):
// `POST /api/inquiries/:id/status` `{ status }` – Wechsel nach `INQUIRY_TRANSITIONS` (KONZEPT §5.5); der Hook schreibt
// Audit `inquiry_status_changed` (Statusverlauf, DM-21) und setzt `lastActivityAt`, nie `deleteAfter` (L-10);
// gleicher Status → `{ unchanged: true }`, unerlaubt → 409.
// `POST /api/inquiries/:id/delete-now` `{ reference }` – „Jetzt löschen“: Anfrage und Referenzbilder sofort löschen
// (Speicherobjekte über den Upload-Hook), Audit `inquiry_deleted` nur mit Referenz und Datum, `deletion-log`
// (`ruleId = ADMIN`, `trigger = admin`). Die Referenz im Rumpf schützt vor dem Löschen der falschen Anfrage.

const log = createLogger()

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: ADMIN_NO_STORE })

async function loadInquiry(req: PayloadRequest): Promise<Inquiry | Response> {
  if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
  const id = Number(req.routeParams?.id)
  if (!Number.isSafeInteger(id) || id < 1) return json(404, 'Unbekannte Anfrage.')
  const doc = (await req.payload.findByID({
    collection: 'inquiries',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Inquiry | null
  return doc ?? json(404, 'Unbekannte Anfrage.')
}

const isStatus = (v: unknown): v is InquiryStatus =>
  typeof v === 'string' && (INQUIRY_STATUSES as readonly string[]).includes(v)

export const inquiryStatusEndpoint: Endpoint = {
  path: '/:id/status',
  method: 'post',
  handler: async (req) => {
    const inquiry = await loadInquiry(req)
    if (inquiry instanceof Response) return inquiry
    const body = await readJsonBody(req)
    const to = body.status
    if (!isStatus(to)) return json(400, 'Unbekannter Status.')
    const from = inquiry.status as InquiryStatus
    if (from === to) return adminActionResponse({ doc: inquiry, unchanged: true })
    if (!canTransitionInquiry(from, to)) {
      return json(409, `Die Anfrage kann nicht von „${from}“ nach „${to}“ wechseln.`)
    }
    try {
      const doc = await req.payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: { status: to },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, transition: inquiryTransitionId(from, to) },
      })
      log.info('inquiries.status', { id: inquiry.id, from, to })
      return adminActionResponse({ doc })
    } catch (err) {
      if (err instanceof ValidationError) return json(409, err.message)
      log.error('inquiries.status_failed', { id: inquiry.id, reason: (err as Error)?.message })
      return json(500, 'Unerwarteter Fehler. Bitte die Seite neu laden und noch einmal versuchen.')
    }
  },
}

/** Anzahl Speicherobjekte eines privaten Uploads (Original und Bildgrößen). */
function storageObjects(upload: PrivateUpload | null): number {
  if (!upload) return 0
  const sizes = Object.values((upload.sizes ?? {}) as Record<string, { filename?: string | null }>)
  return (upload.filename ? 1 : 0) + sizes.filter((s) => s?.filename).length
}

export const inquiryDeleteNowEndpoint: Endpoint = {
  path: '/:id/delete-now',
  method: 'post',
  handler: async (req) => {
    const inquiry = await loadInquiry(req)
    if (inquiry instanceof Response) return inquiry
    const body = await readJsonBody(req)
    if (body.reference !== inquiry.reference) {
      return json(400, 'Bitte die Nummer der Anfrage zur Bestätigung mitschicken.')
    }
    if (inquiry.privacy?.legalHold) {
      return json(
        409,
        'Die Anfrage ist gesperrt (Aufbewahrungspflicht) und kann nicht gelöscht werden.',
      )
    }
    const now = requestNow(req)
    const imageIds = (inquiry.referenceImages ?? [])
      .map((v) => (typeof v === 'number' ? v : v?.id))
      .filter((v): v is number => typeof v === 'number')
    try {
      await inTransaction(req, async () => {
        let objects = 0
        for (const id of imageIds) {
          const upload = (await req.payload.findByID({
            collection: 'private-uploads',
            id,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            req,
          })) as PrivateUpload | null
          objects += storageObjects(upload)
        }
        await req.payload.delete({
          collection: 'inquiries',
          id: inquiry.id,
          overrideAccess: true,
          req,
          context: { ...req.context, system: true },
        })
        await writeAudit(req, {
          action: 'inquiry_deleted',
          entityCollection: 'inquiries',
          entityId: inquiry.id,
          summary: `Anfrage ${inquiry.reference} am ${formatBerlin(now, 'dd.MM.yyyy')} gelöscht („Jetzt löschen“).`,
          seed: inquiry.seed ?? false,
        })
        await writeDeletionLog(req, {
          entityCollection: 'inquiries',
          entityId: inquiry.id,
          ruleId: 'ADMIN',
          action: 'deleted',
          trigger: 'admin',
          storageObjectsCount: objects,
          executedAt: now,
        })
      })
      log.info('inquiries.deleted_now', { id: inquiry.id, images: imageIds.length })
      return Response.json(
        { deleted: true, reference: inquiry.reference },
        { headers: ADMIN_NO_STORE },
      )
    } catch (err) {
      if (err instanceof ValidationError) return json(409, err.message)
      log.error('inquiries.delete_failed', { id: inquiry.id, reason: (err as Error)?.message })
      return json(
        500,
        'Löschen hat nicht geklappt. Bitte die Seite neu laden und noch einmal versuchen.',
      )
    }
  },
}

export const inquiryActionEndpoints: Endpoint[] = [inquiryStatusEndpoint, inquiryDeleteNowEndpoint]
