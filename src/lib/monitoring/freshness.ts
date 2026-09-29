import 'server-only'

import type { Env } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { readJson } from '@/lib/storage/systemFiles'

// Frische-Prüfung ohne Datenbank (ARCHITEKTUR §11.3, PLAN P5.3): liest `job-alarm.json` und `backup-status.json` über
// `systemFiles`. `jobs = late`, wenn der letzte volle Lauf älter als 3 h ist (oder fehlt); `backup = off` außerhalb von
// Produktion oder ohne `BACKUP_ENABLED`, sonst `late`, wenn der letzte Erfolg älter als 30 h ist. 503, sobald ein Wert
// `late` ist. Ergebnis 60 s im Prozess gecacht. Im Wartungsmodus 200 mit `{ maintenance: true }`.

export const BACKUP_STATUS_KEY = 'backup-status.json'
export const JOBS_LATE_AFTER_MS = 3 * 60 * 60 * 1000
export const BACKUP_LATE_AFTER_MS = 30 * 60 * 60 * 1000
export const FRESHNESS_CACHE_MS = 60 * 1000

export type Freshness =
  { maintenance: true } | { jobs: 'ok' | 'late'; backup: 'ok' | 'late' | 'off' }

const olderThan = (iso: string | null | undefined, now: Date, ms: number): boolean => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) || now.getTime() - t > ms
}

export async function computeFreshness(
  env: Pick<Env, 'MAINTENANCE_MODE' | 'APP_ENV' | 'BACKUP_ENABLED'>,
  now: Date,
): Promise<Freshness> {
  if (env.MAINTENANCE_MODE) return { maintenance: true }
  const alarm = await jobAlarm.read()
  const jobs = olderThan(alarm.lastFullRunAt, now, JOBS_LATE_AFTER_MS) ? 'late' : 'ok'
  let backup: 'ok' | 'late' | 'off' = 'off'
  if (env.APP_ENV === 'production' && env.BACKUP_ENABLED) {
    const status = await readJson<{ lastSuccessAt?: string | null }>(BACKUP_STATUS_KEY)
    backup = olderThan(status?.lastSuccessAt, now, BACKUP_LATE_AFTER_MS) ? 'late' : 'ok'
  }
  return { jobs, backup }
}

export const freshnessStatus = (f: Freshness): 200 | 503 =>
  'maintenance' in f || (f.jobs !== 'late' && f.backup !== 'late') ? 200 : 503

let cache: { at: number; value: Freshness } | null = null

/** Mit 60-s-Cache im Prozess (Schlüssel: Zeitpunkt der Abfrage). */
export async function cachedFreshness(
  env: Pick<Env, 'MAINTENANCE_MODE' | 'APP_ENV' | 'BACKUP_ENABLED'>,
  now: Date,
): Promise<Freshness> {
  if (cache && now.getTime() - cache.at >= 0 && now.getTime() - cache.at < FRESHNESS_CACHE_MS) {
    return cache.value
  }
  const value = await computeFreshness(env, now)
  cache = { at: now.getTime(), value }
  return value
}

/** Nur Tests. */
export function __resetFreshnessCache(): void {
  cache = null
}
