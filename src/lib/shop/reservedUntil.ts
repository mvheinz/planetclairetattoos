import type { Locale } from '@/lib/enums'
import { berlinDateKey, formatBerlin } from '@/lib/time'

// „reserviert bis 14:30“ im Korb (U-58 b): Ende einer fremden Reservierung (Kasse oder Vorkasse) in Europe/Berlin –
// nur Uhrzeit, an einem anderen Tag zusätzlich das Datum. Keine Angaben darüber, wer reserviert hat. Rein, ohne DB.

export interface ReservedUntilParts {
  time: string
  /** `null` am selben Berliner Tag wie `now`. */
  date: string | null
}

export function reservedUntilParts(
  untilIso: string | null | undefined,
  now: Date,
  locale: Locale,
): ReservedUntilParts | null {
  if (!untilIso) return null
  const until = new Date(untilIso)
  if (Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) return null
  const time = formatBerlin(until, 'HH:mm', locale)
  const sameDay = berlinDateKey(until) === berlinDateKey(now)
  return {
    time,
    date: sameDay ? null : formatBerlin(until, locale === 'en' ? 'd MMM' : 'dd.MM.', locale),
  }
}
