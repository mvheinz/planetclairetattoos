import { describe, expect, it } from 'vitest'

import { DEFAULT_SHIPPING_RATES } from '@/globals/settingsDefaults'
import { computeShipping, highestShippingClass, ShippingError } from '@/lib/commerce/shipping'

// DM-ORD-05 (Vorbedingung): höchste Versandklasse bestimmt den Tarif; Abholung = 0; nur_abholung nie versenden.
const settings = { shipping: { rates: DEFAULT_SHIPPING_RATES } }

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

  it('DM-ORD-05 shippingCents = Tarif der höchsten Klasse (Zone DE)', () => {
    expect(computeShipping([{ shippingClass: 'brief' }], 'shipping', settings)).toEqual({
      shippingClass: 'brief',
      zone: 'DE',
      shippingCents: 450,
    })
    expect(
      computeShipping(
        [{ shippingClass: 'brief' }, { shippingClass: 'paket_klein' }],
        'shipping',
        settings,
      ).shippingCents,
    ).toBe(650)
    expect(
      computeShipping(
        [{ shippingClass: 'keramik' }, { shippingClass: 'brief' }],
        'shipping',
        settings,
      ).shippingCents,
    ).toBe(890)
  })

  it('DM-ORD-05 Abholung kostet 0 – auch mit nur_abholung', () => {
    expect(
      computeShipping(
        [{ shippingClass: 'keramik' }, { shippingClass: 'nur_abholung' }],
        'pickup',
        settings,
      ),
    ).toEqual({ shippingClass: 'nur_abholung', zone: null, shippingCents: 0 })
  })

  it('DM-ORD-05 Versand mit einer nur_abholung-Position wird abgelehnt', () => {
    const run = () =>
      computeShipping(
        [{ shippingClass: 'brief' }, { itemNumber: 23, shippingClass: 'nur_abholung' }],
        'shipping',
        settings,
      )
    expect(run).toThrow(ShippingError)
    expect(run).toThrow('Nr. 023 gibt es nur zur Abholung.')
  })

  it('ohne Tarif bzw. ohne Positionen gibt es einen Fehler statt 0 €', () => {
    expect(() => computeShipping([{ shippingClass: 'brief' }], 'shipping', {})).toThrow(
      /kein Versandpreis/,
    )
    expect(() => computeShipping([], 'pickup', settings)).toThrow(/leer/)
  })
})
