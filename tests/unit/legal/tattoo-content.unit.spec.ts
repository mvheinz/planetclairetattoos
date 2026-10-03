import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'

import { FORBIDDEN_CONTENT_PATTERNS, type ForbiddenPattern } from '../../helpers/forbiddenPatterns'

// P7.15 – Scan der Tattoo-Inhalte auf V-15 (Heil-/Gesundheitsversprechen), V-24 (Anzahlung „verfällt“/„nicht
// erstattbar“) und V-25 (Abfrage von Gesundheitsdaten) – RECHT §5, R-034, R-170. Geprüft werden: Seed-Dateien unter
// `content/seed/data/` (Seiten `tattoo`/`tattoo_aftercare`/`commissions`, FAQ `tattoo`/`aftercare`; die Seed-Dateien
// dafür kommen in P8.6/P8.7 hinzu und laufen dann automatisch mit), die Texte der Tattoo- und Auftragsarbeiten-Seiten aus
// `src/i18n/messages/*.json` (Rückfalltexte, Formular-Beschriftungen) und die Test-Fixtures des Tattoo-Bereichs.

const ROOT = path.resolve(__dirname, '../../..')
const SEED_DIR = path.join(ROOT, 'content/seed/data')
const PAGE_KEYS = new Set(['tattoo', 'tattoo_aftercare', 'commissions'])
const FAQ_CATEGORIES = new Set(['tattoo', 'aftercare', 'commissions'])

const V25: ForbiddenPattern = {
  id: 'V-25',
  re: /Allergi|Krankheit|Medikament|Schwanger|Hauterkrank|allerg(y|ies)|illness|medication|pregnan|skin condition/iu,
}
const PATTERNS: ForbiddenPattern[] = [
  ...FORBIDDEN_CONTENT_PATTERNS.filter((p) => ['V-15', 'V-24'].includes(p.id)),
  V25,
]

type Json = unknown

/** Alle Zeichenketten eines JSON-Werts. */
function strings(value: Json): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

/** Einträge der Seed-Dateien, die Tattoo-Seiten bzw. -FAQ sind. */
function seedTattooEntries(): { source: string; texts: string[] }[] {
  if (!existsSync(SEED_DIR)) return []
  const out: { source: string; texts: string[] }[] = []
  for (const file of readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(path.join(SEED_DIR, file), 'utf8')) as Json
    const visit = (node: Json, where: string) => {
      if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${where}[${i}]`))
      if (!node || typeof node !== 'object') return
      const rec = node as Record<string, Json>
      const isPage = typeof rec.key === 'string' && PAGE_KEYS.has(rec.key) && 'layout' in rec
      const isFaq =
        typeof rec.category === 'string' && FAQ_CATEGORIES.has(rec.category) && 'question' in rec
      if (isPage || isFaq) {
        out.push({ source: `${file} ${where}`, texts: strings(rec) })
        return
      }
      for (const [k, v] of Object.entries(rec)) visit(v, `${where}.${k}`)
    }
    visit(data, '')
  }
  return out
}

function messageTexts(): { source: string; texts: string[] }[] {
  return ['de', 'en'].flatMap((locale) => {
    const msgs = JSON.parse(
      readFileSync(path.join(ROOT, `src/i18n/messages/${locale}.json`), 'utf8'),
    ) as Record<string, Json>
    return ['tattoo', 'commission'].map((ns) => ({
      source: `messages/${locale}.json ${ns}`,
      texts: strings(msgs[ns]),
    }))
  })
}

/** Zeichenketten-Literale der Tattoo-Fixtures (FAQ-Antworten, Titel, Beschreibungen). */
function fixtureTexts(): { source: string; texts: string[] }[] {
  const dirs = ['tests/e2e/tattoo', 'tests/e2e/commission']
  return dirs
    .filter((d) => existsSync(path.join(ROOT, d)))
    .flatMap((d) =>
      readdirSync(path.join(ROOT, d))
        .filter((f) => f.endsWith('.ts'))
        .map((f) => {
          const src = readFileSync(path.join(ROOT, d, f), 'utf8')
          const literals = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]!)
          return { source: `${d}/${f}`, texts: literals }
        }),
    )
}

function violations(entries: { source: string; texts: string[] }[]): string[] {
  return entries.flatMap(({ source, texts }) =>
    texts.flatMap((t) =>
      PATTERNS.filter((p) => p.re.test(t)).map((p) => `${p.id} ${source}: ${t.slice(0, 80)}`),
    ),
  )
}

describe('Tattoo-Inhalte ohne V-15/V-24/V-25 (P7.15)', () => {
  it('R-170 Seed-Seiten und -FAQ des Tattoo-Bereichs ohne Heilversprechen, Verfallsklausel, Gesundheitsabfrage', () => {
    expect(violations(seedTattooEntries())).toEqual([])
  })

  it('R-170 Texte der Tattoo- und Auftragsarbeiten-Seiten (DE/EN) ohne V-15/V-24/V-25', () => {
    const entries = messageTexts()
    expect(entries.every((e) => e.texts.length > 0)).toBe(true)
    expect(violations(entries)).toEqual([])
  })

  it('R-170 Test-Fixtures des Tattoo-Bereichs ohne V-15/V-24/V-25', () => {
    expect(violations(fixtureTexts())).toEqual([])
  })

  it('R-034 Tattoo-Preis-Hinweis nennt den Gesamtpreis ohne „inkl. MwSt.“', () => {
    const note = LEGAL_SNIPPET_SEED['price.tattooNote']
    expect(note.de).toContain('Gesamtpreis')
    expect(note.en).toContain('Total price')
    const v02 = FORBIDDEN_CONTENT_PATTERNS.find((p) => p.id === 'V-02')!
    expect(v02.re.test(note.de)).toBe(false)
  })

  it('Gegenprobe: die Muster schlagen an', () => {
    expect(
      violations([
        {
          source: 'probe',
          texts: [
            'Die Anzahlung verfällt bei Absage.',
            'Heilt garantiert in einer Woche.',
            'Hast du Allergien?',
          ],
        },
      ]).map((v) => v.slice(0, 4)),
    ).toEqual(['V-24', 'V-15', 'V-25'])
  })
})
