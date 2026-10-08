// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { PriceTag } from '@/components/shop/PriceTag'
import { SoldStamp } from '@/components/shop/SoldStamp'
import {
  TAG_MIN_WIDTH,
  estimateTagWidth,
  formatTagPrice,
  stampAngle,
  stampFramePaths,
  tagAngle,
  tagOutlinePath,
  threadLength,
} from '@/lib/shop/priceTag'

// P3.4 Preisschild KO-05 und Stempel KO-06 (E-77): Winkel, Fadenlänge und Kontur deterministisch aus der Nummer.

const h = React.createElement
afterEach(cleanup)

describe('PriceTag – Geometrie aus der Objektnummer (KO-05)', () => {
  it.each([
    // nr, (nr×37) mod 9 − 4 (0 → 2.5), 6 + (nr×13) mod 9, Stempel −14 ± 2
    [1, -3, 10, -12],
    [17, 4, 11, -13],
    [999, -4, 6, -15],
    [1000, -3, 10, -16],
  ])('Nr. %i: Drehung %d°, Faden %d px, Stempel %d°', (nr, angle, thread, stamp) => {
    expect(tagAngle(nr)).toBe(angle)
    expect(threadLength(nr)).toBe(thread)
    expect(stampAngle(nr)).toBe(stamp)
  })

  it('Ergebnis 0 wird 2.5° (ein Schild hängt nie gerade)', () => {
    // (nr × 37) mod 9 = 4 ⇔ nr ≡ 4 · 37⁻¹ ≡ 4 (mod 9), da 37 ≡ 1 (mod 9)
    expect(tagAngle(4)).toBe(2.5)
    expect(tagAngle(13)).toBe(2.5)
    for (let nr = 1; nr <= 2000; nr++) {
      const a = tagAngle(nr)
      expect(a).not.toBe(0)
      expect(Math.abs(a)).toBeLessThanOrEqual(4)
      expect(threadLength(nr)).toBeGreaterThanOrEqual(6)
      expect(threadLength(nr)).toBeLessThanOrEqual(14)
      expect(stampAngle(nr)).toBeGreaterThanOrEqual(-16)
      expect(stampAngle(nr)).toBeLessThanOrEqual(-12)
    }
  })

  it('Kontur und Stempelrahmen sind deterministisch (Server = Client), Wackel höchstens ±0.6 px', () => {
    for (const nr of [1, 17, 999, 1000]) {
      const w = estimateTagWidth(formatTagPrice(4500, 'de'), 'hanging')
      expect(tagOutlinePath(w, 72, nr)).toBe(tagOutlinePath(w, 72, nr))
      expect(stampFramePaths(nr)).toEqual(stampFramePaths(nr))
      const coords = tagOutlinePath(w, 72, nr)
        .match(/-?\d+(\.\d+)?/g)!
        .map(Number)
      const xs = coords.filter((_, i) => i % 2 === 0)
      const ys = coords.filter((_, i) => i % 2 === 1)
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(1 - 0.6)
      expect(Math.max(...xs)).toBeLessThanOrEqual(w - 1 + 0.6)
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(1 - 0.6)
      expect(Math.max(...ys)).toBeLessThanOrEqual(72 - 1 + 0.6)
      const gaps = stampFramePaths(nr).length
      expect(gaps).toBeGreaterThanOrEqual(3)
      expect(gaps).toBeLessThanOrEqual(6)
    }
    expect(tagOutlinePath(90, 72, 1)).not.toBe(tagOutlinePath(90, 72, 2))
  })

  it('Breite: mindestens 76 px (mini 64 px), wächst mit dem Preis', () => {
    expect(estimateTagWidth('5 €', 'hanging')).toBe(TAG_MIN_WIDTH.hanging)
    expect(estimateTagWidth('5 €', 'mini')).toBe(64)
    expect(estimateTagWidth('1.250,50 €', 'hanging')).toBeGreaterThan(
      estimateTagWidth('45 €', 'hanging'),
    )
  })
})

