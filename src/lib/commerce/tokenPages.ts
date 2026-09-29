import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { buildLegalAttachments } from '@/lib/legal/attachments'
import { createLogger } from '@/lib/monitoring/logger'
import type { PaymentsAdapter } from '@/lib/payments'
import { ipHash } from '@/lib/security/ipHash'
import { clientIp, hit, retryAfterSeconds, type RateLimitResult } from '@/lib/security/rateLimit'
import { readStoredFile } from '@/lib/storage/read'
import type { Invoice } from '@/payload-types'

import { orderLegalDocuments } from './orderView'
import { findOrderByStatusToken, getThanksState } from './thanksState'

// Token-Endpunkte (ARCHITEKTUR §2.5, §8.3, §8.5): `GET /api/checkout/[token]/state` (Zustandscode der wartenden
// Danke-Seite, P4.17) und `GET /api/orders/[token]/documents/[file]` (Rechtstext-PDFs der Bestellung, P4.23). Beide mit
// Rate-Limit `token_pages` (60/min je IP-Hash), `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`,
// `X-Robots-Tag: noindex, nofollow`; unbekannter Token → 404. Der Token steht nie im Log (Pfade normalisiert der
// Logger, `normalizeLogPath`).

const log = createLogger()

/**
 * Belege (Rechnung, Gutschrift) über den Status-Link: gesperrt (R-067 ist strenger als KONZEPT §4.12, ARCHITEKTUR C-24).
 * Freischaltung nur nach Antwort der Kanzlei (P11) – dann liefert die Dokument-Route auch `<Belegnummer>.pdf`.
 */
export const STATUS_PAGE_INVOICE_DOWNLOAD = false as boolean

export const TOKEN_PAGE_HEADERS = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
} as const

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...TOKEN_PAGE_HEADERS, ...extra } })

const notFound = () =>
  new Response('Not Found', {
    status: 404,
    headers: { ...TOKEN_PAGE_HEADERS, 'content-type': 'text/plain; charset=utf-8' },
  })

/** Treffer im Bucket `token_pages` für die anfragende IP (IP-Hash, R-134). */
export async function hitTokenPages(
  headers: Pick<Headers, 'get'>,
  payload: Payload,
  now: Date,
): Promise<RateLimitResult> {
  const ip = clientIp(headers) ?? 'unknown'
  return hit('token_pages', ipHash(ip, { now: () => now }), now, payload)
}

export interface TokenDeps {
  payload?: Payload
  payments?: PaymentsAdapter
}

/** `GET /api/checkout/[token]/state`: nur `{ state }` – keine Bestellnummer, keine Personendaten. */
export async function handleCheckoutState(
  request: Request,
  token: string,
  now: Date,
  deps: TokenDeps = {},
): Promise<Response> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const limit = await hitTokenPages(request.headers, payload, now)
  if (!limit.allowed) {
    return json({ error: 'rate_limited' }, 429, {
      'retry-after': String(retryAfterSeconds(limit, now)),
    })
  }
  const state = await getThanksState(token, now, { payload, payments: deps.payments })
  if (!state) return json({ error: 'not_found' }, 404)
  return json({ state: state.code })
}

const RECEIPT_FILE = /^(BSP-)?(RE|GS)-\d{4}-\d{1,6}\.pdf$/

async function receiptPdf(payload: Payload, orderId: number, file: string): Promise<Buffer | null> {
  const number = file.slice(0, -'.pdf'.length)
  const res = await payload.find({
    collection: 'invoices',
    where: { and: [{ order: { equals: orderId } }, { number: { equals: number } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const invoice = res.docs[0] as Invoice | undefined
  const pdfId = invoice?.pdf && typeof invoice.pdf === 'object' ? invoice.pdf.id : invoice?.pdf
  if (!pdfId) return null
  const upload = await payload.findByID({
    collection: 'private-uploads',
    id: pdfId as number,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (!upload?.filename) return null
  return readStoredFile('private', upload.filename, (upload as { prefix?: string | null }).prefix)
}

/**
 * `GET /api/orders/[token]/documents/[file]`: nur die Rechtstext-PDFs aus `orders.legalTextVersions` unter ihren
 * Anhangsnamen (`AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf`, EN-Bestellung ggf. `…_EN.pdf`). Jeder
 * andere Dateiname – auch Rechnung oder Gutschrift derselben Bestellung – ergibt 404, solange
 * `STATUS_PAGE_INVOICE_DOWNLOAD = false`.
 */
export async function handleOrderDocument(
  request: Request,
  token: string,
  file: string,
  now: Date,
  deps: TokenDeps = {},
): Promise<Response> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const limit = await hitTokenPages(request.headers, payload, now)
  if (!limit.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        ...TOKEN_PAGE_HEADERS,
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': String(retryAfterSeconds(limit, now)),
      },
    })
  }
  const order = await findOrderByStatusToken(payload, token)
  if (!order) return notFound()

  let data: Buffer | null = null
  if (RECEIPT_FILE.test(file)) {
    if (!STATUS_PAGE_INVOICE_DOWNLOAD) return notFound()
    data = await receiptPdf(payload, order.id, file)
  } else {
    const { files } = await orderLegalDocuments(payload, order, order.locale)
    if (!files.includes(file)) return notFound()
    try {
      const { createLocalReq } = await import('payload')
      const req = await createLocalReq({ context: { system: true } }, payload)
      const attachments = await buildLegalAttachments(req, order)
      data = attachments.find((a) => a.filename === file)?.content ?? null
    } catch (err) {
      log.warn('order_documents.unavailable', {
        orderId: order.id,
        file,
        error: (err as Error)?.message,
      })
      data = null
    }
  }
  if (!data) return notFound()
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      ...TOKEN_PAGE_HEADERS,
      'content-type': 'application/pdf',
      'content-length': String(data.length),
      'content-disposition': `inline; filename="${file}"`,
      'x-content-type-options': 'nosniff',
    },
  })
}
