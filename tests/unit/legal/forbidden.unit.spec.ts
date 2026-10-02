import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { LEGAL_SNIPPET_KEYS } from '@/lib/enums'
import { V16_THIRD_PARTY_MARKS } from '@/lib/legal/forbidden'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import { snippetTokens } from '@/lib/legal/snippets'

import {
  FORBIDDEN_CONTENT_PATTERNS,
  FORBIDDEN_SOURCE_PATTERNS,
  type ForbiddenPattern,
} from '../../helpers/forbiddenPatterns'

import { FORBIDDEN_ALLOWLIST, type AllowlistEntry } from './forbidden.allowlist'

// RECHT §5 (V-01–V-31): Scan über `src/**` und `content/**` (Groß-/Kleinschreibung egal). Geprüft wird, was sich im
// Quelltext per Textsuche prüfen lässt; gerenderte Seiten (ab P2) und Mails prüft `tests/e2e/legal/forbidden.e2e.spec.ts`.
// V-13 (unbelegte Produktaussagen) setzt die Veröffentlichungsprüfung durch (R-044, R-045); V-18, V-28, V-29 sind
// manuelle Sichtung; V-09, V-20, V-30, V-31 betreffen gerenderten Text (e2e). Ausnahmen: `forbidden.allowlist.ts`.

const ROOT = path.resolve(__dirname, '../../..')
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|css|scss|md|mdx|txt|html|svg|yml|yaml)$/i
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.data'])

export interface Finding {
  file: string
  line: number
  id: string
  text: string
}

function listFiles(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(path.join(ROOT, dir))
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    if (SKIP_DIRS.has(name)) return []
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) return listFiles(rel)
    return TEXT_EXT.test(name) ? [rel] : []
  })
}

const v16 = V16_THIRD_PARTY_MARKS.map((r): ForbiddenPattern => ({
  id: 'V-16',
  re: new RegExp(r.pattern.source, 'iu'),
}))

/** Muster je Datei: Inhalte zusätzlich mit der Marken-/Figurenliste V-16 (Seed-Texte zu Verkaufsware). */
export function patternsFor(file: string): readonly ForbiddenPattern[] {
  const base = [...FORBIDDEN_CONTENT_PATTERNS, ...FORBIDDEN_SOURCE_PATTERNS]
  return file.startsWith('content/') ? [...base, ...v16] : base
}

/** Alle Treffer einer Datei (eine Zeile kann mehrere IDs treffen). */
export function scanText(
  file: string,
  text: string,
  patterns: readonly ForbiddenPattern[],
): Finding[] {
  const out: Finding[] = []
  text.split('\n').forEach((line, i) => {
    for (const { id, re } of patterns) {
      const m = re.exec(line)
      if (m) out.push({ file, line: i + 1, id, text: m[0] })
    }
  })
  return out
}

const matches = (entry: AllowlistEntry, f: Finding) =>
  entry.file === f.file && entry.id === f.id && (!entry.match || f.text.includes(entry.match))

/** Treffer ohne Allowlist-Eintrag und Allowlist-Einträge ohne Treffer (veraltet). */
export function applyAllowlist(
  findings: Finding[],
  allowlist: readonly AllowlistEntry[],
): { violations: Finding[]; unused: AllowlistEntry[] } {
  return {
    violations: findings.filter((f) => !allowlist.some((e) => matches(e, f))),
    unused: allowlist.filter((e) => !findings.some((f) => matches(e, f))),
  }
}

const files = [...listFiles('src'), ...listFiles('content')]
const findings = files.flatMap((f) =>
  scanText(f, readFileSync(path.join(ROOT, f), 'utf8'), patternsFor(f)),
)

