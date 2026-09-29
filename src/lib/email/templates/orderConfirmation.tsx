import 'server-only'

import { formatIban } from '@/lib/commerce/epc'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'

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
import {
  addressBlocks,
  attachmentBlocks,
  bankBlocks,
  contractSentenceBlock,
  dhlBlocks,
  itemsBlocks,
  metaBlock,
  orderMailDataSchema,
  paidBlocks,
  providerBlocks,
  statusAndPrivacyBlocks,
  unavailableBlocks,
  warrantyBlock,
  withdrawalBlocks,
  type OrderMailData,
} from './orderSections'

// M01 `order_confirmation` (O1) und M02 `prepayment_instructions` (O2) – beide Bestellbestätigung nach R-081 (KONZEPT
// §6.3), M05 `prepayment_received` (O3/O5). Anhänge lädt der Versand-Job laut Registry (M01: Rechnung + Rechtstexte,
// M02: Rechtstexte, M05: Rechnung).

export const ORDER_CONFIRMATION_VERSION = 'm01-v1'
export const PREPAYMENT_INSTRUCTIONS_VERSION = 'm02-v1'
export const PREPAYMENT_RECEIVED_VERSION = 'm05-v1'

export { orderMailDataSchema }

export function orderConfirmationSubject(d: Pick<OrderMailData, 'orderNumber'>, locale: Locale) {
  return fill(mailTexts(locale).orderConfirmation.subject, { orderNumber: d.orderNumber })
}

export function prepaymentInstructionsSubject(
  d: Pick<OrderMailData, 'orderNumber' | 'dueAt'>,
  locale: Locale,
) {
  if (!d.dueAt) throw new Error('M02 braucht die Zahlungsfrist (prepayment.dueAt).')
  return fill(mailTexts(locale).prepaymentInstructions.subject, {
    orderNumber: d.orderNumber,
    date: fmtDate(d.dueAt, locale),
  })
}

export function prepaymentReceivedSubject(d: Pick<OrderMailData, 'orderNumber'>, locale: Locale) {
  return fill(mailTexts(locale).prepaymentReceived.subject, { orderNumber: d.orderNumber })
}

/** Gemeinsamer Schluss der Bestellbestätigungen M01/M02 (R-081 Nr. 6–10, Anbieterkennung mit Telefon). */
function confirmationTail(input: TemplateRenderInput<OrderMailData>, withInvoice: boolean) {
  const { data: d, locale, links, business } = input
  return [
    warrantyBlock(locale, links),
    ...attachmentBlocks(d, locale, withInvoice),
    ...withdrawalBlocks(locale, links, WITHDRAWAL_LINK_LABEL[locale]),
    ...dhlBlocks(d, locale, business),
    ...statusAndPrivacyBlocks(locale, links),
    closingBlock(locale, business),
    ...providerBlocks(locale, business),
  ]
}

export async function renderOrderConfirmation(
  input: TemplateRenderInput<OrderMailData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).orderConfirmation
  return renderCustomerMail({
    locale,
    subject: orderConfirmationSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber })),
      contractSentenceBlock(locale),
      metaBlock(d, locale),
      ...itemsBlocks(d, locale),
      ...unavailableBlocks(d, locale),
      ...paidBlocks(d, locale),
      ...addressBlocks(d, locale),
      ...confirmationTail(input, true),
    ],
  })
}

export async function renderPrepaymentInstructions(
  input: TemplateRenderInput<OrderMailData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).prepaymentInstructions
  if (!d.bank || !d.dueAt) throw new Error('M02 braucht Bankverbindung und Zahlungsfrist.')
  const due = fmtDate(d.dueAt, locale)
  const bank = await bankBlocks(
    { bank: d.bank, amountCents: d.totalCents, orderNumber: d.orderNumber },
    locale,
  )
  return renderCustomerMail({
    locale,
    subject: prepaymentInstructionsSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    images: bank.images,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber })),
      contractSentenceBlock(locale),
      metaBlock(d, locale),
      ...itemsBlocks(d, locale),
      ...paidBlocks(d, locale),
      block.p(
        getSnippet('email.vorkasse.paymentInstructions', locale, {
          amount: money(d.totalCents, locale),
          dueDate: fmtDateTime(d.dueAt, locale),
          accountHolder: d.bank.accountHolder,
          iban: formatIban(d.bank.iban),
          orderNumber: d.orderNumber,
        }).text,
      ),
      ...bank.blocks,
      block.p(fill(mailTexts(locale).common.dueBy, { date: due })),
      block.p(fill(d.items.length > 1 ? t.reservedMany : t.reservedOne, { date: due })),
      block.p(t.invoiceLater),
      ...addressBlocks(d, locale),
      ...confirmationTail(input, false),
    ],
  })
}

export async function renderPrepaymentReceived(
  input: TemplateRenderInput<OrderMailData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).prepaymentReceived
  return renderCustomerMail({
    locale,
    subject: prepaymentReceivedSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber, amount: money(d.totalCents, locale) })),
      metaBlock(d, locale),
      block.p(d.fulfillmentMethod === 'pickup' ? t.nextPickup : t.nextShipping),
      ...(d.invoiceNumber
        ? [block.p(fill(t.invoiceAttached, { file: `${d.invoiceNumber}.pdf` }))]
        : []),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}
