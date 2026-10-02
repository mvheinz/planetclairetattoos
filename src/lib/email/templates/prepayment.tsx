import 'server-only'

import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { localizedPath } from '@/lib/routes/paths'

import type { RenderedMail, TemplateRenderInput } from '../registry'

import {
  block,
  closingBlock,
  fill,
  fmtDate,
  fmtDateTime,
  greetingBlock,
  mailTexts,
  money,
  renderCustomerMail,
} from './kit'
import { bankBlocks, bankSchema, statusAndPrivacyBlocks } from './orderSections'

// Kund:innen-Mails der Vorkasse und bei „leider schon weg“ (KONZEPT §6.2/§6.3, R-071, R-084, P4.15):
// M03 `prepayment_reminder`, M04 `prepayment_cancelled` (nur O4 durch Task oder Verwaltung, nie bei Widerruf – dort
// bestätigt M08), M10 `oversold_apology` (O19: keine Rechnung, kein Rabattcode, nur ein Link zum Shop).

export const PREPAYMENT_REMINDER_VERSION = 'm03-v1'
export const PREPAYMENT_CANCELLED_VERSION = 'm04-v1'
export const OVERSOLD_APOLOGY_VERSION = 'm10-v1'

const iso = z.iso.datetime({ offset: true })
const orderNumber = z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/)
const base = {
  orderId: z.number().int().positive(),
  orderNumber,
  customerName: z.string().max(200).nullish(),
}

export const prepaymentReminderDataSchema = z.object({
  ...base,
  /** Offener Betrag in Cent. */
  amountCents: z.number().int().positive(),
  bank: bankSchema,
  dueAt: iso,
})
export type PrepaymentReminderData = z.infer<typeof prepaymentReminderDataSchema>

export const prepaymentCancelledDataSchema = z.object({
  ...base,
  /** `payment_timeout` (Task) bzw. `admin` (Verwaltung, dann mit `reasonText`); Widerruf ist ausgeschlossen. */
  reason: z.enum(['payment_timeout', 'admin']),
  reasonText: z.string().trim().min(1).max(500).nullish(),
})
export type PrepaymentCancelledData = z.infer<typeof prepaymentCancelledDataSchema>

export const oversoldApologyDataSchema = z.object({
  ...base,
  items: z
    .array(z.object({ itemNumber: z.number().int().positive(), title: z.string().min(1).max(200) }))
    .min(1),
  refundedCents: z.number().int().positive(),
})
export type OversoldApologyData = z.infer<typeof oversoldApologyDataSchema>

export const prepaymentReminderSubject = (d: PrepaymentReminderData, locale: Locale) =>
  fill(mailTexts(locale).prepaymentReminder.subject, {
    orderNumber: d.orderNumber,
    date: fmtDate(d.dueAt, locale),
  })

export const prepaymentCancelledSubject = (d: PrepaymentCancelledData, locale: Locale) =>
  fill(mailTexts(locale).prepaymentCancelled.subject, { orderNumber: d.orderNumber })

export const oversoldApologySubject = (d: OversoldApologyData, locale: Locale) =>
  fill(mailTexts(locale).oversoldApology.subject, { orderNumber: d.orderNumber })

export async function renderPrepaymentReminder(
  input: TemplateRenderInput<PrepaymentReminderData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).prepaymentReminder
  const bank = await bankBlocks(
    { bank: d.bank, amountCents: d.amountCents, orderNumber: d.orderNumber },
    locale,
  )
  return renderCustomerMail({
    locale,
    subject: prepaymentReminderSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    images: bank.images,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(
        getSnippet('email.vorkasse.reminder', locale, {
          orderNumber: d.orderNumber,
          dueDate: fmtDateTime(d.dueAt, locale),
        }).text,
      ),
      block.rows([
        [mailTexts(locale).common.orderNumber, d.orderNumber],
        [t.open, money(d.amountCents, locale)],
      ]),
      ...bank.blocks,
      block.p(fill(mailTexts(locale).common.dueBy, { date: fmtDate(d.dueAt, locale) })),
      block.p(t.alreadyPaid),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}

export async function renderPrepaymentCancelled(
  input: TemplateRenderInput<PrepaymentCancelledData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).prepaymentCancelled
  const reason = d.reason === 'admin' && d.reasonText ? d.reasonText : t.reasonTimeout
  const snippet = getSnippet('email.vorkasse.cancellation', locale)
  return renderCustomerMail({
    locale,
    subject: prepaymentCancelledSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber })),
      block.p(fill(t.reason, { reason })),
      // Baustein `email.vorkasse.cancellation`: bis zum Kanzlei-Wortlaut (A28) gekennzeichneter Platzhalter (R-002).
      (snippet.origin as string) === 'lawyer'
        ? block.p(snippet.text)
        : block.placeholder(mailTexts(locale).common.placeholderMark, snippet.text),
      block.p(t.alreadyPaid),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}

export async function renderOversoldApology(
  input: TemplateRenderInput<OversoldApologyData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).oversoldApology
  return renderCustomerMail({
    locale,
    subject: oversoldApologySubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(d.items.length > 1 ? t.introMany : t.introOne),
      block.list(d.items.map((i) => `${formatItemNumber(i.itemNumber, locale)} · ${i.title}`)),
      block.rows([[mailTexts(locale).common.orderNumber, d.orderNumber]]),
      block.p(fill(t.refund, { amount: money(d.refundedCents, locale) })),
      block.p(t.noContract),
      block.link(t.shop, t.shopLabel, `${links.siteUrl}${localizedPath('R02', locale)}`),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}
