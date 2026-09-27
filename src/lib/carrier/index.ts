import 'server-only'

import { getEnv } from '@/lib/env'

import { createManualCarrierAdapter } from './manual'
import type { CarrierAdapter, TrackingUrlTemplate } from './types'

export type * from './types'
export { DEFAULT_TRACKING_URL_TEMPLATES, normalizeTrackingNumber } from './manual'

// Auswahl über CARRIER_DRIVER (ARCHITEKTUR §3.7); einziger Treiber ist `manual`.

let override: CarrierAdapter | undefined

/**
 * Versand-Adapter. `templates` = `settings.shipping.trackingUrlTemplates` (ab P5 aus den Einstellungen); ohne Angabe
 * gelten die Standardvorlagen.
 */
export function getCarrierAdapter(templates?: readonly TrackingUrlTemplate[]): CarrierAdapter {
  if (override) return override
  const env = getEnv()
  if (env.CARRIER_DRIVER !== 'manual') {
    throw new Error(`Unbekannter CARRIER_DRIVER: ${String(env.CARRIER_DRIVER)}`)
  }
  return createManualCarrierAdapter(templates)
}

/** Nur in Tests benutzen. */
export function __setCarrierAdapterForTests(adapter?: CarrierAdapter): void {
  override = adapter
}
