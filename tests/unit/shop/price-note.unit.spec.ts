// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { DeliveryTime, deliveryTimeText } from '@/components/shop/DeliveryTime'
import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { PriceFootnote } from '@/components/shop/PriceFootnote'
import { PriceNote, priceNoteText, type PriceTaxSettings } from '@/components/shop/PriceNote'
import { ShippingNoteLink } from '@/components/shop/ShippingNoteLink'
import { WarrantyNotice } from '@/components/shop/WarrantyNotice'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { WARRANTY_INFO_URL } from '@/lib/legal/warranty'
import { isVagueDeliveryTime, validateDeliveryTimeText } from '@/lib/shop/deliveryTime'

// P3.3 Preis-, Steuer-, Liefer- und Gewährleistungshinweise (R-030, R-032, R-035, R-049; V-02, V-20).

const ROOT = path.resolve(import.meta.dirname, '../../..')
const h = React.createElement

afterEach(cleanup)

function renderIntl(ui: React.ReactElement, locale: Locale = 'de') {
  return render(
    h(NextIntlClientProvider, { locale, messages: locale === 'de' ? de : en, children: ui }),
  ).container
}

/** Kleinunternehmerin seit 2026, Regelbesteuerung ab 01.03.2027 (Mitternacht Berlin = 23:00 UTC am Vortag). */
const SETTINGS: PriceTaxSettings = {
  tax: {
    modes: [
      { mode: 'kleinunternehmer', validFrom: '2026-01-01T00:00:00.000Z' },
      { mode: 'regelbesteuert', validFrom: '2027-02-28T23:00:00.000Z' },
    ],
    standardRate: 19,
    reducedRate: 7,
  },
}
const BEFORE = new Date('2027-02-28T22:59:59.999Z')
const FROM = new Date('2027-02-28T23:00:00.000Z')
const VAT_WORDING = /inkl\.?\s*(MwSt|USt)|incl\.?\s*(\d+\s*%\s*)?VAT|Mehrwertsteuer|\bMwSt\b/i

