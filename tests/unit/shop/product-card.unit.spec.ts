// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Badge, BADGE_KINDS } from '@/components/shop/Badge'
import { CARD_IMAGE_SIZES, ProductCard, type ProductCardData } from '@/components/shop/ProductCard'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import type { Media } from '@/payload-types'

// P3.4 Produktkarte KO-07 (AK-DS-10) und Badges KO-10.

const h = React.createElement
afterEach(cleanup)

function renderIntl(ui: React.ReactElement, locale: Locale = 'de') {
  return render(
    h(NextIntlClientProvider, { locale, messages: locale === 'de' ? de : en, children: ui }),
  ).container
}

const MEDIA = {
  id: 7,
  alt: 'Vase mit Fuchs',
  url: '/media/vase.webp',
  width: 1600,
  height: 2000,
  focalX: 40,
  focalY: 30,
  dominantColor: '#c9a27e',
  sizes: {
    thumb: { url: '/media/vase-400x500.webp', width: 400, height: 500 },
    card: { url: '/media/vase-800x1000.webp', width: 800, height: 1000 },
  },
} as unknown as Media

const product = (over: Partial<ProductCardData> = {}): ProductCardData => ({
  id: 12,
  itemNumber: 17,
  title: 'Vase „Fuchs“',
  slug: '017-vase-fuchs',
  priceCents: 4500,
  status: 'available',
  category: 'keramik',
  dimensions: { diameterCm: 14 },
  images: [MEDIA],
  ...over,
})

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable="true"]'

