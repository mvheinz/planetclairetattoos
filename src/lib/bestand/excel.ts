import {
  FIBER_COMPONENTS,
  PRODUCT_CATEGORIES,
  TEXTILE_CONDITIONS,
  TEXTILE_FIBERS,
} from '@/lib/enums'
import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  excelDay,
  fold,
  isoDay,
  num,
  sameNum,
  sameText,
  str,
  type CellValue,
} from '@/lib/pflege/cells'
import { decide, emptyReport, NO_BASE, type Decision, type PflegeReport } from '@/lib/pflege/merge'
import type { SnapshotRows } from '@/lib/pflege/snapshot'

import type { BestandProduct } from './schema'

// Bestandsliste als Excel (U-85, U-86, PLAN P18.1): Spalten der Liste, Werte je Stück und der Rückweg – welche Zelle
// welches Feld in `content/bestand/products.json` ändert. Reine Funktionen ohne Excel-Bibliothek (die Datei schreibt
// und liest `excelBook.ts` mit exceljs). Jutta bearbeitet die Liste auf dem iPad (Numbers oder Excel) und gibt sie
// zurück; übernommen wird nur, was sie gegenüber dem **gemerkten Stand** der Liste geändert hat (Dreiwege-Abgleich,
// U-89). Ungültige Werte werden gemeldet und nicht übernommen; ändert sie einen deutschen Text, aber nicht den
// englischen, ergänzt Claude das Englische (U-00).

export type { CellValue }

export interface ExcelColumn {
  key: string
  header: string
  /** Breite in Zeichen. */
  width: number
  /** Nur zur Ansicht (Nummer, Foto, Prüfpunkte) – Änderungen werden ignoriert. */
  readOnly?: boolean
  /** Auswahlliste (Datenüberprüfung in Excel). */
  list?: readonly string[]
  /** Hinweis in der Kopfzeile (Kommentar). */
  hint?: string
  /** Mehrzeiliger Text (Zeilenumbruch). */
  wrap?: boolean
  /** Zahlformat, z. B. `0.00` für Euro. */
  numFmt?: string
  /** Zahl: „12,5“ und 12.5 gelten als gleich. */
  kind?: 'num'
}

const CATEGORY_DE = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c, ENUM_LABELS.PRODUCT_CATEGORIES[c].de]),
) as Record<(typeof PRODUCT_CATEGORIES)[number], string>
const CONDITION_DE = Object.fromEntries(
  TEXTILE_CONDITIONS.map((c) => [c, ENUM_LABELS.TEXTILE_CONDITIONS[c].de]),
) as Record<(typeof TEXTILE_CONDITIONS)[number], string>

export const YES = 'ja'
export const NO = 'nein'

