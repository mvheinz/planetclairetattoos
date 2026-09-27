import 'server-only'

import type { CarrierAdapter, CarrierCode, TrackingUrlTemplate } from './types'

// Treiber `manual` (ARCHITEKTUR §3.7, E-26): Jutta trägt die Sendungsnummer ein; Links aus den Vorlagen der Einstellungen.

/** Standard von `settings.shipping.trackingUrlTemplates` (DATENMODELL §7.1; Deutsche Post über DHL, DM-12). */
export const DEFAULT_TRACKING_URL_TEMPLATES: readonly TrackingUrlTemplate[] = [
  {
    carrier: 'dhl',
    urlTemplate:
      'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}',
  },
  {
    carrier: 'deutsche_post',
    urlTemplate:
      'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}',
  },
]

/** Großbuchstaben, ohne Leer- und Trennzeichen (DATENMODELL §6.8.1 `shipment.trackingNumber`). */
export function normalizeTrackingNumber(trackingNumber: string): string {
  return trackingNumber.replace(/[\s-]+/g, '').toUpperCase()
}

const TRACKING_RE = /^[A-Z0-9]{8,35}$/

export function createManualCarrierAdapter(
  templates: readonly TrackingUrlTemplate[] = DEFAULT_TRACKING_URL_TEMPLATES,
): CarrierAdapter {
  return {
    driver: 'manual',
    validateTrackingNumber(_carrier: CarrierCode, trackingNumber: string) {
      return TRACKING_RE.test(normalizeTrackingNumber(trackingNumber ?? ''))
    },
    trackingUrl(carrier, trackingNumber, locale) {
      const number = normalizeTrackingNumber(trackingNumber ?? '')
      if (!number) return null
      const template = templates.find((t) => t.carrier === carrier)?.urlTemplate
      if (!template || !template.includes('{trackingNumber}')) return null
      return template
        .replaceAll('{trackingNumber}', encodeURIComponent(number))
        .replaceAll('{locale}', locale)
    },
  }
}
