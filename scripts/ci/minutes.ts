import { pathToFileURL } from 'node:url'

import { errorText, ghApi, ghApiPages, type GhApi, type GhApiPages } from './gh'

// Minuten-Wächter (`pnpm ci:minutes`, ARCHITEKTUR §6.8, §6.10; PLAN P1.33a): summiert die abrechenbaren
// GitHub-Actions-Minuten des laufenden Kalendermonats (UTC). Je Lauf `…/runs/<id>/timing`, Summe über
// `billable.UBUNTU.job_runs[].duration_ms`, je Job auf volle Minuten aufgerundet; fehlt `billable`, ersatzweise
// `…/runs/<id>/jobs` mit `completed_at − started_at`. Nur lesende Endpunkte; die API ist für Tests injizierbar.
// Ausgabe `MINUTEN_MONAT=<n>` und `MINUTEN_STATUS=ok|knapp|erschoepft|unbekannt`; Exit-Code immer 0.

export const LIMIT_KNAPP = 1500
export const LIMIT_ERSCHOEPFT = 2000
const MINUTE_MS = 60_000

export type MinutesStatus = 'ok' | 'knapp' | 'erschoepft' | 'unbekannt'

export interface MinutesApi {
  get: GhApi
  pages: GhApiPages
}

export interface MinutesResult {
  minutes: number | null
  status: MinutesStatus
  message: string
  lines: string[]
}

interface Run {
  id: number
  created_at: string
}
interface Timing {
  billable?: Record<string, { job_runs?: { duration_ms?: number }[] } | undefined>
}
interface JobsPage {
  jobs?: { started_at?: string | null; completed_at?: string | null }[]
}

/** Erster Tag des Monats von `now` (UTC), z. B. `2026-09-01`. */
export function monthStart(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export const runsEndpoint = (now: Date) =>
  `repos/{owner}/{repo}/actions/runs?created=${encodeURIComponent(`>=${monthStart(now)}`)}&per_page=100`

const roundUp = (ms: number) => Math.ceil(Math.max(0, ms) / MINUTE_MS)

export function statusFor(minutes: number): Exclude<MinutesStatus, 'unbekannt'> {
  if (minutes >= LIMIT_ERSCHOEPFT) return 'erschoepft'
  if (minutes >= LIMIT_KNAPP) return 'knapp'
  return 'ok'
}

async function minutesOfRun(run: Run, api: MinutesApi, now: Date): Promise<number> {
  const timing = (await api.get(`repos/{owner}/{repo}/actions/runs/${run.id}/timing`)) as Timing
  const jobRuns = timing?.billable?.UBUNTU?.job_runs
  if (timing?.billable && Array.isArray(jobRuns)) {
    return jobRuns.reduce((sum, j) => sum + roundUp(Number(j.duration_ms ?? 0)), 0)
  }
  // Ersatz ohne `billable`: Laufzeiten der Jobs (laufende Jobs bis jetzt).
  const pages = (await api.pages(
    `repos/{owner}/{repo}/actions/runs/${run.id}/jobs?per_page=100`,
  )) as JobsPage[]
  let sum = 0
  for (const page of pages) {
    if (!Array.isArray(page?.jobs)) throw new Error(`Lauf ${run.id}: Antwort ohne Liste \`jobs\``)
    for (const job of page.jobs) {
      if (!job.started_at) continue
      const end = job.completed_at ? Date.parse(job.completed_at) : now.getTime()
      sum += roundUp(end - Date.parse(job.started_at))
    }
  }
  return sum
}

/** Summe der aufgerundeten Job-Minuten aller Läufe des laufenden UTC-Monats. */
export async function countMonthMinutes(now: Date, api: MinutesApi): Promise<number> {
  const from = Date.parse(`${monthStart(now)}T00:00:00Z`)
  const pages = (await api.pages(runsEndpoint(now))) as { workflow_runs?: Run[] }[]
  const runs: Run[] = []
  for (const page of pages) {
    if (!Array.isArray(page?.workflow_runs)) throw new Error('Antwort ohne Liste `workflow_runs`')
    for (const run of page.workflow_runs) {
      if (Date.parse(run.created_at) >= from) runs.push(run)
    }
  }
  let total = 0
  for (const run of runs) total += await minutesOfRun(run, api, now)
  return total
}

const MESSAGES: Record<Exclude<MinutesStatus, 'unbekannt'>, (n: number) => string> = {
  ok: (n) => `CI-Minuten diesen Monat: ${n} von ${LIMIT_ERSCHOEPFT} – alles im Rahmen.`,
  knapp: (n) =>
    `CI-Minuten fast aufgebraucht (${n} von ${LIMIT_ERSCHOEPFT}) – bis Monatsende nur Phasenende-Läufe.`,
  erschoepft: (n) =>
    `CI-Minuten aufgebraucht (${n} von ${LIMIT_ERSCHOEPFT}) – CI startet nicht mehr: nicht mergen, lokal weiter prüfen, Eintrag in docs/OFFENE-PUNKTE.md.`,
}

export async function runMinutes(
  now: Date,
  api: MinutesApi = { get: ghApi, pages: ghApiPages },
  log: (line: string) => void = (l) => console.log(l),
): Promise<MinutesResult> {
  let result: MinutesResult
  try {
    const minutes = await countMonthMinutes(now, api)
    const status = statusFor(minutes)
    const message = MESSAGES[status](minutes)
    result = {
      minutes,
      status,
      message,
      lines: [`MINUTEN_MONAT=${minutes}`, `MINUTEN_STATUS=${status}`, message],
    }
  } catch (err) {
    const message = `Minuten-Stand nicht abrufbar (${errorText(err)}) – gilt wie „knapp“: bis Monatsende nur Phasenende-Läufe (Vermerk im PR-Text).`
    result = {
      minutes: null,
      status: 'unbekannt',
      message,
      lines: ['MINUTEN_MONAT=unbekannt', 'MINUTEN_STATUS=unbekannt', message],
    }
  }
  for (const line of result.lines) log(line)
  return result
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // Echte Uhrzeit nur hier am Einstiegspunkt; die Funktionen bekommen `now` übergeben.
  void runMinutes(new Date()).finally(() => process.exit(0))
}
