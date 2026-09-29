import 'server-only'

import type { SqlExecutor } from '@/lib/db/tx'
import { berlinDateKey, berlinMonthKey, formatBerlin } from '@/lib/time'

import { hasOkRunForPeriod } from './runLog'

// Tägliche und monatliche Tasks (KONZEPT §8.1 Nr. 3, ARCHITEKTUR §9.6 Nr. 5): laufen beim ersten vollen Lauf des
// Job-Weckers nach der Berliner Uhrzeit und führen ihre Arbeit höchstens einmal je Berliner Kalendertag bzw. -monat aus.
// Der Zeitraum ist ein Berliner Datums- bzw. Monatsschlüssel – damit robust gegen Sommerzeit (23-/25-Stunden-Tage) und
// UTC-Cron. Erledigt ist ein Zeitraum, sobald `job_runs` einen Lauf mit `status = 'ok'` und `counts.period` enthält; der
// Task gibt dafür `period` in seiner Ausgabe zurück (das Lauf-Protokoll übernimmt es). Aufruf innerhalb des Task-Locks.

export type RunPeriod = 'day' | 'month'

export interface RunOnceDecision {
  due: boolean
  /** `JJJJ-MM-TT` bzw. `JJJJ-MM` (Berlin). */
  period: string
  reason: 'due' | 'too_early' | 'done'
}

/** Rein: Zeitraum-Schlüssel und ob die Berliner Uhrzeit erreicht ist (Monat: ab dem 1. um `berlinHour`). */
export function periodOf(
  per: RunPeriod,
  berlinHour: number,
  now: Date,
): { period: string; reached: boolean } {
  const hour = Number(formatBerlin(now, 'H'))
  if (per === 'day') return { period: berlinDateKey(now), reached: hour >= berlinHour }
  const day = Number(formatBerlin(now, 'd'))
  return { period: berlinMonthKey(now), reached: day > 1 || hour >= berlinHour }
}

export async function runOncePer(
  db: SqlExecutor,
  task: string,
  per: RunPeriod,
  berlinHour: number,
  now: Date,
): Promise<RunOnceDecision> {
  const { period, reached } = periodOf(per, berlinHour, now)
  if (!reached) return { due: false, period, reason: 'too_early' }
  if (await hasOkRunForPeriod(db, task, period)) return { due: false, period, reason: 'done' }
  return { due: true, period, reason: 'due' }
}
