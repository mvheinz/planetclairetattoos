import 'server-only'

import { formatBerlin } from '@/lib/time'

// Gemeinsame Formatregeln der Exporte (KONZEPT §7.15, R-124): Dezimalkomma ohne Tausenderpunkte, Datum `TT.MM.JJJJ`
// (Europe/Berlin), Trennzeichen `;`, Zeilenende CRLF. Gleiche Eingaben ergeben byte-identische Dateien.

export const CSV_SEPARATOR = ';'
export const CRLF = '\r\n'
export const UTF8_BOM = '﻿'

/** Cent → „1234,50“ bzw. „-45,00“ (Integer-Rechnung, keine Fließkommazahlen). */
export function decimalComma(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error(`Betrag in Cent erwartet: ${String(cents)}`)
  const abs = Math.abs(cents)
  const s = `${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
  return cents < 0 ? `-${s}` : s
}

/** Datum `TT.MM.JJJJ` in Europe/Berlin; leer ohne Wert. */
export function berlinDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? '' : formatBerlin(d, 'dd.MM.yyyy')
}

/** Feld nach RFC 4180 quoten, wenn nötig (Trennzeichen, Anführungszeichen, Zeilenumbruch). */
export function csvField(value: string, separator = CSV_SEPARATOR): string {
  return value.includes(separator) || /["\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value
}

export function csvLine(fields: readonly string[], separator = CSV_SEPARATOR): string {
  return fields.map((f) => csvField(f, separator)).join(separator) + CRLF
}

/** Monatsschlüssel `JJJJ-MM` prüfen. */
export const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
