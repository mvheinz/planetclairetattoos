import 'server-only'

import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'

import type { RenderedMail, TemplateRenderInput } from '../registry'

import {
  block,
  closingBlock,
  fill,
  greetingBlock,
  mailTexts,
  money,
  renderCustomerMail,
} from './kit'
import { statusAndPrivacyBlocks } from './orderSections'

// M09 `refund_confirmation` (KONZEPT §5.3 O13–O15/O21, R-072, R-084, PLAN P6.10): Erstattung erfolgreich – Betrag,
// erstattete Stücke, Weg des Geldes (dasselbe Zahlungsmittel bzw. Rücküberweisung bei Vorkasse), Gutschrift GS als
// PDF-Anhang. Keine Werbung (V-09).

export const REFUND_CONFIRMATION_VERSION = 'm09-v1'

export const refundConfirmationDataSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber: z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/),
  customerName: z.string().max(200).nullish(),
  amountCents: z.number().int().positive(),
  shippingCents: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['card', 'paypal', 'prepayment']),
  items: z
    .array(z.object({ itemNumber: z.number().int().positive(), title: z.string().min(1).max(200) }))
    .default([]),
  withdrawalReference: z
    .string()
    .regex(/^(BSP-)?WR-\d{4}-\d{5,}$/)
    .nullish(),
  creditNoteId: z.number().int().positive(),
  creditNoteNumber: z.string().min(1).max(40),
})
export type RefundConfirmationData = z.infer<typeof refundConfirmationDataSchema>

export const refundConfirmationSubject = (d: RefundConfirmationData, locale: Locale) =>
  fill(mailTexts(locale).refundConfirmation.subject, { orderNumber: d.orderNumber })

export async function renderRefundConfirmation(
  input: TemplateRenderInput<RefundConfirmationData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).refundConfirmation
  const amount = money(d.amountCents, locale)
  return renderCustomerMail({
    locale,
    subject: refundConfirmationSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(
        d.withdrawalReference
          ? fill(t.introWithdrawal, { reference: d.withdrawalReference, amount })
          : fill(t.introOther, { amount }),
      ),
      block.rows([
        [mailTexts(locale).common.orderNumber, d.orderNumber],
        [t.amount, amount],
      ]),
      ...(d.items.length > 0
        ? [
            block.p(t.itemsTitle),
            block.list(
              d.items.map((i) => `${formatItemNumber(i.itemNumber, locale)} · ${i.title}`),
            ),
          ]
        : []),
      ...(d.shippingCents > 0
        ? [block.p(fill(t.shippingIncluded, { amount: money(d.shippingCents, locale) }))]
        : []),
      block.p(d.paymentMethod === 'prepayment' ? t.prepayment : t.card),
      block.p(fill(t.creditNote, { number: d.creditNoteNumber })),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}
