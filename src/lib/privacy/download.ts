import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { hitTokenPages, TOKEN_PAGE_HEADERS } from '@/lib/commerce/tokenPages'
import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/monitoring/logger'
import { privacyExportDeleteAfter } from '@/lib/retention/policy'
import { retryAfterSeconds } from '@/lib/security/rateLimit'
import { STORAGE_PREFIX } from '@/lib/storage'
import { readStoredFile } from '@/lib/storage/read'
import { signedPrivateUrl } from '@/lib/storage/signed'
import type { PrivacyRequest, PrivateUpload } from '@/payload-types'

import { verifyPrivacyExportToken } from './exportToken'

// `GET /api/privacy-export/[token]` (ARCHITEKTUR §2.5, R-137, PLAN P6.17): Download des DSGVO-Exports über den Link aus
// M14 – ohne Admin-Sitzung. Signierter Token ohne Personendaten, 7 Tage gültig; danach, nach Löschung der Datei (L-17,
// 30 Tage nach der Antwort) oder bei ersetztem Export → 410. Unbekannter/verfälschter Token → 404. Rate-Limit
// `token_pages`, `private, no-store`, `Referrer-Policy: no-referrer`, `Content-Disposition: attachment`; bei `s3`
// Weiterleitung auf eine signierte URL (≤ 300 s, R-136).

const log = createLogger()

const plain = (status: number, text: string, extra: Record<string, string> = {}) =>
  new Response(text, {
    status,
    headers: { ...TOKEN_PAGE_HEADERS, 'content-type': 'text/plain; charset=utf-8', ...extra },
  })
const gone = () => plain(410, 'Gone – dieser Link ist abgelaufen. / This link has expired.')

export async function handlePrivacyExport(
  request: Request,
  token: string,
  now: Date,
  deps: { payload?: Payload } = {},
): Promise<Response> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const limit = await hitTokenPages(request.headers, payload, now)
  if (!limit.allowed) {
    return plain(429, 'Too Many Requests', { 'retry-after': String(retryAfterSeconds(limit, now)) })
  }
  const check = verifyPrivacyExportToken(token, now)
  if (!check.ok) return check.reason === 'expired' ? gone() : plain(404, 'Not Found')
  const pr = (await payload.findByID({
    collection: 'privacy-requests',
    id: check.requestId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as PrivacyRequest | null
  if (!pr) return gone()
  const fileId =
    typeof pr.exportFile === 'object' && pr.exportFile ? pr.exportFile.id : (pr.exportFile ?? null)
  if (!fileId) return gone()
  if (
    pr.answeredAt &&
    now.getTime() >= privacyExportDeleteAfter(new Date(pr.answeredAt)).getTime()
  ) {
    return gone()
  }
  const upload = (await payload.findByID({
    collection: 'private-uploads',
    id: fileId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as PrivateUpload | null
  if (!upload?.filename || upload.purpose !== 'data_export') return gone()
  const prefix = upload.prefix ?? STORAGE_PREFIX.private
  if (getEnv().STORAGE_DRIVER === 's3') {
    const url = await signedPrivateUrl(`${prefix}/${upload.filename}`)
    if (!url) return gone()
    return new Response(null, { status: 302, headers: { ...TOKEN_PAGE_HEADERS, location: url } })
  }
  const bytes = await readStoredFile('private', upload.filename, prefix)
  if (!bytes) {
    log.warn('privacy_export.file_missing', { requestId: pr.id })
    return gone()
  }
  log.info('privacy_export.downloaded', { requestId: pr.id })
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...TOKEN_PAGE_HEADERS,
      'content-type': 'application/zip',
      'content-length': String(bytes.length),
      'content-disposition': `attachment; filename="${upload.filename}"`,
      'x-content-type-options': 'nosniff',
    },
  })
}
