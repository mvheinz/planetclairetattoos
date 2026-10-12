import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadBestand } from '@/lib/bestand/schema'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'

// P20.4 / V-25 (U-93): Englisch aus einem Guss – britisches Englisch und feste Wörter (Begriffsliste
// docs/design/TEXTE.md §8). Geprüft werden alle englischen Texte, die Besucher:innen sehen: Sprachdatei, Seiten, FAQ,
// Kategorien und Einstellungen des Beispielbestands, Bausteine und der echte Bestand. Die Rechtstexte sind ausgenommen
// (Kanzlei-Mappe, TEXTE.md §8).

const root = path.resolve(import.meta.dirname, '../../..')
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), 'utf8')) as unknown

/** Verbotene Varianten → richtiges Wort laut Begriffsliste. */
const FORBIDDEN: [RegExp, string][] = [
  [/\b(shopping )?cart\b/i, 'basket'],
  [/\bpick-up\b/i, 'pickup'],
  [/\bskeptic(al|ally)?\b/i, 'sceptical'],
  [/\bleash(es|ed)?\b/i, 'lead'],
  [/\bcolor(s|ed|ful)?\b/i, 'colour'],
  [/\bfavorite\b/i, 'favourite'],
  [/\bcenter\b/i, 'centre'],
]

/** Englische Texte eines JSON-Baums: Werte unter `en` bzw. `…En`, ohne die Rechtstexte. */
function englishOf(node: unknown, isEn = false, out: string[] = []): string[] {
  if (typeof node === 'string') {
    if (isEn) out.push(node)
  } else if (Array.isArray(node)) {
    for (const v of node) englishOf(v, isEn, out)
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'legalTexts') continue
      englishOf(v, isEn || k === 'en' || /En$/.test(k), out)
    }
  }
  return out
}

describe('V-25 Englisch aus einem Guss (TEXTE.md §8)', async () => {
  const bestand = await loadBestand(root)
  const sources: Record<string, string[]> = {
    'src/i18n/messages/en.json': englishOf(read('src/i18n/messages/en.json'), true),
    'Bausteine (EN)': Object.values(LEGAL_SNIPPET_SEED).map((s) => s.en),
    'content/bestand/products.json': englishOf(bestand),
  }
  for (const f of readdirSync(path.join(root, 'content/seed/data')).filter((x) =>
    x.endsWith('.json'),
  ))
    sources[`content/seed/data/${f}`] = englishOf(read(`content/seed/data/${f}`))

  it('keine verbotenen Varianten (cart, pick-up, skeptical, leash, color, favorite, center)', () => {
    const hits: string[] = []
    for (const [file, texts] of Object.entries(sources))
      for (const t of texts)
        for (const [re, right] of FORBIDDEN) {
          const m = re.exec(t)
          if (m) hits.push(`${file}: „${m[0]}“ → „${right}“ in: ${t.slice(0, 120)}`)
        }
    expect(hits).toEqual([])
  })

  it('der Knopf heißt überall „Add to basket“, die Startseite sagt „exists only once“', () => {
    const en = sources['src/i18n/messages/en.json']!
    expect(en).toContain('Add to basket')
    const pages = sources['content/seed/data/pages.json']!
    expect(pages).toContain('A small planet where everything exists only once')
  })

  it('keine zwei Stücke mit demselben englischen Gegenstand und Namen; kein „Ceramic“ vor dem Gegenstand', () => {
    const titles = bestand.map((p) => p.title.en)
    expect(new Set(titles).size).toBe(titles.length)
    const things = bestand.map((p) => p.title.en.split(' “')[0]!)
    // V-25: zwei verschiedene Stücke hießen beide „Two-handled cup“
    expect(things.filter((t) => t === 'Two-handled cup')).toHaveLength(1)
    for (const t of things) expect(t).not.toMatch(/^Ceramic\b/)
  })
})
