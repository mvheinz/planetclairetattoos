import 'server-only'

import { z } from 'zod'

import { buildEpcPayload, formatIban } from '@/lib/commerce/epc'
import { epcQrPng } from '@/lib/commerce/qr'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { vatNote } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import { formatItemNumber } from '@/lib/products/itemNumber'

import type { MailBusiness, MailLinks } from '../layout'
import type { MailAttachment } from '../types'

import { block, fill, fmtDate, fmtDateTime, mailTexts, money, priceTable, type Block } from './kit'

// Gemeinsame Daten und Abschnitte der Bestellmails (KONZEPT §6.3, R-081): M01 `order_confirmation`, M02
// `prepayment_instructions`, M05 `prepayment_received` sowie Bankblock für M03. Die Daten entstehen beim Einreihen aus
// dem Snapshot der Bestellung (`buildOrderMailData`, `src/lib/email/orderMailData.ts`) – die Vorlage rendert nur.

const iso = z.iso.datetime({ offset: true })
const cents = z.number().int().nonnegative()

export const mailAddressSchema = z.object({
  name: z.string().max(200).nullish(),
  addressLine1: z.string().max(200).nullish(),
  addressLine2: z.string().max(200).nullish(),
  postalCode: z.string().max(20).nullish(),
  city: z.string().max(100).nullish(),
  country: z.string().max(2).nullish(),
})
export type MailAddress = z.infer<typeof mailAddressSchema>

export const bankSchema = z.object({
  accountHolder: z.string().min(1).max(70),
  iban: z.string().min(15).max(42),
  bic: z.string().max(11).nullish(),
  bankName: z.string().max(100).nullish(),
})
export type MailBank = z.infer<typeof bankSchema>

export const legalVersionSchema = z.object({ version: z.number().int().positive(), date: iso })

export const orderMailDataSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber: z.string().regex(/^(BSP-)?PC-\d{4}-\d{5}$/),
  placedAt: iso,
  customerName: z.string().max(200).nullish(),
  items: z
    .array(
      z.object({
        itemNumber: z.number().int().positive(),
        title: z.string().min(1).max(200),
        characteristics: z.string().max(500),
        priceCents: cents,
        deviationText: z.string().max(1000).nullish(),
      }),
    )
    .min(1),
  fulfillmentMethod: z.enum(['shipping', 'pickup']),
  shippingCents: cents,
  totalCents: cents,
  taxMode: z.enum(['kleinunternehmer', 'regelbesteuert']),
  paymentMethod: z.enum(['card', 'paypal', 'prepayment']),
  paymentMethodType: z.string().max(40).nullish(),
  paidAt: iso.nullish(),
  shippingAddress: mailAddressSchema.nullish(),
  /** `null` = wie Lieferadresse. */
  billingAddress: mailAddressSchema.nullish(),
  /** `settings.shipping.deliveryTimeText` (Sprache der Bestellung). */
  deliveryTime: z.string().max(200).nullish(),
  legal: z.object({ agb: legalVersionSchema, withdrawal: legalVersionSchema }),
  /** Dateinamen der Pflicht-Anhänge in Versandreihenfolge (Rechnung, AGB, Widerrufsbelehrung, ggf. EN-Fassungen). */
  attachmentFiles: z.array(z.string().max(120)).max(10),
  invoiceNumber: z.string().max(40).nullish(),
  carrierEmailConsent: z.boolean(),
  /** S4 (P4.21): fehlende Stücke mit erstattetem Betrag. */
  unavailable: z
    .array(z.object({ itemNumber: z.number().int().positive(), refundedCents: cents }))
    .default([]),
  /** Vorkasse (M02): Bankverbindung aus `settings.payment` und Frist `prepayment.dueAt`. */
  bank: bankSchema.nullish(),
  dueAt: iso.nullish(),
})
export type OrderMailData = z.infer<typeof orderMailDataSchema>

export const EPC_CID = 'epc@planetclaire'
/** Anzeigegröße des EPC-QR-Codes in Mails (PNG 360 px). */
export const EPC_MAIL_SIZE = 180

// --- Abschnitte ------------------------------------------------------------------------------------------------

const c = (locale: Locale) => mailTexts(locale).common

export function metaBlock(d: OrderMailData, locale: Locale): Block {
  return block.rows([
    [c(locale).orderNumber, d.orderNumber],
    [c(locale).orderedAt, fmtDateTime(d.placedAt, locale)],
  ])
}

