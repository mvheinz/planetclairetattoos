import 'server-only'

import type { FulfillmentMethod, ShippingClass, TaxMode, VatCategory } from '@/lib/enums'
import { assertCents } from '@/lib/money'
import { computeTax, getTaxModeAt, type TaxResult, type TaxSettings } from '@/lib/tax'

import { computeShipping, type ShippingResult, type ShippingSettings } from './shipping'

// Summen einer Kasse/Bestellung (E-25, KONZEPT §4.5/§4.14, DATENMODELL §6.25.1/§6.8.1) – eine Quelle für Warenkorb,
// Kasse, Stripe-Session, Bestellung und Beleg. Reine Funktion ohne DB; der Zeitpunkt für den Steuermodus kommt als
// Parameter (A-08). R-070: Die Zahlart ist bewusst **kein** Eingabewert – keine Gebühren, Aufschläge oder Rabatte je
// Zahlart; Karte, PayPal und Vorkasse ergeben immer denselben Gesamtbetrag.

export interface TotalsItem {
  itemNumber?: number | null
  /** Endpreis des Stücks (Integer-Cent, > 0). */
  priceCents: number
  vatCategory: VatCategory
  shippingClass: ShippingClass
}

export interface TotalsInput {
  items: readonly TotalsItem[]
  fulfillmentMethod: FulfillmentMethod
  /** Lieferland (Standard `DE`, R-060); bei Abholung ohne Bedeutung. */
  country?: string | null
  /** Zeitpunkt für den Steuermodus (`getTaxModeAt`, R-032) – z. B. `submittedAt` bzw. injiziertes `now`. */
  at: Date
}

export type TotalsSettings = ShippingSettings & TaxSettings

export interface Totals {
  subtotalCents: number
  shippingCents: number
  totalCents: number
  shipping: ShippingResult
  taxMode: TaxMode
  /** Steuerzeilen inkl. Versandanteil (KA-10); leer im Kleinunternehmer-Modus. */
  tax: TaxResult
}

export function computeTotals(input: TotalsInput, settings: TotalsSettings): Totals {
  for (const item of input.items) {
    assertCents(item.priceCents, 'Preis')
    if (item.priceCents === 0) throw new Error('Preis muss größer als 0 sein.')
  }
  const shipping = computeShipping(input.items, input.fulfillmentMethod, settings, {
    country: input.country,
  })
  const subtotalCents = input.items.reduce((n, i) => n + i.priceCents, 0)
  const taxMode = getTaxModeAt(settings, input.at)
  const tax = computeTax(
    input.items.map((i) => ({ grossCents: i.priceCents, vatCategory: i.vatCategory })),
    taxMode,
    { shippingCents: shipping.shippingCents },
  )
  const totalCents = subtotalCents + shipping.shippingCents
  if (tax.totalGrossCents !== totalCents) {
    throw new Error(`Summenfehler: Steuerbrutto ${tax.totalGrossCents} ≠ Gesamt ${totalCents}.`)
  }
  return {
    subtotalCents,
    shippingCents: shipping.shippingCents,
    totalCents,
    shipping,
    taxMode,
    tax,
  }
}
