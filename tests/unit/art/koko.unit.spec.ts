import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { KOKO_JSON, KOKO_MAX_BYTES, buildKoko, sizeOf } from '../../../scripts/art/koko'

// P12.6 Koko, Vorsitzende der Goth Dogs Berlin (U-08): Bildbudget, nur Pupillen animiert, Bewegung reduzieren, DE/EN.

const koko = JSON.parse(readFileSync(KOKO_JSON, 'utf8')) as ReturnType<typeof buildKoko>
const css = readFileSync('src/components/home/Koko.module.css', 'utf8')
const tsx = readFileSync('src/components/home/ChairwomanKoko.tsx', 'utf8')

describe('Koko (U-08)', () => {
  it('Quelle ist die aktuelle Generator-Ausgabe (pnpm art:koko), im Bildbudget', () => {
    expect(JSON.stringify(koko)).toBe(JSON.stringify(buildKoko()))
    expect(sizeOf(koko)).toBeLessThanOrEqual(KOKO_MAX_BYTES)
  })

  it('freigestellt: nur Hund – Teile für Fell, Kappe mit grünen Bommeln, Augen, Pfoten; kein Knochenkreuz, keine Shirt-Falten', () => {
    const ids = koko.parts.map((p) => p.id)
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
    expect(koko.parts.find((p) => p.id === 'pom-l')!.fill).toBe('green')
    expect(koko.parts.find((p) => p.id === 'chest')!.fill).toBe('white')
  })

  it('nur die Pupillen sind animiert: genau eine Animation, nur auf der Pupillen-Gruppe', () => {
    expect(koko.parts.filter((p) => p.id.startsWith('pupil-'))).toHaveLength(2)
    expect(
      (css.match(/animation\s*:/g) ?? []).filter((a, i, all) => all.indexOf(a) === i),
    ).toHaveLength(1)
    expect(css).toMatch(/\.pupils\s*\{[^}]*animation:\s*koko-look/)
    expect((css.match(/@keyframes/g) ?? []).length).toBe(1)
    // Pupillen liegen in der Gruppe, alles andere außerhalb
    expect(tsx).toContain('data-koko-pupils')
    expect(tsx).toMatch(/filter\(\(p\) => !p\.id\.startsWith\('pupil-'\)\)/)
  })

  it('weniger Bewegung: Standbild per Systemeinstellung und Schalter', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.pupils\s*\{\s*animation:\s*none/)
    expect(css).toMatch(/html\[data-motion='reduced'\] \.pupils\s*\{\s*animation:\s*none/)
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
