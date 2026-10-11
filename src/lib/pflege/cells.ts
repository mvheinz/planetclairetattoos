// Pflege per Excel (U-85–U-89): Zellwerte vergleichen und lesen – gemeinsam für Bestands- und Texte-Liste. Reine
// Funktionen ohne Excel-Bibliothek. Numbers und Excel liefern Zahlen mal als Zahl, mal als Text („12,5“), Zeilenumbrüche
// als `\r\n` oder `\n` und Daten als UTC-Mitternacht; verglichen wird deshalb immer normalisiert.

export type CellValue = string | number | boolean | Date | null | undefined
/** Was im gemerkten Stand (JSON) steht. */
export type StoredCell = string | number | boolean | null

/** Kalendertag `JJJJ-MM-TT` (Ortszeit des Date-Objekts). */
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Excel-Datum (UTC-Mitternacht) als Kalendertag. */
export const excelDay = (d: Date): Date =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/** Zelle als Text (getrimmt, Zeilenumbrüche vereinheitlicht, geschützte Leerzeichen als Leerzeichen). */
export function str(v: CellValue): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : isoDay(excelDay(v))
  return String(v).replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim()
}

/** Zahl aus einer Zelle (auch „12,5“, „49,50 €“, „1.200“ als Tausender); leer → null; sonst NaN. */
export function num(v: CellValue): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN
  if (typeof v === 'boolean' || v instanceof Date) return Number.NaN
  let s = String(v)
    .trim()
    .replace(/[\s ]|€|eur$|cm$|g$/gi, '')
  if (!s) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '') // 1.200,50
  s = s.replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN
}

export const sameText = (a: CellValue, b: CellValue): boolean => str(a) === str(b)

export const sameNum = (a: CellValue, b: CellValue): boolean => {
  const x = num(a)
  const y = num(b)
  if (x === null || y === null) return x === y
  if (Number.isNaN(x) || Number.isNaN(y)) return sameText(a, b)
  return Math.abs(x - y) < 1e-9
}

/** Für den gemerkten Stand: nur JSON-taugliche Werte. */
export function storable(v: CellValue): StoredCell {
  if (v === undefined) return null
  if (v instanceof Date) return str(v)
  return v
}

/** Text ohne Akzente, klein, Leerraum zusammengefasst – für Auswahllisten und Kopfzeilen. */
export const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s ]+/g, ' ')
    .trim()
