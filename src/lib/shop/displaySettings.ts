import { TAX_MODES, type TaxMode } from '@/lib/enums'

// Projektion der öffentlichen Einstellungen (Whitelist `getPublicSettings()`, DATENMODELL §7.1) auf das, was Listen-
// und Stückseiten anzeigen (KONZEPT §3.2, §3.4): Shop geöffnet/pausiert samt Hinweis, Abholung, Lieferzeit, aktueller
// Steuermodus, Reservierungsdauer (Hinweis „schau in … Minuten nochmal“, P18.5).
// Reines Modul (ohne Datenbank testbar); geladen wird über `src/lib/data/shopSettings.ts`.

export interface ShopDisplaySettings {
  isOpen: boolean
  closedMessage: string | null
  pickupEnabled: boolean
  pickupCity: string | null
  /** `settings.shipping.deliveryTimeText` in der Sprache der Seite (Produktseite, R-035); `null` → Standard. */
  deliveryTimeText: string | null
  /** Aktueller Steuermodus zum Zeitpunkt des Renderns. */
  taxMode: TaxMode
  /** `settings.payment.reservationMinutes` (30–60); ohne gültigen Wert der Standard 30 wie bei der Reservierung. */
  reservationMinutes: number
}

/** Standard und Bereich wie `DEADLINE_DEFAULTS.reservationMinutes` (src/lib/commerce/deadlines.ts, server-only). */
const RESERVATION_MINUTES = { value: 30, min: 30, max: 60 } as const

export function pickShopDisplaySettings(settings: Record<string, unknown>): ShopDisplaySettings {
  const shop = (settings.shop ?? {}) as { isOpen?: unknown; closedMessage?: unknown }
  const shipping = (settings.shipping ?? {}) as {
    pickupEnabled?: unknown
    pickupCity?: unknown
    deliveryTimeText?: unknown
  }
  const tax = (settings.tax ?? {}) as { currentMode?: unknown }
  const minutes = ((settings.payment ?? {}) as { reservationMinutes?: unknown }).reservationMinutes
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    isOpen: shop.isOpen !== false,
    closedMessage: text(shop.closedMessage),
    pickupEnabled: shipping.pickupEnabled !== false,
    pickupCity: text(shipping.pickupCity),
    deliveryTimeText: text(shipping.deliveryTimeText),
    taxMode: (TAX_MODES as readonly string[]).includes(String(tax.currentMode))
      ? (tax.currentMode as TaxMode)
      : 'kleinunternehmer',
    reservationMinutes:
      typeof minutes === 'number' &&
      Number.isInteger(minutes) &&
      minutes >= RESERVATION_MINUTES.min &&
      minutes <= RESERVATION_MINUTES.max
        ? minutes
        : RESERVATION_MINUTES.value,
  }
}

/** Einstellungen im Format für `PriceNote`/`PriceFootnote`: der aktuelle Modus gilt ab sofort. */
export function taxSettingsFor(mode: TaxMode) {
  return { tax: { modes: [{ mode, validFrom: '1970-01-01T00:00:00.000Z' }] } }
}
