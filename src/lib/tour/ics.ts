import type { Locale, TourStatus } from '@/lib/enums'
import { berlinDateKey } from '@/lib/time'
import { tourHoursText } from '@/lib/tour/dates'

// Kalender-Datei eines Markttermins (V-60, U-93, P20.3; KONZEPT §3.1a): `GET /api/public/tour-dates/<id>.ics` liefert
// ein iCalendar (RFC 5545) mit genau einem VEVENT – „In den Kalender“ auf dem Schaukasten „on Tour“. Rein, ohne
// Datenbank. Keine Personendaten (kein ORGANIZER, keine Mail-Adresse), kein Event-JSON-LD.
//
// Zeiten: Mit Uhrzeit von–bis (z. B. 10–18 Uhr) beginnt und endet der Termin in Ortszeit `TZID=Europe/Berlin` (mit
// VTIMEZONE samt Sommerzeit-Regeln); mehrtägige Märkte wiederholen die Uhrzeit täglich (`RRULE:FREQ=DAILY;COUNT=n`) –
// so bleiben 10–18 Uhr auch über die Zeitumstellung 10–18 Uhr. Ohne vollständige Uhrzeit ist der Termin ganztägig
// (`VALUE=DATE`, Ende = Tag nach dem letzten Tag). Die Kalendertage kommen aus den gespeicherten UTC-Zeitpunkten in
// Berliner Zeit (`startsAt` = Beginn des ersten Tages, `endsAt` = Ende des letzten Tages, DATENMODELL §6.30).

export const ICS_CONTENT_TYPE = 'text/calendar; charset=utf-8'

/** Was der Kalender braucht (Auszug aus `PublicTourDate`). */
export interface TourIcsItem {
  id: number
  name: string
  place: string
  address: string | null
  link: string | null
  standNumber: string | null
  timeFrom: string | null
  timeTo: string | null
  note: string | null
  startsAt: string | Date
  endsAt: string | Date
  status: TourStatus
}

/** Texte in der Sprache der Anfrage (aus `home.tour`). */
export interface TourIcsTexts {
  /** „Stand 12“ (ohne Standnummer `null`). */
  stand: string | null
  /** „Alle Termine: {Adresse des Schaukastens}“. */
  more: string
  /** „abgesagt“. */
  cancelled: string
}

export interface TourIcsOptions {
  locale: Locale
  /** Basis-URL der Website (`NEXT_PUBLIC_SITE_URL`) – für die UID. */
  siteUrl: string
  /** Absolute Adresse des Schaukastens (Startseite mit `#on-tour`). */
  pageUrl: string
  /** Zeitpunkt der Erzeugung (DTSTAMP). */
  now: Date
  texts: TourIcsTexts
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const toDate = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v)

/** `YYYY-MM-DD` → `YYYYMMDD`. */
const compact = (key: string) => key.replace(/-/g, '')

/** Kalendertag `YYYY-MM-DD` um `days` verschieben (reines Datum, ohne Zeitzone). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Anzahl Kalendertage von `a` bis einschließlich `b` (`YYYY-MM-DD`). */
export function daysInclusive(a: string, b: string): number {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((t(b) - t(a)) / 86_400_000) + 1
}

/** UTC-Zeitpunkt im iCalendar-Format `YYYYMMDDTHHMMSSZ`. */
export function icsUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
}

/** TEXT-Wert maskieren (RFC 5545 §3.3.11): `\`, `;`, `,` und Zeilenumbrüche. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

const encoder = new TextEncoder()

/** Zeile auf höchstens 75 Oktette falten (RFC 5545 §3.1): Fortsetzung mit CRLF + Leerzeichen, nie mitten im Zeichen. */
export function foldIcsLine(line: string): string {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    const limit = out.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

/** Zeitzone Europe/Berlin (MEZ/MESZ, Umstellung am letzten Sonntag im März bzw. Oktober). */
const VTIMEZONE_BERLIN = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'X-LIC-LOCATION:Europe/Berlin',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
] as const

