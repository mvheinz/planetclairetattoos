import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  KOKO_JSON,
  KOKO_MAX_BYTES,
  KOKO_SVG,
  buildKoko,
  kokoSvg,
  pupilsOf,
} from '../../../scripts/art/koko'

// P12.6 Koko, Vorsitzende der Goth Dogs Berlin (U-08): Bildbudget, nur Pupillen animiert, Bewegung reduzieren, DE/EN.

const built = buildKoko()
const svg = readFileSync(KOKO_SVG, 'utf8')
const meta = JSON.parse(readFileSync(KOKO_JSON, 'utf8')) as {
  w: number
  h: number
  pupils: ReturnType<typeof pupilsOf>
}
const css = readFileSync('src/components/home/Koko.module.css', 'utf8')
const tsx = readFileSync('src/components/home/ChairwomanKoko.tsx', 'utf8')

describe('Koko (U-08)', () => {
  it('Quelle ist die aktuelle Generator-Ausgabe (pnpm art:koko), im Bildbudget (eigene Datei, kein Inline-SVG)', () => {
    expect(svg).toBe(kokoSvg(built))
    expect(svg.length).toBeLessThanOrEqual(KOKO_MAX_BYTES)
    expect(meta).toEqual({ w: built.w, h: built.h, pupils: pupilsOf(built) })
    expect(tsx).toContain('<img')
    expect(tsx).not.toContain('<svg')
  })

  it('freigestellt: nur der Hund – Fell, Kappe mit grünen Bommeln, Augen, weiße Brust und Pfoten; kein Knochenkreuz, keine Shirt-Falten', () => {
    const ids = built.parts.map((p) => p.id)
    for (const id of [
      'head',
      'hat-l',
      'hat-r',
      'pom-l',
      'pom-r',
      'eye-l',
      'eye-r',
      'chest',
      'leg-l',
      'leg-r',
      'tail',
    ])
      expect(ids).toContain(id)
    expect(ids.join(' ')).not.toMatch(/bone|cross|kreuz|shirt|fold|falte|background/i)
    expect(built.parts.find((p) => p.id === 'pom-l')!.fill).toBe('green')
    expect(built.parts.find((p) => p.id === 'chest')!.fill).toBe('white')
    expect(svg).not.toMatch(/<(circle|ellipse|rect|text|image)\b/)
    // Pupillen sind nicht im Bild (sie sind bewegliche Elemente darüber)
    expect(svg).not.toContain('pupil')
    expect(meta.pupils).toHaveLength(2)
  })

  it('nur die Pupillen sind animiert: genau eine Animation, nur auf den Pupillen-Elementen', () => {
    expect((css.match(/animation\s*:/g) ?? []).length).toBe(3) // Pupille + zweimal „none“ (System, Schalter)
    expect((css.match(/@keyframes/g) ?? []).length).toBe(1)
    expect(css).toMatch(/\.pupil\s*\{[^}]*animation:\s*koko-look/)
    expect(tsx).toContain('data-koko-pupil')
    expect(css).not.toMatch(/\.drawing\s*\{[^}]*animation/)
  })

  it('weniger Bewegung: Standbild per Systemeinstellung und Schalter', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.pupil\s*\{\s*animation:\s*none/)
    expect(css).toMatch(/html\[data-motion='reduced'\] \.pupil\s*\{\s*animation:\s*none/)
  })

  it('Alt-Text DE/EN „Koko, Vorsitzende der Goth Dogs Berlin“', () => {
    const de = JSON.parse(readFileSync('src/i18n/messages/de.json', 'utf8')) as {
      home: Record<string, string>
    }
    const en = JSON.parse(readFileSync('src/i18n/messages/en.json', 'utf8')) as {
      home: Record<string, string>
    }
    expect(de.home.chairwomanAlt).toBe('Koko, Vorsitzende der Goth Dogs Berlin')
    expect(en.home.chairwomanAlt).toMatch(/Koko, chairwoman of the Goth Dogs Berlin/)
    expect((de.home.fitnessAlt ?? '').length).toBeGreaterThan(20)
    expect((en.home.fitnessAlt ?? '').length).toBeGreaterThan(20)
  })
})
