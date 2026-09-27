import 'server-only'

import { TZDate } from '@date-fns/tz'

import { APP_TIME_ZONE, type Clock } from '@/lib/time'

// Zeitausdrücke des Beispielbestands (SEED-SPEC §2.2). Alle Zeitwerte der Datendateien sind relativ zu `N`
// (`SEED_NOW`, kanonisch `2026-10-15T10:00:00+02:00`). Berliner Kalender über `@date-fns/tz` (keine eigene
// Offset-Rechnung).
//
//   expr      = dayExpr | nowExpr | monthExpr
//   dayExpr   = anchor [ "@" time ]          ; ohne Uhrzeit → 12:00
//   anchor    = "D" sign int | "SAT>=D" sign int
//   nowExpr   = "N" [ sign int ( "min" | "h" ) ]
//   monthExpr = "M-" int                     ; → "YYYY-MM"

export const CANONICAL_SEED_NOW = '2026-10-15T10:00:00+02:00'

export class SeedTimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedTimeError'
  }
}

const DAY_RE = /^(SAT>=)?D([+-])(\d{1,4})(?:@(\d{2}):(\d{2})(?::(\d{2}))?)?$/
const NOW_RE = /^N(?:([+-])(\d{1,6})(min|h))?$/
const MONTH_RE = /^M-(\d{1,3})$/
/** ISO 8601 mit Offset (wie `SEED_NOW` in `src/lib/env.schema.ts`). */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

export function isSeedTimeExpr(expr: string): boolean {
  return DAY_RE.test(expr) || NOW_RE.test(expr) || MONTH_RE.test(expr)
}

function berlinParts(d: Date): { y: number; m: number; day: number } {
  const t = new TZDate(d.getTime(), APP_TIME_ZONE)
  return { y: t.getFullYear(), m: t.getMonth(), day: t.getDate() }
}

/** Löst einen Ausdruck auf: Zeitpunkt (`Date`) bzw. Monat `YYYY-MM` (`string`). */
export function resolveSeedTime(expr: string, opts: { now: Date }): Date | string {
  const now = opts.now
  if (Number.isNaN(now.getTime())) throw new SeedTimeError('Referenzzeit N ist ungültig.')

  const day = DAY_RE.exec(expr)
  if (day) {
    const [, sat, sign, n, hh, mm, ss] = day
    const offset = (sign === '-' ? -1 : 1) * Number(n)
    const h = hh === undefined ? 12 : Number(hh)
    const mi = mm === undefined ? 0 : Number(mm)
    const s = ss === undefined ? 0 : Number(ss)
    if (h > 23 || mi > 59 || s > 59) throw new SeedTimeError(`Ungültige Uhrzeit in „${expr}“.`)
    const { y, m, day: d } = berlinParts(now)
    let date = d + offset
    if (sat) {
      const probe = new TZDate(y, m, date, 12, 0, 0, APP_TIME_ZONE)
      date += (6 - probe.getDay() + 7) % 7
    }
    const t = new TZDate(y, m, date, h, mi, s, APP_TIME_ZONE)
    return new Date(t.getTime())
  }

  const nowExpr = NOW_RE.exec(expr)
  if (nowExpr) {
    const [, sign, n, unit] = nowExpr
    if (!sign) return new Date(now.getTime())
    const ms = Number(n) * (unit === 'h' ? 3_600_000 : 60_000)
    return new Date(now.getTime() + (sign === '-' ? -ms : ms))
  }

  const month = MONTH_RE.exec(expr)
  if (month) {
    const { y, m } = berlinParts(now)
    const total = y * 12 + m - Number(month[1])
    const yy = Math.floor(total / 12)
    const mm = (total % 12) + 1
    return `${yy}-${String(mm).padStart(2, '0')}`
  }

  throw new SeedTimeError(`Unbekannter Zeitausdruck „${expr}“ (SEED-SPEC §2.2).`)
}

/** Wie `resolveSeedTime`, aber nur Zeitpunkte (Tages- oder Jetzt-Ausdruck). */
export function resolveSeedDate(expr: string, now: Date): Date {
  const v = resolveSeedTime(expr, { now })
  if (typeof v === 'string') throw new SeedTimeError(`„${expr}“ ist kein Zeitpunkt.`)
  return v
}

/** Wie `resolveSeedTime`, als ISO-String (für Payload-Datumsfelder). */
export function seedIso(expr: string, now: Date): string {
  return resolveSeedDate(expr, now).toISOString()
}

/**
 * Referenzzeit `N` aus `SEED_NOW`: gesetzt → ISO 8601 mit Offset, sonst Fehler (Exit 1); leer → aktuelle Zeit der
 * injizierten Uhr, auf die Minute abgerundet (SEED-SPEC §2.2).
 */
export function parseSeedNow(raw: string | undefined | null, clock: Clock): Date {
  const value = (raw ?? '').trim()
  if (value === '') {
    const t = clock.now().getTime()
    return new Date(t - (t % 60_000))
  }
  const d = new Date(value)
  if (!ISO_WITH_OFFSET.test(value) || Number.isNaN(d.getTime())) {
    throw new SeedTimeError(
      `SEED_NOW „${value}“ ist kein ISO-8601-Zeitpunkt mit Offset (z. B. ${CANONICAL_SEED_NOW}).`,
    )
  }
  return d
}