describe('RECHT §5 Verbotsmuster in src/** und content/**', () => {
  it('V-01–V-31 kein Treffer außerhalb der begründeten Allowlist', () => {
    expect(files.length).toBeGreaterThan(100)
    const { violations } = applyAllowlist(findings, FORBIDDEN_ALLOWLIST)
    expect(violations.map((v) => `${v.file}:${v.line} ${v.id} „${v.text}“`)).toEqual([])
  })

  it('Allowlist: jeder Eintrag hat eine Begründung und wird noch gebraucht', () => {
    for (const e of FORBIDDEN_ALLOWLIST) expect(e.reason.length, e.file).toBeGreaterThan(15)
    const { unused } = applyAllowlist(findings, FORBIDDEN_ALLOWLIST)
    expect(unused).toEqual([])
  })

  it('V-01, V-02, V-03 Gegenprobe: OS-Link, „inkl. MwSt.“ und vorbelegtes Häkchen werden erkannt', () => {
    const sample = [
      '<a href="https://ec.europa.eu/consumers/odr">OS</a>',
      'Preis 20 € inkl. MwSt.',
      '<input type="checkbox" defaultChecked />',
      '<input type="checkbox" checked={true} />',
      '<input type="checkbox" defaultChecked={false} />',
    ].join('\n')
    const ids = scanText('src/x.tsx', sample, patternsFor('src/x.tsx')).map(
      (f) => `${f.line}:${f.id}`,
    )
    expect(ids).toEqual(['1:V-01', '2:V-02', '3:V-03', '4:V-03'])
    const godzilla = scanText(
      'content/seed/data/products.json',
      '"title": "Godzilla-Tasse"',
      patternsFor('content/seed/data/products.json'),
    )
    expect(godzilla.map((f) => f.id)).toEqual(['V-16'])
    const { violations } = applyAllowlist(
      [{ file: 'src/a.ts', line: 1, id: 'V-01', text: 'ODR' }],
      [{ file: 'src/a.ts', id: 'V-02', reason: 'andere ID – deckt den Treffer nicht ab' }],
    )
    expect(violations).toHaveLength(1)
  })
})

// P3.3: Preis-, Steuer-, Liefer- und Gewährleistungshinweise (V-02 Steuerhinweis im Kleinunternehmer-Modus, V-19
// Werbung mit Selbstverständlichkeiten, V-20 Streich-/„statt“-Preise). Die Bausteine werden mit Beispielwerten
// gerendert; die neuen Dateien (Bausteine, Komponenten, Grafiken, Texte) zusätzlich als Quelltext geprüft.
const V20: ForbiddenPattern = {
  id: 'V-20',
  re: /<del|<s>|line-through|\bstatt\b|\bUVP\b|\bSale\b|-\d+\s*%/iu,
}
const PRICE_PATTERNS: readonly ForbiddenPattern[] = [
  ...FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-02' || p.id === 'V-19'),
  V20,
]
const P33_FILES = [
  'src/lib/legal/snippets.ts',
  'src/lib/legal/warranty.ts',
  'src/lib/shop/deliveryTime.ts',
  ...listFiles('src/components/shop'),
  ...listFiles('public/legal'),
]

