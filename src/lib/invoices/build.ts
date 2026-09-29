import 'server-only'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { CountryCode, PaymentMethod, ProductCategory, TaxMode, VatCategory } from '@/lib/enums'
import { SMALL_BUSINESS_VAT_NOTE } from '@/lib/legal/constants'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { computeTax, VAT_RATES, type VatRate } from '@/lib/tax'
import { berlinMonthKey } from '@/lib/time'

import { parseInvoiceData, type InvoiceDataV1, type InvoiceLine } from './schema'

// Belegdaten aus Bestellung und Einstellungen (DATENMODELL §6.9, R-120, R-061) – reine Funktionen, ohne DB.
// Belege sind deutsch (verbindliche Fassung); Positionen „Nr. 017 · Titel · Kategorie“, Menge 1, Versand als Position.

export interface InvoiceOrderItem {
  id?: string | null
  itemNumber: number
  titleDe: string
  category: ProductCategory
  priceCents: number
  vatCategory: VatCategory
  status?: string | null
}

interface Address {
  name?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  postalCode?: string | null
  city?: string | null
  country?: CountryCode | null
}

export interface InvoiceOrder {
  orderNumber: string
  customer: { name?: string | null; email: string }
  fulfillmentMethod: 'shipping' | 'pickup'
  shippingAddress?: Address | null
  billingAddressDiffers?: boolean | null
  billingAddress?: Address | null
  items: readonly InvoiceOrderItem[]
  shippingCents: number
  paymentMethod: PaymentMethod
}

export interface InvoiceBusiness {
  legalName: string
  tradeName?: string | null
  street: string
  postalCode?: string | null
  city: string
  country?: CountryCode | null
  email: string
  taxNumber?: string | null
  vatId?: string | null
  economicId?: string | null
}

/** Rechnungsempfänger:in (R-061): Abholung immer Rechnungsadresse; Versand ohne Abweichung die Lieferadresse. */
export function invoiceRecipientAddress(order: InvoiceOrder): Address {
  const billing = order.fulfillmentMethod === 'pickup' || order.billingAddressDiffers === true
  const address = billing ? order.billingAddress : order.shippingAddress
  if (!address?.name || !address.addressLine1 || !address.postalCode || !address.city) {
    throw new Error(
      billing
        ? 'Rechnungsadresse fehlt (Pflicht bei Abholung bzw. abweichender Rechnungsadresse, R-061).'
        : 'Lieferadresse fehlt.',
    )
  }
  return address
}

/** „Nr. 017 · Titel · Kategorie“ (R-120, handelsübliche Bezeichnung). */
export function invoiceLineDescription(item: InvoiceOrderItem): string {
  return `${formatItemNumber(item.itemNumber, 'de')} · ${item.titleDe} · ${ENUM_LABELS.PRODUCT_CATEGORIES[item.category].de}`
}

export const SHIPPING_LINE_DESCRIPTION = 'Versand'

function sellerOf(b: InvoiceBusiness): InvoiceDataV1['seller'] {
  return {
    legalName: b.legalName,
    tradeName: b.tradeName || null,
    street: b.street,
    postalCode: b.postalCode ?? '',
    city: b.city,
    country: b.country ?? 'DE',
    email: b.email,
    taxNumber: b.taxNumber || null,
    vatId: b.vatId || null,
    economicId: b.economicId || null,
  }
}

export interface BuildInvoiceDataInput {
  order: InvoiceOrder
  business: InvoiceBusiness
  taxMode: TaxMode
  /** Zu berechnende Positionen (Standard: alle Positionen der Bestellung; bei S4 nur die gelieferten, §8.4). */
  items?: readonly InvoiceOrderItem[]
  /** Versand berechnen (Standard: ja, wenn Versandkosten > 0). */
  includeShipping?: boolean
  paidAt: Date
  /** Leistungszeitpunkt (Zahlungs-/Übergabedatum), Anzeige als Monat. */
  deliveryDate: Date
}

