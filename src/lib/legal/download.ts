import 'server-only'

import type { Payload } from 'payload'

import { seedPreviewModeActive } from '@/lib/env'
import { LEGAL_TEXT_TYPES, type LegalTextType, type Locale } from '@/lib/enums'
import { readStoredFile } from '@/lib/storage/read'
import type { LegalText } from '@/payload-types'

import { getActiveLegalText } from './getActive'

// Öffentliche Rechtstext-PDFs (KONZEPT §2.2, ARCHITEKTUR §2.5): `/api/legal/[type].pdf?locale=de` (zu „jetzt“ gültige
// Fassung) und `/api/legal/[type]/[versionId].pdf` (eine bestimmte veröffentlichte bzw. abgelöste Fassung). Entwürfe,
// geplante Fassungen, unbekannte Typen und Fassungen ohne PDF → 404. EN ohne EN-PDF → deutsches PDF (R-015).

export const LEGAL_PDF_CACHE_CONTROL = 'public, max-age=3600'

const isType = (v: string): v is LegalTextType =>
  (LEGAL_TEXT_TYPES as readonly string[]).includes(v)
const PUBLIC_STATUSES = new Set(['active', 'superseded'])

export type LegalPdfRequest =
  | { kind: 'current'; type: LegalTextType; locale: Locale }
  | { kind: 'version'; type: LegalTextType; id: number; locale: Locale }

/** Pfadsegmente nach `/api/legal/` → Anfrage, oder `null` (404). */
export function parseLegalPdfPath(
  segments: readonly string[],
  localeParam: string | null,
): LegalPdfRequest | null {
  const locale: Locale = localeParam === 'en' ? 'en' : 'de'
  if (localeParam !== null && localeParam !== 'de' && localeParam !== 'en') return null
  if (segments.length === 1) {
    const m = /^([a-z-]+)\.pdf$/.exec(segments[0] ?? '')
    if (!m || !isType(m[1]!)) return null
    return { kind: 'current', type: m[1], locale }
  }
  if (segments.length === 2) {
    const type = segments[0] ?? ''
    const m = /^([1-9]\d{0,9})\.pdf$/.exec(segments[1] ?? '')
    if (!isType(type) || !m) return null
    return { kind: 'version', type, id: Number(m[1]), locale }
  }
  return null
}

const notFound = () =>
  new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })

async function findVersion(payload: Payload, type: LegalTextType, id: number) {
  const doc = await payload.findByID({
    collection: 'legal-texts',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  return doc && doc.type === type ? doc : null
}

/** Antwort der Download-Route (ohne Cookies, nur eigener Speicher). */
export async function legalPdfResponse(
  payload: Payload,
  segments: readonly string[],
  localeParam: string | null,
  now: Date,
): Promise<Response> {
  const request = parseLegalPdfPath(segments, localeParam)
  if (!request) return notFound()
  const doc: LegalText | null =
    request.kind === 'current'
      ? await getActiveLegalText(request.type, now, { payload })
      : await findVersion(payload, request.type, request.id)
  if (!doc || !PUBLIC_STATUSES.has(doc.status)) return notFound()
  if (doc.seed && !seedPreviewModeActive()) return notFound()
  const idOf = (v: unknown) => (typeof v === 'object' && v ? (v as { id: number }).id : v)
  const pdfId = (request.locale === 'en' && idOf(doc.pdfEn)) || idOf(doc.pdfDe)
  if (!pdfId) return notFound()
  const file = await payload.findByID({
    collection: 'documents',
    id: pdfId as number,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (!file?.filename) return notFound()
  const data = await readStoredFile(
    'documents',
    file.filename,
    (file as { prefix?: string | null }).prefix,
  )
  if (!data) return notFound()
  const name = `${doc.type}_v${doc.version}${idOf(doc.pdfEn) === pdfId ? '_en' : ''}.pdf`
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(data.length),
      'content-disposition': `inline; filename="${name}"`,
      'cache-control': LEGAL_PDF_CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
    },
  })
}
