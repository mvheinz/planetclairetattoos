import sharp from 'sharp'
import { afterAll, describe, expect, it, vi } from 'vitest'

import type { PublicProduct } from '@/lib/data/products'
import { cocoSymbolSvg } from '@/og/assets'
import { focalCrop } from '@/og/photo'
import { pickFlashForOg, pickGalleryForOg } from '@/lib/data/ogTattoo'
import type { PublicFlash, PublicGalleryEntry } from '@/lib/data/tattoo'
import {
  defaultOgAlt,
  flashOgAlt,
  galleryOgAlt,
  productOgAlt,
  renderDefaultOg,
  renderFlashOg,
  renderGalleryOg,
  renderProductOg,
} from '@/og/render'

// P3.14 OG-Bilder erzeugen (DESIGN §12.6): PNG 1200 × 630, beim Rendern keine Anfrage an fremde Hosts – auch nicht bei
// Zeichen ohne Glyphe (satori lädt sonst Ersatzschriften/Emoji aus dem Netz). Der Netzwerk-Wächter der Unit-Tests
// blockiert fremde Hosts zusätzlich; hier wird `fetch` direkt überwacht.

const fetchSpy = vi.spyOn(globalThis, 'fetch')
afterAll(() => fetchSpy.mockRestore())

/** Aufrufe von `fetch` außer `data:`-URLs (so lädt der Renderer seine eingebauten WASM-Module – kein Netz). */
const networkFetches = () =>
  fetchSpy.mock.calls
    .map(([input]) => (input instanceof Request ? input.url : String(input)))
    .filter((url) => !url.startsWith('data:'))

// Stempelfarbe seit U-12: Petrol (#0F4C57)
const FOX = { r: 0x0f, g: 0x4c, b: 0x57 }

/** Anteil der Pixel nahe der Stempelfarbe rechts vom Foto (x ≥ 504). */
async function foxShare(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let hits = 0
  let total = 0
  for (let y = 0; y < info.height; y++)
    for (let x = 504; x < info.width; x++) {
      const i = (y * info.width + x) * 3
      total++
      if (
        Math.abs(data[i]! - FOX.r) < 20 &&
        Math.abs(data[i + 1]! - FOX.g) < 20 &&
        Math.abs(data[i + 2]! - FOX.b) < 20
      )
        hits++
    }
  return hits / total
}

const product = (over: Partial<PublicProduct> = {}) =>
  ({
    id: 1,
    title: 'Schale „Langohr & Wuschel“ 🚀 mit Ümläüten ß €',
    itemNumber: 17,
    priceCents: 4500,
    status: 'available',
    images: [],
    ...over,
  }) as unknown as PublicProduct

describe('P3.14 OG-Bilder', () => {
  it('Standardbild DE/EN: PNG 1200 × 630, ohne Netzwerk', async () => {
    for (const locale of ['de', 'en'] as const) {
      const res = await renderDefaultOg(locale)
      expect(res.headers.get('content-type')).toBe('image/png')
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
      expect(meta).toMatchObject({ format: 'png', width: 1200, height: 630 })
    }
    expect(networkFetches()).toEqual([])
  }, 60_000)

  it('Produktbild: PNG 1200 × 630; verkauft mit Stempel (Petrol-Farbe), sonst ohne; ohne Netzwerk', async () => {
    const available = Buffer.from(await (await renderProductOg(product(), 'de')).arrayBuffer())
    const sold = Buffer.from(
      await (await renderProductOg(product({ status: 'sold' }), 'en')).arrayBuffer(),
    )
    for (const png of [available, sold])
      expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 })
    expect(await foxShare(available)).toBe(0)
    expect(await foxShare(sold)).toBeGreaterThan(0.001)
    expect(networkFetches()).toEqual([])
  }, 60_000)

  it('Alt-Texte je Sprache', () => {
    expect(productOgAlt({ title: 'Schale', itemNumber: 17 }, 'de')).toBe(
      'Schale – Nr. 017: Foto und Preisschild',
    )
    expect(productOgAlt({ title: 'Bowl', itemNumber: 17 }, 'en')).toBe(
      'Bowl – No. 017: photo and price tag',
    )
    expect(defaultOgAlt('de')).toMatch(/Tattoos & Unikate aus Berlin/)
  })

  it('Fokuspunkt-Zuschnitt 4:5 am Rand begrenzt', () => {
    expect(focalCrop(1000, 1000, 50, 50)).toEqual({ left: 100, top: 0, width: 800, height: 1000 })
    expect(focalCrop(1000, 1000, 0, 50)).toEqual({ left: 0, top: 0, width: 800, height: 1000 })
    expect(focalCrop(1000, 1000, 100, 50)).toEqual({ left: 200, top: 0, width: 800, height: 1000 })
    expect(focalCrop(400, 1000, 50, 90)).toEqual({ left: 0, top: 500, width: 400, height: 500 })
  })

  it('Coco-Symbol als eigenständiges SVG ohne CSS-Variablen', () => {
    const sprite =
      '<svg><style>.fur{fill:var(--coco-fur,#E2BF8E)}@media (forced-colors:active){.fur{fill:none}}</style>' +
      '<symbol id="coco-rennen-a" viewBox="0 0 160 120" data-x="1"><g class="fur"/></symbol></svg>'
    expect(cocoSymbolSvg(sprite, 'coco-rennen-a')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><style>.fur{fill:#E2BF8E}</style><g class="fur"/></svg>',
    )
    expect(cocoSymbolSvg(sprite, 'fehlt')).toBeNull()
  })
})

