import 'server-only'

import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
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
} from './kit'
import { statusAndPrivacyBlocks } from './orderSections'

// Versand und Abholung (KONZEPT §6.3, R-082, R-083): M06 `order_shipped` (O7, PLAN P5.15) mit versandten Positionen,
// Versanddienst, Sendungsnummer und Verfolgungslink (ohne Nummer entfallen beide – Versanddatum und Versandart bleiben,
// vorläufige Regel K-40), Laufzeit, Baustein `email.shipping.damageNotice` („… unberührt“); M07 `pickup_ready` (O8,
// PLAN P5.17) mit Positionen und dem von Jutta bestätigten Abholtext (Ort steht nur in dieser Mail, E-29). Keine
// Werbung, Bilder nur per CID; Fuß mit Bestellstatus und „Vertrag widerrufen“.

export const ORDER_SHIPPED_VERSION = 'm06-v1'
export const PICKUP_READY_VERSION = 'm07-v1'

const iso = z.iso.datetime({ offset: true })
const orderNumber = z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/)
const items = z
  .array(z.object({ itemNumber: z.number().int().positive(), title: z.string().min(1).max(200) }))
  .min(1)

export const orderShippedDataSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber,
  customerName: z.string().max(200).nullish(),
  items,
  carrier: z.enum(['dhl', 'deutsche_post']),
  trackingNumber: z
    .string()
    .regex(/^[A-Z0-9]{8,35}$/)
    .nullable(),
  /** Nur mit Sendungsnummer (aus `settings.shipping.trackingUrlTemplates`). */
  trackingUrl: z.url({ protocol: /^https$/ }).nullable(),
  shippedAt: iso,
})
export type OrderShippedData = z.infer<typeof orderShippedDataSchema>

export const pickupReadyDataSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber,
  customerName: z.string().max(200).nullish(),
  items,
  /** Bestätigter Abholtext mit Adresse (`orders.pickup.messageText`). */
  messageText: z.string().trim().min(1).max(2000),
})
export type PickupReadyData = z.infer<typeof pickupReadyDataSchema>

export const orderShippedSubject = (d: OrderShippedData, locale: Locale) =>
  fill(mailTexts(locale).orderShipped.subject, { orderNumber: d.orderNumber })

export const pickupReadySubject = (d: PickupReadyData, locale: Locale) =>
  fill(mailTexts(locale).pickupReady.subject, { orderNumber: d.orderNumber })

const itemLines = (list: OrderShippedData['items'], locale: Locale) =>
  list.map((i) => `${formatItemNumber(i.itemNumber, locale)} · ${i.title}`)

export async function renderOrderShipped(
  input: TemplateRenderInput<OrderShippedData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).orderShipped
  const common = mailTexts(locale).common
  const tracking = d.trackingNumber && d.trackingUrl ? d.trackingNumber : null
  return renderCustomerMail({
    locale,
    subject: orderShippedSubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(fill(t.intro, { orderNumber: d.orderNumber, date: fmtDate(d.shippedAt, locale) })),
      block.h(t.itemsHeading),
      block.list(itemLines(d.items, locale)),
      block.rows([
        [common.orderNumber, d.orderNumber],
        [t.shippedAt, fmtDate(d.shippedAt, locale)],
        [t.carrier, t.carriers[d.carrier]],
        ...(tracking ? [[t.trackingNumber, tracking] as const] : []),
      ]),
      tracking && d.trackingUrl
        ? block.link(t.trackingIntro, t.trackingLabel, d.trackingUrl)
        : block.p(t.noTracking),
      block.p(t.transitTime),
      block.p(getSnippet('email.shipping.damageNotice', locale).text),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}

export async function renderPickupReady(
  input: TemplateRenderInput<PickupReadyData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).pickupReady
  // Baustein `email.pickup.ready` (R-083): Einleitung; „…“ steht für den bestätigten Abholtext darunter.
  const intro = getSnippet('email.pickup.ready', locale)
    .text.replace(/\s*…\s*$/, '')
    .trim()
  return renderCustomerMail({
    locale,
    subject: pickupReadySubject(d, locale),
    title: t.title,
    links,
    business,
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.customerName),
      block.p(intro),
      block.lines(d.messageText.split(/\r?\n/)),
      block.h(t.itemsHeading),
      block.list(itemLines(d.items, locale)),
      block.rows([[mailTexts(locale).common.orderNumber, d.orderNumber]]),
      block.p(t.reply),
      ...statusAndPrivacyBlocks(locale, links),
      closingBlock(locale, business),
    ],
  })
}
