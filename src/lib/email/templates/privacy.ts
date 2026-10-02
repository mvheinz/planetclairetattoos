import 'server-only'

import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'

import type { MailLinks } from '../layout'
import type { RenderedMail, TemplateRenderInput } from '../registry'

import {
  block,
  closingBlock,
  fill,
  fmtDate,
  greetingBlock,
  mailTexts,
  renderCustomerMail,
  type Block,
} from './kit'

// Datenschutz-Mails (PLAN P6.17/P6.18, KONZEPT §6 M14–M16, LOESCHKONZEPT §5.4/§5.6/§5.10, R-150–R-152) – Transaktions-
// mails über die Outbox, nur an die gespeicherte Adresse der Anfrage, keine Werbung (V-09), kein OS-Hinweis (V-01):
// - M14 `privacy_access_response`: Referenz, Baustein `privacyRequest.accessResponse` (bis zum Kanzlei-Wortlaut als
//   Platzhalter gekennzeichnet), signierter Download-Link (7 Tage gültig; der Token wird erst beim Versand an die Stelle
//   von `PRIVACY_EXPORT_TOKEN_PLACEHOLDER` gesetzt und steht nie im `email-log`), Löschtermin der Datei, Rechte und
//   Beschwerderecht.
// - M15 `privacy_erasure_response`: Referenz, Baustein `privacyRequest.erasureResponse`, je Datenbereich „gelöscht“,
//   „eingeschränkt bis {Datum}“ bzw. „aufbewahrt bis {Datum}“ (Art. 17 Abs. 3 lit. e), Belege unverändert bis Fristende,
//   Hinweis zu Empfängern (Art. 19) und Beschwerderecht.
// - M16 `consent_withdrawal_confirmation`: welche Einwilligung (DHL-Weitergabe bzw. Portfolio), Zeitpunkt, Wirkung ab
//   sofort.

export const PRIVACY_ACCESS_RESPONSE_VERSION = 'm14-v1'
export const PRIVACY_ERASURE_RESPONSE_VERSION = 'm15-v1'
export const CONSENT_WITHDRAWAL_CONFIRMATION_VERSION = 'm16-v1'

/** Platzhalter des Download-Tokens (wie der Status-Token: erst beim Versand eingesetzt, R-137). */
export const PRIVACY_EXPORT_TOKEN_PLACEHOLDER = '__PRIVACY_EXPORT_TOKEN__'

export function privacyExportUrl(links: Pick<MailLinks, 'siteUrl'>, token: string): string {
  return `${links.siteUrl}/api/privacy-export/${token}`
}

const REFERENCE = z.string().regex(/^DS-\d{4}-\d{4,}$/)
const ISO = z.string().datetime({ offset: true })

export const PRIVACY_AREAS = [
  'orders',
  'checkouts',
  'invoices',
  'withdrawals',
  'inquiries',
  'complaints',
  'emailLog',
  'consentLog',
  'privacyRequests',
  'files',
] as const
export type PrivacyArea = (typeof PRIVACY_AREAS)[number]

export const privacyAccessResponseDataSchema = z.strictObject({
  privacyRequestId: z.number().int().positive(),
  reference: REFERENCE,
  name: z.string().max(100).nullish(),
  /** Ablauf des Download-Links (7 Tage). */
  linkExpiresAt: ISO,
  /** Löschung der Exportdatei (Antwort + 30 Tage, L-17). */
  fileDeleteAt: ISO,
})
export type PrivacyAccessResponseData = z.infer<typeof privacyAccessResponseDataSchema>

export const privacyErasureResponseDataSchema = z.strictObject({
  privacyRequestId: z.number().int().positive(),
  reference: REFERENCE,
  name: z.string().max(100).nullish(),
  areas: z
    .array(
      z.strictObject({
        area: z.enum(PRIVACY_AREAS),
        outcome: z.enum(['deleted', 'restricted', 'kept', 'unchanged']),
        until: ISO.nullish(),
      }),
    )
    .min(1),
})
export type PrivacyErasureResponseData = z.infer<typeof privacyErasureResponseDataSchema>

