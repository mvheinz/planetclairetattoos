// Zeitquelle und Berliner Kalender (ARCHITEKTUR §3.9, A-08). DB speichert UTC, Anzeige Europe/Berlin (CLAUDE.md §6).
// Reines Hilfsmodul ohne Server-Zugriff: auch für Client und Verhaltensmodule importierbar.
import { TZDate } from '@date-fns/tz'
import {
  addDays,
  addMonths,
  format,
  startOfDay,
  startOfMonth,
  type Locale as DateFnsLocale,
} from 'date-fns'
import { de, enGB } from 'date-fns/locale'

export const APP_TIME_ZONE = 'Europe/Berlin'

export type Clock = { now(): Date }

/** Echte Uhr – nur am Rand (Route-Handler, Job-Einstieg) erzeugen und dann weiterreichen. */
export const systemClock: Clock = { now: () => new Date() }

/** Feste Uhr für Tests und Seed (`SEED_NOW`). */
export function fixedClock(iso: string | Date): Clock {
  const t = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(t.getTime())) throw new Error(`fixedClock: ungültige Zeit ${String(iso)}`)
  return { now: () => new Date(t.getTime()) }
}

const inBerlin = (d: Date) => new TZDate(d.getTime(), APP_TIME_ZONE)
const toDate = (d: TZDate) => new Date(d.getTime())

/** Beginn des Berliner Kalendertags (00:00 Europe/Berlin) als UTC-Zeitpunkt. */
export function berlinDayStart(d: Date): Date {
  return toDate(startOfDay(inBerlin(d)))
}

/** n Berliner Kalendertage addieren (Uhrzeit bleibt lokal gleich, auch über die Zeitumstellung). */
export function addBerlinDays(d: Date, n: number): Date {
  return toDate(addDays(inBerlin(d), n))
}

/** n Berliner Kalendermonate addieren (kalendergenau: 31.01. + 1 Monat = 28./29.02.; Uhrzeit bleibt lokal gleich). */
export function addBerlinMonths(d: Date, n: number): Date {
  return toDate(addMonths(inBerlin(d), n))
}

/** Monatsbereich `[start, end)` für `YYYY-MM` in Berliner Zeit. */
export function berlinMonthRange(yyyyMm: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm)
  if (!m) throw new Error(`berlinMonthRange: erwartet YYYY-MM, erhalten ${yyyyMm}`)
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  if (month < 0 || month > 11) throw new Error(`berlinMonthRange: ungültiger Monat ${yyyyMm}`)
  const start = new TZDate(year, month, 1, 0, 0, 0, APP_TIME_ZONE)
  const end = new TZDate(year, month + 1, 1, 0, 0, 0, APP_TIME_ZONE)
  return { start: toDate(startOfMonth(start)), end: toDate(end) }
}

/** Berliner Kalenderjahr eines Zeitpunkts. */
export function berlinYear(d: Date): number {
  return inBerlin(d).getFullYear()
}

/** Berliner Monatsschlüssel `YYYY-MM`. */
export function berlinMonthKey(d: Date): string {
  return format(inBerlin(d), 'yyyy-MM')
}

/** Berliner Datum `YYYY-MM-DD` (u. a. für den täglich wechselnden IP-Hash-Schlüssel). */
export function berlinDateKey(d: Date): string {
  return format(inBerlin(d), 'yyyy-MM-dd')
}

const LOCALES: Record<'de' | 'en', DateFnsLocale> = { de, en: enGB }

/** Anzeige immer in Europe/Berlin (date-fns-Muster, z. B. `dd.MM.yyyy HH:mm`). */
export function formatBerlin(d: Date, pattern: string, locale: 'de' | 'en' = 'de'): string {
  return format(inBerlin(d), pattern, { locale: LOCALES[locale] })
}
