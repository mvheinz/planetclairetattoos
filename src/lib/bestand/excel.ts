import {
  FIBER_COMPONENTS,
  PRODUCT_CATEGORIES,
  TEXTILE_CONDITIONS,
  TEXTILE_FIBERS,
} from '@/lib/enums'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { lintProductText } from '@/lib/legal/forbidden'
import { newForbiddenHits } from '@/lib/legal/forbiddenContent'
import {
  excelDay,
  fold,
  isoDay,
  num,
  str,
  UNREADABLE,
  type CellValue,
  type SheetRow,
} from '@/lib/pflege/cells'
import { decide, emptyReport, NO_BASE, type Decision, type PflegeReport } from '@/lib/pflege/merge'
import { hasCareTemplate } from '@/lib/products/categoryRules'
import { isEstimatedDimensionsNote } from '@/lib/products/measure'
import type { ConsumedCells, SnapshotRows } from '@/lib/pflege/snapshot'

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
    hint: 'z. B. „Edelstahl 316L“',
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
  // V-22 a (U-93): eigener Satz, Claudes Vorschlag (nur zum Lesen) und das Übernehmen per „ja“
  {
    key: 'wortVonMir',
    header: 'Ein Wort von mir',
    width: 44,
    wrap: true,
    hint: 'Ein, zwei Sätze von dir in Ich-Form (höchstens 280 Zeichen) – stehen auf der Produktseite. Leer = kein Satz.',
  },
  {
    key: 'vorschlag',
    header: 'Vorschlag: Ein Wort von mir',
    width: 44,
    wrap: true,
    readOnly: true,
    hint: 'Vorschlag von Claude – erscheint nie von selbst. Übernehmen: rechts daneben „ja“.',
  },
  {
    key: 'vorschlagUebernehmen',
    header: 'Vorschlag übernehmen',
    width: 12,
    list: [YES, NO],
    hint: '„ja“ = der Vorschlag (Deutsch und Englisch) wird dein „Ein Wort von mir“. Leer oder „nein“ = nichts passiert. Schreibst du selbst etwas in „Ein Wort von mir“, gilt dein Text.',
  },
  // V-23: Pflege je Stück – leer = die feste Pflegezeile der Stückart aus den Einstellungen
  {
    key: 'pflege',
    header: 'Pflege',
    width: 34,
    wrap: true,
    hint: 'Nur Keramik, Schmuck, Textil und Caps. Leer = die feste Pflegezeile der Stückart (z. B. Keramik: feucht abwischen, nicht in die Spülmaschine).',
  },
  { key: 'pruefen', header: 'Bitte prüfen', width: 60, wrap: true, readOnly: true },
  { key: 'notiz', header: 'Deine Notiz', width: 30, wrap: true },
  {
    key: 'verkauft',
    header: 'Verkauft',
    width: 16,
    hint: 'Datum (z. B. 11.10.2026) oder „ja“, gern mit Preis und kurzer Notiz (z. B. „11.10.2026 35 € Markt“) – leer = noch da. Bitte keine Namen von Käufer:innen.',
  },
  {
    key: 'insArchiv',
    header: 'ins Archiv',
    width: 11,
    list: [YES, NO],
    hint: 'Nur bei verkauften Stücken: „ja“ = mit sold-Stempel im Archiv zeigen (bitte nur, wenn Maße und Angaben stimmen). Leer = nicht im Archiv.',
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

/** Verkaufsjahr plausibel? Nicht in der Zukunft, nicht mehr als fünf Jahre zurück. */
function saleYearIssue(y: number, year: number): string | null {
  if (y > year) return 'liegt in der Zukunft – bitte prüfen'
  if (y < year - 5) return 'liegt lange zurück – bitte prüfen'
  return null
}

/** Bezugszeit beim Zurückspielen: Jahr für „11.10.“ und heutiger Tag in Berlin (`JJJJ-MM-TT`, gegen Zukunftsdaten). */
export interface SoldClock {
  year: number
  today?: string
}

/** Wörter, die „noch da“ bedeuten (nie als verkauft lesen). */
const NOT_SOLD = /^(nein|no|nope|nicht|noch|offen|frei|verfugbar|available|reserviert)\b/

/**
 * Zelle „Verkauft“ lesen – streng, damit nie ein Stück versehentlich als verkauft gilt: leer, „nein“, „noch da“, „-“, „0“
 * = nicht verkauft; verkauft nur mit Datum (Excel-Datum, „11.10.2026“, „11.10.26“, „11.10.“) oder „ja“/„x“/„verkauft“ am
 * Anfang, jeweils gern mit Preis und Notiz dahinter. Anderer Text ist ein Fehler (Meldung, nichts geändert). „11.10.“
 * ohne Jahr: dieses Jahr, liegt der Tag noch vor uns, das Vorjahr; ein Datum in der Zukunft ist ein Fehler.
 */
export function parseSold(
  value: CellValue,
  clock: number | SoldClock,
): { sold: BestandProduct['sold'] | null } | { error: string } {
  const { year, today } = typeof clock === 'number' ? { year: clock, today: undefined } : clock
  if (value === null || value === undefined || value === false) return { sold: null }
  const future = (iso: string) => today !== undefined && iso > today
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { error: 'Datum nicht lesbar' }
    // Excel-Daten kommen als UTC-Mitternacht: Kalendertag in UTC lesen
    const day = excelDay(value)
    const off = future(isoDay(day))
      ? 'liegt in der Zukunft – bitte prüfen'
      : saleYearIssue(day.getFullYear(), year)
    if (off) return { error: `Datum „${str(value)}“ ${off}` }
    return { sold: { date: isoDay(day) } }
  }
  if (value === true) return { sold: {} }
  // Eine reine Zahl (Numbers/Excel machen aus „35 €“ oft 35, aus „11.10“ 11,1) ist nicht eindeutig
  if (typeof value === 'number')
    return value === 0
      ? { sold: null }
      : {
          error:
            'bitte ein Datum (11.10.2026) oder „ja“ eintragen, Preis dahinter (z. B. „ja 35 €“)',
        }
  const text = String(value).trim()
  if (!text || NOT_SOLD.test(fold(text)) || /^[-–—0.\s]+$/.test(text)) return { sold: null }
  // „11.10.2026“, „11.10.26“, „11.10.“ – eine Jahreszahl nur mit Leerzeichen/Ende dahinter und nicht vor „€“
  const m = /^(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?=\s|$)(?!\s*(?:€|eur)))?(.*)$/is.exec(text)
  if (m) {
    const rest = m[4]!
    if (/^\d/.test(rest) && !/^\d{1,5}(?:[.,]\d{1,2})?\s*(?:€|eur)/i.test(rest))
      return { error: `Datum „${text}“ bitte prüfen (z. B. 11.10.2026)` }
    const explicit = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null
    const make = (y: number) => new Date(y, Number(m[2]) - 1, Number(m[1]))
    let d = make(explicit ?? year)
    if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1)
      return { error: `Datum „${text}“ gibt es nicht` }
    // „20.12.“ im Januar eingetragen: der Markt im Dezember davor
    if (explicit === null && future(isoDay(d))) d = make(year - 1)
    const off = future(isoDay(d))
      ? 'liegt in der Zukunft – bitte prüfen'
      : saleYearIssue(d.getFullYear(), year)
    if (off) return { error: `Datum „${text}“ ${off}` }
    return { sold: { date: isoDay(d), ...noteAndPrice(rest) } }
  }
  const yes = /^(ja|x|verkauft|yes|sold|✓|✔)(?=$|[\s,:–-])[\s,:–-]*(.*)$/is.exec(text)
  if (yes) return { sold: noteAndPrice(yes[2]!) }
  return {
    error:
      'bitte ein Datum oder „ja“ voranstellen (z. B. „ja Markt“); sonst gilt es nicht als verkauft',
  }
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
    wortVonMir: p.juttaSays?.de ?? '',
    vorschlag: p.juttaSaysSuggestion?.de ?? '',
    // Eine Aktion, kein Zustand: nie vorangekreuzt
    vorschlagUebernehmen: '',
    pflege: hasCareTemplate(p.category) ? (p.careInstructions?.de ?? '') : '',
    pruefen: p.review.map((r) => `• ${r}`).join('\n'),
    notiz: p.ownerNote ?? '',
    verkauft: soldText(p.sold),
    // V-11: nie vorangekreuzt – „ja“ nur, wenn Jutta es selbst angekreuzt hat
    insArchiv: p.sold?.archive ? YES : '',
  }
}

