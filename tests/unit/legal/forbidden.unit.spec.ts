import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { isTemplateImplemented, TEMPLATE_META } from '@/lib/email/registry'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { LEGAL_SNIPPET_KEYS, type EmailTemplate } from '@/lib/enums'
import { V16_THIRD_PARTY_MARKS } from '@/lib/legal/forbidden'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import { snippetTokens } from '@/lib/legal/snippets'

import {
  FORBIDDEN_CONTENT_PATTERNS,
  FORBIDDEN_SOURCE_PATTERNS,
  type ForbiddenPattern,
} from '../../helpers/forbiddenPatterns'
import { MAIL_FIXTURE_DATA, renderFixture, scanMail } from '../../helpers/mails'

import allowlistJson from './forbidden.allowlist.json'

// RECHT §5 (V-01–V-31): Scan über `src/**` und `content/**` (Groß-/Kleinschreibung egal). Geprüft wird, was sich im
// Quelltext per Textsuche prüfen lässt; gerenderte Seiten (ab P2) prüft `tests/e2e/legal/forbidden.e2e.spec.ts`.
// V-13 (unbelegte Produktaussagen) setzt die Veröffentlichungsprüfung durch (R-044, R-045); V-28, V-29 sind manuelle
// Sichtung. P6.13 ergänzt V-20/V-25/V-30 im öffentlichen Code und in `messages`, den Schema-Scan V-23 und die
// gerenderten Mail-Vorlagen (V-01, V-02 im KU-Modus, V-09, V-11, V-18). Ausnahmen: `forbidden.allowlist.json`.

export interface AllowlistEntry {
  /** Pfad relativ zum Repo, mit `/`. */
  file: string
  id: string
  /** Teilstring des Treffers; ohne Angabe gilt der Eintrag für alle Treffer dieser ID in der Datei. */
  match?: string
  /** Pflicht-Begründung. */
  reason: string
}

const FORBIDDEN_ALLOWLIST: readonly AllowlistEntry[] = allowlistJson.entries

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

const p = (id: string, re: RegExp): ForbiddenPattern => ({ id, re })

/** V-20 Streich-, Rabatt- und „statt“-Preise: Texte (`messages`) bzw. Markup/Stile öffentlicher Komponenten. */
const V20_TEXT = p('V-20', /\bstatt\b|\bUVP\b|\bSale\b|-\d+\s*%/iu)
const V20_MARKUP = p('V-20', /<del\b|<s>|<s\s|line-through/iu)
/** V-23 Zahlungsdaten von Kund:innen: Schema-Felder (Ausnahme `settings.payment`, Allowlist). */
const V23_SCHEMA = p('V-23', /\bname:\s*'(iban|cardNumber|creditCard|cvc|cvv)'/iu)
/** V-25 Gesundheitsdaten in Formular-Labels. */
const V25 = p('V-25', /Allergi|Krankheit|Medikament|Schwanger|Hauterkrank/iu)
/** V-30 Funktionen für „später“ im öffentlichen UI. */
const V30 = p(
  'V-30',
  /Newsletter|Warteliste|Benachrichtige\s+mich|Mein\s+Konto|Registrieren|Gutschein/iu,
)

const isMessages = (f: string) => f.startsWith('src/i18n/messages/')
const isPublicCode = (f: string) =>
  f.startsWith('src/components/') || f.startsWith('src/app/(frontend)/')
const isSchema = (f: string) => /^src\/(collections|globals|fields)\//.test(f)

