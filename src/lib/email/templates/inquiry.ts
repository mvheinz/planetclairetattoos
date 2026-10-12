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
// Eingang, Gegenstand (nur die feste Auswahl) und die **Anzahl** der Bilder – nie die Bilder selbst –, Antwortzeit-Satz
// (`site-texts.emails.inquiryResponseTime`, sonst Standard), „Angebot und Bezahlung per Mail, nicht über den Shop“,
// Baustein `inquiry.autoReply` („noch kein Vertrag, keine Zahlung“; Platzhalter bis zum Kanzleitext), Löschung 6 Monate
// nach Eingang mit Datum und Link auf den Abschnitt „Auftragsarbeiten“ der Datenschutzerklärung.
// Keine Bestellmail (kein Status-Link, kein „Vertrag widerrufen“), keine Werbung.
//
// P18.5 (Missbrauchsschutz): Die Empfängeradresse ist ungeprüft. Damit niemand über das Formular beliebigen Text in
// Juttas Namen an fremde Adressen schicken kann (und eine vertippte Adresse nichts Persönliches erfährt), wiederholt die
// Mail **keine Freitexte**: keine Anrede mit Namen, keine Idee, kein „Etwas anderes: …“, kein Wunschzeitraum, kein Budget.
// Die Felder fehlen deshalb auch im Datenschema (die Ausgangs-Warteschlange hält sie nicht vor). Rückbau, falls Jutta das
// Echo wieder möchte: die Felder in `inquiryReceiptDataSchema` und `submitCommission` (src/lib/commission/submit.ts)
// wieder aufnehmen, hier als Zeilen in `summaryRows` ergänzen und die Texte `email.inquiryReceipt.*` zurückholen
// (Stand vor P18.5 in der Git-Historie).

export const INQUIRY_RECEIPT_VERSION = 'm11-v2'

const iso = z.iso.datetime({ offset: true })

/** Nur feste Angaben – keine Freitexte der Anfragenden (P18.5, siehe oben); `strictObject` weist zusätzliche Felder ab. */
export const inquiryReceiptDataSchema = z.strictObject({
  inquiryId: z.number().int().positive(),
  reference: z.string().regex(/^(BSP-)?AA-\d{4}-\d{4,}$/),
  receivedAt: iso,
  deleteAfter: iso,
  objectType: z.enum(INQUIRY_OBJECT_TYPES),
  imageCount: z.number().int().min(0).max(5),
  /** Antwortzeit-Satz aus `site-texts.emails.inquiryResponseTime` (leer = Standardtext; Text von Jutta, kein Freitext). */
  responseTime: z.string().max(300).nullish(),
})
export type InquiryReceiptData = z.infer<typeof inquiryReceiptDataSchema>

export const inquiryReceiptSubject = (d: InquiryReceiptData, locale: Locale) =>
  fill(mailTexts(locale).inquiryReceipt.subject, { reference: d.reference })

/** Anzeige des Gegenstands: nur die feste Bezeichnung der Auswahl („Etwas anderes“ ohne den Freitext, P18.5). */
export function inquiryObjectLabel(type: InquiryObjectType, locale: Locale): string {
  return mailTexts(locale).inquiryReceipt.objectTypes[type]
}

/** Zusammenfassung: Referenz, Eingang, Gegenstand, Anzahl der Bilder – ausschließlich feste bzw. vom System erzeugte Werte. */
function summaryRows(d: InquiryReceiptData, locale: Locale): [string, string][] {
  const t = mailTexts(locale).inquiryReceipt
  return [
    [t.reference, d.reference],
    [t.receivedAt, formatBerlinWithZone(new Date(d.receivedAt), locale)],
    [t.object, inquiryObjectLabel(d.objectType, locale)],
    [t.images, String(d.imageCount)],
  ]
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
  return renderCustomerMail({
    locale,
    subject: inquiryReceiptSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: false,
    blocks: [
      // Anrede ohne Namen („Hallo,“): der Name ist ein ungeprüfter Freitext (P18.5)
      greetingBlock(locale),
      block.p(t.intro),
      block.rows(summaryRows(d, locale)),
      block.p(d.responseTime?.trim() || t.responseTime),
      block.p(t.offerByMail),
      autoReplyBlock(locale),
      block.p(fill(t.deletion, { date: fmtDate(d.deleteAfter, locale) })),
      block.link(common.privacyLink, common.privacyLinkLabel, `${links.privacy}#auftragsarbeiten`),
      closingBlock(locale, business),
    ],
  })
}
