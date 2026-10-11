import { describe, expect, it } from 'vitest'

import { loadBestand } from '@/lib/bestand/schema'

import { RUNDGANG_CSS, RUNDGANG_ROUTES } from '../../../scripts/pflege/ansichten'
import { catalogFacts, dimensionsText, shorten } from '../../../scripts/pflege/ansichtenText'

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
  it('ohne Tattoo-Galerie und Rechtsseiten; Galerie-Fotos und Vorschau-Banner ausgeblendet', () => {
    const routes = RUNDGANG_ROUTES.map((r) => r.route)
    expect(routes.some((r) => r.includes('galerie'))).toBe(false)
    expect(routes.some((r) => /impressum|datenschutz|agb|widerruf/.test(r))).toBe(false)
    expect(RUNDGANG_CSS).toMatch(/\[data-gallery-entry\] img[^{]*\{visibility:hidden!important\}/)
    expect(RUNDGANG_CSS).toMatch(/#pv-banner\{display:none!important\}/)
  })
})