describe('ProductCard – AK-DS-10', () => {
  it('AK-DS-10 genau ein <a> je Karte, kein weiteres fokussierbares Element', () => {
    const el = renderIntl(h(ProductCard, { product: product(), locale: 'de' }))
    const links = el.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(el.querySelectorAll(FOCUSABLE)).toHaveLength(1)
    expect(links[0]!.getAttribute('href')).toBe('/de/shop/017-vase-fuchs')
  })

  it('AK-DS-10 Foto, Schild, Titel und Meta liegen im Link (Klick navigiert zur Produktseite)', () => {
    const el = renderIntl(h(ProductCard, { product: product(), locale: 'de' }))
    const link = el.querySelector('a')!
    for (const part of [
      link.querySelector('img'),
      link.querySelector('[data-price-tag]'),
      [...link.querySelectorAll('span')].find((s) => s.textContent === 'Vase „Fuchs“'),
      [...link.querySelectorAll('span')].find((s) => s.textContent === 'Keramik · Ø 14 cm'),
    ]) {
      expect(part).toBeTruthy()
      expect(part!.closest('a')).toBe(link)
    }
  })

  it('AK-DS-10 aria-label „{Titel}, {Preis}{, gerade reserviert | , verkauft}“ (DE/EN)', () => {
    const label = (p: ProductCardData, locale: Locale = 'de') => {
      cleanup()
      return renderIntl(h(ProductCard, { product: p, locale }), locale)
        .querySelector('a')!
        .getAttribute('aria-label')
    }
    expect(label(product())).toBe('Vase „Fuchs“, 45 €')
    expect(label(product({ status: 'reserved' }))).toBe('Vase „Fuchs“, 45 €, gerade reserviert')
    expect(label(product({ status: 'sold' }))).toBe('Vase „Fuchs“, 45 €, verkauft')
    expect(label(product({ status: 'sold', title: 'Fox vase' }), 'en')).toBe('Fox vase, €45, sold')
  })

  it('AK-DS-10 Bild-Container hat vor dem Laden die Endhöhe (4:5), Dominanzfarbe als Lade-Hintergrund', () => {
    const el = renderIntl(h(ProductCard, { product: product(), locale: 'de' }))
    const img = el.querySelector('img')!
    const frame = img.parentElement!
    expect(frame.style.aspectRatio).toBe('4 / 5')
    expect(frame.style.getPropertyValue('--img-bg')).toBe('#c9a27e')
    expect(img.getAttribute('width')).toBe('800')
    expect(img.getAttribute('height')).toBe('1000')
    expect(img.style.objectPosition).toBe('40% 30%')
    cleanup()
    // ohne Foto: gleicher Rahmen (Schraffur), keine Verschiebung
    const empty = renderIntl(h(ProductCard, { product: product({ images: [] }), locale: 'de' }))
    const placeholder = empty.querySelector<HTMLElement>('[data-image-missing]')!
    expect(placeholder.style.aspectRatio).toBe('4 / 5')
  })

  it('KO-07 srcset aus thumb/card, sizes laut KO-07, die ersten zwei Karten ohne loading="lazy"', () => {
    const el = renderIntl(
      h(
        'ul',
        null,
        [0, 1, 2].map((i) =>
          h(
            'li',
            { key: i },
            h(ProductCard, { product: product({ id: i }), locale: 'de', index: i }),
          ),
        ),
      ),
    )
    const imgs = [...el.querySelectorAll('img')]
    expect(imgs[0]!.getAttribute('srcset')).toBe(
      '/media/vase-400x500.webp 400w, /media/vase-800x1000.webp 800w',
    )
    expect(imgs[0]!.getAttribute('sizes')).toBe(CARD_IMAGE_SIZES)
    expect(CARD_IMAGE_SIZES).toBe('(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw')
    expect(imgs.map((i) => i.getAttribute('loading'))).toEqual([null, null, 'lazy'])
    expect(imgs.every((i) => i.getAttribute('decoding') === 'async')).toBe(true)
    expect(imgs[0]!.getAttribute('alt')).toBe('Vase mit Fuchs')
  })

  it('Zustände: reserved → Badge oben links auf dem Foto; sold → Stempel sichtbar, Karte gedämpft markiert', () => {
    const reserved = renderIntl(
      h(ProductCard, { product: product({ status: 'reserved' }), locale: 'de' }),
    )
    const badge = reserved.querySelector('[data-badge="reserved"]')!
    expect(badge.textContent).toBe('reserviert')
    expect(badge.parentElement!.querySelector('img')).not.toBeNull()
    expect(reserved.querySelector<HTMLElement>('[data-sold-stamp]')!.hidden).toBe(true)
    cleanup()
    const sold = renderIntl(h(ProductCard, { product: product({ status: 'sold' }), locale: 'de' }))
    expect(sold.querySelector('a')!.getAttribute('data-status')).toBe('sold')
    expect(sold.querySelector<HTMLElement>('[data-sold-stamp]')!.hidden).toBe(false)
    expect(sold.querySelector('[data-badge]')).toBeNull()
  })

  it('Meta „Keramik · Ø 14 cm“; EN mit englischer Kategorie; ohne Maße nur die Kategorie', () => {
    const deEl = renderIntl(h(ProductCard, { product: product(), locale: 'de' }))
    expect(deEl.textContent).toContain('Keramik · Ø 14 cm')
    cleanup()
    const enEl = renderIntl(
      h(ProductCard, { product: product({ dimensions: null }), locale: 'en' }),
      'en',
    )
    expect(enEl.textContent).toMatch(/Ceramics$/)
  })
})

describe('Badge – KO-10', () => {
  it('sechs Arten mit DE/EN-Text, Icon außer Second-Hand, nur Lebensmittelecht als Link', () => {
    for (const kind of BADGE_KINDS) {
      cleanup()
      const el = renderIntl(h(Badge, { kind }))
      const badge = el.querySelector(`[data-badge="${kind}"]`)!
      expect(badge.textContent).toBe((de.shop.badges as Record<string, string>)[kind])
      expect(badge.querySelector('svg') !== null).toBe(kind !== 'secondHand')
      expect(badge.tagName).toBe('SPAN')
    }
    cleanup()
    const link = renderIntl(
      h(Badge, { kind: 'foodSafe', href: '/de/konformitaetserklaerungen#glaze-3' }),
      'en',
    ).querySelector('a')!
    expect(link.textContent).toBe('Food-safe – view declaration')
    expect(link.getAttribute('href')).toBe('/de/konformitaetserklaerungen#glaze-3')
  })
})