export const BESTAND_COLUMNS: readonly ExcelColumn[] = [
  {
    key: 'nr',
    header: 'Nr.',
    width: 6,
    readOnly: true,
    kind: 'num',
    hint: 'Objektnummer – bitte nicht ändern.',
  },
  { key: 'foto', header: 'Foto', width: 12, readOnly: true },
  { key: 'kategorie', header: 'Kategorie', width: 13, list: Object.values(CATEGORY_DE) },
  { key: 'titleDe', header: 'Name (Deutsch)', width: 34, wrap: true },
  { key: 'titleEn', header: 'Name (Englisch)', width: 34, wrap: true },
  { key: 'preis', header: 'Preis (€)', width: 10, numFmt: '0.00', kind: 'num' },
  { key: 'breite', header: 'Breite (cm)', width: 10, kind: 'num' },
  { key: 'hoehe', header: 'Höhe (cm)', width: 10, kind: 'num' },
  { key: 'tiefe', header: 'Tiefe (cm)', width: 10, kind: 'num' },
  { key: 'durchmesser', header: 'Durchmesser (cm)', width: 12, kind: 'num' },
  { key: 'masseHinweis', header: 'Maße – Hinweis', width: 30, wrap: true },
  { key: 'gewicht', header: 'Gewicht (g)', width: 10, kind: 'num' },
  { key: 'materialDe', header: 'Material (Deutsch)', width: 30, wrap: true },
  { key: 'materialEn', header: 'Material (Englisch)', width: 30, wrap: true },
  { key: 'groesse', header: 'Größe (Textil/Cap)', width: 16, wrap: true },
  { key: 'zustand', header: 'Zustand (Textil/Cap)', width: 16, list: Object.values(CONDITION_DE) },
  { key: 'secondHand', header: 'Second Hand', width: 11, list: [YES, NO] },
  {
    key: 'fasern',
    header: 'Fasern laut Etikett',
    width: 24,
    wrap: true,
    hint: 'z. B. „100 % Baumwolle“ oder „60 % Baumwolle, 40 % Polyester“',
  },
  {
    key: 'metall',
    header: 'Metallteile (Schmuck)',
    width: 22,
    wrap: true,
    hint: 'z. B. „Edelstahl, nickelfrei“',
  },
  {
    key: 'abweichung',
    header: 'Macke / Abweichung',
    width: 34,
    wrap: true,
    hint: 'leer = keine Abweichung',
  },
  { key: 'beschreibungDe', header: 'Beschreibung (Deutsch)', width: 60, wrap: true },
  { key: 'beschreibungEn', header: 'Beschreibung (Englisch)', width: 60, wrap: true },
  { key: 'pruefen', header: 'Bitte prüfen', width: 60, wrap: true, readOnly: true },
  { key: 'notiz', header: 'Deine Notiz', width: 30, wrap: true },
  {
    key: 'verkauft',
    header: 'Verkauft',
    width: 16,
    hint: 'Datum (z. B. 11.10.2026) oder „ja“, gern mit Preis und kurzer Notiz (z. B. „11.10.2026 35 € Markt“) – leer = noch da',
  },
]

const textile = (p: BestandProduct) => p.category === 'textil' || p.category === 'cap'

const euro = (cents: number) => Math.round(cents) / 100

/** Fasern als Text: „60 % Baumwolle, 40 % Polyester“ (nur Hauptstoff; andere Teile mit Präfix). */
export function fibersText(rows: BestandProduct['fiberComposition']): string {
  if (!rows?.length) return ''
  const part = (c: string) =>
    c === 'main'
      ? ''
      : `${ENUM_LABELS.FIBER_COMPONENTS[c as (typeof FIBER_COMPONENTS)[number]].de}: `
  return rows
    .map((r) => `${part(r.component)}${r.percent} % ${ENUM_LABELS.TEXTILE_FIBERS[r.fiber].de}`)
    .join(', ')
}

const FIBER_BY_NAME = new Map<string, (typeof TEXTILE_FIBERS)[number]>()
for (const f of TEXTILE_FIBERS) {
  const l = ENUM_LABELS.TEXTILE_FIBERS[f]
  FIBER_BY_NAME.set(fold(l.de), f)
  if (l.en) FIBER_BY_NAME.set(fold(l.en), f)
  FIBER_BY_NAME.set(fold(f), f)
}
const COMPONENT_BY_NAME = new Map<string, (typeof FIBER_COMPONENTS)[number]>()
for (const c of FIBER_COMPONENTS) COMPONENT_BY_NAME.set(fold(ENUM_LABELS.FIBER_COMPONENTS[c].de), c)

