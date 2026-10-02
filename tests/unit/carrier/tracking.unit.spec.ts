import { describe, expect, it } from 'vitest'

import { defaultCarrierFor, trackingTemplatesFromSettings } from '@/lib/carrier'
import {
  createManualCarrierAdapter,
  normalizeTrackingNumber,
  parseTrackingNumber,
} from '@/lib/carrier/manual'

// P5.14 – Sendungsnummer normalisieren/prüfen (DATENMODELL §6.8.1: Großbuchstaben, ohne Leerzeichen, ^[A-Z0-9]{8,35}$)
// und Verfolgungslink aus den Vorlagen (EN-Variante mit /en/).

describe('Sendungsnummer (P5.14)', () => {
  it('„00340 4343 1234 5678 90“ → 0034043431234567890 und gültig', () => {
    expect(normalizeTrackingNumber('00340 4343 1234 5678 90')).toBe('0034043431234567890')
    expect(parseTrackingNumber('00340 4343 1234 5678 90')).toBe('0034043431234567890')
    expect(
      createManualCarrierAdapter().validateTrackingNumber('dhl', '00340 4343 1234 5678 90'),
    ).toBe(true)
  })

  it('Kleinbuchstaben werden groß, Tabs/Zeilenumbrüche fallen weg', () => {
    expect(parseTrackingNumber(' rr 123 456 789 de\n')).toBe('RR123456789DE')
    expect(parseTrackingNumber('JJ\t1234\t5678')).toBe('JJ12345678')
  })

  it('„ABC“ (zu kurz), zu lang und Sonderzeichen werden abgelehnt', () => {
    const c = createManualCarrierAdapter()
    for (const bad of [
      'ABC',
      '1234567',
      'A'.repeat(36),
      '0034043416#123',
      '00340-4343-1234',
      'ÄÖÜ12345678',
      '',
      '   ',
    ]) {
      expect(parseTrackingNumber(bad), bad).toBeNull()
      expect(c.validateTrackingNumber('deutsche_post', bad), bad).toBe(false)
    }
    expect(parseTrackingNumber(null)).toBeNull()
    expect(parseTrackingNumber('A'.repeat(35))).toBe('A'.repeat(35))
    expect(parseTrackingNumber('12345678')).toBe('12345678')
  })
})

describe('Verfolgungslink (P5.14)', () => {
  const c = createManualCarrierAdapter()
  it('DE-Link aus der Vorlage, EN-Variante mit /en/; ohne Nummer kein Link', () => {
    expect(c.trackingUrl('dhl', '00340 4343 1234 5678 90', 'de')).toBe(
      'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=0034043431234567890',
    )
    expect(c.trackingUrl('deutsche_post', 'rr123456789de', 'en')).toBe(
      'https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html?piececode=RR123456789DE',
    )
    expect(c.trackingUrl('dhl', '', 'en')).toBeNull()
  })

  it('Vorlage mit {locale} wird ersetzt statt /de/ umzuschreiben', () => {
    const custom = createManualCarrierAdapter([
      { carrier: 'dhl', urlTemplate: 'https://track.example/{locale}/de/?n={trackingNumber}' },
    ])
    expect(custom.trackingUrl('dhl', '12345678', 'en')).toBe(
      'https://track.example/en/de/?n=12345678',
    )
  })

  it('Vorlagen aus den Einstellungen: ungültige Einträge fallen weg', () => {
    expect(
      trackingTemplatesFromSettings({
        shipping: {
          trackingUrlTemplates: [
            { carrier: 'dhl', urlTemplate: 'https://www.dhl.de/de/x?p={trackingNumber}' },
            { carrier: 'other', urlTemplate: 'https://x.example/{trackingNumber}' },
            { carrier: 'deutsche_post', urlTemplate: 'https://www.dhl.de/' },
            null,
          ],
        },
      }),
    ).toEqual([{ carrier: 'dhl', urlTemplate: 'https://www.dhl.de/de/x?p={trackingNumber}' }])
    expect(trackingTemplatesFromSettings({})).toEqual([])
  })
})

describe('Versanddienst-Vorbelegung (P5.14)', () => {
  it('Klasse brief → deutsche_post, sonst dhl', () => {
    expect(defaultCarrierFor('brief')).toBe('deutsche_post')
    expect(defaultCarrierFor('paket_klein')).toBe('dhl')
    expect(defaultCarrierFor('keramik')).toBe('dhl')
    expect(defaultCarrierFor(null)).toBe('dhl')
  })
})