describe('PriceNote (R-030, R-032)', () => {
  it('R-030 Kleinunternehmer: Baustein price.kleinunternehmerNote, nie „inkl. MwSt/USt“ (AK-3-07, V-02, R-126)', () => {
    for (const locale of ['de', 'en'] as const) {
      for (const vatCategory of ['standard', 'reduced_art'] as const) {
        const text = priceNoteText({ locale, settings: SETTINGS, at: BEFORE, vatCategory })
        expect(text).not.toMatch(VAT_WORDING)
        expect(text).toMatch(locale === 'de' ? /§ 19 UStG/ : /Section 19/)
      }
    }
    const el = renderIntl(
      h(PriceNote, { locale: 'de', settings: SETTINGS, at: BEFORE, amountCents: 5390 }),
    )
    expect(el.textContent).toBe(
      '53,90 € Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    )
    expect(el.querySelector('[data-price-note]')?.getAttribute('data-price-note')).toBe(
      'kleinunternehmer',
    )
    expect(el.textContent).not.toMatch(VAT_WORDING)
  })

  it('R-030 Regelbesteuerung ab validFrom: „inkl. 19 % USt.“ bzw. 7 % je vatCategory (Datumsgrenze)', () => {
    expect(
      priceNoteText({ locale: 'de', settings: SETTINGS, at: FROM, vatCategory: 'standard' }),
    ).toBe('inkl. 19 % USt.')
    expect(
      priceNoteText({ locale: 'de', settings: SETTINGS, at: FROM, vatCategory: 'reduced_art' }),
    ).toBe('inkl. 7 % USt.')
    expect(
      priceNoteText({ locale: 'en', settings: SETTINGS, at: FROM, vatCategory: 'standard' }),
    ).toBe('incl. 19% VAT')
    // eine Millisekunde vorher gilt noch der Kleinunternehmer-Hinweis
    expect(
      priceNoteText({ locale: 'de', settings: SETTINGS, at: BEFORE, vatCategory: 'standard' }),
    ).not.toMatch(/USt\./)
    const el = renderIntl(h(PriceNote, { locale: 'de', settings: SETTINGS, at: FROM }))
    expect(el.querySelector('[data-price-note]')?.getAttribute('data-price-note')).toBe(
      'regelbesteuert',
    )
  })

  it('R-030 ohne Einstellungen gilt der Grund-Seed (Kleinunternehmerin, E-02)', () => {
    expect(priceNoteText({ locale: 'de', settings: null, at: FROM })).toBe(
      'Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    )
  })

  it('R-030 PriceFootnote: Sternchen, Steuerhinweis und Versandlink auf R25, genau ein Element mit fester id', () => {
    const el = renderIntl(h(PriceFootnote, { locale: 'de', settings: SETTINGS, at: BEFORE }))
    const note = el.querySelectorAll('#price-footnote')
    expect(note).toHaveLength(1)
    expect(note[0]!.textContent).toBe(
      '* Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet · zzgl. Versandkosten',
    )
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/de/versand-und-zahlung')
  })
})

describe('MoneyAmount und ShippingNoteLink', () => {
  it('Betrag mit formatMoney full; kein Vergleichs-/Streichpreis (V-20)', () => {
    const el = renderIntl(h(MoneyAmount, { cents: 890, locale: 'en' }))
    expect(el.textContent).toBe('€8.90')
    expect(el.innerHTML).not.toMatch(/<del|<s>|line-through|statt|UVP/i)
    for (const f of ['MoneyAmount', 'PriceNote', 'PriceFootnote']) {
      const src = readFileSync(path.join(ROOT, `src/components/shop/${f}.tsx`), 'utf8')
      expect(src, f).not.toMatch(
        /compareAt|originalPrice|oldPrice|previousPrice|<del|<s>|line-through/,
      )
    }
  })

  it('R-031 Versandhinweis als Link auf Versand & Zahlung je Sprache', () => {
    const deLink = renderIntl(h(ShippingNoteLink, { locale: 'de' })).querySelector('a')!
    expect(deLink.textContent).toBe('zzgl. Versandkosten')
    expect(deLink.getAttribute('href')).toBe('/de/versand-und-zahlung')
    cleanup()
    const enLink = renderIntl(h(ShippingNoteLink, { locale: 'en' }), 'en').querySelector('a')!
    expect(enLink.getAttribute('href')).toBe('/en/shipping-and-payment')
  })
})

describe('DeliveryTime (R-035)', () => {
  it('R-035 Versand und Abholung mit Lieferzeit aus den Einstellungen, ohne vage Zusätze', () => {
    expect(deliveryTimeText('de', '2–5 Werktage', 'paket_klein')).toBe(
      'Lieferzeit: 2–5 Werktage (bei Vorkasse ab Zahlungseingang)',
    )
    expect(deliveryTimeText('de', '2–5 Werktage', 'nur_abholung')).toMatch(
      /^Abholbereit innerhalb von 2–5 Werktage nach Zahlungseingang/,
    )
    const el = renderIntl(
      h(DeliveryTime, { locale: 'en', deliveryTime: '2–5 working days', shippingClass: 'keramik' }),
      'en',
    )
    expect(el.textContent).toBe(
      'Delivery time: 2–5 working days (for payment in advance, from receipt of payment)',
    )
    for (const locale of ['de', 'en'] as const) {
      for (const cls of ['brief', 'nur_abholung'] as const) {
        expect(isVagueDeliveryTime(deliveryTimeText(locale, null, cls))).toBe(false)
      }
    }
  })

  it('R-035 vage Angaben („ca.“, „in der Regel“) erscheinen nie und sind in den Einstellungen gesperrt', () => {
    expect(deliveryTimeText('de', 'ca. 3 Tage', 'brief')).toBe(
      'Lieferzeit: 2–5 Werktage (bei Vorkasse ab Zahlungseingang)',
    )
    expect(deliveryTimeText('de', 'in der Regel 3 Tage', 'brief')).not.toMatch(/in der Regel/)
    expect(validateDeliveryTimeText('ca. 3 Werktage')).toMatch(/ohne „ca.“/)
    expect(validateDeliveryTimeText('In der Regel 2 Tage')).not.toBe(true)
    expect(validateDeliveryTimeText('usually 3 days')).not.toBe(true)
    expect(validateDeliveryTimeText('2–5 Werktage')).toBe(true)
    expect(validateDeliveryTimeText('3–4 working days')).toBe(true)
    expect(validateDeliveryTimeText('x'.repeat(61))).toMatch(/60 Zeichen/)
  })
})

describe('WarrantyNotice (R-049)', () => {
  for (const locale of ['de', 'en'] as const) {
    it(`R-049 Grafik mit Alt-Text vom eigenen Origin, Text und Link zur EU-Infoseite (${locale})`, () => {
      const el = renderIntl(h(WarrantyNotice, { locale }), locale)
      const img = el.querySelector('img')!
      const src = img.getAttribute('src')!
      expect(src).toMatch(/^\/legal\/[a-z-]+\.svg$/)
      expect(existsSync(path.join(ROOT, 'public', src))).toBe(true)
      expect(img.getAttribute('alt')!.length).toBeGreaterThan(20)
      expect(img.getAttribute('width')).toBeTruthy()
      const link = el.querySelector('a')!
      expect(link.getAttribute('href')).toBe(WARRANTY_INFO_URL[locale])
      expect(link.textContent!.length).toBeGreaterThan(10)
      const messages = (locale === 'de' ? de : en).shop.warranty
      expect(el.textContent).toContain(messages.title)
      expect(el.textContent).toContain(messages.text)
      // Keine Werbung mit Selbstverständlichkeiten, keine eigene „Garantie“ (V-19)
      expect(el.textContent).not.toMatch(/2\s*Jahre\s*Gewährleistung|Garantie|rechtssicher/i)
    })
  }
})
