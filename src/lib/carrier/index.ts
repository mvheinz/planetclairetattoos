import 'server-only'

import type { Payload, PayloadRequest } from 'payload'

import type { ShippingClass } from '@/lib/enums'
import { getEnv } from '@/lib/env'

import { createManualCarrierAdapter } from './manual'
import type { CarrierAdapter, CarrierCode, TrackingUrlTemplate } from './types'

export type * from './types'
export {
  DEFAULT_TRACKING_URL_TEMPLATES,
  normalizeTrackingNumber,
  parseTrackingNumber,
  TRACKING_NUMBER_RE,
} from './manual'

// Auswahl über CARRIER_DRIVER (ARCHITEKTUR §3.7); einziger Treiber ist `manual`.

let override: CarrierAdapter | undefined

/**
 * Versand-Adapter. `templates` = `settings.shipping.trackingUrlTemplates`; ohne Angabe gelten die Standardvorlagen
 * (lieber `getCarrierAdapterFromSettings`).
 */
export function getCarrierAdapter(templates?: readonly TrackingUrlTemplate[]): CarrierAdapter {
  if (override) return override
  const env = getEnv()
  if (env.CARRIER_DRIVER !== 'manual') {
    throw new Error(`Unbekannter CARRIER_DRIVER: ${String(env.CARRIER_DRIVER)}`)
  }
  return createManualCarrierAdapter(templates)
}

export const isCarrierCode = (v: unknown): v is CarrierCode => v === 'dhl' || v === 'deutsche_post'

/** Gültige Vorlagen aus `settings.shipping.trackingUrlTemplates` (Einträge ohne `{trackingNumber}` fallen weg). */
export function trackingTemplatesFromSettings(settings: {
  shipping?: { trackingUrlTemplates?: readonly unknown[] | null } | null
}): TrackingUrlTemplate[] {
  return (settings.shipping?.trackingUrlTemplates ?? []).flatMap((t) => {
    const row = t as { carrier?: unknown; urlTemplate?: unknown } | null
    return row && isCarrierCode(row.carrier) && typeof row.urlTemplate === 'string'
      ? row.urlTemplate.includes('{trackingNumber}')
        ? [{ carrier: row.carrier, urlTemplate: row.urlTemplate }]
        : []
      : []
  })
}

/** Adapter mit den Vorlagen aus den Einstellungen (Versand melden P5.15, Bestellstatus-Seite). */
export async function getCarrierAdapterFromSettings(
  payload: Payload,
  req?: PayloadRequest,
): Promise<CarrierAdapter> {
  const settings = await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  return getCarrierAdapter(trackingTemplatesFromSettings(settings))
}

/** Vorbelegung der Versanddienst-Auswahl (P5.14): Versandklasse `brief` → Deutsche Post, sonst DHL. */
export function defaultCarrierFor(shippingClass: ShippingClass | null | undefined): CarrierCode {
  return shippingClass === 'brief' ? 'deutsche_post' : 'dhl'
}

/** Nur in Tests benutzen. */
export function __setCarrierAdapterForTests(adapter?: CarrierAdapter): void {
  override = adapter
}