describe('P3.3 Preis- und Rechtshinweise (V-02, V-19, V-20)', () => {
  it('V-02 V-19 V-20 gerenderte Bausteine DE/EN ohne Steuer-, Selbstverständlichkeits- und Streichpreis-Muster', () => {
    const hits: string[] = []
    for (const key of LEGAL_SNIPPET_KEYS) {
      for (const locale of ['de', 'en'] as const) {
        const text = LEGAL_SNIPPET_SEED[key][locale]
        const rendered = snippetTokens(text).reduce(
          (t, tok) => t.split(`{{${tok}}}`).join('X'),
          text,
        )
        for (const f of scanText(`${key}.${locale}`, rendered, PRICE_PATTERNS)) {
          hits.push(`${f.file} ${f.id} „${f.text}“`)
        }
      }
    }
    for (const [locale, messages] of [
      ['de', de.shop],
      ['en', en.shop],
    ] as const) {
      for (const f of scanText(`shop.${locale}`, JSON.stringify(messages), PRICE_PATTERNS)) {
        hits.push(`${f.file} ${f.id} „${f.text}“`)
      }
    }
    expect(hits).toEqual([])
  })

  it('V-02 V-19 V-20 neue Dateien (Komponenten, Bausteine, Grafiken) ohne Treffer', () => {
    expect(P33_FILES).toEqual(
      expect.arrayContaining([
        'src/components/shop/PriceNote.tsx',
        'src/components/shop/WarrantyNotice.tsx',
        'public/legal/warranty-notice-de.svg',
      ]),
    )
    const hits = P33_FILES.flatMap((file) =>
      scanText(file, readFileSync(path.join(ROOT, file), 'utf8'), PRICE_PATTERNS),
    )
    expect(hits.map((h) => `${h.file}:${h.line} ${h.id} „${h.text}“`)).toEqual([])
  })

  it('Gegenprobe: „inkl. MwSt.“, „2 Jahre Gewährleistung“ und Streichpreise werden erkannt', () => {
    const sample = [
      'Endpreis inkl. MwSt.',
      '2 Jahre Gewährleistung',
      '<del>59 €</del>',
      'statt 60 €',
      '-20 %',
    ]
    const ids = sample.flatMap((line) => scanText('x', line, PRICE_PATTERNS).map((f) => f.id))
    expect(ids).toEqual(['V-02', 'V-19', 'V-20', 'V-20', 'V-20'])
  })
})

// P3.16 (Nachverfolgbarkeit R-001 für P3): R-096 kein Widerrufsausschluss im Shop, R-139 Instagram nur als Link.
describe('P3.16 R-096 und R-139 im Quelltext', () => {
  it('R-096 V-08: kein Widerrufsausschluss in src/** und content/**; products ohne Feld „kein Widerrufsrecht“', () => {
    const { violations } = applyAllowlist(
      findings.filter((f) => f.id === 'V-08'),
      FORBIDDEN_ALLOWLIST,
    )
    expect(violations.map((v) => `${v.file}:${v.line} „${v.text}“`)).toEqual([])
    const source = readFileSync(path.join(ROOT, 'src/collections/Products.ts'), 'utf8')
    const fields = [...source.matchAll(/\bname:\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]!)
    expect(fields).toContain('isCustomCommission')
    expect(
      fields.filter((f) =>
        /withdraw|widerruf|noReturn|nonReturnable|finalSale|customMade|personali[sz]ed/i.test(f),
      ),
    ).toEqual([])
  })

  it('R-139 V-05: Instagram nur als einfacher Link mit rel="noopener noreferrer" – keine Einbettung, kein Bild', () => {
    const { violations } = applyAllowlist(
      findings.filter((f) => f.id === 'V-05'),
      FORBIDDEN_ALLOWLIST,
    )
    expect(violations.map((v) => `${v.file}:${v.line} „${v.text}“`)).toEqual([])
    const tsx = listFiles('src').filter((f) => f.endsWith('.tsx'))
    const links: string[] = []
    const bad: string[] = []
    for (const file of tsx) {
      const text = readFileSync(path.join(ROOT, file), 'utf8')
      for (const m of text.matchAll(/href=\{instagram(?:Dm)?Url\(/g)) {
        const open = text.lastIndexOf('<a', m.index)
        const close = text.indexOf('>', m.index)
        const tag = text.slice(open, close + 1)
        links.push(file)
        if (open < 0 || !/rel="noopener noreferrer"/.test(tag)) bad.push(`${file}: ${tag}`)
      }
      // Keine Instagram-Adresse als geladene Ressource (Bild, Rahmen, Skript, Video); JSON-LD `sameAs` ist ein Verweis.
      if (/\b(?:src|srcSet|data|poster)=\{?[^}>]*instagram/i.test(text))
        bad.push(`${file}: Instagram als eingebettete Ressource`)
    }
    // Menü, Fuß und Kontakt (Profil + Direktnachricht) verlinken Instagram.
    expect(new Set(links)).toEqual(
      new Set([
        'src/components/content/ContactLinks.tsx',
        'src/components/layout/MenuOverlay.tsx',
        'src/components/layout/SiteFooter.tsx',
      ]),
    )
    expect(bad).toEqual([])
  })
})