/** Erster und letzter Berliner Kalendertag des Termins (`endsAt` 23:59:59 gehört zum letzten Tag). */
export function tourDayKeys(item: Pick<TourIcsItem, 'startsAt' | 'endsAt'>): {
  first: string
  last: string
  days: number
} {
  const first = berlinDateKey(toDate(item.startsAt))
  const lastRaw = berlinDateKey(new Date(toDate(item.endsAt).getTime() - 1))
  const last = lastRaw < first ? first : lastRaw
  return { first, last, days: daysInclusive(first, last) }
}

/** Uhrzeit von–bis vollständig und sinnvoll (Ende nach Beginn am selben Tag)? Sonst ganztägig. */
export function timedRange(
  from: string | null | undefined,
  to: string | null | undefined,
): { from: string; to: string } | null {
  const a = from?.trim() ?? ''
  const b = to?.trim() ?? ''
  if (!TIME_RE.test(a) || !TIME_RE.test(b) || b <= a) return null
  return { from: a, to: b }
}

/** Pfad der Kalender-Datei eines Termins (Link „In den Kalender“, Route `src/app/(api)/api/public/tour-dates/[file]`). */
export function tourIcsPath(id: number, locale: Locale): string {
  return `/api/public/tour-dates/${id}.ics?locale=${locale}`
}

/** Dateiname für den Download: `planet-claire-on-tour-2026-10-24.ics`. */
export function tourIcsFileName(item: Pick<TourIcsItem, 'startsAt' | 'endsAt'>): string {
  return `planet-claire-on-tour-${tourDayKeys(item).first}.ics`
}

/** Die iCalendar-Datei eines Termins (CRLF, gefaltete Zeilen, UTF-8). */
export function buildTourIcs(item: TourIcsItem, options: TourIcsOptions): string {
  const { first, last, days } = tourDayKeys(item)
  const time = timedRange(item.timeFrom, item.timeTo)
  const cancelled = item.status === 'cancelled'
  const host = new URL(options.siteUrl).hostname
  const hours = tourHoursText(item.timeFrom, item.timeTo, options.locale)
  const summary = cancelled
    ? `${item.name} (${options.texts.cancelled}) · Planet Claire`
    : `${item.name} · Planet Claire`
  const location = [item.place, item.address].filter((v): v is string => !!v?.trim()).join(', ')
  const description = [hours, options.texts.stand, item.note, item.link, options.texts.more]
    .filter((v): v is string => !!v?.trim())
    .join('\n')

  const event: string[] = [
    'BEGIN:VEVENT',
    `UID:tour-${item.id}@${host}`,
    `DTSTAMP:${icsUtc(options.now)}`,
  ]
  if (time) {
    const hm = (v: string) => v.replace(':', '')
    event.push(
      `DTSTART;TZID=Europe/Berlin:${compact(first)}T${hm(time.from)}00`,
      `DTEND;TZID=Europe/Berlin:${compact(first)}T${hm(time.to)}00`,
    )
    if (days > 1) event.push(`RRULE:FREQ=DAILY;COUNT=${days}`)
  } else {
    event.push(
      `DTSTART;VALUE=DATE:${compact(first)}`,
      `DTEND;VALUE=DATE:${compact(addDaysToKey(last, 1))}`,
    )
  }
  event.push(`SUMMARY:${escapeIcsText(summary)}`)
  if (location) event.push(`LOCATION:${escapeIcsText(location)}`)
  if (description) event.push(`DESCRIPTION:${escapeIcsText(description)}`)
  event.push(`URL:${options.pageUrl}`, `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`)
  event.push('END:VEVENT')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Planet Claire//on Tour//${options.locale.toUpperCase()}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(time ? VTIMEZONE_BERLIN : []),
    ...event,
    'END:VCALENDAR',
  ]
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