describe('PriceTag – Darstellung', () => {
  it('Preis in Spectral Italic mit formatMoney(tag) und Sternchen, darunter „Nr. 017“ (DE/EN)', () => {
    const de = render(h(PriceTag, { itemNumber: 17, priceCents: 4500, locale: 'de' })).container
    const tag = de.querySelector('[data-price-tag="hanging"]')!
    expect(tag.textContent).toBe('45\u00a0€*Nr. 017')
    expect(tag.querySelector('[data-money]')!.textContent).toBe('45\u00a0€*')
    // Sternchen ist rein visuell; die Auflösung steht als PriceFootnote auf der Seite (R-030)
    expect(tag.querySelector('[data-money] [aria-hidden="true"]')!.textContent).toBe('*')
    cleanup()
    const en = render(h(PriceTag, { itemNumber: 1000, priceCents: 3850, locale: 'en' })).container
    expect(en.textContent).toBe('€38.50*No. 1000')
  })

  it('Drehung und Fadenlänge als Stil-Variablen; Drehpunkt ist die Öse', () => {
    const el = render(h(PriceTag, { itemNumber: 17, priceCents: 4500, locale: 'de' })).container
    const tag = el.querySelector<HTMLElement>('[data-price-tag]')!
    expect(tag.style.getPropertyValue('--tag-angle')).toBe('4deg')
    expect(tag.style.getPropertyValue('--tag-thread')).toBe('11px')
    expect(el.querySelector('[data-price-tag-swing]')!.getAttribute('data-angle')).toBe('4')
  })

  it('SSR und Client liefern dasselbe Markup (keine Zufallswerte)', () => {
    const a = renderToStaticMarkup(
      h(PriceTag, { itemNumber: 999, priceCents: 12000, locale: 'de' }),
    )
    const b = renderToStaticMarkup(
      h(PriceTag, { itemNumber: 999, priceCents: 12000, locale: 'de' }),
    )
    expect(a).toBe(b)
  })

  it('Varianten: hanging mit Faden, pinned, mini ohne Nummer; kein Leinen-Anker (U-44: Rasterzelle ist die Karte)', () => {
    const hanging = render(
      h(PriceTag, { itemNumber: 1, priceCents: 900, locale: 'de', variant: 'hanging' }),
    ).container
    expect(hanging.querySelector('[data-price-tag="hanging"]')).not.toBeNull()
    expect(hanging.querySelector('[data-leash-anchor]')).toBeNull()
    cleanup()
    const pinned = render(
      h(PriceTag, { itemNumber: 1, priceCents: 900, locale: 'de', variant: 'pinned' }),
    ).container
    expect(pinned.querySelector('[data-leash-anchor]')).toBeNull()
    expect(pinned.textContent).toContain('Nr. 001')
    cleanup()
    const mini = render(
      h(PriceTag, { itemNumber: 1, priceCents: 900, locale: 'de', variant: 'mini' }),
    ).container
    expect(mini.textContent).toBe('9\u00a0€*')
  })

  it('sold: Stempel sichtbar über dem Preis, Preis bleibt als Text; nicht verkauft: Stempel nur als verborgener Platz', () => {
    const sold = render(
      h(PriceTag, { itemNumber: 17, priceCents: 4500, locale: 'de', sold: true }),
    ).container
    const stamp = sold.querySelector<HTMLElement>('[data-sold-stamp]')!
    expect(stamp.hidden).toBe(false)
    expect(stamp.getAttribute('aria-hidden')).toBe('true')
    expect(sold.querySelector('[data-money]')!.textContent).toBe('45\u00a0€*')
    cleanup()
    const slot = render(
      h(PriceTag, { itemNumber: 17, priceCents: 4500, locale: 'de', stampSlot: true }),
    ).container
    expect(slot.querySelector<HTMLElement>('[data-sold-stamp]')!.hidden).toBe(true)
    cleanup()
    const none = render(h(PriceTag, { itemNumber: 17, priceCents: 4500, locale: 'de' })).container
    expect(none.querySelector('[data-sold-stamp]')).toBeNull()
  })

  it('das Schild ist nicht fokussierbar (Teil des Karten-Links, KO-05)', () => {
    const el = render(
      h(PriceTag, { itemNumber: 17, priceCents: 4500, locale: 'de', sold: true }),
    ).container
    expect(el.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
  })
})

describe('SoldStamp (KO-06)', () => {
  it('aria-hidden, Wort „sold“ mit lang="en", Drehung −14° ± 2° nach Nummer', () => {
    const el = render(h(SoldStamp, { itemNumber: 17 })).container
    const stamp = el.querySelector<HTMLElement>('[data-sold-stamp]')!
    expect(stamp.getAttribute('aria-hidden')).toBe('true')
    expect(stamp.querySelector('[lang="en"]')!.textContent).toBe('sold')
    expect(stamp.style.getPropertyValue('--stamp-angle')).toBe('-13deg')
    expect(stamp.querySelectorAll('svg path').length).toBeGreaterThanOrEqual(3)
  })
})