/** „ins Archiv“/„Vorschlag übernehmen“ lesen: „ja“/„x“/Häkchen = angekreuzt; leer/„nein“ = nicht; anderes → `null` (Fehler). */
function archiveTick(v: CellValue): boolean | null {
  if (v === true) return true
  if (v === false || v === null || v === undefined) return false
  const t = fold(str(v))
  if (!t || t === NO || t === 'no' || t === '-') return false
  if (t === YES || t === 'x' || t === 'yes' || t === '✓' || t === '✔') return true
  return null
}

export type ApplyReport = PflegeReport

export { num }

const COLUMN = new Map(BESTAND_COLUMNS.map((c) => [c.key, c]))

const categoryOf = (v: string) =>
  PRODUCT_CATEGORIES.find((c) => fold(CATEGORY_DE[c]) === fold(v) || c === fold(v))
const conditionOf = (v: string) => TEXTILE_CONDITIONS.find((k) => fold(CONDITION_DE[k]) === fold(v))

/** Zahl einer Zelle als Text, gerundet wie beim Speichern (`?` = keine Zahl). */
function canonNum(v: CellValue, factor: number): string {
  const n = num(v)
  if (n === null) return ''
  return Number.isNaN(n) ? `?${str(v)}` : String(Math.round(n * factor) / factor)
}

