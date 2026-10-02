import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { orderActionErrorResponse } from '@/endpoints/orders/_action'
import { readJsonBody } from '@/endpoints/products/actions'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'

// Aktionen der Ansicht „Datenschutz-Anfragen“ `/export/datenschutz` (PLAN P6.16–P6.18, KONZEPT §7.15, LOESCHKONZEPT §5;
// nur angemeldete Verwaltung, sonst 403):
// `POST /api/privacy-requests/intake` – Anfrage erfassen (P6.16) ·
// `POST /api/privacy-requests/:id/save` – Status, Identität, Verlängerung, Abschluss, Notizen (P6.16) ·
// `POST /api/privacy-requests/:id/search` `{ email?, orderNumber?, name? }` – Personensuche (P6.17, R-150) ·
// `POST /api/privacy-requests/:id/export` – Auskunft-Export als ZIP (P6.17) ·
// `POST /api/privacy-requests/:id/send-access` – Antwort M14 mit Download-Link (P6.17) ·
// `POST /api/privacy-requests/:id/erasure` `{ decisions }` – Löschen/Einschränken/Behalten, Antwort M15 (P6.18, R-151) ·
// `POST /api/privacy-requests/:id/rectify` `{ orderId, changes }` – Berichtigung (P6.18, R-152).
// Eine Transaktion je Aufruf; Mails nur über die Outbox, nach dem Commit direkt versendet.

const log = createLogger()

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: ADMIN_NO_STORE })

export interface PrivacyActionResult {
  doc: unknown
  unchanged?: boolean
  extra?: Record<string, unknown>
  /** Mail-Jobs, die nach dem Commit direkt laufen. */
  jobs?: (number | string | null)[]
}

type Handler = (
  req: PayloadRequest,
  id: number,
  body: Record<string, unknown>,
  now: Date,
) => Promise<PrivacyActionResult>

const requests = () => import('@/lib/privacy/requests')

async function runJobs(req: PayloadRequest, jobs: PrivacyActionResult['jobs'], now: Date) {
  if (!jobs?.length) return
  const { runEmailJobNow } = await import('@/lib/email/outbox')
  for (const job of jobs) {
    await runEmailJobNow(req.payload, job ?? null, { now }).catch((e: unknown) =>
      log.error('privacy.mail_failed', { reason: (e as Error)?.message }),
    )
  }
}

function privacyAction(path: string, handler: Handler): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
      const id = Number(req.routeParams?.id)
      if (!Number.isSafeInteger(id) || id < 1) return json(404, 'Unbekannte Datenschutz-Anfrage.')
      try {
        const body = await readJsonBody(req)
        const now = requestNow(req)
        const result = await inTransaction(req, () => handler(req, id, body, now))
        await runJobs(req, result.jobs, now)
        log.info('privacy.admin_action', { id, path, unchanged: !!result.unchanged })
        return adminActionResponse(
          { doc: result.doc, unchanged: result.unchanged },
          result.extra ?? {},
        )
      } catch (err) {
        return orderActionErrorResponse(err, `privacy-requests/${path}`)
      }
    },
  }
}

export const privacyIntakeEndpoint: Endpoint = {
  path: '/intake',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, 'Nicht erlaubt.')
    try {
      const body = await readJsonBody(req)
      const now = requestNow(req)
      const { createPrivacyRequest } = await requests()
      const doc = await inTransaction(req, () => createPrivacyRequest(req, body, now))
      log.info('privacy.intake', { id: doc.id })
      return Response.json({ doc }, { status: 201, headers: ADMIN_NO_STORE })
    } catch (err) {
      return orderActionErrorResponse(err, 'privacy-requests/intake')
    }
  },
}

export const privacySaveEndpoint = privacyAction('save', async (req, id, body, now) =>
  (await requests()).savePrivacyRequest(req, id, body, now),
)

const exporter = () => import('@/lib/privacy/export')

const personQuery = (body: Record<string, unknown>) => ({
  email: typeof body.email === 'string' ? body.email : null,
  orderNumber: typeof body.orderNumber === 'string' ? body.orderNumber : null,
  name: typeof body.name === 'string' ? body.name : null,
})

export const privacySearchEndpoint = privacyAction('search', async (req, id, body, now) => {
  const { searchForRequest } = await exporter()
  const { countMatches } = await import('@/lib/privacy/search')
  const res = await searchForRequest(req, id, personQuery(body), now)
  return { doc: res.request, extra: { counts: countMatches(res.matches) } }
})

export const privacyExportEndpoint = privacyAction('export', async (req, id, body, now) => {
  const { createPrivacyExport } = await exporter()
  const res = await createPrivacyExport(req, id, personQuery(body), now)
  return { doc: res.request, extra: { counts: res.counts, exportFileId: res.upload.id } }
})

export const privacySendAccessEndpoint = privacyAction('send-access', async (req, id, _b, now) => {
  const { sendAccessResponse } = await exporter()
  const res = await sendAccessResponse(req, id, now)
  return { doc: res.request, unchanged: res.unchanged, jobs: [res.jobId] }
})

export const PRIVACY_ADMIN_ENDPOINTS: Endpoint[] = [
  privacyIntakeEndpoint,
  privacySaveEndpoint,
  privacySearchEndpoint,
  privacyExportEndpoint,
  privacySendAccessEndpoint,
]
