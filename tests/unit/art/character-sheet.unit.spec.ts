import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  CO02_RANGES,
  SHEET_MAX_BYTES,
  SHEET_SVG,
  SHEET_WEBP,
} from '../../../scripts/art/character-sheet'

// P9.8 Coco-Charakterblatt (DESIGN §10.1, KUNST-QA CO-02): Zeichenvorlage, nie ausgeliefert, keine eingebetteten Fotos.

const svg = readFileSync(SHEET_SVG, 'utf8')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  )
}

describe('P9.8 Coco-Charakterblatt', () => {
  it('kein <image> (keine eingebetteten Fotos), keine externen Verweise', () => {
    expect(svg).not.toMatch(/<image\b/i)
    expect(svg).not.toMatch(/href="(?!#)/)
    expect(svg).not.toMatch(/data:image/)
  })

  it('liegt unter content/art/coco/, nie unter public/ und wird von src/ nicht eingebunden', () => {
    expect(SHEET_SVG.startsWith('content/art/coco/')).toBe(true)
    expect(walk('public').filter((f) => /character-sheet/.test(f))).toEqual([])
    // kein Code/Stil in src/ lädt das Blatt (der Sprite-Kommentar nennt es nur als Quelle)
    const refs = walk('src')
      .filter((f) => /\.(tsx?|css|json)$/.test(f))
      .filter((f) => /character-sheet/.test(readFileSync(f, 'utf8')))
    expect(refs).toEqual([])
  })

  it('WebP gerendert, ≤ 300 KB', async () => {
    expect(statSync(SHEET_WEBP).size).toBeLessThanOrEqual(SHEET_MAX_BYTES)
    const meta = await sharp(SHEET_WEBP).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBeGreaterThanOrEqual(1200)
  })

  it('Messtabelle: alle gemessenen Verhältnisse in den Bereichen von CO-02', () => {
    const values = [...svg.matchAll(/data-measure="(side|front):(\w+)">([^<]+)</g)]
    expect(values.length).toBeGreaterThanOrEqual(9)
    for (const [, view, key, raw] of values) {
      if (raw === '–') continue
      const v = Number(raw!.replace(',', '.'))
      const [lo, hi] = CO02_RANGES[key as keyof typeof CO02_RANGES]
      expect(v, `${view} ${key}`).toBeGreaterThanOrEqual(lo)
      expect(v, `${view} ${key}`).toBeLessThanOrEqual(hi)
    }
    expect(svg).not.toContain('>NEIN<')
  })

  it('enthält Seiten- und ¾-Ansicht mit K-Hilfslinien, Merkmale, Strich-Regeln und Gesten aller 10 Posen/Brücken', () => {
    for (const s of [
      'Seitenansicht',
      '¾-Ansicht',
      'Widerrist',
      'Ohrkuppe',
      '1 K',
      'Messtabelle',
      'Merkmale',
      'Strich',
      'Wash',
    ])
      expect(svg, s).toContain(s)
    for (const p of [
      'rennen',
      'schnueffeln',
      'sitzen',
      'schlafen',
      'springen',
      'kopfschief',
      'bremsen',
      'abspringen',
      'einrollen-1',
      'einrollen-2',
    ])
      expect(svg, p).toContain(
        `>${p}<`
          .replace('>bremsen<', '>Brücke bremsen<')
          .replace('>abspringen<', '>Brücke abspringen<')
          .replace(/>einrollen-(\d)</, '>Brücke einrollen-$1<'),
      )
    expect(svg).toContain('D-Ring')
  })
})
