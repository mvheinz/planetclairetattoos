import 'server-only'

import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import {
  mentionsSchlichtungsstelle,
  SCHLICHTUNGSSTELLE_ADDRESS,
  UNIVERSAL_SCHLICHTUNGSSTELLE,
} from '@/lib/legal/vsbg'
import { formatItemNumber } from '@/lib/products/itemNumber'

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
import { statusAndPrivacyBlocks } from './orderSections'

// Reklamations-Mails (PLAN P6.11, KONZEPT §6 M12/M13, §7.8, R-084, R-111, R-112) – Transaktionsmails über die Outbox,
// keine Werbung (V-09), kein OS-Hinweis (V-01), nie „Garantie“ für die Gewährleistung (V-18):
// - M12 `complaint_repair_choice`: Bestellnummer, betroffene Stücke, Eingang der Reklamation und der Baustein
//   `complaint.repairChoice` (Wahlrecht Reparatur/Ersatz, bei Unikaten Ersatz in der Regel unmöglich, + 12 Monate
//   Gewährleistung bei Reparatur). Solange der Baustein ein Platzhalter ist (Kanzlei, K-20), stehen an seiner Stelle
//   die Arbeitsfassungs-Sätze aus `email.complaintRepairChoice` – die Mail nennt die Pflichtinhalte also immer.
// - M13 `dispute_vsbg`: Bestellnummer und Baustein `dispute.vsbg37` (Universalschlichtungsstelle mit Anschrift und
//   URL, Arbeitsfassung „nicht bereit und nicht verpflichtet“ bis K-22). Fehlen Anschrift/URL im Baustein, ergänzt die
//   Mail sie aus `src/lib/legal/vsbg.ts`.

export const COMPLAINT_REPAIR_CHOICE_VERSION = 'm12-v1'
export const DISPUTE_VSBG_VERSION = 'm13-v1'

const ORDER_NUMBER = z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/)

export const complaintRepairChoiceDataSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber: ORDER_NUMBER,
  complaintId: z.number().int().positive(),
  customerName: z.string().max(200).nullish(),
  kind: z.enum(['transport_damage', 'defect']),
  receivedAt: z.string().datetime({ offset: true }),
  items: z
    .array(z.object({ itemNumber: z.number().int().positive(), title: z.string().min(1).max(200) }))
    .default([]),
})
export type ComplaintRepairChoiceData = z.infer<typeof complaintRepairChoiceDataSchema>

export const disputeVsbgDataSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber: ORDER_NUMBER,
  complaintId: z.number().int().positive(),
  customerName: z.string().max(200).nullish(),
  receivedAt: z.string().datetime({ offset: true }),
})
export type DisputeVsbgData = z.infer<typeof disputeVsbgDataSchema>

export const complaintRepairChoiceSubject = (d: ComplaintRepairChoiceData, locale: Locale) =>
  fill(mailTexts(locale).complaintRepairChoice.subject, { orderNumber: d.orderNumber })

export const disputeVsbgSubject = (d: DisputeVsbgData, locale: Locale) =>
  fill(mailTexts(locale).disputeVsbg.subject, { orderNumber: d.orderNumber })

/** Baustein `complaint.repairChoice`; als Platzhalter (vor dem Kanzlei-Wortlaut) die Arbeitsfassung. */
function repairChoiceBlocks(locale: Locale): Block[] {
  const snippet = getSnippet('complaint.repairChoice', locale)
  if ((snippet.origin as string) !== 'placeholder') return [block.p(snippet.text)]
  const t = mailTexts(locale).complaintRepairChoice
  return [block.p(t.choice), block.p(t.unique), block.p(t.extension), block.p(t.rights)]
}

export async function renderComplaintRepairChoice(
  input: TemplateRenderInput<ComplaintRepairChoiceData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).complaintRepairChoice
  return renderCustomerMail({
    locale,
    subject: complaintRepairChoiceSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber })),
      block.rows([
        [mailTexts(locale).common.orderNumber, d.orderNumber],
        [t.receivedAt, fmtDate(d.receivedAt, locale)],
        [t.kind, t.kindLabel[d.kind]],
      ]),
      ...(d.items.length > 0
        ? [
            block.p(t.itemsTitle),
            block.list(
              d.items.map((i) => `${formatItemNumber(i.itemNumber, locale)} · ${i.title}`),
            ),
          ]
        : []),
      ...repairChoiceBlocks(locale),
      block.p(t.reply),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}

export async function renderDisputeVsbg(
  input: TemplateRenderInput<DisputeVsbgData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).disputeVsbg
  const snippet = getSnippet('dispute.vsbg37', locale)
  const placeholder = (snippet.origin as string) === 'placeholder'
  return renderCustomerMail({
    locale,
    subject: disputeVsbgSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber })),
      block.rows([
        [mailTexts(locale).common.orderNumber, d.orderNumber],
        [t.receivedAt, fmtDate(d.receivedAt, locale)],
      ]),
      placeholder
        ? block.placeholder(mailTexts(locale).common.placeholderMark, snippet.text)
        : block.p(snippet.text),
      ...(placeholder || !mentionsSchlichtungsstelle(snippet.text)
        ? [
            block.rows([
              [t.bodyName, UNIVERSAL_SCHLICHTUNGSSTELLE.name],
              [t.address, SCHLICHTUNGSSTELLE_ADDRESS],
              [t.website, UNIVERSAL_SCHLICHTUNGSSTELLE.url],
            ]),
          ]
        : []),
      block.p(t.reply),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}
