import { describe, expect, it } from 'vitest'

import { DEFAULT_SHIPPING_RATES } from '@/globals/settingsDefaults'
import {
  assertShippingCountry,
  computeShipping,
  enabledCountries,
  highestShippingClass,
  ShippingError,
} from '@/lib/commerce/shipping'
import { COUNTRY_CODES } from '@/lib/enums'

// DM-ORD-05, AK-4-01, AK-4-02, R-060 (P4.2): höchste Versandklasse bestimmt den Tarif; Abholung = 0; nur_abholung nie
// versenden; nur Länder aus settings.shipping.enabledCountries, GB/US nie.
const settings = { shipping: { rates: DEFAULT_SHIPPING_RATES, enabledCountries: ['DE'] } }

describe('computeShipping (DM-ORD-05)', () => {
  it('DM-ORD-05 höchste Klasse im Korb: brief < paket_klein < keramik', () => {
    expect(highestShippingClass([{ shippingClass: 'brief' }])).toBe('brief')
    expect(
      highestShippingClass([
        { shippingClass: 'brief' },
        { shippingClass: 'keramik' },
        { shippingClass: 'paket_klein' },
      ]),
    ).toBe('keramik')
  })

  it('DM-ORD-05 shippingCents = Tarif der höchsten Klasse (Zone DE) mit Anzeigename', () => {
    expect(computeShipping([{ shippingClass: 'brief' }], 'shipping', settings)).toEqual({
      shippingClass: 'brief',
      zone: 'DE',
      country: 'DE',
      shippingCents: 450,
      label: { de: 'Deutsche Post (Brief)', en: 'Deutsche Post (letter)' },
    })
    expect(
      computeShipping(
        [{ shippingClass: 'brief' }, { shippingClass: 'paket_klein' }],
        'shipping',
        settings,
      ).shippingCents,
    ).toBe(650)
  })

  it('AK-4-01 Brief + Keramik → 890 bei shipping („DHL Paket (Keramik)“), 0 bei pickup („Abholung in Berlin“)', () => {
    const items = [
      { itemNumber: 17, shippingClass: 'brief' as const },
      { itemNumber: 21, shippingClass: 'keramik' as const },
    ]
    const shipped = computeShipping(items, 'shipping', settings)
    expect(shipped).toMatchObject({ shippingClass: 'keramik', zone: 'DE', shippingCents: 890 })
    expect(shipped.label).toEqual({ de: 'DHL Paket (Keramik)', en: 'DHL parcel (ceramics)' })
    const pickup = computeShipping(items, 'pickup', settings)
    expect(pickup).toMatchObject({ zone: null, country: null, shippingCents: 0 })
    expect(pickup.label).toEqual({ de: 'Abholung in Berlin', en: 'Pickup in Berlin' })
  })

  it('DM-ORD-05 Abholung kostet 0 – auch mit nur_abholung', () => {
    expect(
      computeShipping(
        [{ shippingClass: 'keramik' }, { shippingClass: 'nur_abholung' }],
        'pickup',
        settings,
      ),
    ).toMatchObject({ shippingClass: 'nur_abholung', zone: null, shippingCents: 0 })
  })

  it('AK-4-02 DM-ORD-05 Versand mit einer nur_abholung-Position wird abgelehnt', () => {
    const run = () =>
      computeShipping(
        [{ shippingClass: 'brief' }, { itemNumber: 23, shippingClass: 'nur_abholung' }],
        'shipping',
        settings,
      )
    expect(run).toThrow(ShippingError)
    expect(run).toThrow('Nr. 023 gibt es nur zur Abholung.')
    try {
      run()
    } catch (e) {
      expect((e as ShippingError).code).toBe('pickup_only')
    }
    expect(() =>
      computeShipping([{ shippingClass: 'nur_abholung' }], 'shipping', settings),
    ).toThrow(/nur zur Abholung/)
  })

  it('ohne Tarif bzw. ohne Positionen gibt es einen Fehler statt 0 €', () => {
    expect(() => computeShipping([{ shippingClass: 'brief' }], 'shipping', {})).toThrow(
      /kein Versandpreis/,
    )
    expect(() => computeShipping([], 'pickup', settings)).toThrow(/leer/)
  })
})

describe('Lieferländer (R-060)', () => {
  it('R-060 Land AT bei nur DE → Fehler country_not_enabled', () => {
    const run = () =>
      computeShipping([{ shippingClass: 'brief' }], 'shipping', settings, { country: 'AT' })
    expect(run).toThrow(ShippingError)
    expect(run).toThrow(/nicht möglich/)
    try {
      run()
    } catch (e) {
      expect((e as ShippingError).code).toBe('country_not_enabled')
    }
    expect(
      computeShipping([{ shippingClass: 'brief' }], 'shipping', settings, { country: 'de' }),
    ).toMatchObject({ country: 'DE', zone: 'DE' })
  })

  it('R-060 GB und US sind nie Lieferländer – auch nicht, wenn sie in den Einstellungen stünden', () => {
    expect(COUNTRY_CODES).not.toContain('GB')
    expect(COUNTRY_CODES).not.toContain('US')
    const tampered = { shipping: { ...settings.shipping, enabledCountries: ['DE', 'GB', 'US'] } }
    expect(enabledCountries(tampered)).toEqual(['DE'])
    for (const c of ['GB', 'US', 'XX', '']) {
      expect(() => assertShippingCountry(c, tampered)).toThrow(ShippingError)
    }
  })

  it('R-060 ohne Einstellung gilt nur DE; ein freigeschaltetes EU-Land nutzt die Zone EU', () => {
    expect(enabledCountries({})).toEqual(['DE'])
    expect(enabledCountries({ shipping: { enabledCountries: [] } })).toEqual(['DE'])
    const eu = {
      shipping: {
        enabledCountries: ['DE', 'AT'],
        rates: [
          ...DEFAULT_SHIPPING_RATES,
          { zone: 'EU' as const, shippingClass: 'brief' as const, priceCents: 900 },
        ],
      },
    }
    expect(
      computeShipping([{ shippingClass: 'brief' }], 'shipping', eu, { country: 'AT' }),
    ).toMatchObject({ zone: 'EU', country: 'AT', shippingCents: 900 })
  })

  it('R-060 bei Abholung spielt das Land keine Rolle', () => {
    expect(
      computeShipping([{ shippingClass: 'brief' }], 'pickup', settings, { country: 'AT' }),
    ).toMatchObject({ country: null, shippingCents: 0 })
  })
})