export const consentWithdrawalConfirmationDataSchema = z.strictObject({
  purpose: z.enum(['carrier_email_forwarding', 'portfolio']),
  withdrawnAt: ISO,
  name: z.string().max(100).nullish(),
  orderNumber: z
    .string()
    .regex(/^(BSP-)?PC-\d{4}-\d{5}$/)
    .nullish(),
})
export type ConsentWithdrawalConfirmationData = z.infer<
  typeof consentWithdrawalConfirmationDataSchema
>

export const privacyAccessResponseSubject = (d: PrivacyAccessResponseData, locale: Locale) =>
  fill(mailTexts(locale).privacyAccessResponse.subject, { reference: d.reference })
export const privacyErasureResponseSubject = (d: PrivacyErasureResponseData, locale: Locale) =>
  fill(mailTexts(locale).privacyErasureResponse.subject, { reference: d.reference })
export const consentWithdrawalConfirmationSubject = (
  _d: ConsentWithdrawalConfirmationData,
  locale: Locale,
) => mailTexts(locale).consentWithdrawalConfirmation.subject

/** Baustein; als Platzhalter (vor dem Kanzlei-Wortlaut) gekennzeichnet. */
function snippetBlock(
  key: 'privacyRequest.accessResponse' | 'privacyRequest.erasureResponse',
  locale: Locale,
): Block {
  const snippet = getSnippet(key, locale)
  return (snippet.origin as string) === 'placeholder'
    ? block.placeholder(mailTexts(locale).common.placeholderMark, snippet.text)
    : block.p(snippet.text)
}

export async function renderPrivacyAccessResponse(
  input: TemplateRenderInput<PrivacyAccessResponseData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).privacyAccessResponse
  return renderCustomerMail({
    locale,
    subject: privacyAccessResponseSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: false,
    blocks: [
      greetingBlock(locale, d.name),
      block.p(fill(t.intro, { reference: d.reference })),
      block.link(
        t.download,
        t.downloadLabel,
        privacyExportUrl(links, PRIVACY_EXPORT_TOKEN_PLACEHOLDER),
      ),
      block.p(
        fill(t.validity, {
          date: fmtDate(d.linkExpiresAt, locale),
          deleteDate: fmtDate(d.fileDeleteAt, locale),
        }),
      ),
      block.p(t.contents),
      snippetBlock('privacyRequest.accessResponse', locale),
      block.p(t.rights),
      block.p(t.reply),
      closingBlock(locale, business),
    ],
  })
}

export async function renderPrivacyErasureResponse(
  input: TemplateRenderInput<PrivacyErasureResponseData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).privacyErasureResponse
  const rows = d.areas.map((a) =>
    fill(t[a.outcome], {
      area: t.areas[a.area],
      ...(a.outcome !== 'deleted' ? { date: fmtDate(a.until ?? input.now, locale) } : {}),
    }),
  )
  const restricted = d.areas.some((a) => a.outcome === 'restricted')
  return renderCustomerMail({
    locale,
    subject: privacyErasureResponseSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: false,
    blocks: [
      greetingBlock(locale, d.name),
      block.p(fill(t.intro, { reference: d.reference })),
      block.list(rows),
      ...(restricted ? [block.p(t.restrictedMeaning)] : []),
      snippetBlock('privacyRequest.erasureResponse', locale),
      block.p(t.recipients),
      block.p(t.complaint),
      block.p(t.reply),
      closingBlock(locale, business),
    ],
  })
}

export async function renderConsentWithdrawalConfirmation(
  input: TemplateRenderInput<ConsentWithdrawalConfirmationData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).consentWithdrawalConfirmation
  const rows: [string, string][] = [[t.withdrawnAt, fmtDate(d.withdrawnAt, locale)]]
  if (d.orderNumber) rows.push([t.orderNumber, d.orderNumber])
  return renderCustomerMail({
    locale,
    subject: consentWithdrawalConfirmationSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: false,
    blocks: [
      greetingBlock(locale, d.name),
      block.p(t[d.purpose]),
      block.rows(rows),
      block.p(t[`effect_${d.purpose}`]),
      block.p(t.past),
      block.p(t.reply),
      closingBlock(locale, business),
    ],
  })
}
