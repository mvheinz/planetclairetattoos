import sharp from 'sharp'
import { afterAll, describe, expect, it, vi } from 'vitest'

import type { PublicProduct } from '@/lib/data/products'
import { cocoSymbolSvg } from '@/og/assets'
import { focalCrop } from '@/og/photo'
import { defaultOgAlt, productOgAlt, renderDefaultOg, renderProductOg } from '@/og/render'

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

const FOX = { r: 0xb8, g: 0x4e, b: 0x1a }

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
        Math.abs(data[i]! - FOX.r) < 40 &&
        Math.abs(data[i + 1]! - FOX.g) < 40 &&
        Math.abs(data[i + 2]! - FOX.b) < 40
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

  it('Produktbild: PNG 1200 × 630; verkauft mit Stempel (Fuchs-Farbe), sonst ohne; ohne Netzwerk', async () => {
    const available = Buffer.from(await (await renderProductOg(product(), 'de')).arrayBuffer())
    const sold = Buffer.from(
      await (await renderProductOg(product({ status: 'sold' }), 'en')).arrayBuffer(),
    )
    for (const png of [available, sold])
      expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 })
    expect(await foxShare(available)).toBe(0)
    expect(await foxShare(sold)).toBeGreaterThan(0.002)
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
