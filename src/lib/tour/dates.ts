import type { Locale, TourStatus } from '@/lib/enums'
import {
  addBerlinDays,
  berlinDateKey,
  berlinDayStart,
  formatBerlin,
  parseBerlinLocal,
} from '@/lib/time'

// „Planet Claire on Tour“ (P12.8, U-20, DATENMODELL §6.30): Märkte, Flohmärkte, Kunstmärkte mit Datum von–bis. Gespeichert
// sind zwei Zeitpunkte (UTC): `startsAt` = Beginn des ersten Tages, `endsAt` = Ende des letzten Tages (23:59:59 Uhr,
// Europe/Berlin). Die Uhrzeiten (`timeFrom`/`timeTo`) sind reiner Anzeigetext. Der Zustand „vorbei“ folgt aus dem Datum;
// „abgesagt“ setzt Jutta von Hand. Rein, ohne Datenbank.

export interface TourTimes {
  startsAt: Date | string
  endsAt: Date | string
}

const toDate = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** `HH:mm`-Eingabe (leer erlaubt). */
export const isTourTime = (v: string): boolean => TIME_RE.test(v)

/** Beginn des Berliner Kalendertags und Ende dieses Tages (23:59:59) für beliebige Zeitpunkte normalisieren. */
export function normalizeTourRange(
  startsAt: Date | string,
  endsAt?: Date | string | null,
): { startsAt: Date; endsAt: Date } {
  const start = berlinDayStart(toDate(startsAt))
  const lastDayStart = berlinDayStart(toDate(endsAt ?? startsAt))
  const end = new Date(berlinDayStart(addBerlinDays(lastDayStart, 1)).getTime() - 1000)
  return { startsAt: start, endsAt: end }
}

export interface TourDateIssue {
  path: 'startDate' | 'endDate'
  message: string
}

/** Formular (Datum `YYYY-MM-DD`; Enddatum leer = eintägig) → `startsAt`/`endsAt` (UTC) in Europe/Berlin. */
export function tourRangeFromInput(input: {
  startDate: string
  endDate?: string
}): { startsAt: Date; endsAt: Date } | { issues: TourDateIssue[] } {
  const startDate = input.startDate?.trim() ?? ''
  const endDate = input.endDate?.trim() || startDate
  const issues: TourDateIssue[] = []
  if (!DATE_RE.test(startDate))
    issues.push({ path: 'startDate', message: 'Bitte ein Startdatum wählen.' })
  if (!DATE_RE.test(endDate))
    issues.push({ path: 'endDate', message: 'Bitte ein gültiges Enddatum wählen.' })
  if (issues.length > 0) return { issues }
  const start = parseBerlinLocal(`${startDate}T00:00`)
  const end = parseBerlinLocal(`${endDate}T23:59:59`)
  if (!start) return { issues: [{ path: 'startDate', message: 'Bitte ein Startdatum wählen.' }] }
  if (!end) return { issues: [{ path: 'endDate', message: 'Bitte ein gültiges Enddatum wählen.' }] }
  if (endDate < startDate)
    return { issues: [{ path: 'endDate', message: 'Das Enddatum liegt vor dem Startdatum.' }] }
  return { startsAt: start, endsAt: end }
}

/** Umkehrung für „Termin bearbeiten“: gespeicherte Zeitpunkte → Formularwerte (Berliner Kalendertage). */
export function tourInputFromRange(range: TourTimes): { startDate: string; endDate: string } {
  return {
    startDate: berlinDateKey(toDate(range.startsAt)),
    endDate: berlinDateKey(new Date(toDate(range.endsAt).getTime() - 1)),
  }
}

export type TourState = 'upcoming' | 'running' | 'past' | 'cancelled'

/** Anzeige-Zustand: abgesagt bleibt abgesagt; „vorbei“ von Hand oder weil `endsAt` erreicht ist; sonst kommt/läuft. */
export function tourState(item: TourTimes & { status?: TourStatus | null }, now: Date): TourState {
  if (item.status === 'cancelled') return 'cancelled'
  if (item.status === 'past' || now.getTime() >= toDate(item.endsAt).getTime()) return 'past'
  return now.getTime() >= toDate(item.startsAt).getTime() ? 'running' : 'upcoming'
}

