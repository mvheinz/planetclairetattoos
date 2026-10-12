import { describe, expect, it, vi } from 'vitest'

import { loadBestand } from '@/lib/bestand/schema'

import {
  blurFocus,
  RUNDGANG_CSS,
  RUNDGANG_LATER,
  RUNDGANG_ROUTES,
  rundgangInventoryError,
  rundgangPlan,
} from '../../../scripts/pflege/ansichten'
import {
  catalogFacts,
  dimensionsText,
  markdownToHtml,
  shorten,
} from '../../../scripts/pflege/ansichtenText'

// P18.3 (U-88): Katalog und Rundgang als PDF – Eckdaten je Stück, gekürzte Beschreibung, Rundgang ohne Tattoo-Galerie
// und ohne Fotos von Kund:innen.

describe('Katalog (PDF)', () => {
  it('Maße, Preis und Eckdaten in Juttas Schreibweise', async () => {
    expect(dimensionsText({ widthCm: 7, heightCm: 9.5, depthCm: 2 })).toBe('B 7 × H 9,5 × T 2 cm')
    expect(dimensionsText({ diameterCm: 12 })).toBe('Ø 12 cm')
    expect(dimensionsText({ heightCm: 4, diameterCm: 8 })).toBe('H 4 cm, Ø 8 cm')
    expect(dimensionsText({})).toBe('')
    const shirt = (await loadBestand()).find((p) => p.category === 'textil')!
    const f = catalogFacts(shirt)
    expect(f.price).toMatch(/^\d+,\d{2}\s€$/)
    expect(f.facts.join(' · ')).toContain('Zustand')
    expect(f.description.length).toBeLessThanOrEqual(172)
  })

  it('kürzt am Satzende, sonst am Wort mit „…“', () => {
    expect(shorten('Kurz.')).toBe('Kurz.')
    const two = `${'a'.repeat(120)}. ${'b'.repeat(120)}.`
    expect(shorten(two)).toBe(`${'a'.repeat(120)}.`)
    expect(shorten(`${'wort '.repeat(60)}`)).toMatch(/wort …$/)
  })
})

