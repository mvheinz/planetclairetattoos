import 'server-only'

import { z } from 'zod'

import { INQUIRY_OBJECT_TYPES, type InquiryObjectType, type Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { formatBerlinWithZone } from '@/lib/time'

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

// M11 `inquiry_receipt` – Bestätigung der Auftragsanfrage (KONZEPT §6.3 „M11“, §10.4, R-160, PLAN P7.12): Referenz,
// Zusammenfassung (Gegenstand, Idee, Wunschzeitraum, Budget und nur die **Anzahl** der Bilder – nie die Bilder selbst),
// Antwortzeit-Satz (`site-texts.emails.inquiryResponseTime`, sonst Standard), „Angebot und Bezahlung per Mail, nicht über
// den Shop“, Baustein `inquiry.autoReply` („noch kein Vertrag, keine Zahlung“; Platzhalter bis zum Kanzleitext),
// Löschung 6 Monate nach Eingang mit Datum und Link auf den Abschnitt „Auftragsarbeiten“ der Datenschutzerklärung.
// Keine Bestellmail (kein Status-Link, kein „Vertrag widerrufen“), keine Werbung.

export const INQUIRY_RECEIPT_VERSION = 'm11-v1'

const iso = z.iso.datetime({ offset: true })
const optional = (max: number) => z.string().max(max).nullish()

export const inquiryReceiptDataSchema = z.strictObject({
  inquiryId: z.number().int().positive(),
  reference: z.string().regex(/^(BSP-)?AA-\d{4}-\d{4,}$/),
  receivedAt: iso,
  deleteAfter: iso,
  name: z.string().min(1).max(100),
  objectType: z.enum(INQUIRY_OBJECT_TYPES),
  objectTypeOther: optional(80),
  idea: z.string().min(1).max(3000),
  desiredTimeframe: optional(120),
  budget: optional(60),
  imageCount: z.number().int().min(0).max(5),
  /** Antwortzeit-Satz aus `site-texts.emails.inquiryResponseTime` (leer = Standardtext). */
  responseTime: optional(300),
})
export type InquiryReceiptData = z.infer<typeof inquiryReceiptDataSchema>

export const inquiryReceiptSubject = (d: InquiryReceiptData, locale: Locale) =>
  fill(mailTexts(locale).inquiryReceipt.subject, { reference: d.reference })

/** Anzeige des Gegenstands („Etwas anderes: Spiegel“). */
export function inquiryObjectLabel(
  type: InquiryObjectType,
  other: string | null | undefined,
  locale: Locale,
): string {
  const label = mailTexts(locale).inquiryReceipt.objectTypes[type]
  return type === 'sonstiges' && other?.trim() ? `${label}: ${other.trim()}` : label
}

function autoReplyBlock(locale: Locale): Block {
  const snippet = getSnippet('inquiry.autoReply', locale)
  return (snippet.origin as string) === 'placeholder'
    ? block.placeholder(mailTexts(locale).common.placeholderMark, snippet.text)
    : block.p(snippet.text)
}

export async function renderInquiryReceipt(
  input: TemplateRenderInput<InquiryReceiptData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).inquiryReceipt
  const common = mailTexts(locale).common
  const or = (v: string | null | undefined) => v?.trim() || t.empty
  return renderCustomerMail({
    locale,
    subject: inquiryReceiptSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: false,
    blocks: [
      greetingBlock(locale, d.name),
      block.p(t.intro),
      block.rows([
        [t.reference, d.reference],
        [t.receivedAt, formatBerlinWithZone(new Date(d.receivedAt), locale)],
        [t.object, inquiryObjectLabel(d.objectType, d.objectTypeOther, locale)],
        [t.idea, d.idea.trim()],
        [t.timeframe, or(d.desiredTimeframe)],
        [t.budget, or(d.budget)],
        [t.images, String(d.imageCount)],
      ]),
      block.p(d.responseTime?.trim() || t.responseTime),
      block.p(t.offerByMail),
      autoReplyBlock(locale),
      block.p(fill(t.deletion, { date: fmtDate(d.deleteAfter, locale) })),
      block.link(common.privacyLink, common.privacyLinkLabel, `${links.privacy}#auftragsarbeiten`),
      closingBlock(locale, business),
    ],
  })
}