/** Liegt der Termin hinter uns (egal ob abgesagt)? Abgesagte vergangene Termine gehören zu den vergangenen. */
export function isTourOver(item: TourTimes & { status?: TourStatus | null }, now: Date): boolean {
  return item.status === 'past' || now.getTime() >= toDate(item.endsAt).getTime()
}

/** Aufteilung für die Startseite: kommende (inklusive abgesagter, noch nicht vergangener) zuerst, vergangene danach. */
export function splitTourDates<T extends TourTimes & { status?: TourStatus | null; id?: number }>(
  items: T[],
  now: Date,
  pastLimit = 12,
): { upcoming: T[]; past: T[] } {
  const byStart = (a: T, b: T) =>
    toDate(a.startsAt).getTime() - toDate(b.startsAt).getTime() ||
    toDate(a.endsAt).getTime() - toDate(b.endsAt).getTime() ||
    (a.id ?? 0) - (b.id ?? 0)
  const upcoming = items.filter((i) => !isTourOver(i, now)).sort(byStart)
  const past = items
    .filter((i) => isTourOver(i, now))
    .sort((a, b) => byStart(b, a))
    .slice(0, pastLimit)
  return { upcoming, past }
}

/** Letzter Tag (das Ende liegt um 23:59:59, ein Ende genau um Mitternacht zählt zum Vortag). */
const lastDay = (t: TourTimes) => new Date(toDate(t.endsAt).getTime() - 1)

/** Mehrtägig nach Berliner Kalendertagen. */
export function isTourMultiDay(t: TourTimes): boolean {
  return berlinDateKey(toDate(t.startsAt)) !== berlinDateKey(lastDay(t))
}

/**
 * Datum als Text mit Jahr: eintägig DE „Sa 12.10.2026“ / EN „Sat 12 Oct 2026“; mehrtägig DE „12.–13.10.2026“ (anderer
 * Monat „30.10.–02.11.2026“) / EN „12–13 Oct 2026“ („30 Oct–2 Nov 2026“).
 */
export function tourDateText(t: TourTimes, locale: Locale): string {
  const start = toDate(t.startsAt)
  const end = lastDay(t)
  if (!isTourMultiDay(t)) {
    return locale === 'en'
      ? formatBerlin(start, 'EEE d MMM yyyy', 'en')
      : `${formatBerlin(start, 'EEEEEE', 'de')} ${formatBerlin(start, 'dd.MM.yyyy')}`
  }
  const sameMonth = formatBerlin(start, 'yyyy-MM') === formatBerlin(end, 'yyyy-MM')
  if (locale === 'en') {
    return sameMonth
      ? `${formatBerlin(start, 'd', 'en')}–${formatBerlin(end, 'd MMM yyyy', 'en')}`
      : `${formatBerlin(start, 'd MMM', 'en')}–${formatBerlin(end, 'd MMM yyyy', 'en')}`
  }
  return sameMonth
    ? `${formatBerlin(start, 'dd.')}–${formatBerlin(end, 'dd.MM.yyyy')}`
    : `${formatBerlin(start, 'dd.MM.')}–${formatBerlin(end, 'dd.MM.yyyy')}`
}

/** Maschinenlesbares Datum für `<time datetime>`: `2026-10-12` bzw. `2026-10-12/2026-10-13`. */
export function tourDateIso(t: TourTimes): string {
  const a = berlinDateKey(toDate(t.startsAt))
  const b = berlinDateKey(lastDay(t))
  return a === b ? a : `${a}/${b}`
}

/** Uhrzeiten als Text: DE „10–18 Uhr“ (volle Stunden) bzw. „10:30–18:00 Uhr“; EN „10:00–18:00“; nur Beginn: „ab 10 Uhr“. */
export function tourHoursText(
  from: string | null | undefined,
  to: string | null | undefined,
  locale: Locale,
): string | null {
  const a = from?.trim() || null
  const b = to?.trim() || null
  if (!a && !b) return null
  const short = (v: string) => (v.endsWith(':00') ? String(Number(v.slice(0, 2))) : v)
  const full = (!a || a.endsWith(':00')) && (!b || b.endsWith(':00'))
  if (locale === 'en') {
    if (a && b) return `${a}–${b}`
    return a ? `from ${a}` : `until ${b}`
  }
  const fmt = (v: string) => (full ? short(v) : v)
  if (a && b) return `${fmt(a)}–${fmt(b)} Uhr`
  return a ? `ab ${fmt(a)} Uhr` : `bis ${fmt(b!)} Uhr`
}
