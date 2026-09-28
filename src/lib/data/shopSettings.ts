import 'server-only'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'
import { pickShopDisplaySettings, type ShopDisplaySettings } from '@/lib/shop/displaySettings'
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