/** „60 % Baumwolle, 40 % Polyester“ → Faserzeilen; Fehler als Text. */
export function parseFibers(
  text: string,
): { rows: NonNullable<BestandProduct['fiberComposition']> } | { error: string } {
  const rows: NonNullable<BestandProduct['fiberComposition']> = []
  for (const raw of text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    let rest = raw
    let component: (typeof FIBER_COMPONENTS)[number] = 'main'
    const colon = /^([^:]+):\s*(.+)$/.exec(raw)
    if (colon) {
      const c = COMPONENT_BY_NAME.get(fold(colon[1]!))
      if (!c) return { error: `Teil „${colon[1]}“ unbekannt (Hauptstoff, Futter, Besatz …)` }
      component = c
      rest = colon[2]!
    }
    const m = /^(\d{1,3})\s*%\s*(.+)$/.exec(rest) ?? /^(.+?)\s+(\d{1,3})\s*%$/.exec(rest)
    if (!m)
      return { error: `„${raw}“ – bitte „Prozent % Faser“ schreiben, z. B. „100 % Baumwolle“` }
    const [pct, name] = /^\d/.test(m[1]!) ? [m[1]!, m[2]!] : [m[2]!, m[1]!]
    const fiber = FIBER_BY_NAME.get(fold(name))
    if (!fiber) return { error: `Faser „${name.trim()}“ ist keine amtliche Bezeichnung` }
    rows.push({ component, fiber, percent: Number(pct) })
  }
  for (const c of new Set(rows.map((r) => r.component))) {
    const sum = rows.filter((r) => r.component === c).reduce((n, r) => n + r.percent, 0)
    if (sum !== 100) return { error: `Fasern ergeben ${sum} % statt 100 %` }
  }
  return { rows }
}

/** „35 €“ bzw. „35,50 €“. */
const euroText = (cents: number) =>
  `${cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')} €`

/** Anzeige „Verkauft“: Datum TT.MM.JJJJ (sonst „ja“), dann ggf. erzielter Preis und Notiz. */
export function soldText(sold: BestandProduct['sold']): string {
  if (!sold) return ''
  const date = sold.date ? sold.date.split('-').reverse().join('.') : YES
  return [date, sold.priceCents !== undefined ? euroText(sold.priceCents) : '', sold.note ?? '']
    .filter(Boolean)
    .join(' ')
}

const PRICE_IN_TEXT = /(?:^|\s)(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o)?\b)/i

/** Notiz und erzielten Preis („35 €“, „35,50 Euro“) trennen. */
function noteAndPrice(text: string): { note?: string; priceCents?: number } {
  const m = PRICE_IN_TEXT.exec(text)
  const out: { note?: string; priceCents?: number } = {}
  let rest = text
  if (m) {
    const cents = Math.round(Number(m[1]!.replace(',', '.')) * 100)
    if (cents >= 1 && cents <= 1_000_000) {
      out.priceCents = cents
      rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ')
    }
  }
  const note = rest
    .trim()
    .replace(/^[-–:,]\s*/, '')
    .trim()
  if (note) out.note = note.slice(0, 300)
  return out
}

/**
 * Zelle „Verkauft“ lesen: leer/„nein“ = nicht verkauft; ein Datum (Excel-Datum, „11.10.2026“, „11.10.26“, „11.10.“)
 * oder „ja“/„x“/„verkauft“, jeweils gern mit Notiz dahinter. `year`: Jahr für „11.10.“.
 */
export function parseSold(
  value: CellValue,
  year: number,
): { sold: BestandProduct['sold'] | null } | { error: string } {
  if (value === null || value === undefined || value === false) return { sold: null }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { error: 'Datum nicht lesbar' }
    // Excel-Daten kommen als UTC-Mitternacht: Kalendertag in UTC lesen
    return { sold: { date: isoDay(excelDay(value)) } }
  }
  if (value === true) return { sold: {} }
  const text = String(value).trim()
  if (!text || fold(text) === NO) return { sold: null }
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?\s*(.*)$/s.exec(text)
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : year
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]))
    if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1)
      return { error: `Datum „${text}“ gibt es nicht` }
    return { sold: { date: isoDay(d), ...noteAndPrice(m[4]!) } }
  }
  const yes = /^(ja|x|verkauft|yes|sold)(?=$|[\s,:–-])[\s,:–-]*(.*)$/is.exec(text)
  if (yes) return { sold: noteAndPrice(yes[2]!) }
  // freier Text ohne „ja“/Datum: als verkauft mit Notiz (und ggf. Preis)
  return { sold: noteAndPrice(text) }
}