// P14.12 (U-61) – Vorschaukarten für Flash (R12) und Galerie (R15).
const flash = (over: Partial<PublicFlash> = {}) =>
  ({
    id: 1,
    number: 12,
    display: 'F-012',
    anchor: 'f-012',
    title: 'Kelch mit Schlange 🐍',
    image: { id: 5 },
    status: 'available',
    ...over,
  }) as unknown as PublicFlash
const entry = (over: Partial<PublicGalleryEntry> = {}) =>
  ({
    id: 3,
    kind: 'healed',
    image: { id: 9 },
    internal: false,
    featured: false,
    ...over,
  }) as unknown as PublicGalleryEntry

describe('P14.12 Vorschaukarten Tattoo (U-61)', () => {
  it('Flash: PNG 1200 × 630 DE/EN, auch ohne Zeichnung; ohne Netzwerk', async () => {
    for (const [f, locale] of [
      [flash(), 'de'],
      [null, 'en'],
    ] as const) {
      const png = Buffer.from(await (await renderFlashOg(f, locale)).arrayBuffer())
      expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 })
    }
    expect(networkFetches()).toEqual([])
  }, 60_000)

  it('Galerie ohne Foto mit Einwilligung → Standardbild', async () => {
    const res = await renderGalleryOg(null, 'de')
    const def = await renderDefaultOg('de')
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(await def.arrayBuffer()))).toBe(
      true,
    )
  }, 60_000)

  it('Auswahl: Flash bevorzugt verfügbare mit Zeichnung; Galerie nie Seed-Ausnahme (R-182)', () => {
    const taken = flash({ number: 3, status: 'claimed' })
    const open = flash({ number: 7 })
    expect(pickFlashForOg([flash({ image: null }), taken, open])?.number).toBe(7)
    expect(pickFlashForOg([taken])?.number).toBe(3)
    expect(pickFlashForOg([flash({ image: null })])).toBeNull()
    expect(pickGalleryForOg([entry({ internal: true })])).toBeNull()
    expect(pickGalleryForOg([entry({ internal: true, id: 1 }), entry({ id: 2 })])?.id).toBe(2)
  })

  it('Alt-Texte Flash/Galerie je Sprache', () => {
    expect(flashOgAlt(flash(), 'de')).toBe(
      'Flash-Motive von Planet Claire, vorne F-012 – Kelch mit Schlange 🐍',
    )
    expect(flashOgAlt(null, 'en')).toBe('Flash designs by Planet Claire')
    expect(galleryOgAlt(entry(), 'en')).toBe('Planet Claire gallery: photo of a tattoo')
    expect(galleryOgAlt(null, 'de')).toBe(defaultOgAlt('de'))
  })
})
