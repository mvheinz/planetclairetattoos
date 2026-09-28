import 'server-only'

import { SHIPPING_OPTION_LABELS } from '@/lib/enumLabels'
import {
  COUNTRY_CODES,
  SHIPPING_CLASS_RANK,
  type CountryCode,
  type FulfillmentMethod,
  type ShippingClass,
  type ShippingZone,
} from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { zoneForCountry } from '@/lib/settings/rules'

// Versandkosten (E-24, E-25, DATENMODELL §6.8.1, DM-ORD-05, KONZEPT §4.5): die höchste Versandklasse im Korb bestimmt
// den Tarif aus `settings.shipping.rates`; Abholung kostet nichts; `nur_abholung` wird nie versendet; Versand nur in
// Länder aus `settings.shipping.enabledCountries` (R-060, GB/US gibt es im Enum nicht). Reine Funktion ohne DB.

export interface ShippingItem {
  itemNumber?: number | null
  shippingClass: ShippingClass
}

export interface ShippingRate {
  zone?: ShippingZone | null
  shippingClass?: ShippingClass | null
  priceCents?: number | null
}

export interface ShippingSettings {
  shipping?: {
    rates?: readonly ShippingRate[] | null
    /** Lieferländer (Standard nur `DE`, E-24). */
    enabledCountries?: readonly string[] | null
  } | null
}

export interface ShippingLabel {
  de: string
  en: string
}

export interface ShippingResult {
  shippingClass: ShippingClass
  /** `null` bei Abholung. */
  zone: ShippingZone | null
  /** Lieferland; `null` bei Abholung. */
  country: CountryCode | null
  shippingCents: number
  /** Anzeigename der Versandoption (z. B. „DHL Paket (Keramik)“, „Abholung in Berlin“; KONZEPT §4.7). */
  label: ShippingLabel
}

export type ShippingErrorCode = 'empty' | 'pickup_only' | 'no_rate' | 'country_not_enabled'

export class ShippingError extends Error {
  constructor(
    readonly code: ShippingErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ShippingError'
  }
}

/** Startwert, solange `settings.shipping.enabledCountries` leer ist (E-24). */
export const DEFAULT_ENABLED_COUNTRIES: readonly CountryCode[] = ['DE']

const isCountryCode = (value: string): value is CountryCode =>
  (COUNTRY_CODES as readonly string[]).includes(value)

/** Aktive Lieferländer; nur Werte aus `COUNTRY_CODES` (GB/US nie, R-060). */
export function enabledCountries(settings: ShippingSettings | null | undefined): CountryCode[] {
  const list = settings?.shipping?.enabledCountries
  const source = list && list.length > 0 ? list : DEFAULT_ENABLED_COUNTRIES
  return [...new Set(source.map((c) => String(c).toUpperCase()).filter(isCountryCode))]
}

/** Prüft das Lieferland gegen die Whitelist (R-060) und liefert es als `CountryCode`. */
export function assertShippingCountry(
  country: string,
  settings: ShippingSettings | null | undefined,
): CountryCode {
  const code = country.trim().toUpperCase()
  if (!isCountryCode(code) || !enabledCountries(settings).includes(code)) {
    throw new ShippingError(
      'country_not_enabled',
      `Lieferung nach ${code || '(leer)'} ist nicht möglich – wir liefern nur innerhalb Deutschlands.`,
    )
  }
  return code
}

/** Versandklasse mit dem höchsten Rang (`SHIPPING_CLASS_RANK`). */
export function highestShippingClass(items: readonly ShippingItem[]): ShippingClass {
  if (items.length === 0) throw new ShippingError('empty', 'Der Warenkorb ist leer.')
  return items.reduce<ShippingClass>(
    (best, item) =>
      SHIPPING_CLASS_RANK[item.shippingClass] > SHIPPING_CLASS_RANK[best]
        ? item.shippingClass
        : best,
    items[0]!.shippingClass,
  )
}

export interface ShippingOptions {
  /** Lieferland (ISO 3166-1 alpha-2); Standard `DE`. Bei Abholung ohne Bedeutung. */
  country?: string | null
}

/**
 * Versand für einen Korb: `pickup` → 0 € („Abholung in Berlin“); `shipping` → Tarif der höchsten Klasse in der Zone
 * des Lieferlands. Wirft `ShippingError` bei leerem Korb, `nur_abholung` mit Versand („Nr. 023 gibt es nur zur
 * Abholung.“), nicht freigeschaltetem Land (R-060) oder fehlendem Tarif (nie stillschweigend 0 €).
 */
export function computeShipping(
  items: readonly ShippingItem[],
  method: FulfillmentMethod,
  settings: ShippingSettings,
  options: ShippingOptions = {},
): ShippingResult {
  const shippingClass = highestShippingClass(items)
  if (method === 'pickup') {
    return {
      shippingClass,
      zone: null,
      country: null,
      shippingCents: 0,
      label: SHIPPING_OPTION_LABELS.pickup,
    }
  }
  const pickupOnly = items.find((i) => i.shippingClass === 'nur_abholung')
  if (pickupOnly || shippingClass === 'nur_abholung') {
    const label =
      typeof pickupOnly?.itemNumber === 'number'
        ? formatItemNumber(pickupOnly.itemNumber, 'de')
        : 'Ein Stück'
    throw new ShippingError('pickup_only', `${label} gibt es nur zur Abholung.`)
  }
  const country = assertShippingCountry(options.country ?? 'DE', settings)
  const zone = zoneForCountry(country)
  const rate = (settings.shipping?.rates ?? []).find(
    (r) => r.zone === zone && r.shippingClass === shippingClass,
  )
  if (
    !rate ||
    typeof rate.priceCents !== 'number' ||
    !Number.isSafeInteger(rate.priceCents) ||
    rate.priceCents < 0
  ) {
    throw new ShippingError(
      'no_rate',
      `Für ${shippingClass} (${zone}) ist kein Versandpreis hinterlegt.`,
    )
  }
  return {
    shippingClass,
    zone,
    country,
    shippingCents: rate.priceCents,
    label: SHIPPING_OPTION_LABELS[shippingClass],
  }
}
