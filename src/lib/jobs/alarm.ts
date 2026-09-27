import 'server-only'

import { readJson, writeJson } from '@/lib/storage/systemFiles'

// Job-Wecker (ARCHITEKTUR §9.6): Weckzeitpunkt als Systemdatei `job-alarm.json` (lokal `.data/job-alarm.json`, s3
// `system/job-alarm.json`) – der Tick liest ihn ohne Datenbank.

export const JOB_ALARM_KEY = 'job-alarm.json'
/** Sicherheitsnetz: mindestens stündlich ein voller Lauf. */
export const FULL_RUN_INTERVAL_MS = 60 * 60 * 1000

export interface JobAlarmState {
  /** Nächster bekannter Weckzeitpunkt (ISO) oder `null`. */
  nextDueAt: string | null
  /** Letzter voller Lauf (ISO) oder `null`. */
  lastFullRunAt: string | null
}

const EMPTY: JobAlarmState = { nextDueAt: null, lastFullRunAt: null }

const time = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

export const jobAlarm = {
  async read(): Promise<JobAlarmState> {
    const raw = await readJson<Partial<JobAlarmState>>(JOB_ALARM_KEY)
    return { ...EMPTY, ...(raw ?? {}) }
  },

  /** Fällig, wenn der Weckzeitpunkt erreicht ist oder der letzte volle Lauf ≥ 60 min zurückliegt (bzw. fehlt). */
  isDueState(state: JobAlarmState, now: Date): boolean {
    const last = time(state.lastFullRunAt)
    if (last === null || now.getTime() - last >= FULL_RUN_INTERVAL_MS) return true
    const next = time(state.nextDueAt)
    return next !== null && now.getTime() >= next
  },

  async isDue(now: Date): Promise<boolean> {
    return jobAlarm.isDueState(await jobAlarm.read(), now)
  },

  /** Nach dem Commit einer zeitgebundenen Sache: Weckzeitpunkt höchstens vorziehen, nie nach hinten schieben. */
  async bump(at: Date): Promise<void> {
    const state = await jobAlarm.read()
    const current = time(state.nextDueAt)
    if (current !== null && current <= at.getTime()) return
    await writeJson(JOB_ALARM_KEY, { ...state, nextDueAt: at.toISOString() })
  },

  /** Nach einem vollen Lauf: neuer Weckzeitpunkt (oder `null`) und Zeit des Laufs. */
  async markFullRun(now: Date, nextDueAt: Date | null): Promise<void> {
    await writeJson(JOB_ALARM_KEY, {
      nextDueAt: nextDueAt ? nextDueAt.toISOString() : null,
      lastFullRunAt: now.toISOString(),
    } satisfies JobAlarmState)
  },
}
