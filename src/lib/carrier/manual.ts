import 'server-only'

import type { CarrierAdapter, CarrierCode, TrackingUrlTemplate } from './types'

// Treiber `manual` (ARCHITEKTUR §3.7, E-26): Jutta trägt die Sendungsnummer ein (oder scannt sie); Links aus den
// Vorlagen der Einstellungen (`settings.shipping.trackingUrlTemplates`, DATENMODELL §7.1).

const DHL_TRACKING =
  'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}'

/** Standard von `settings.shipping.trackingUrlTemplates` (DATENMODELL §7.1; Deutsche Post über DHL, Annahme DM-12). */
export const DEFAULT_TRACKING_URL_TEMPLATES: readonly TrackingUrlTemplate[] = [
  { carrier: 'dhl', urlTemplate: DHL_TRACKING },
  { carrier: 'deutsche_post', urlTemplate: DHL_TRACKING },
]

/** Großbuchstaben, ohne Leerzeichen (DATENMODELL §6.8.1 `shipment.trackingNumber`, wie der Speicher-Hook der Bestellung). */
export function normalizeTrackingNumber(trackingNumber: string): string {
  return (trackingNumber ?? '').replace(/\s+/g, '').toUpperCase()
}

export const TRACKING_NUMBER_RE = /^[A-Z0-9]{8,35}$/

/** Normalisierte Sendungsnummer oder `null`, wenn sie nicht zum Format passt (Sonderzeichen, zu kurz/lang). */
export function parseTrackingNumber(input: string | null | undefined): string | null {
  const number = normalizeTrackingNumber(input ?? '')
  return TRACKING_NUMBER_RE.test(number) ? number : null
}

/**
 * EN-Variante des Links: Platzhalter `{locale}` wird ersetzt; sonst wird ein Sprachpfad `/de/` direkt nach dem Host
 * (DHL: `www.dhl.de/de/…`) zu `/en/`.
 */
function localizeTemplate(template: string, locale: 'de' | 'en'): string {
  if (template.includes('{locale}')) return template.replaceAll('{locale}', locale)
  if (locale === 'de') return template
  return template.replace(/^(https:\/\/[^/]+)\/de\//, '$1/en/')
}

export function createManualCarrierAdapter(
  templates: readonly TrackingUrlTemplate[] = DEFAULT_TRACKING_URL_TEMPLATES,
): CarrierAdapter {
  return {
    driver: 'manual',
    validateTrackingNumber(_carrier: CarrierCode, trackingNumber: string) {
      return parseTrackingNumber(trackingNumber) !== null
    },
    trackingUrl(carrier, trackingNumber, locale) {
      const number = normalizeTrackingNumber(trackingNumber ?? '')
      if (!number) return null
      const template = templates.find((t) => t.carrier === carrier)?.urlTemplate
      if (!template || !template.includes('{trackingNumber}')) return null
      return localizeTemplate(template, locale).replaceAll(
        '{trackingNumber}',
        encodeURIComponent(number),
      )
    },
  }
}
