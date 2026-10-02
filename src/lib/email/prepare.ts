import 'server-only'

import { createHash } from 'node:crypto'

import type { PayloadRequest } from 'payload'

import { statusTokenForMail } from '@/lib/commerce/statusToken'
import { getEnv } from '@/lib/env'
import { buildLegalAttachments } from '@/lib/legal/attachments'
import { preservingReq } from '@/lib/payload/localReq'
import { readStoredFile } from '@/lib/storage/read'
import type { EmailLog, Invoice, Order } from '@/payload-types'

import { AttachmentNotReadyError } from './errors'
import { mailLinks, STATUS_TOKEN_PLACEHOLDER, type MailBusiness } from './layout'
import { getTemplate, templateMeta, type RequiredAttachment } from './registry'
import type { MailAttachment } from './types'

// Mail für den Versand vorbereiten (Task `sendEmail`, P4.13): Vorlage rendern, Status-Link aus dem Siegel der
// Bestellung (P4.1) erst ganz am Ende einsetzen, Pflicht-Anhänge laden. `bodySha256` entsteht aus Text + HTML mit dem
// festen Platzhalter an der Token-Stelle (KONZEPT §6.3, R-081) – Token und Link stehen nie im `email-log`.

export interface PreparedMail {
  subject: string
  html: string
  text: string
  attachments: MailAttachment[]
  templateVersion: string
  bodySha256: string
  /** Anhangsliste für `email-log.attachments` (ohne eingebettete Bilder). */
  attachmentLog: { filename: string; sha256: string; sizeBytes: number }[]
}

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

/** Hash-Grundlage des Inhalts: Text und HTML (mit Platzhalter statt Token). */
export function bodyHash(text: string, html: string): string {
  return sha256(`${text}\n\n${html}`)
}

async function invoicePdf(req: PayloadRequest, id: number | null, what: string) {
  const invoice =
    id === null
      ? null
      : ((await preservingReq(req, () =>
          req.payload.findByID({
            collection: 'invoices',
            id,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            req,
          }),
        )) as Invoice | null)
  if (!invoice || invoice.status !== 'issued' || !invoice.pdf)
    throw new AttachmentNotReadyError(what)
  const upload = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'private-uploads',
      id: idOf(invoice.pdf)!,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )
  const content = await readStoredFile(
    'private',
    upload.filename ?? '',
    (upload as { prefix?: string | null }).prefix,
  )
  if (!content) throw new AttachmentNotReadyError(`${invoice.number}.pdf`)
  return { filename: `${invoice.number}.pdf`, content, contentType: 'application/pdf' }
}

async function loadAttachments(
  req: PayloadRequest,
  kinds: readonly RequiredAttachment[],
  order: Order | null,
  data: Record<string, unknown>,
): Promise<MailAttachment[]> {
  const out: MailAttachment[] = []
  for (const kind of kinds) {
    if (!order) throw new Error(`Anhang „${kind}“ braucht eine Bestellung.`)
    if (kind === 'invoice') out.push(await invoicePdf(req, idOf(order.invoice), 'Rechnung'))
    if (kind === 'credit_note') {
      out.push(await invoicePdf(req, idOf(data.creditNoteId), 'Gutschrift'))
    }
    if (kind === 'legal_texts') {
      for (const a of await buildLegalAttachments(req, order)) {
        out.push({ filename: a.filename, content: a.content, contentType: a.contentType })
      }
    }
  }
  return out
}

/** Mail-Baustein „Grußformel und Signatur“ (`site-texts.emails.signature`, P5.27) in der Sprache der Mail. */
export async function mailSignature(
  req: PayloadRequest,
  locale: 'de' | 'en',
): Promise<string | null> {
  const texts = (await preservingReq(req, () =>
    req.payload.findGlobal({
      slug: 'site-texts',
      locale,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as { emails?: { signature?: string | null } | null }
  const signature = texts.emails?.signature?.trim()
  return signature ? signature : null
}

export async function prepareMail(
  req: PayloadRequest,
  log: EmailLog,
  data: Record<string, unknown>,
  now: Date,
): Promise<PreparedMail> {
  const env = getEnv()
  const meta = templateMeta(log.template)
  const def = getTemplate(log.template)
  const parsed = def.schema.parse(data)
  const orderId = idOf(log.order)
  const order =
    orderId === null
      ? null
      : ((await preservingReq(req, () =>
          req.payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )) as Order)
  const token = meta.orderMail && order ? await statusTokenForMail(req, order.id, { now }) : null
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({
      slug: 'settings',
      locale: log.locale,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )
  const signature = await mailSignature(req, log.locale)
  const links = mailLinks({
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    adminRoute: env.ADMIN_ROUTE,
    locale: log.locale,
    withStatusLink: token !== null,
  })
  const rendered = await def.render({
    locale: log.locale,
    data: parsed,
    links,
    business: { ...(settings.business as MailBusiness), signature },
    now,
  })
  const bodySha256 = bodyHash(rendered.text, rendered.html)
  const insert = (s: string) => (token ? s.split(STATUS_TOKEN_PLACEHOLDER).join(token) : s)
  const files = await loadAttachments(req, meta.attachments, order, parsed)
  return {
    subject: rendered.subject,
    html: insert(rendered.html),
    text: insert(rendered.text),
    attachments: [...rendered.images, ...files],
    templateVersion: def.version,
    bodySha256,
    attachmentLog: files.map((f) => ({
      filename: f.filename,
      sha256: sha256(f.content),
      sizeBytes: f.content.length,
    })),
  }
}
