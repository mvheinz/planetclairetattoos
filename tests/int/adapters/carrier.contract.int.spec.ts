import { describe, expect, it } from 'vitest'

import { getTestPayload } from '../helpers/payload'

import {
  __setCarrierAdapterForTests,
  getCarrierAdapter,
  getCarrierAdapterFromSettings,
  normalizeTrackingNumber,
} from '@/lib/carrier'
import { createManualCarrierAdapter } from '@/lib/carrier/manual'

// P1.10/P5.14 – Kontrakttest Versand (ARCHITEKTUR §3.7): Treiber `manual`, keine API, keine Netzwerk-Anfrage.

describe('Versand – manual', () => {
  const carrier = getCarrierAdapter()

  it('Treiber manual, kein Etikett (E-26)', () => {
    expect(carrier.driver).toBe('manual')
    expect(carrier.createLabel).toBeUndefined()
  })

  it("validateTrackingNumber('dhl', '00340434161234567890') === true; leere Nummer false", () => {
    expect(carrier.validateTrackingNumber('dhl', '00340434161234567890')).toBe(true)
    expect(carrier.validateTrackingNumber('dhl', '')).toBe(false)
    expect(carrier.validateTrackingNumber('deutsche_post', 'rr 123 456 789 de')).toBe(true)
    expect(carrier.validateTrackingNumber('dhl', '1234567')).toBe(false) // < 8
    expect(carrier.validateTrackingNumber('dhl', 'A'.repeat(36))).toBe(false) // > 35
    expect(carrier.validateTrackingNumber('dhl', '0034043416#123')).toBe(false)
    expect(normalizeTrackingNumber(' jj12 3456 78 ')).toBe('JJ12345678')
    expect(carrier.validateTrackingNumber('dhl', 'JJ12-3456-78')).toBe(false) // Sonderzeichen (P5.14)
  })

  it('trackingUrl aus der Vorlage, normalisierte Nummer; ohne Nummer null', () => {
    expect(carrier.trackingUrl('dhl', '00340434161234567890', 'de')).toBe(
      'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434161234567890',
    )
    expect(carrier.trackingUrl('deutsche_post', 'rr123456789de', 'en')).toContain(
      'piececode=RR123456789DE',
    )
    expect(carrier.trackingUrl('dhl', '', 'de')).toBeNull()
    expect(carrier.trackingUrl('dhl', '   ', 'de')).toBeNull()
  })

  it('ohne Vorlage null; Vorlagen aus den Einstellungen mit {locale}', () => {
    const custom = createManualCarrierAdapter([
      { carrier: 'dhl', urlTemplate: 'https://www.dhl.de/{locale}/x?n={trackingNumber}' },
    ])
    expect(custom.trackingUrl('deutsche_post', '00340434161234567890', 'de')).toBeNull()
    expect(custom.trackingUrl('dhl', '00340434161234567890', 'en')).toBe(
      'https://www.dhl.de/en/x?n=00340434161234567890',
    )
    const broken = createManualCarrierAdapter([
      { carrier: 'dhl', urlTemplate: 'https://www.dhl.de/' },
    ])
    expect(broken.trackingUrl('dhl', '00340434161234567890', 'de')).toBeNull()
  })
})

describe('Versand – Vorlagen aus den Einstellungen (P5.14, DATENMODELL §7.1, DM-12)', () => {
  it('Grund-Seed enthält die Vorlagen für dhl und deutsche_post (DHL-Sendungsverfolgung, Annahme DM-12)', async () => {
    const payload = await getTestPayload()
    const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true })
    const templates = settings.shipping?.trackingUrlTemplates ?? []
    const dhl =
      'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}'
    expect(templates.map((t) => [t.carrier, t.urlTemplate]).sort()).toEqual([
      ['deutsche_post', dhl],
      ['dhl', dhl],
    ])
  })

  it('getCarrierAdapterFromSettings: Link DE/EN aus den Einstellungen; kein Request an fremde Hosts', async () => {
    const payload = await getTestPayload()
    __setCarrierAdapterForTests(undefined)
    const carrier = await getCarrierAdapterFromSettings(payload)
    expect(carrier.driver).toBe('manual')
    expect(carrier.trackingUrl('deutsche_post', '00340 4343 1234 5678 90', 'de')).toBe(
      'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=0034043431234567890',
    )
    expect(carrier.trackingUrl('dhl', '0034043431234567890', 'en')).toBe(
      'https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html?piececode=0034043431234567890',
    )
  })
})