/** Werte einer Zeile (Spalten-Schlüssel → Zellwert) für ein Stück. */
export function rowOf(p: BestandProduct): Record<string, CellValue> {
  const d = p.dimensions
  return {
    nr: p.itemNumber,
    foto: null,
    kategorie: CATEGORY_DE[p.category],
    titleDe: p.title.de,
    titleEn: p.title.en,
    preis: euro(p.priceCents),
    breite: d.widthCm ?? null,
    hoehe: d.heightCm ?? null,
    tiefe: d.depthCm ?? null,
    durchmesser: d.diameterCm ?? null,
    masseHinweis: d.note?.de ?? '',
    gewicht: p.weightGrams,
    materialDe: p.materials.de,
    materialEn: p.materials.en,
    groesse: textile(p) ? (p.sizeLabel?.de ?? '') : '',
    zustand: textile(p) && p.condition ? CONDITION_DE[p.condition] : '',
    secondHand: textile(p) ? (p.isSecondHand ? YES : NO) : '',
    fasern: textile(p) ? fibersText(p.fiberComposition) : '',
    metall: p.category === 'schmuck' ? (p.metalPartsMaterial?.de ?? '') : '',
    abweichung: p.deviationDescription?.de ?? '',
    beschreibungDe: p.description.de,
    beschreibungEn: p.description.en,
    pruefen: p.review.map((r) => `• ${r}`).join('\n'),
    notiz: p.ownerNote ?? '',
    verkauft: soldText(p.sold),
  }
}

export type ApplyReport = PflegeReport

export { num }

const COLUMN = new Map(BESTAND_COLUMNS.map((c) => [c.key, c]))
const sameIn = (key: string) => (COLUMN.get(key)?.kind === 'num' ? sameNum : sameText)

export interface ApplyOptions {
  /** Jahr für „11.10.“ ohne Jahr (Berlin). */
  year: number
  /** Gemerkter Stand der Liste (Zeilen je Nr.); `null` = unbekannt → jeder Unterschied zählt (nur mit Freigabe). */
  base: SnapshotRows | null
}

const fmtEuro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

