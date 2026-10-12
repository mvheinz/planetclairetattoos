import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { SHIPPING_CLASSES, type Locale, type ShippingClass } from '@/lib/enums'
import {
  carrierForClass,
  carrierName,
  classCarrierName,
  highestClassOf,
  orderCarrierName,
  shippingClassName,
} from '@/lib/shop/carrier'

// P20.2 (V-09, U-93): Die Zeile direkt über „Zahlungspflichtig bestellen“ heißt „Versand: Keramik-Paket (DHL)“ statt
// „Versand als Keramik-Paket-Paket (DHL)“, Danke- und Statusseite nennen den echten Versanddienst statt „mit der Post“.

const MESSAGES = { de, en } as const
const t = (locale: Locale) => createTranslator({ locale, messages: MESSAGES[locale] })

/** Wörter klein, an Leerzeichen, Bindestrichen und Satzzeichen getrennt („Keramik-Paket-Paket“ → keramik, paket, paket). */
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/** Zwei gleiche Wörter direkt hintereinander (ohne Groß-/Kleinschreibung, auch über die Naht Klasse/Zusatz). */
const doubled = (text: string) => {
  const w = words(text)
  return w.find((word, i) => i > 0 && w[i - 1] === word) ?? null
}

/** Kassenzeile wie in `CheckoutSummaryTotals`. */
const checkoutLine = (locale: Locale, cls: ShippingClass) =>
  t(locale)('checkout.overview.shippingLine', {
    shippingClass: shippingClassName(cls, locale),
    carrier: classCarrierName(cls),
  })

describe('V-09 Versandzeile an der Kasse', () => {
  it('Prüfung erkennt die alte Doppelung (Gegenprobe)', () => {
    expect(doubled('Versand als Keramik-Paket-Paket (DHL)')).toBe('paket')
    expect(doubled('Shipped as a Ceramics parcel parcel (DHL)')).toBe('parcel')
    expect(doubled('Versand: Keramik-Paket (DHL)')).toBeNull()
  })

  it.each(
    (['de', 'en'] as const).flatMap((locale) =>
      SHIPPING_CLASSES.map((cls) => [locale, cls] as [Locale, ShippingClass]),
    ),
  )('%s/%s: kein Wort doppelt hintereinander', (locale, cls) => {
    const line = checkoutLine(locale, cls)
    expect(doubled(line), line).toBeNull()
    // Klasse und Dienst stehen vollständig darin
    expect(line).toContain(shippingClassName(cls, locale))
    expect(line).toContain(classCarrierName(cls))
  })

  it('Wortlaut wie im Analyse-Vorschlag', () => {
    expect(checkoutLine('de', 'keramik')).toBe('Versand: Keramik-Paket (DHL)')
    expect(checkoutLine('de', 'brief')).toBe('Versand: Brief (Deutsche Post)')
    expect(checkoutLine('de', 'paket_klein')).toBe('Versand: Paket klein (DHL)')
    expect(checkoutLine('en', 'keramik')).toBe('Shipping: Ceramics parcel (DHL)')
    expect(checkoutLine('en', 'brief')).toBe('Shipping: Letter (Deutsche Post)')
  })

  it('Lieferart auf Danke- und Statusseite nennt den Dienst, nie „mit der Post“', () => {
    for (const locale of ['de', 'en'] as const) {
      for (const carrier of ['DHL', 'Deutsche Post']) {
        const line = t(locale)('order.deliveryShipping', { carrier })
        expect(line).toContain(carrier)
        expect(doubled(line), line).toBeNull()
      }
    }
    expect(t('de')('order.deliveryShipping', { carrier: 'DHL' })).toBe('Versand per DHL')
    expect(t('en')('order.deliveryShipping', { carrier: 'Deutsche Post' })).toBe(
      'Shipping with Deutsche Post',
    )
    for (const messages of [de, en]) {
      expect(JSON.stringify(messages)).not.toMatch(/mit der Post|by post/i)
    }
  })
})

describe('V-09 Versanddienst je Klasse und Bestellung', () => {
  it('Brief → Deutsche Post, sonst DHL (KONZEPT §7.6)', () => {
    expect(carrierForClass('brief')).toBe('deutsche_post')
    for (const cls of ['paket_klein', 'keramik', 'nur_abholung', null, undefined] as const)
      expect(carrierForClass(cls)).toBe('dhl')
    expect(carrierName('dhl')).toBe('DHL')
    expect(carrierName('deutsche_post')).toBe('Deutsche Post')
    expect(carrierName('other')).toBeNull()
    expect(carrierName(null)).toBeNull()
  })

  it('höchste Klasse zählt (E-25)', () => {
    expect(highestClassOf([])).toBeNull()
    expect(highestClassOf([null, 'brief', undefined])).toBe('brief')
    expect(highestClassOf(['brief', 'keramik', 'paket_klein'])).toBe('keramik')
  })

  it('Bestellung: gemeldeter Dienst vor Versandklasse; „Sonstige“ und ohne Klasse ohne Namen', () => {
    expect(orderCarrierName({ shippingClass: 'brief' })).toBe('Deutsche Post')
    expect(orderCarrierName({ shippingClass: 'keramik' })).toBe('DHL')
    expect(orderCarrierName({ itemClasses: ['brief', 'paket_klein'] })).toBe('DHL')
    expect(orderCarrierName({ itemClasses: ['brief'] })).toBe('Deutsche Post')
    expect(orderCarrierName({ shipmentCarrier: 'dhl', shippingClass: 'brief' })).toBe('DHL')
    expect(orderCarrierName({ shipmentCarrier: 'other', shippingClass: 'keramik' })).toBeNull()
    expect(orderCarrierName({})).toBeNull()
  })
})
