import { describe, expect, it } from 'vitest'

import { TATTOO_PAGES } from '@/components/layout/navItems'
import { buildSitemap } from '@/lib/seo/sitemap'
import {
  ALL_TATTOO_PAGES,
  hiddenTattooRoutes,
  tattooPageVisible,
  visibleTattooPages,
} from '@/lib/tattoo/pages'

// P20.5 (V-28 a, V-11): Flash (R12) und Galerie (R15) erscheinen in Menü, Unter-Navigation, Übersicht und Sitemap nur mit
// Inhalt; die übrigen Tattoo-Unterseiten immer. Die gerade offene Seite bleibt in der Unter-Navigation stehen.

const SITE = 'https://planetclairetattoos.com'

describe('Tattoo-Unterseiten nur mit Inhalt', () => {
  it('mit Flash und Galerie: alle Unterseiten', () => {
    expect(visibleTattooPages(TATTOO_PAGES, ALL_TATTOO_PAGES)).toEqual([...TATTOO_PAGES])
    expect(hiddenTattooRoutes(ALL_TATTOO_PAGES)).toEqual([])
  })

  it('ohne Flash: R12 fehlt; ohne Galerie: R15 fehlt; der Rest bleibt in Reihenfolge', () => {
    expect(visibleTattooPages(TATTOO_PAGES, { flash: false, gallery: true })).toEqual([
      'R14',
      'R15',
      'R16',
      'R17',
      'R18',
    ])
    expect(visibleTattooPages(TATTOO_PAGES, { flash: true, gallery: false })).toEqual([
      'R12',
      'R14',
      'R16',
      'R17',
      'R18',
    ])
    expect(hiddenTattooRoutes({ flash: false, gallery: false })).toEqual(['R12', 'R15'])
    expect(tattooPageVisible('R11', { flash: false, gallery: false })).toBe(true)
  })

  it('die offene Seite bleibt sichtbar (Leerzustand mit Unter-Navigation)', () => {
    expect(
      visibleTattooPages(['R11', 'R12', 'R14'] as const, { flash: false, gallery: false }, 'R12'),
    ).toEqual(['R11', 'R12', 'R14'])
  })

  it('Sitemap ohne leere Unterseiten, beide Sprachen', () => {
    const all = buildSitemap(SITE).map((e) => e.url)
    expect(all).toContain(`${SITE}/de/tattoo/flash`)
    expect(all).toContain(`${SITE}/en/tattoo/gallery`)
    const urls = buildSitemap(SITE, {
      products: [],
      categories: [],
      hiddenRoutes: hiddenTattooRoutes({ flash: false, gallery: false }),
    }).map((e) => e.url)
    for (const path of [
      '/de/tattoo/flash',
      '/en/tattoo/flash',
      '/de/tattoo/galerie',
      '/en/tattoo/gallery',
    ])
      expect(urls).not.toContain(`${SITE}${path}`)
    expect(urls).toContain(`${SITE}/de/tattoo/preise`)
    expect(urls).toHaveLength(all.length - 4)
  })
})