/** Positionen (Nr., Titel, wesentliche Eigenschaften, vereinbarte Abweichung, Preis), Versand, Gesamt mit Steuerhinweis. */
export function itemsBlocks(d: OrderMailData, locale: Locale): Block[] {
  const t = c(locale)
  const lines = d.items.map((i) => ({
    label: `${formatItemNumber(i.itemNumber, locale)} · ${i.title}`,
    detail: [
      ...(i.characteristics ? [i.characteristics] : []),
      ...(i.deviationText ? [fill(t.deviation, { text: i.deviationText })] : []),
    ],
    amount: money(i.priceCents, locale),
  }))
  lines.push({
    label: d.fulfillmentMethod === 'pickup' ? t.pickup : t.shipping,
    detail: [],
    amount: money(d.shippingCents, locale),
  })
  lines.push({
    label: t.total,
    detail: [vatNote(d.taxMode, locale)],
    amount: money(d.totalCents, locale),
    strong: true,
  } as (typeof lines)[number] & { strong: boolean })
  return [block.h(t.itemsHeading), priceTable(lines)]
}

/** S4: „Leider schon weg: Nr. … – erstattet: … €“ (Daten aus P4.21). */
export function unavailableBlocks(d: OrderMailData, locale: Locale): Block[] {
  if (d.unavailable.length === 0) return []
  const t = c(locale)
  return [
    block.h(t.unavailableHeading),
    block.list(
      d.unavailable.map((u) =>
        fill(t.unavailableLine, {
          item: formatItemNumber(u.itemNumber, locale),
          amount: money(u.refundedCents, locale),
        }),
      ),
    ),
  ]
}

export function paymentMethodLabel(d: OrderMailData, locale: Locale): string {
  const m = c(locale).method
  if (d.paymentMethod === 'prepayment') return m.prepayment
  if (d.paymentMethod === 'paypal') return m.paypal
  if (d.paymentMethodType === 'apple_pay') return `${m.card} (${m.apple_pay})`
  if (d.paymentMethodType === 'google_pay') return `${m.card} (${m.google_pay})`
  return m.card
}

/** Zahlart und „bezahlt am“ (M01). */
export function paidBlocks(d: OrderMailData, locale: Locale): Block[] {
  const t = c(locale)
  return [
    block.h(t.paymentHeading),
    block.lines([
      fill(t.paymentMethod, { method: paymentMethodLabel(d, locale) }),
      ...(d.paidAt ? [fill(t.paidAt, { date: fmtDate(d.paidAt, locale) })] : []),
    ]),
  ]
}