/**
 * Kanonische Form einer Zelle – so, wie sie nach dem Übernehmen in der Liste stünde (U-89 c): „100% Baumwolle“ =
 * „100 % Baumwolle“, „Nein“ = „nein“, Häkchen = „ja“, 12,34 cm = 12,3 cm, ein Excel-Datum = „TT.MM.JJJJ“ usw. Damit
 * führt dieselbe Liste beim zweiten Zurückspielen nie zu Rückfragen.
 */
export function canonical(key: string, v: CellValue, clock: number | SoldClock): string {
  switch (key) {
    case 'verkauft': {
      const r = parseSold(v, clock)
      return 'error' in r ? `?${str(v)}` : soldText(r.sold ?? undefined)
    }
    case 'fasern': {
      const t = str(v)
      const r = t ? parseFibers(t) : null
      return !r ? '' : 'error' in r ? `?${t}` : fibersText(r.rows)
    }
    case 'secondHand':
      return v === true ? YES : v === false ? NO : fold(str(v))
    case 'insArchiv':
    case 'vorschlagUebernehmen': {
      const tick = archiveTick(v)
      return tick === null ? `?${str(v)}` : tick ? YES : ''
    }
    case 'zustand': {
      const c = conditionOf(str(v))
      return c ? CONDITION_DE[c] : str(v)
    }
    case 'kategorie': {
      const c = categoryOf(str(v))
      return c ? CATEGORY_DE[c] : str(v)
    }
    case 'preis':
      return canonNum(v, 100)
    case 'nr':
    case 'gewicht':
      return canonNum(v, 1)
    case 'breite':
    case 'hoehe':
    case 'tiefe':
    case 'durchmesser':
      return canonNum(v, 10)
    default:
      return str(v)
  }
}

/** Vergleich je Spalte über die kanonische Form. */
export function sameFor(
  key: string,
  clock: number | SoldClock,
): (a: CellValue, b: CellValue) => boolean {
  return (a, b) => canonical(key, a, clock) === canonical(key, b, clock)
}

