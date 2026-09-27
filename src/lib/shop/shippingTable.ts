import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale, ShippingClass, ShippingZone } from '@/lib/enums'
import { formatMoney } from '@/lib/money'

// Versandtabelle als Text für das Rechtstext-Token `{{shippingTable}}` (R-012, DATENMODELL §6.12): Versandklassen und
// DE-Preise aus `settings.shipping.rates`, dazu Abholung und die Regel „höchste Versandklasse“ (E-25). Reine Funktion.

export interface ShippingTableSettings {
  rates?:
    | readonly {
        zone?: ShippingZone | null
        shippingClass?: ShippingClass | null
        priceCents?: number | null
      }[]
    | null
  pickupEnabled?: boolean | null
  pickupCity?: string | null
}

const TEXT = {
  de: {
    pickup: (city: string) => `Abholung in ${city}: kostenlos`,
    rule: 'Bestellst du mehrere Stücke, gilt der Preis der höchsten Versandklasse.',
  },
  en: {
    pickup: (city: string) => `Pickup in ${city}: free`,
    rule: 'If you order several pieces, the price of the highest shipping class applies.',
  },
} as const

/** Zeilen der Versandtabelle (Zone DE), getrennt durch Zeilenumbrüche; leer, wenn keine DE-Preise gepflegt sind. */
export function shippingTableText(shipping: ShippingTableSettings, locale: Locale): string {
  const lines: string[] = []
  for (const rate of shipping.rates ?? []) {
    if (rate.zone !== 'DE' || !rate.shippingClass || typeof rate.priceCents !== 'number') continue
    const label = ENUM_LABELS.SHIPPING_CLASSES[rate.shippingClass]
    const name = (locale === 'en' ? label.en : undefined) ?? label.de
    lines.push(`${name}: ${formatMoney(rate.priceCents, locale)}`)
  }
  if (lines.length === 0) return ''
  if (shipping.pickupEnabled && shipping.pickupCity)
    lines.push(TEXT[locale].pickup(shipping.pickupCity))
  lines.push(TEXT[locale].rule)
  return lines.join('\n')
}
