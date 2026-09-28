import { TAX_MODES, type TaxMode } from '@/lib/enums'

// Projektion der öffentlichen Einstellungen (Whitelist `getPublicSettings()`, DATENMODELL §7.1) auf das, was Listen-
// und Stückseiten anzeigen (KONZEPT §3.2): Shop geöffnet/pausiert samt Hinweis, Abholung, aktueller Steuermodus.
// Reines Modul (ohne Datenbank testbar); geladen wird über `src/lib/data/shopSettings.ts`.

export interface ShopDisplaySettings {
  isOpen: boolean
  closedMessage: string | null
  pickupEnabled: boolean
  pickupCity: string | null
  /** Aktueller Steuermodus zum Zeitpunkt des Renderns. */
  taxMode: TaxMode
}

export function pickShopDisplaySettings(settings: Record<string, unknown>): ShopDisplaySettings {
  const shop = (settings.shop ?? {}) as { isOpen?: unknown; closedMessage?: unknown }
  const shipping = (settings.shipping ?? {}) as { pickupEnabled?: unknown; pickupCity?: unknown }
  const tax = (settings.tax ?? {}) as { currentMode?: unknown }
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    isOpen: shop.isOpen !== false,
    closedMessage: text(shop.closedMessage),
    pickupEnabled: shipping.pickupEnabled !== false,
    pickupCity: text(shipping.pickupCity),
    taxMode: (TAX_MODES as readonly string[]).includes(String(tax.currentMode))
      ? (tax.currentMode as TaxMode)
      : 'kleinunternehmer',
  }
}

/** Einstellungen im Format für `PriceNote`/`PriceFootnote`: der aktuelle Modus gilt ab sofort. */
export function taxSettingsFor(mode: TaxMode) {
  return { tax: { modes: [{ mode, validFrom: '1970-01-01T00:00:00.000Z' }] } }
}
