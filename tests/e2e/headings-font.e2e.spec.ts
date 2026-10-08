import { expect, test } from './fixtures'
import { type Page } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import { productByNumber, setCart } from './cart/cartHelpers'

// P13.4 (U-43): Alle Überschriften H1–H3 (z. B. „Planet Claire on Tour“) stehen auf allen Seiten in Spectral wie der
// Titel – Shop, Kategorie, Produkt, Archiv, Tattoo-Seiten, Über mich, Kontakt, Rechtliches, Korb, Widerruf, Fehlerseite
// und Fußbereich. Fließtext bleibt Bricolage. Spectral nie unter 16 px (LG-03, DESIGN §4.3). Die Startseite hat eigene
// Prüfungen (home*.e2e.spec.ts).

interface HeadingRow {
  tag: string
  text: string
  family: string
  size: number
}

async function headings(page: Page): Promise<HeadingRow[]> {
  return page.evaluate(() => {
    const out: { tag: string; text: string; family: string; size: number }[] = []
    for (const el of Array.from(document.querySelectorAll('h1, h2, h3'))) {
      const r = el.getBoundingClientRect()
      const st = getComputedStyle(el)
      // nur sichtbare Überschriften (keine sr-only-Überschriften mit 1×1 px, nichts in verborgenen Dialogen)
      if (r.width < 2 || r.height < 2 || st.visibility === 'hidden') continue
      out.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 50),
        family: st.fontFamily,
        size: parseFloat(st.fontSize),
      })
    }
    return out
  })
}

/** Absätze im Inhalt, die in Spectral stehen (Fließtext bleibt Bricolage bzw. Plex Mono für Nummern). */
async function spectralParagraphs(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main p'))
      .filter((p) => /spectral/i.test(getComputedStyle(p).fontFamily))
      .map((p) => (p.textContent ?? '').trim().slice(0, 50)),
  )
}

const ROUTES = [
  ['R02', {}],
  ['R03', { slug: true }],
  ['R05', {}],
  ['R06', {}],
  ['R10', {}],
  ['R11', {}],
  ['R12', {}],
  ['R14', {}],
  ['R15', {}],
  ['R16', {}],
  ['R17', {}],
  ['R18', {}],
  ['R19', {}],
  ['R20', {}],
  ['R21', {}],
  ['R22', {}],
  ['R23', {}],
  ['R24', {}],
  ['R25', {}],
  ['R26', {}],
  ['R27', {}],
] as const

function expectSpectral(rows: HeadingRow[], where: string) {
  expect(rows.length, `${where}: mindestens eine Überschrift`).toBeGreaterThan(0)
  const bad = rows
    .filter((r) => !/spectral/i.test(r.family) || r.size < 16)
    .map((r) => `${r.tag} „${r.text}“ ${r.size}px ${r.family.split(',')[0]}`)
  expect(bad, where).toEqual([])
}

test.describe('U-43 Überschriften in Spectral', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Schrift-Prüfung einmal je Lauf (desktop)')
  })

  for (const locale of ['de', 'en'] as const) {
    test(`H1–H3 aller Seiten (außer Startseite) in Spectral, Fließtext Bricolage (${locale})`, async ({
      page,
    }) => {
      test.setTimeout(240_000)
      // `slug` gilt nur für R03 (Kategorie Keramik, Slug je Sprache).
      const slugs = { de: 'keramik', en: 'ceramics' }
      for (const [id, params] of ROUTES) {
        const path = localizedPath(id, locale, 'slug' in params ? { slug: slugs[locale] } : {})
        const res = await page.goto(path)
        expect(res?.status(), path).toBeLessThan(400)
        expectSpectral(await headings(page), path)
        expect(await spectralParagraphs(page), path).toEqual([])
      }
      // Produktseite (erstes Stück im Shop) und Fehlerseite
      await page.goto(localizedPath('R02', locale))
      const product = await page.locator('main a[href*="/shop/9"]').first().getAttribute('href')
      expect(product).toBeTruthy()
      await page.goto(product!)
      expectSpectral(await headings(page), product!)
      expect(await spectralParagraphs(page), product!).toEqual([])
      await page.goto(`/${locale}/gibt-es-nicht-u43`)
      expectSpectral(await headings(page), '404')
    })
  }

  test('Korb mit Stück: Überschriften in Spectral', async ({ page, context }) => {
    const p = await productByNumber(901)
    test.skip(p.status !== 'available', 'Anker 901 nicht verfügbar')
    await setCart(context, [{ id: p.id, p: p.priceCents }])
    await page.goto(localizedPath('R06', 'de'))
    expectSpectral(await headings(page), 'R06 mit Stück')
  })
})