/** Muster je Datei: Inhalte zusätzlich mit der Marken-/Figurenliste V-16 (Seed-Texte zu Verkaufsware). */
export function patternsFor(file: string): readonly ForbiddenPattern[] {
  const out = [...FORBIDDEN_CONTENT_PATTERNS, ...FORBIDDEN_SOURCE_PATTERNS]
  if (file.startsWith('content/')) out.push(...v16)
  if (isMessages(file)) out.push(V20_TEXT, V25, V30)
  if (isPublicCode(file))
    out.push(V25, V30, ...(/\.(tsx|css|scss)$/.test(file) ? [V20_MARKUP] : []))
  if (isSchema(file)) out.push(V23_SCHEMA, ...(file.endsWith('Inquiries.ts') ? [V25] : []))
  return out
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
        // Einfacher Link `<a …>` oder Knopf-Link `<Button href=… rel=…>` (Tattoo-Bereich, P7).
        const open = Math.max(text.lastIndexOf('<a', m.index), text.lastIndexOf('<Button', m.index))
        const close = text.indexOf('>', m.index)
        const tag = text.slice(open, close + 1)
        links.push(file)
        if (open < 0 || !/rel="(?:me )?noopener noreferrer"/.test(tag)) bad.push(`${file}: ${tag}`)
      }
      // Keine Instagram-Adresse als geladene Ressource (Bild, Rahmen, Skript, Video); JSON-LD `sameAs` ist ein Verweis.
      if (/\b(?:src|srcSet|data|poster)=\{?[^}>]*instagram/i.test(text))
        bad.push(`${file}: Instagram als eingebettete Ressource`)
    }
    // Nur Menü, Fuß und – seit U-42 (P13.3) – der Hinweis unter dem Schaukasten der Startseite verlinken das Instagram-Profil
    // (U-15 gilt weiter: keine Direktnachricht, kein Anfrageweg).
    expect(new Set(links)).toEqual(
      new Set([
        'src/components/layout/MenuOverlay.tsx',
        'src/components/layout/SiteFooter.tsx',
        'src/components/home/InstagramLink.tsx',
      ]),
    )
    expect(bad).toEqual([])
  })
})

// P6.13 – Verbotsprüfungen je ID (Nachverfolgbarkeit), Schema-Scan V-23 und gerenderte Mails.
describe('P6.13 Quelltext-Scans je Verbot', () => {
  const violationsOf = (id: string) =>
    applyAllowlist(
      findings.filter((f) => f.id === id),
      FORBIDDEN_ALLOWLIST,
    ).violations.map((v) => `${v.file}:${v.line} „${v.text}“`)

  const SOURCE_SCANS: readonly [string, string][] = [
    ['V-01', 'kein Link/Text zur EU-OS-Plattform in src/** und content/**'],
    ['V-03', 'keine vorbelegten Häkchen (defaultChecked / checked={true})'],
    ['V-04', 'keine externen Schriften und CDNs'],
    ['V-05', 'keine Einbettungen Dritter'],
    ['V-06', 'keine CAPTCHA-Dienste'],
    ['V-07', 'keine Tracker'],
    ['V-16', 'keine fremden Figuren/Marken in Produkttexten des Seeds'],
    ['V-20', 'keine Streich-/„statt“-Preise in messages und öffentlichen Komponenten'],
    ['V-21', 'keine Aufschläge für Zahlarten'],
    ['V-22', 'keine Personenfelder aus searchParams'],
    ['V-23', 'keine Zahlungsdaten-Felder außerhalb der Stammdaten'],
    ['V-25', 'keine Gesundheitsfragen in Formular-Labels'],
    ['V-30', 'kein Newsletter/Konto/Gutschein im öffentlichen Code und in messages'],
  ]
  for (const [id, what] of SOURCE_SCANS) {
    it(`${id} ${what}`, () => {
      expect(violationsOf(id)).toEqual([])
    })
  }

  it('V-23 Schema-Scan: `iban` nur in settings.payment (Juttas eigene Bankverbindung), sonst keine Zahlungsdaten', () => {
    const hits = findings.filter((f) => f.id === 'V-23')
    expect(hits.map((h) => h.file)).toEqual(['src/globals/Settings.ts'])
    const lines = readFileSync(path.join(ROOT, 'src/globals/Settings.ts'), 'utf8').split('\n')
    const payment = lines.findIndex((l) => /name:\s*'payment'/.test(l))
    const groups = lines
      .map((l, i) => ({ i, top: /^ {0,2}name:\s*'[a-zA-Z]+'/.test(l) }))
      .filter((g) => g.top && g.i > payment)
    const end = groups[0]?.i ?? lines.length
    expect(payment).toBeGreaterThan(-1)
    for (const h of hits) {
      expect(h.line - 1).toBeGreaterThan(payment)
      expect(h.line - 1).toBeLessThan(end)
    }
  })

  it('V-20 V-23 V-25 V-30 Gegenprobe: Streichpreis, IBAN-Feld, Gesundheitsfrage und Newsletter werden erkannt', () => {
    const ids = (file: string, text: string) =>
      scanText(file, text, patternsFor(file)).map((f) => f.id)
    expect(ids('src/i18n/messages/de.json', '"price": "45 € statt 59 €"')).toEqual(['V-20'])
    expect(ids('src/components/shop/X.tsx', '<del>59 €</del>')).toEqual(['V-20'])
    expect(ids('src/collections/Orders.ts', "{ name: 'iban', type: 'text' }")).toEqual(['V-23'])
    expect(ids('src/components/forms/X.tsx', '<label>Allergien</label>')).toEqual(['V-25'])
    expect(ids('src/i18n/messages/en.json', '"cta": "Newsletter abonnieren"')).toEqual(['V-30'])
    // Verwaltungscode und Tests sind nicht „öffentlich“
    expect(ids('src/admin/views/X.tsx', 'Newsletter')).toEqual([])
  })
})

