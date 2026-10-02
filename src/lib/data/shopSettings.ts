import 'server-only'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'
import { pickShopDisplaySettings, type ShopDisplaySettings } from '@/lib/shop/displaySettings'
import {
  pickBusinessInfo,
  shippingRatesDe,
  type BusinessInfo,
  type ParcelClass,
} from '@/lib/shop/productInfo'
import { systemClock } from '@/lib/time'

export { taxSettingsFor, type ShopDisplaySettings } from '@/lib/shop/displaySettings'

// Shop-Einstellungen für die öffentlichen Listen und Stückseiten (DATENMODELL §7.1, KONZEPT §3.2): ausschließlich aus
// der Whitelist `getPublicSettings()` – Shop geöffnet/pausiert samt Hinweis, Abholung, aktueller Steuermodus (nur
// `tax.currentMode` ist öffentlich). Gecacht (Tag `settings`). Ohne Datenbank: geöffnet, Kleinunternehmer (E-02).

const log = createLogger()

export async function loadShopDisplaySettings(locale: Locale): Promise<ShopDisplaySettings> {
  try {
    return pickShopDisplaySettings(await getPublicSettings(systemClock, { locale }))
  } catch (err) {
    log.warn('shop_settings.load_failed', { reason: (err as Error).message })
    return pickShopDisplaySettings({})
  }
}

export const getShopDisplaySettings = cached(loadShopDisplaySettings, {
  key: 'shop-display-settings',
  tags: [TAGS.settings],
})

export interface ProductInfoSettings {
  business: BusinessInfo
  /** DE-Preise je Versandklasse in Cent (`settings.shipping.rates`, Zone DE, E-25). */
  shippingRates: Partial<Record<ParcelClass, number>>
}

/**
 * Stammdaten der Herstellerin (Block „Herstellerin & Sicherheit“, R-040) und DE-Versandpreise (Block „Versand & Rückgabe
 * kurz“, R-031) für die Produktseite – aus derselben Whitelist. Ohne Datenbank leer (die Seite zeigt dann nur Platzhalter).
 */
export async function loadProductInfoSettings(locale: Locale): Promise<ProductInfoSettings> {
  let settings: Record<string, unknown> = {}
  try {
    settings = await getPublicSettings(systemClock, { locale })
  } catch (err) {
    log.warn('shop_settings.load_failed', { reason: (err as Error).message })
  }
  return { business: pickBusinessInfo(settings, locale), shippingRates: shippingRatesDe(settings) }
}

export const getProductInfoSettings = cached(loadProductInfoSettings, {
  key: 'product-info-settings',
  tags: [TAGS.settings],
})

export interface ShippingPaymentSettings {
  /** `settings.shipping` wie für `computeShipping` (Tarife aller Zonen, Lieferländer) – dieselbe Quelle (E-25). */
  shipping: {
    rates: { zone: string | null; shippingClass: string | null; priceCents: number | null }[]
    enabledCountries: string[]
  }
  pickupEnabled: boolean
  pickupCity: string | null
  /** `settings.shipping.deliveryTimeText` in der Sprache der Seite; `null` → Standard (E-31). */
  deliveryTimeText: string | null
  prepaymentEnabled: boolean
  /** Reservierungsdauer bei Vorkasse in Kalendertagen (E-23, Standard 5). */
  prepaymentDays: number
}

const DEFAULT_PREPAYMENT_DAYS = 5

/** Versand- und Zahlungsangaben für R25 und den Korb (KONZEPT §3.15) – aus der Whitelist der Einstellungen. */
export async function loadShippingPaymentSettings(
  locale: Locale,
): Promise<ShippingPaymentSettings> {
  let settings: Record<string, unknown> = {}
  try {
    settings = await getPublicSettings(systemClock, { locale })
  } catch (err) {
    log.warn('shop_settings.load_failed', { reason: (err as Error).message })
  }
  const obj = (v: unknown) =>
    (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const shipping = obj(settings.shipping)
  const payment = obj(settings.payment)
  const display = pickShopDisplaySettings(settings)
  const rates = (Array.isArray(shipping.rates) ? shipping.rates : []).map((r) => {
    const rate = obj(r)
    return {
      zone: typeof rate.zone === 'string' ? rate.zone : null,
      shippingClass: typeof rate.shippingClass === 'string' ? rate.shippingClass : null,
      priceCents: typeof rate.priceCents === 'number' ? rate.priceCents : null,
    }
  })
  const days = payment.prepaymentDays
  return {
    shipping: {
      rates,
      enabledCountries: Array.isArray(shipping.enabledCountries)
        ? shipping.enabledCountries.map(String)
        : [],
    },
    pickupEnabled: display.pickupEnabled,
    pickupCity: display.pickupCity,
    deliveryTimeText: display.deliveryTimeText,
    prepaymentEnabled: payment.prepaymentEnabled !== false,
    prepaymentDays:
      typeof days === 'number' && Number.isInteger(days) && days > 0
        ? days
        : DEFAULT_PREPAYMENT_DAYS,
  }
}

export const getShippingPaymentSettings = cached(loadShippingPaymentSettings, {
  key: 'shipping-payment-settings',
  tags: [TAGS.settings],
})