function addressLines(a: MailAddress | null | undefined): string[] {
  if (!a) return []
  const place = [a.postalCode, a.city].filter(Boolean).join(' ')
  return [
    a.name,
    a.addressLine1,
    a.addressLine2,
    place,
    a.country && a.country !== 'DE' ? a.country : null,
  ].filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

/** Liefer- und Rechnungsadresse bzw. Abholung; Lieferzeit bzw. „Ich melde mich wegen der Abholung“. */
export function addressBlocks(d: OrderMailData, locale: Locale): Block[] {
  const t = c(locale)
  const out: Block[] = [block.h(t.addressHeading)]
  if (d.fulfillmentMethod === 'shipping') {
    out.push(block.lines([`${t.shippingAddress}:`, ...addressLines(d.shippingAddress)]))
    out.push(
      block.lines([
        `${t.billingAddress}:`,
        ...(d.billingAddress ? addressLines(d.billingAddress) : [t.billingSame]),
      ]),
    )
  } else {
    out.push(block.lines([`${t.billingAddress}:`, ...addressLines(d.billingAddress)]))
  }
  out.push(block.h(t.deliveryHeading))
  if (d.fulfillmentMethod === 'pickup') out.push(block.p(t.pickupNote))
  else if (d.deliveryTime) {
    out.push(
      block.p(getSnippet('delivery.timeShipping', locale, { deliveryTime: d.deliveryTime }).text),
    )
  }
  return out
}

/** Gesetzliche Mängelhaftung mit Link zur harmonisierten Mitteilung (R-049) auf der eigenen Seite R25. */
export function warrantyBlock(locale: Locale, links: MailLinks): Block {
  const t = c(locale)
  return block.link(t.warranty, t.warrantyLink, `${links.siteUrl}${localizedPath('R25', locale)}`)
}

/** Hinweis auf die Anhänge in der Fassung der Bestellung (Dateinamen mit Versionsnummer). */
export function attachmentBlocks(d: OrderMailData, locale: Locale, withInvoice: boolean): Block[] {
  const t = c(locale)
  const agbFile =
    d.attachmentFiles.find((f) => /^AGB_v\d+\.pdf$/.test(f)) ?? `AGB_v${d.legal.agb.version}.pdf`
  const wFile =
    d.attachmentFiles.find((f) => /^Widerrufsbelehrung-und-Formular_v\d+\.pdf$/.test(f)) ??
    `Widerrufsbelehrung-und-Formular_v${d.legal.withdrawal.version}.pdf`
  const english = d.attachmentFiles.filter((f) => f.endsWith('_EN.pdf'))
  const items = [
    ...(withInvoice && d.invoiceNumber
      ? [fill(t.attInvoice, { file: `${d.invoiceNumber}.pdf` })]
      : []),
    fill(t.attAgb, { date: fmtDate(d.legal.agb.date, locale), file: agbFile }),
    fill(t.attWithdrawal, { date: fmtDate(d.legal.withdrawal.date, locale), file: wFile }),
    ...(english.length > 0 ? [fill(t.attEnglish, { files: english.join(', ') })] : []),
  ]
  return [block.h(t.attachmentsHeading), block.list(items)]
}

/** Widerrufsweg („Vertrag widerrufen“) und Rücksendekosten (E-27). */
export function withdrawalBlocks(locale: Locale, links: MailLinks, linkLabel: string): Block[] {
  const t = c(locale)
  return [
    block.link(t.withdrawalInfo, linkLabel, links.withdraw),
    block.p(getSnippet('withdrawal.returnCostsNote', locale).text),
  ]
}

/** Nur bei erteilter DHL-Einwilligung: Status und Widerrufsweg (R-101). */
export function dhlBlocks(d: OrderMailData, locale: Locale, business: MailBusiness): Block[] {
  if (!d.carrierEmailConsent || d.fulfillmentMethod !== 'shipping') return []
  return [block.p(fill(c(locale).dhlConsent, { email: business.email }))]
}

export function statusAndPrivacyBlocks(locale: Locale, links: MailLinks): Block[] {
  const t = c(locale)
  return [
    ...(links.orderStatus ? [block.link(t.statusLink, t.statusLinkLabel, links.orderStatus)] : []),
    block.link(t.privacyLink, t.privacyLinkLabel, links.privacy),
  ]
}

/** Anbieterkennung mit Telefonnummer – nur in den Bestellbestätigungen M01/M02 (R-021, R-081 Nr. 1). */
export function providerBlocks(locale: Locale, business: MailBusiness): Block[] {
  const t = c(locale)
  const place = [business.postalCode, business.city].filter(Boolean).join(' ')
  return [
    block.h(t.providerHeading),
    block.lines(
      [
        business.tradeName ? `${business.legalName} · ${business.tradeName}` : business.legalName,
        business.street,
        place,
        business.phone ? `${t.phone}: ${business.phone}` : null,
        `${t.email}: ${business.email}`,
      ].filter((x): x is string => !!x),
    ),
  ]
}

/** Baustein `email.orderConfirmation.contractSentence` als gekennzeichneter Platzhalter (Kanzleifrage K-01). */
export function contractSentenceBlock(locale: Locale): Block {
  const s = getSnippet('email.orderConfirmation.contractSentence', locale)
  // Bis P6 gibt es nur Arbeits- bzw. Platzhalterfassungen – immer gekennzeichnet (R-002).
  return (s.origin as string) === 'lawyer'
    ? block.p(s.text)
    : block.placeholder(c(locale).placeholderMark, s.text)
}

/** Bankverbindung (Kontoinhaberin, IBAN in 4er-Gruppen, BIC, Bank, Betrag, Verwendungszweck) und EPC-QR per CID. */
export async function bankBlocks(
  input: { bank: MailBank; amountCents: number; orderNumber: string },
  locale: Locale,
): Promise<{ blocks: Block[]; images: MailAttachment[] }> {
  const t = c(locale)
  const { bank } = input
  const rows: [string, string][] = [
    [t.accountHolder, bank.accountHolder],
    [t.iban, formatIban(bank.iban)],
    ...(bank.bic ? [[t.bic, bank.bic] as [string, string]] : []),
    ...(bank.bankName ? [[t.bank, bank.bankName] as [string, string]] : []),
    [t.amount, money(input.amountCents, locale)],
    [t.reference, input.orderNumber],
  ]
  const payload = buildEpcPayload({
    name: bank.accountHolder,
    iban: bank.iban,
    bic: bank.bic,
    amountCents: input.amountCents,
    reference: input.orderNumber,
  })
  const png = await epcQrPng(payload)
  return {
    blocks: [
      block.h(t.bankHeading),
      block.rows(rows),
      block.image(EPC_CID, t.qrAlt, EPC_MAIL_SIZE),
      block.p(t.qrHint),
    ],
    images: [{ filename: 'girocode.png', content: png, contentType: 'image/png', cid: EPC_CID }],
  }
}