describe('Rundgang (PDF)', () => {
  it('ohne Tattoo-Galerie und Impressum/Datenschutz/AGB/Widerrufsbelehrung; Galerie-Fotos und Vorschau-Banner ausgeblendet', () => {
    const routes = RUNDGANG_ROUTES.map((r) => r.route)
    expect(routes.some((r) => r.includes('galerie'))).toBe(false)
    expect(routes.some((r) => /impressum|datenschutz|agb|widerrufsbelehrung/.test(r))).toBe(false)
    expect(RUNDGANG_CSS).toMatch(/\[data-gallery-entry\] img[^{]*\{visibility:hidden!important\}/)
    expect(RUNDGANG_CSS).toMatch(/#pv-banner\{display:none!important\}/)
  })

  it('V-27: mit Korb, Kasse, „Versand & Zahlung“, „Vertrag widerrufen“ und Archiv; Kaufleiste ausgeblendet', () => {
    const routes = RUNDGANG_ROUTES.map((r) => r.route)
    for (const route of [
      '/de/warenkorb',
      '/de/kasse',
      '/de/versand-und-zahlung',
      '/de/vertrag-widerrufen',
      '/de/archiv',
    ])
      expect(routes).toContain(route)
    expect(new Set(routes).size).toBe(routes.length)
    expect(RUNDGANG_CSS).toMatch(/\[data-buy-bar\]\{display:none!important\}/)
    expect(RUNDGANG_LATER.map((l) => l.prefix)).toEqual(['/de/danke/', '/de/bestellung/'])
  })

  const report = (inventory: 'bestand' | 'demo' | undefined, extra: string[] = []) => ({
    inventory,
    routes: [
      ...RUNDGANG_ROUTES.filter((r) => r.route !== 'PRODUCT').map((r) => ({
        route: r.route,
        lang: 'de',
        status: 'ok',
      })),
      { route: '/de/shop/115-wandtasche', lang: 'de', status: 'ok' },
      { route: '/en/cart', lang: 'en', status: 'ok' },
      ...extra.map((route) => ({ route, lang: 'de', status: 'ok' })),
    ],
  })

  it('V-27: Plan mit echtem Bestand – alle Seiten, „Ein Stück“ = echtes Stück, Danke/Status als Vermerk „ab dem Start sichtbar“', () => {
    const plan = rundgangPlan(report('bestand'), '/de/shop/115-wandtasche')
    expect(plan.pages.map((p) => p.route)).toEqual(
      RUNDGANG_ROUTES.map((r) => (r.route === 'PRODUCT' ? '/de/shop/115-wandtasche' : r.route)),
    )
    expect(plan.notes.map((n) => n.title)).toEqual([
      'Danke-Seite – ab dem Start sichtbar',
      'Bestellstatus – ab dem Start sichtbar',
    ])
    // Enthält die Vorschau mit echtem Bestand eine Danke-Seite, wird sie fotografiert
    const withThanks = rundgangPlan(report('bestand', ['/de/danke/abc']), '/de/shop/115-wandtasche')
    expect(withThanks.pages.at(-1)).toEqual({ route: '/de/danke/abc', title: 'Danke-Seite' })
    // Mit Demo-Bestand nie (U-76: keine Demo-Stücke)
    const demo = rundgangPlan(report('demo', ['/de/danke/abc', '/de/bestellung/abc']), undefined)
    expect(demo.pages.some((p) => /danke|bestellung/.test(p.route))).toBe(false)
  })

  it('V-27/U-76: nur mit einer Vorschau aus echtem Bestand – Demo-Bestand und ältere Dateien ohne Angabe nie', () => {
    expect(rundgangInventoryError({ inventory: 'bestand' })).toBeNull()
    expect(rundgangInventoryError({ inventory: 'demo' })).toMatch(/Demo-Bestand/)
    expect(rundgangInventoryError({})).toMatch(/älter als P16\.3/)
  })

  it('V-27: fehlende Seiten (z. B. Kasse ohne Korb, nicht gebaut) werden Vermerke statt Abbruch', () => {
    const r = report('bestand')
    r.routes = r.routes
      .filter((x) => x.route !== '/de/kasse')
      .map((x) => (x.route === '/de/archiv' ? { ...x, status: 'not-built' } : x))
    const plan = rundgangPlan(r, undefined)
    const missing = plan.notes.map((n) => n.title)
    expect(missing).toEqual(expect.arrayContaining(['Kasse', 'Archiv', 'Ein Stück']))
    expect(plan.pages.map((p) => p.route)).not.toContain('/de/kasse')
  })

  it('V-27: vor jedem Foto verliert die Überschrift den Fokus (kein dunkler Kasten)', () => {
    const blur = vi.fn()
    const h1 = { blur }
    const body = { blur: vi.fn() }
    vi.stubGlobal('document', { activeElement: h1, body })
    blurFocus()
    expect(blur).toHaveBeenCalledOnce()
    vi.stubGlobal('document', { activeElement: body, body })
    blurFocus()
    expect(body.blur).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('Anleitung (PDF)', () => {
  it('wandelt Überschriften, Listen, Tabellen und Hinweise um und maskiert HTML', () => {
    const html = markdownToHtml(
      [
        '# Titel',
        '',
        'Ein **fetter** Satz mit `Code` und <b>.',
        '',
        '1. Erster Schritt',
        '   geht weiter.',
        '2. Zweiter',
        '',
        '- Punkt',
        '',
        '| A | B |',
        '|---|---|',
        '| 1 | 2 |',
        '',
        '> Hinweis',
      ].join('\n'),
    )
    expect(html).toContain('<h1>Titel</h1>')
    expect(html).toContain(
      '<p>Ein <strong>fetter</strong> Satz mit <code>Code</code> und &lt;b&gt;.</p>',
    )
    expect(html).toContain('<ol><li>Erster Schritt geht weiter.</li><li>Zweiter</li></ol>')
    expect(html).toContain('<ul><li>Punkt</li></ul>')
    expect(html).toContain('<th>A</th><th>B</th>')
    expect(html).toContain('<td>1</td><td>2</td>')
    expect(html).toContain('<aside>Hinweis</aside>')
  })
})
