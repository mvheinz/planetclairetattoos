import type { Locale } from '@/lib/enums'
import { addBerlinDays, berlinDateKey, berlinDayStart, formatBerlin } from '@/lib/time'

// Tattoo-Angebote (DATENMODELL §6.15, E-53): ohne Angabe endet ein Angebot am Starttag um 23:59 Uhr (Europe/Berlin).
// Öffentlich sichtbar nur `published = true` und `endsAt > jetzt`; einen gespeicherten Status gibt es nicht – „kommt“,
// „läuft“, „vorbei“ leitet `offerState` aus `startsAt`/`endsAt` ab (KONZEPT §5.6, §9.5). Rein, ohne Datenbank.

/** Ende des Starttags 23:59 Uhr Berlin (als UTC-Zeitpunkt). */
export function defaultOfferEnd(startsAt: Date): Date {
  return new Date(berlinDayStart(addBerlinDays(startsAt, 1)).getTime() - 60_000)
}

export type OfferState = 'upcoming' | 'running' | 'ended'

export interface OfferTimes {
  startsAt: Date | string
  endsAt: Date | string
}

const toDate = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v)

/** Zustand zum Zeitpunkt `now`: vor `startsAt` kommt, bis `endsAt` (exklusiv) läuft, danach vorbei. */
export function offerState(offer: OfferTimes, now: Date): OfferState {
  const start = toDate(offer.startsAt).getTime()
  const end = toDate(offer.endsAt).getTime()
  if (now.getTime() >= end) return 'ended'
  if (now.getTime() >= start) return 'running'
  return 'upcoming'
}

/** Öffentlich sichtbar (Abfrage-Filter + Abwehr in der Tiefe): veröffentlicht und noch nicht beendet. */
export function isOfferVisible(
  offer: OfferTimes & { published?: boolean | null },
  now: Date,
): boolean {
  return offer.published !== false && offerState(offer, now) !== 'ended'
}

/** Berliner Kalendertage bis zum Beginn (0 = heute, 1 = morgen; Zeitumstellung über Rundung). */
export function daysUntilStart(offer: Pick<OfferTimes, 'startsAt'>, now: Date): number {
  const diff = berlinDayStart(toDate(offer.startsAt)).getTime() - berlinDayStart(now).getTime()
  return Math.max(0, Math.round(diff / 86_400_000))
}

/** Sortierung nach Beginn (dann Ende, dann `id`). */
export function sortOffers<T extends OfferTimes & { id?: number | string }>(offers: T[]): T[] {
  return [...offers].sort(
    (a, b) =>
      toDate(a.startsAt).getTime() - toDate(b.startsAt).getTime() ||
      toDate(a.endsAt).getTime() - toDate(b.endsAt).getTime() ||
      String(a.id ?? '').localeCompare(String(b.id ?? '')),
  )
}

/** Laufendes bzw. nächstes Angebot (Teaser R11 und Startseite). */
export function currentOrNextOffer<T extends OfferTimes & { published?: boolean | null }>(
  offers: T[],
  now: Date,
): T | null {
  return sortOffers(offers.filter((o) => isOfferVisible(o, now)))[0] ?? null
}

/** Letzter Tag des Angebots (ein Ende genau um Mitternacht zählt zum Vortag). */
function lastDay(offer: OfferTimes): Date {
  return new Date(toDate(offer.endsAt).getTime() - 1)
}

/** Mehrtägig nach Berliner Kalendertagen. */
export function isMultiDay(offer: OfferTimes): boolean {
  return berlinDateKey(toDate(offer.startsAt)) !== berlinDateKey(lastDay(offer))
}

/**
 * Datums-Badge (DESIGN KO-20): eintägig DE „Sa 12.10.“ / EN „Sat 12 Oct“; mehrtägig DE „12.–13.10.“ (anderer Monat
 * „30.10.–2.11.“) / EN „12–13 Oct“ („30 Oct–2 Nov“).
 */
export function offerDateBadge(offer: OfferTimes, locale: Locale): string {
  const start = toDate(offer.startsAt)
  const end = lastDay(offer)
  if (!isMultiDay(offer)) {
    return locale === 'en'
      ? formatBerlin(start, 'EEE d MMM', 'en')
      : `${formatBerlin(start, 'EEEEEE', 'de')} ${formatBerlin(start, 'dd.MM.')}`
  }
  const sameMonth = formatBerlin(start, 'yyyy-MM') === formatBerlin(end, 'yyyy-MM')
  if (locale === 'en') {
    return sameMonth
      ? `${formatBerlin(start, 'd', 'en')}–${formatBerlin(end, 'd MMM', 'en')}`
      : `${formatBerlin(start, 'd MMM', 'en')}–${formatBerlin(end, 'd MMM', 'en')}`
  }
  return sameMonth
    ? `${formatBerlin(start, 'dd.')}–${formatBerlin(end, 'dd.MM.')}`
    : `${formatBerlin(start, 'dd.MM.')}–${formatBerlin(end, 'dd.MM.')}`
}

/** Ganztägig: Beginn 00:00 und Ende 23:59 bzw. 00:00 (Berlin). */
export function isAllDay(offer: OfferTimes): boolean {
  const start = formatBerlin(toDate(offer.startsAt), 'HH:mm')
  const end = formatBerlin(toDate(offer.endsAt), 'HH:mm')
  return start === '00:00' && (end === '23:59' || end === '00:00')
}

/**
 * Uhrzeit aus `startsAt`/`endsAt` (nur wenn nicht ganztägig): DE volle Stunden „12“ und „19“ (die Vorlage ergänzt
 * „Uhr“), sonst „12:30“; EN immer „12:00“. `null` bei ganztägigen Angeboten.
 */
export function offerTimeParts(
  offer: OfferTimes,
  locale: Locale,
): { from: string; to: string } | null {
  if (isAllDay(offer)) return null
  const start = toDate(offer.startsAt)
  const end = toDate(offer.endsAt)
  if (locale === 'en') return { from: formatBerlin(start, 'HH:mm'), to: formatBerlin(end, 'HH:mm') }
  const full = formatBerlin(start, 'mm') === '00' && formatBerlin(end, 'mm') === '00'
  const pattern = full ? 'H' : 'H:mm'
  return { from: formatBerlin(start, pattern), to: formatBerlin(end, pattern) }
}

/** Nächster Zeitpunkt (Beginn oder Ende) nach `now` – Weckzeit für `revalidateEndedOffers`. */
export function nextOfferBoundary(offers: OfferTimes[], now: Date): Date | null {
  let min: number | null = null
  for (const o of offers) {
    for (const t of [toDate(o.startsAt).getTime(), toDate(o.endsAt).getTime()]) {
      if (t > now.getTime() && (min === null || t < min)) min = t
    }
  }
  return min === null ? null : new Date(min)
}

/** Anzahl der Zeitpunkte (Beginn oder Ende) im Intervall `(after, until]`. */
export function boundariesBetween(offers: OfferTimes[], after: Date | null, until: Date): number {
  let n = 0
  for (const o of offers) {
    for (const t of [toDate(o.startsAt).getTime(), toDate(o.endsAt).getTime()]) {
      if ((after === null || t > after.getTime()) && t <= until.getTime()) n++
    }
  }
  return n
}