/** Zeilen des gemerkten Stands: Werte der Liste und der feste Schlüssel des Stücks (`_key`, gegen Umnummerieren). */
export function snapshotRowsOf(
  products: readonly BestandProduct[],
): Map<string, Record<string, CellValue>> {
  return new Map(products.map((p) => [String(p.itemNumber), { ...rowOf(p), _key: p.key }]))
}

export interface ApplyOptions {
  /** Jahr für „11.10.“ ohne Jahr (Berlin). */
  year: number
  /** Heutiger Tag in Berlin (`JJJJ-MM-TT`): kein Verkauf in der Zukunft. */
  today?: string
  /** Gemerkter Stand der Liste (Zeilen je Nr.); `null` = unbekannt → jeder Unterschied zählt (nur mit Freigabe). */
  base: SnapshotRows | null
  /** Schon übernommene Werte aus dieser Liste (U-89 c). */
  consumed?: ConsumedCells
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
 * Rechtliche Prüfung eines neuen Textes (RECHT §5): neue Treffer der Verbotsliste; bei öffentlichen Texten zusätzlich
 * unbelegte Aussagen und fremde Marken (V-13, V-16). Treffer, die schon der alte Text hatte, zählen nicht.
 */
export function legalIssue(old: string, value: string, isPublic: boolean): string | null {
  const hits = newForbiddenHits(old, value)
  if (hits.length)
    return `enthält eine verbotene Formulierung (${hits.join(', ')}, siehe Rechtsliste)`
  if (!isPublic) return null
  const before = new Set(lintProductText(old).map((h) => h.label))
  const added = lintProductText(value).filter((h) => !before.has(h.label))
  if (added.length)
    return `enthält „${added.map((h) => h.label).join('“, „')}“ – solche Aussagen bzw. fremde Marken gehen nur mit Nachweis`
  return null
}

/**
 * Zeilen aus Juttas Liste auf den Bestand anwenden. Gibt eine **neue** Liste zurück (Original unverändert) und den
 * Bericht. Zuordnung über „Nr.“; unbekannte Nummern, fehlende Zeilen und neue Zeilen werden gemeldet. Mit gemerktem
 * Stand (`base`) zählt nur, was Jutta gegenüber diesem Stand geändert hat (U-89 a); eine Nummer, die beim Ausgeben
 * nicht in der Liste stand oder inzwischen zu einem anderen Stück gehört, wird nicht angewendet.
 */
export function applyRows(
  products: readonly BestandProduct[],
  rows: readonly SheetRow[],
  opts: ApplyOptions,
): { products: BestandProduct[]; report: ApplyReport } {
  const report = emptyReport()
  const next = products.map((p) => structuredClone(p))
  const byNr = new Map(next.map((p) => [p.itemNumber, p]))
  const seen = new Set<number>()
  for (const row of rows) {
    const nr = num(row.nr)
    if (nr === null) {
      const unreadable = row[UNREADABLE]?.nr
      if (unreadable)
        report.problems.push(`Eine Zeile hat keine lesbare Nr. (${unreadable}) – nicht übernommen.`)
      else if (Object.entries(row).some(([k, v]) => k !== 'foto' && str(v)))
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
    let base: Record<string, CellValue> | null = null
    if (opts.base) {
      const b = opts.base[String(nr)]
      if (!b) {
        report.problems.push(
          `Nr. ${nr} stand nicht in dieser Liste, als sie ausgegeben wurde – Zeile nicht übernommen, bitte klären.`,
        )
        continue
      }
      if (typeof b._key === 'string' && b._key !== p.key) {
        report.problems.push(
          `Nr. ${nr} gehörte beim Ausgeben der Liste zu einem anderen Stück – Zeile nicht übernommen, bitte klären.`,
        )
        continue
      }
      base = b
    }
    applyRow(p, row, rowOf(p), base, opts.consumed?.[String(nr)] ?? {}, report, opts)
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
  row: SheetRow,
  before: Record<string, CellValue>,
  base: Record<string, CellValue> | null,
  consumed: Readonly<Record<string, readonly CellValue[]>>,
  report: ApplyReport,
  opts: { year: number; today?: string },
) {
  const clock: SoldClock = { year: opts.year, ...(opts.today ? { today: opts.today } : {}) }
  const nr = `Nr. ${p.itemNumber}`
  const header = (key: string) => COLUMN.get(key)?.header ?? key
  const change = (what: string, from: string, to: string) =>
    report.changes.push(`${nr}: ${what} „${from || '–'}“ → „${to || '–'}“`)
  const bad = (what: string, value: CellValue, why: string) =>
    report.problems.push(`${nr}: ${what} „${str(value)}“ – ${why}; nicht übernommen.`)
  for (const [key, why] of Object.entries(row[UNREADABLE] ?? {}))
    report.problems.push(`${nr}: ${header(key)} – ${why}; nicht übernommen.`)
  // Je Spalte einmal entscheiden (Dreiwege-Abgleich); Rückfragen genau einmal melden.
  const decisions = new Map<string, Decision>()
  const changed = (key: string): boolean => {
    if (!(key in row)) return false
    let d = decisions.get(key)
    if (d === undefined) {
      d = decide(
        row[key],
        base ? (base[key] ?? null) : NO_BASE,
        before[key],
        sameFor(key, clock),
        consumed[key] ?? [],
      )
      decisions.set(key, d)
      if (d === 'conflict')
        report.conflicts.push(
          `${nr}: ${header(key)} – in deiner Liste „${str(row[key]) || '–'}“, inzwischen „${str(before[key]) || '–'}“. Was gilt?`,
        )
    }
    return d === 'apply'
  }
  /** Rechtlich prüfen; bei Treffer melden und `false`. */
  const legal = (key: string, old: string, value: string, isPublic = true): boolean => {
    const issue = legalIssue(old, value, isPublic)
    if (issue) bad(header(key), row[key], issue)
    return !issue
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
    const applied = { de: false, en: false }
    for (const [key, lang] of [
      [deKey, 'de'],
      [enKey, 'en'],
    ] as const) {
      if (!changed(key)) continue
      const v = str(row[key])
      if (!v) bad(header(key), row[key], 'darf nicht leer sein')
      else if (v.length < min || v.length > max)
        bad(header(key), row[key], `bitte ${min}–${max} Zeichen`)
      else if (legal(key, target[lang], v)) {
        change(header(key), target[lang], v)
        target[lang] = v
        applied[lang] = true
      }
    }
    // Englisch nachziehen, wenn das Deutsche geschrieben wurde, das Englische aber nicht (U-00)
    if (applied.de && !applied.en) report.englishTodo.push(`${nr}: ${what} (Deutsch geändert)`)
  }
  pair('titleDe', 'titleEn', p.title, 'Name', 120, 3)
  pair('materialDe', 'materialEn', p.materials, 'Material')
  pair('beschreibungDe', 'beschreibungEn', p.description, 'Beschreibung')

  if (changed('kategorie')) {
    const v = str(row.kategorie)
    const cat = categoryOf(v)
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

  // Maße: erst alle prüfen; bliebe kein Maß übrig (Pflicht außer bei Textil/Caps), nichts davon übernehmen
  const dims = [
    ['breite', 'widthCm'],
    ['hoehe', 'heightCm'],
    ['tiefe', 'depthCm'],
    ['durchmesser', 'diameterCm'],
  ] as const
  const dimUpdates: [(typeof dims)[number], number | null][] = []
  for (const d of dims) {
    const [key] = d
    if (!changed(key)) continue
    const v = num(row[key])
    if (v !== null && (Number.isNaN(v) || v <= 0 || v > 300))
      bad(header(key), row[key], 'bitte eine Zahl von 0,1 bis 300')
    else dimUpdates.push([d, v === null ? null : Math.round(v * 10) / 10])
  }
  if (dimUpdates.length) {
    const after = { ...p.dimensions }
    for (const [[, field], v] of dimUpdates) {
      if (v === null) delete after[field]
      else after[field] = v
    }
    if (!textile(p) && !dims.some(([, f]) => typeof after[f] === 'number'))
      report.problems.push(
        `${nr}: mindestens ein Maß ist Pflicht – alle Maße leer gelassen, alte Werte bleiben.`,
      )
    else {
      for (const [[key, field], v] of dimUpdates) {
        change(header(key), str(p.dimensions[field] ?? ''), v === null ? '' : String(v))
        if (v === null) delete p.dimensions[field]
        else p.dimensions[field] = v
      }
      // V-15: Eine neue Zahl heißt „nachgemessen“ – der Vermerk „Maße geschätzt“ fällt weg, wenn Jutta den Hinweis
      // nicht selbst geändert hat (dann gilt ihr Text; bei einer Rückfrage bleibt alles, wie es ist).
      if (
        !changed('masseHinweis') &&
        decisions.get('masseHinweis') !== 'conflict' &&
        isEstimatedDimensionsNote(p.dimensions.note?.de)
      ) {
        change('Maße – Hinweis', p.dimensions.note?.de ?? '', '')
        delete p.dimensions.note
      }
    }
  }
  if (changed('masseHinweis')) {
    const v = str(row.masseHinweis)
    if (legal('masseHinweis', p.dimensions.note?.de ?? '', v)) {
      change('Maße – Hinweis', p.dimensions.note?.de ?? '', v)
      if (!v) delete p.dimensions.note
      else {
        p.dimensions.note = { de: v, en: p.dimensions.note?.en ?? v }
        report.englishTodo.push(`${nr}: Maße – Hinweis (Deutsch geändert)`)
      }
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
    if (legal('groesse', p.sizeLabel?.de ?? '', v)) {
      change('Größe', p.sizeLabel?.de ?? '', v)
      if (!v) delete p.sizeLabel
      else {
        // Größen wie „M“, „S/M“, „42“ gelten in beiden Sprachen; Wörter übersetzt Claude
        const code = /^[A-Z0-9/ .,-]{1,12}$/i.test(v) && !/[a-z]{3,}/i.test(v)
        p.sizeLabel = { de: v, en: code ? v : (p.sizeLabel?.en ?? v) }
        if (!code) report.englishTodo.push(`${nr}: Größe (Deutsch geändert)`)
      }
    }
  }
  if (!onlyFor('zustand', textile(p), 'Textil und Caps') && changed('zustand')) {
    const v = str(row.zustand)
    const c = conditionOf(v)
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
    const v = canonical('secondHand', row.secondHand, clock)
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
    else if (legal('metall', p.metalPartsMaterial?.de ?? '', v)) {
      change('Metallteile', p.metalPartsMaterial?.de ?? '', v)
      if (!v) delete p.metalPartsMaterial
      else {
        p.metalPartsMaterial = { de: v }
        report.englishTodo.push(`${nr}: Metallteile (Deutsch geändert, Englisch fehlt)`)
      }
    }
  }
  if (changed('abweichung')) {
    const v = str(row.abweichung)
    if (legal('abweichung', p.deviationDescription?.de ?? '', v)) {
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
  }
  // V-22 a: „Ein Wort von mir“ – eigener Text gilt vor „Vorschlag übernehmen“
  const ownWord = changed('wortVonMir')
  if (ownWord) {
    const v = str(row.wortVonMir)
    if (v.length > 280) bad('Ein Wort von mir', row.wortVonMir, 'bitte höchstens 280 Zeichen')
    else if (legal('wortVonMir', p.juttaSays?.de ?? '', v)) {
      change('Ein Wort von mir', p.juttaSays?.de ?? '', v)
      if (!v) delete p.juttaSays
      else {
        // Das Englische schreibt Claude neu – der alte englische Satz passt nicht mehr (U-00)
        p.juttaSays = { de: v }
        report.englishTodo.push(`${nr}: Ein Wort von mir (Deutsch geändert)`)
      }
    }
  }
  if (changed('vorschlagUebernehmen')) {
    const tick = archiveTick(row.vorschlagUebernehmen)
    const s = p.juttaSaysSuggestion
    if (tick === null)
      bad('Vorschlag übernehmen', row.vorschlagUebernehmen, '„ja“ oder leer lassen')
    else if (tick && !s)
      bad(
        'Vorschlag übernehmen',
        row.vorschlagUebernehmen,
        'für dieses Stück gibt es keinen Vorschlag',
      )
    else if (tick && ownWord && str(row.wortVonMir))
      report.problems.push(
        `${nr}: „Vorschlag übernehmen“ und eigener Text in „Ein Wort von mir“ – dein eigener Text gilt.`,
      )
    else if (tick && s && (p.juttaSays?.de !== s.de || p.juttaSays?.en !== s.en)) {
      change('Ein Wort von mir', p.juttaSays?.de ?? '', s.de)
      p.juttaSays = { de: s.de, en: s.en }
    }
  }
  if (
    !onlyFor('pflege', hasCareTemplate(p.category), 'Keramik, Schmuck, Textil und Caps') &&
    changed('pflege')
  ) {
    const v = str(row.pflege)
    if (v.length > 500) bad('Pflege', row.pflege, 'bitte höchstens 500 Zeichen')
    else if (legal('pflege', p.careInstructions?.de ?? '', v)) {
      change('Pflege', p.careInstructions?.de ?? '', v)
      // Leer = feste Pflegezeile der Stückart (nie mit einer leeren Zeile überschreiben)
      if (!v) delete p.careInstructions
      else {
        p.careInstructions = { de: v, en: p.careInstructions?.en ?? v }
        report.englishTodo.push(`${nr}: Pflege (Deutsch geändert)`)
      }
    }
  }
  if (changed('notiz')) {
    const v = str(row.notiz).slice(0, 500)
    if (legal('notiz', p.ownerNote ?? '', v, false)) {
      change('Deine Notiz', p.ownerNote ?? '', v)
      if (!v) delete p.ownerNote
      else p.ownerNote = v
    }
  }
  if (changed('verkauft')) {
    const parsed = parseSold(row.verkauft, clock)
    if ('error' in parsed) bad('Verkauft', row.verkauft, parsed.error)
    else if (legal('verkauft', p.sold?.note ?? '', parsed.sold?.note ?? '', false)) {
      change('Verkauft', soldText(p.sold), soldText(parsed.sold ?? undefined))
      // Häkchen „ins Archiv“ bleibt beim Ändern von Datum/Preis/Notiz erhalten (V-11)
      if (parsed.sold) p.sold = { ...parsed.sold, ...(p.sold?.archive ? { archive: true } : {}) }
      else delete p.sold
    }
  }
  if (changed('insArchiv')) {
    const tick = archiveTick(row.insArchiv)
    if (tick === null) bad('ins Archiv', row.insArchiv, '„ja“ oder leer lassen')
    else if (tick && !p.sold)
      bad('ins Archiv', row.insArchiv, 'gilt nur für verkaufte Stücke (Spalte „Verkauft“)')
    else if (p.sold && tick !== (p.sold.archive === true)) {
      change('ins Archiv', p.sold.archive ? YES : '', tick ? YES : '')
      if (tick) p.sold.archive = true
      else delete p.sold.archive
    }
  }
  // Spalten nur zum Lesen: Änderungen melden, nie übernehmen (auch keine Rückfrage)
  for (const c of BESTAND_COLUMNS) {
    if (!c.readOnly || c.key === 'foto' || c.key === 'nr' || !(c.key in row)) continue
    const same = sameFor(c.key, clock)
    const ref = base ? (base[c.key] ?? null) : before[c.key]
    if (!same(row[c.key], ref) && !same(row[c.key], before[c.key]))
      report.problems.push(`${nr}: „${c.header}“ ist nur zum Lesen – Änderung nicht übernommen.`)
  }
}