/** Kurzbeschreibung einer neuen Zeile ohne Nummer (Name, Kategorie, Preis, Notiz). */
function newRowSummary(row: Record<string, CellValue>): string {
  const parts = [
    str(row.titleDe) && `„${str(row.titleDe)}“`,
    str(row.kategorie),
    str(row.preis) && `${str(row.preis)} €`,
    str(row.notiz) && `Notiz: ${str(row.notiz)}`,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'ohne Namen'
}

/**
 * Zeilen aus Juttas Liste auf den Bestand anwenden. Gibt eine **neue** Liste zurück (Original unverändert) und den
 * Bericht. Zuordnung über „Nr.“; unbekannte Nummern, fehlende Zeilen und neue Zeilen werden gemeldet. Mit gemerktem
 * Stand (`base`) zählt nur, was Jutta gegenüber diesem Stand geändert hat (U-89 a).
 */
export function applyRows(
  products: readonly BestandProduct[],
  rows: readonly Record<string, CellValue>[],
  opts: ApplyOptions,
): { products: BestandProduct[]; report: ApplyReport } {
  const report = emptyReport()
  const next = products.map((p) => structuredClone(p))
  const byNr = new Map(next.map((p) => [p.itemNumber, p]))
  const seen = new Set<number>()
  for (const row of rows) {
    const nr = num(row.nr)
    if (nr === null) {
      if (Object.entries(row).some(([k, v]) => k !== 'foto' && str(v)))
        report.newEntries.push(
          `Neues Stück ${newRowSummary(row)} – bitte mit Fotos anlegen lassen.`,
        )
      continue
    }
    const p = Number.isInteger(nr) ? byNr.get(nr) : undefined
    if (!p) {
      report.problems.push(`Nr. ${str(row.nr)} gibt es im Bestand nicht – Zeile nicht übernommen.`)
      continue
    }
    if (seen.has(nr)) {
      report.problems.push(`Nr. ${nr} steht doppelt in der Liste – nur die erste Zeile übernommen.`)
      continue
    }
    seen.add(nr)
    const base = opts.base ? opts.base[String(nr)] : undefined
    applyRow(p, row, rowOf(p), opts.base ? (base ?? null) : null, report, opts)
  }
  for (const p of next)
    if (!seen.has(p.itemNumber) && (!opts.base || opts.base[String(p.itemNumber)]))
      report.problems.push(
        `Nr. ${p.itemNumber} fehlt in der Liste – bleibt unverändert (nicht gelöscht).`,
      )
  return { products: next, report }
}

function applyRow(
  p: BestandProduct,
  row: Record<string, CellValue>,
  before: Record<string, CellValue>,
  base: Record<string, CellValue> | null,
  report: ApplyReport,
  opts: { year: number },
) {
  const nr = `Nr. ${p.itemNumber}`
  const header = (key: string) => COLUMN.get(key)!.header
  const change = (what: string, from: string, to: string) =>
    report.changes.push(`${nr}: ${what} „${from || '–'}“ → „${to || '–'}“`)
  const bad = (what: string, value: CellValue, why: string) =>
    report.problems.push(`${nr}: ${what} „${str(value)}“ – ${why}; nicht übernommen.`)
  // Je Spalte einmal entscheiden (Dreiwege-Abgleich); Rückfragen genau einmal melden.
  const decisions = new Map<string, Decision>()
  const changed = (key: string): boolean => {
    if (!(key in row)) return false
    let d = decisions.get(key)
    if (d === undefined) {
      d = decide(row[key], base ? (base[key] ?? null) : NO_BASE, before[key], sameIn(key))
      decisions.set(key, d)
      if (d === 'conflict')
        report.conflicts.push(
          `${nr}: ${header(key)} – in deiner Liste „${str(row[key]) || '–'}“, inzwischen „${str(before[key]) || '–'}“. Was gilt?`,
        )
    }
    return d === 'apply'
  }

  // Pflicht-Texte DE/EN (nie leer; Namen 3–120 Zeichen wie in der Verwaltung)
  const pair = (
    deKey: string,
    enKey: string,
    target: { de: string; en: string },
    what: string,
    max = 5000,
    min = 1,
  ) => {
    const deChanged = changed(deKey)
    const enChanged = changed(enKey)
    for (const [key, lang, did] of [
      [deKey, 'de', deChanged],
      [enKey, 'en', enChanged],
    ] as const) {
      if (!did) continue
      const v = str(row[key])
      if (!v) {
        bad(header(key), row[key], 'darf nicht leer sein')
        continue
      }
      if (v.length < min || v.length > max) {
        bad(header(key), row[key], `bitte ${min}–${max} Zeichen`)
        continue
      }
      change(header(key), target[lang], v)
      target[lang] = v
    }
    if (deChanged && !enChanged) report.englishTodo.push(`${nr}: ${what} (Deutsch geändert)`)
  }
  pair('titleDe', 'titleEn', p.title, 'Name', 120, 3)
  pair('materialDe', 'materialEn', p.materials, 'Material')
  pair('beschreibungDe', 'beschreibungEn', p.description, 'Beschreibung')

  if (changed('kategorie')) {
    const v = str(row.kategorie)
    const cat = PRODUCT_CATEGORIES.find((c) => fold(CATEGORY_DE[c]) === fold(v) || c === fold(v))
    if (!cat)
      bad('Kategorie', row.kategorie, `bitte eine von: ${Object.values(CATEGORY_DE).join(', ')}`)
    else if (cat !== p.category) {
      report.problems.push(
        `${nr}: Kategorie „${CATEGORY_DE[p.category]}“ → „${v}“ – das ändert Pflichtangaben (Größe, Fasern, Lebensmittel, Schmuck); bitte im Chat bestätigen, nicht automatisch übernommen.`,
      )
    }
  }

  if (changed('preis')) {
    const v = num(row.preis)
    if (v === null || Number.isNaN(v) || v < 1 || v > 10_000)
      bad('Preis', row.preis, 'bitte einen Betrag zwischen 1 und 10.000 €')
    else {
      const cents = Math.round(v * 100)
      change('Preis', fmtEuro(p.priceCents / 100), fmtEuro(cents / 100))
      p.priceCents = cents
    }
  }

  const dims = [
    ['breite', 'widthCm'],
    ['hoehe', 'heightCm'],
    ['tiefe', 'depthCm'],
    ['durchmesser', 'diameterCm'],
  ] as const
  for (const [key, field] of dims) {
    if (!changed(key)) continue
    const v = num(row[key])
    if (v !== null && (Number.isNaN(v) || v <= 0 || v > 300))
      bad(header(key), row[key], 'bitte eine Zahl von 0,1 bis 300')
    else {
      const rounded = v === null ? null : Math.round(v * 10) / 10
      change(header(key), str(p.dimensions[field] ?? ''), rounded === null ? '' : String(rounded))
      if (rounded === null) delete p.dimensions[field]
      else p.dimensions[field] = rounded
    }
  }
  if (
    p.category !== 'textil' &&
    p.category !== 'cap' &&
    !['widthCm', 'heightCm', 'depthCm', 'diameterCm'].some(
      (f) => typeof p.dimensions[f as keyof typeof p.dimensions] === 'number',
    )
  ) {
    report.problems.push(
      `${nr}: mindestens ein Maß ist Pflicht – alle Maße leer gelassen, alte Werte bleiben.`,
    )
    for (const [key, field] of dims) {
      const old = num(before[key])
      if (old !== null) p.dimensions[field] = old
    }
  }
  if (changed('masseHinweis')) {
    const v = str(row.masseHinweis)
    change('Maße – Hinweis', p.dimensions.note?.de ?? '', v)
    if (!v) delete p.dimensions.note
    else {
      p.dimensions.note = { de: v, en: p.dimensions.note?.en ?? v }
      report.englishTodo.push(`${nr}: Maße – Hinweis (Deutsch geändert)`)
    }
  }

  if (changed('gewicht')) {
    const v = num(row.gewicht)
    if (v === null || Number.isNaN(v) || v < 1 || v > 100_000)
      bad('Gewicht', row.gewicht, 'bitte Gramm als ganze Zahl')
    else {
      change('Gewicht (g)', String(p.weightGrams), String(Math.round(v)))
      p.weightGrams = Math.round(v)
    }
  }

  const onlyFor = (key: string, ok: boolean, what: string) => {
    if (!changed(key) || ok) return false
    if (str(row[key])) bad(header(key), row[key], `gilt nur für ${what}`)
    return true
  }
  if (!onlyFor('groesse', textile(p), 'Textil und Caps') && changed('groesse')) {
    const v = str(row.groesse)
    change('Größe', p.sizeLabel?.de ?? '', v)
    if (!v) delete p.sizeLabel
    else {
      // Größen wie „M“, „S/M“, „42“ gelten in beiden Sprachen; Wörter übersetzt Claude
      const code = /^[A-Z0-9/ .,-]{1,12}$/i.test(v) && !/[a-z]{3,}/i.test(v)
      p.sizeLabel = { de: v, en: code ? v : (p.sizeLabel?.en ?? v) }
      if (!code) report.englishTodo.push(`${nr}: Größe (Deutsch geändert)`)
    }
  }
  if (!onlyFor('zustand', textile(p), 'Textil und Caps') && changed('zustand')) {
    const v = str(row.zustand)
    const c = TEXTILE_CONDITIONS.find((k) => fold(CONDITION_DE[k]) === fold(v))
    if (!v) {
      change('Zustand', p.condition ? CONDITION_DE[p.condition] : '', '')
      delete p.condition
    } else if (!c)
      bad('Zustand', row.zustand, `bitte eine von: ${Object.values(CONDITION_DE).join(', ')}`)
    else {
      change('Zustand', p.condition ? CONDITION_DE[p.condition] : '', CONDITION_DE[c])
      p.condition = c
    }
  }
  if (!onlyFor('secondHand', textile(p), 'Textil und Caps') && changed('secondHand')) {
    const v = fold(str(row.secondHand))
    if (v !== YES && v !== NO) bad('Second Hand', row.secondHand, '„ja“ oder „nein“')
    else {
      change('Second Hand', p.isSecondHand ? YES : NO, v)
      p.isSecondHand = v === YES
    }
  }
  if (!onlyFor('fasern', textile(p), 'Textil und Caps') && changed('fasern')) {
    const v = str(row.fasern)
    if (!v) {
      change('Fasern', fibersText(p.fiberComposition), '')
      delete p.fiberComposition
    } else {
      const parsed = parseFibers(v)
      if ('error' in parsed) bad('Fasern', row.fasern, parsed.error)
      else {
        change('Fasern', fibersText(p.fiberComposition), fibersText(parsed.rows))
        p.fiberComposition = parsed.rows
      }
    }
  }
  if (!onlyFor('metall', p.category === 'schmuck', 'Schmuck') && changed('metall')) {
    const v = str(row.metall)
    if (v && (v.length < 3 || v.length > 120)) bad('Metallteile', row.metall, 'bitte 3–120 Zeichen')
    else if (!v) {
      change('Metallteile', p.metalPartsMaterial?.de ?? '', v)
      delete p.metalPartsMaterial
    } else {
      change('Metallteile', p.metalPartsMaterial?.de ?? '', v)
      p.metalPartsMaterial = { de: v }
      report.englishTodo.push(`${nr}: Metallteile (neu, Englisch fehlt)`)
    }
  }
  if (changed('abweichung')) {
    const v = str(row.abweichung)
    change('Macke / Abweichung', p.deviationDescription?.de ?? '', v)
    if (!v) {
      delete p.deviationDescription
      p.deviationDecision = 'none'
    } else {
      p.deviationDescription = { de: v, en: p.deviationDescription?.en ?? v }
      p.deviationDecision = 'described'
      report.englishTodo.push(`${nr}: Macke / Abweichung (Deutsch geändert)`)
    }
  }
  if (changed('notiz')) {
    const v = str(row.notiz).slice(0, 500)
    change('Deine Notiz', p.ownerNote ?? '', v)
    if (!v) delete p.ownerNote
    else p.ownerNote = v
  }
  if (changed('verkauft')) {
    const parsed = parseSold(row.verkauft, opts.year)
    if ('error' in parsed) bad('Verkauft', row.verkauft, parsed.error)
    else {
      change('Verkauft', soldText(p.sold), soldText(parsed.sold ?? undefined))
      if (parsed.sold) p.sold = parsed.sold
      else delete p.sold
    }
  }
  // Spalten nur zum Lesen: Änderungen melden, nie übernehmen (auch keine Rückfrage)
  for (const c of BESTAND_COLUMNS) {
    if (!c.readOnly || c.key === 'foto' || c.key === 'nr' || !(c.key in row)) continue
    const same = sameIn(c.key)
    const ref = base ? (base[c.key] ?? null) : before[c.key]
    if (!same(row[c.key], ref) && !same(row[c.key], before[c.key]))
      report.problems.push(`${nr}: „${c.header}“ ist nur zum Lesen – Änderung nicht übernommen.`)
  }
}