/** V-11 (RECHT §5): Rügefristen, die Rechte verkürzen. */
const V11 =
  /(innerhalb|binnen|within)\s+(von\s+)?\d+\s+(Tag(en)?|days?).{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt|otherwise|excluded|expires?)/iu
/** V-18 (RECHT §5): „Garantie“ für die gesetzliche Gewährleistung. */
const V18 = /Garantie|garantiert/iu

/** Verstöße einer gerenderten Mail: V-01, V-02 (Kleinunternehmer-Fixtures), V-09 (Werbung/Tracking), V-11, V-18. */
export function mailViolations(mail: { html: string; text: string; subject?: string }): string[] {
  const all = `${mail.subject ?? ''}\n${mail.text}\n${mail.html}`
  const out = scanMail({ html: mail.html, text: `${mail.subject ?? ''}\n${mail.text}` })
  if (V11.test(all)) out.push('V-11')
  if (V18.test(all)) out.push('V-18')
  return out
}

const RENDERED = (Object.keys(TEMPLATE_META) as EmailTemplate[]).filter(
  (t) => isTemplateImplemented(t) && MAIL_FIXTURE_DATA[t],
)

describe('P6.13 gerenderte Mails (V-01, V-02 im KU-Modus, V-09, V-11, V-18)', () => {
  it('V-09 alle umgesetzten Vorlagen haben Fixture-Daten und werden gescannt', () => {
    const missing = (Object.keys(TEMPLATE_META) as EmailTemplate[]).filter(
      (t) => isTemplateImplemented(t) && !MAIL_FIXTURE_DATA[t],
    )
    expect(missing).toEqual([])
    expect(RENDERED.length).toBeGreaterThanOrEqual(25)
  })

  for (const template of RENDERED) {
    it(`V-01 V-02 V-09 V-11 V-18 ${TEMPLATE_META[template].konzeptId} ${template} DE/EN ohne Verbotsmuster`, async () => {
      for (const locale of ['de', 'en'] as const) {
        const mail = await renderFixture(template, MAIL_FIXTURE_DATA[template]!, locale)
        expect(mailViolations(mail), `${template} ${locale}`).toEqual([])
      }
    })
  }

  it('V-01 V-02 Gegenprobe: eine Mail-Fixture mit OS-Link bzw. „inkl. MwSt.“ fällt durch', async () => {
    const mail = await renderFixture(
      'refund_confirmation',
      MAIL_FIXTURE_DATA.refund_confirmation!,
      'de',
    )
    expect(mailViolations(mail)).toEqual([])
    const os = {
      ...mail,
      html: mail.html.replace(
        '</p>',
        ' <a href="https://ec.europa.eu/consumers/odr/">OS-Plattform</a></p>',
      ),
    }
    expect(mailViolations(os)).toContain('V-01')
    const tax = { ...mail, text: `${mail.text}\nGesamt 45,00 € inkl. MwSt.` }
    expect(mailViolations(tax)).toContain('V-02')
    const promo = { ...mail, text: `${mail.text}\nFolge mir auf Instagram!` }
    expect(mailViolations(promo).some((f) => f.startsWith('V-09'))).toBe(true)
    const guarantee = { ...mail, text: `${mail.text}\n2 Jahre Garantie` }
    expect(mailViolations(guarantee)).toContain('V-18')
    const deadline = {
      ...mail,
      text: `${mail.text}\nMängel bitte innerhalb von 7 Tagen melden, sonst erlischt der Anspruch.`,
    }
    expect(mailViolations(deadline)).toContain('V-11')
  })
})
