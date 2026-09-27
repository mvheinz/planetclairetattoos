import { describe, expect, it } from 'vitest'

import { getCarrierAdapter, normalizeTrackingNumber } from '@/lib/carrier'
import { createManualCarrierAdapter } from '@/lib/carrier/manual'

// P1.10 – Kontrakttest Versand (ARCHITEKTUR §3.7): Treiber `manual`, keine API, keine Netzwerk-Anfrage.

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
    expect(normalizeTrackingNumber(' jj12 3456-78 ')).toBe('JJ12345678')
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