/** `InvoiceDataV1` einer Rechnung (geprüft). */
export function buildInvoiceData(input: BuildInvoiceDataInput): InvoiceDataV1 {
  const { order, taxMode } = input
  const items = input.items ?? order.items
  if (items.length === 0) throw new Error('Rechnung ohne Positionen (O19: keine Rechnung).')
  const address = invoiceRecipientAddress(order)
  const shippingCents = input.includeShipping === false ? 0 : Math.max(0, order.shippingCents | 0)
  const tax = computeTax(
    items.map((i) => ({ grossCents: i.priceCents, vatCategory: i.vatCategory })),
    taxMode,
    { shippingCents },
  )
  const rateOf = (c: VatCategory): VatRate => (taxMode === 'kleinunternehmer' ? 0 : VAT_RATES[c])
  const lines: InvoiceLine[] = items.map((item, i) => ({
    pos: i + 1,
    itemNumber: item.itemNumber,
    description: invoiceLineDescription(item),
    quantity: 1,
    unitPriceCents: item.priceCents,
    totalCents: item.priceCents,
    vatRate: rateOf(item.vatCategory),
  }))
  // Versand: bei Regelbesteuerung anteilig nach Warenwert (KA-10); die Position zeigt den überwiegenden Satz.
  const shippingRate: VatRate =
    taxMode === 'kleinunternehmer'
      ? 0
      : ([...tax.shippingShares].sort((a, b) => b.grossCents - a.grossCents)[0]?.rate ?? 19)
  return parseInvoiceData({
    version: 1,
    seller: sellerOf(input.business),
    buyer: {
      name: address.name,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || null,
      postalCode: address.postalCode,
      city: address.city,
      country: address.country ?? 'DE',
      email: order.customer.email,
    },
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paidAt: input.paidAt.toISOString(),
    deliveryMonth: berlinMonthKey(input.deliveryDate),
    lines,
    shipping:
      shippingCents > 0
        ? {
            description: SHIPPING_LINE_DESCRIPTION,
            totalCents: shippingCents,
            vatRate: shippingRate,
          }
        : null,
    taxLines: tax.taxLines,
    totalGrossCents: tax.totalGrossCents,
    legalNote: taxMode === 'kleinunternehmer' ? SMALL_BUSINESS_VAT_NOTE.de : null,
    relatedInvoiceNumber: null,
  })
}

export interface CreditNoteLineInput {
  description: string
  totalCents: number
  itemNumber?: number | null
  /** Steuersatz der erstatteten Position (aus der Rechnung); im KU-Modus immer 0. */
  vatRate?: VatRate
}

export interface BuildCreditNoteDataInput {
  invoice: { number: string; data: InvoiceDataV1 }
  taxMode: TaxMode
  amountCents: number
  lines?: readonly CreditNoteLineInput[]
  refundedAt: Date
}

/**
 * `InvoiceDataV1` einer Gutschrift mit Verweis auf die Rechnung: Käufer, Verkäuferin, Bestellung und Zahlart aus der
 * Rechnung; Positionen = erstattete Beträge (ohne Angabe eine Zeile „Erstattung zu RE-…“).
 */
export function buildCreditNoteData(input: BuildCreditNoteDataInput): InvoiceDataV1 {
  const { invoice, taxMode, amountCents } = input
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error('Gutschrift: Betrag muss > 0 Cent sein.')
  }
  const src = invoice.data
  const kuRate = (r: VatRate | undefined): VatRate =>
    taxMode === 'kleinunternehmer' ? 0 : (r ?? src.lines[0]?.vatRate ?? 19)
  const inputLines: CreditNoteLineInput[] = input.lines?.length
    ? [...input.lines]
    : [{ description: `Erstattung zu Rechnung ${invoice.number}`, totalCents: amountCents }]
  const sum = inputLines.reduce((n, l) => n + l.totalCents, 0)
  if (sum !== amountCents) throw new Error('Gutschrift: Summe der Zeilen ≠ Betrag.')
  const lines: InvoiceLine[] = inputLines.map((l, i) => ({
    pos: i + 1,
    itemNumber: l.itemNumber ?? null,
    description: l.description,
    quantity: 1,
    unitPriceCents: l.totalCents,
    totalCents: l.totalCents,
    vatRate: kuRate(l.vatRate),
  }))
  const taxLines =
    taxMode === 'kleinunternehmer'
      ? []
      : [...new Set(lines.map((l) => l.vatRate))]
          .sort((a, b) => b - a)
          .map((rate) => {
            const grossCents = lines
              .filter((l) => l.vatRate === rate)
              .reduce((n, l) => n + l.totalCents, 0)
            const netCents = Math.round((grossCents * 100) / (100 + rate))
            return { rate, netCents, taxCents: grossCents - netCents, grossCents }
          })
  return parseInvoiceData({
    ...src,
    paidAt: input.refundedAt.toISOString(),
    deliveryMonth: src.deliveryMonth,
    lines,
    shipping: null,
    taxLines,
    totalGrossCents: amountCents,
    legalNote: taxMode === 'kleinunternehmer' ? SMALL_BUSINESS_VAT_NOTE.de : null,
    relatedInvoiceNumber: invoice.number,
  })
}
