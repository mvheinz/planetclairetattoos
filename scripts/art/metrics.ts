import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  countLayoutEvents,
  hostLoad,
  medianMetrics,
  perfGates,
  runMetrics,
  type Gate,
  type RawRun,
  type RunMetrics,
} from './lib/perf'
import { ART_ROOT, existingRuns } from './lib/run'

// `pnpm art:metrics [<lauf-id>]` (KUNST-QA §3.3, §4.6; PLAN P9.4): wertet die Rohdaten der Tempo-Messung SC-18 aus →
// `metrics/perf.json` (je Route Median der Läufe „mit“ und „ohne“ Engine, Differenz, Layout-Ereignisse aus dem Trace,
// Gates PF-01 … PF-08). Ohne Lauf-ID: der neueste Lauf unter `artifacts/art-qa/`.

const RAW = path.join('raw', 'SC-18', 'art-pixel7', 'tempo')

export interface PerfReport {
  scenario: 'SC-18'
  runId: string
  profile: 'art-pixel7'
  cpuThrottling: 4
  runsPerMode: Record<string, { engine: number; off: number }>
  routes: Record<
    string,
    { engine: RunMetrics; off: RunMetrics; layoutEventsWhileScrolling: number | null }
  >
  /** Rechnerlast während der Messung; `reliable: false` → Messung bei ruhiger Maschine wiederholen. */
  host: ReturnType<typeof hostLoad>
  gates: Gate[]
  pass: boolean
}

export function buildPerfReport(
  runId: string,
  raws: readonly RawRun[],
  layout: Record<string, number | null>,
): PerfReport {
  const routes = [...new Set(raws.map((r) => r.route))].sort()
  const report: PerfReport = {
    scenario: 'SC-18',
    runId,
    profile: 'art-pixel7',
    cpuThrottling: 4,
    runsPerMode: {},
    routes: {},
    host: hostLoad(raws),
    gates: [],
    pass: true,
  }
  for (const route of routes) {
    const of = (mode: 'engine' | 'off') => raws.filter((r) => r.route === route && r.mode === mode)
    const engine = medianMetrics(of('engine').map(runMetrics))
    const off = medianMetrics(of('off').map(runMetrics))
    const layoutEvents = layout[route] ?? null
    report.runsPerMode[route] = { engine: of('engine').length, off: of('off').length }
    report.routes[route] = { engine, off, layoutEventsWhileScrolling: layoutEvents }
    report.gates.push(...perfGates(route, engine, off, layoutEvents))
  }
  report.pass = report.gates.every((g) => g.pass)
  return report
}

function main(): void {
  const runId = process.argv[2] ?? existingRuns().sort().at(-1)
  if (!runId) {
    console.error('art:metrics: kein Lauf unter artifacts/art-qa/.')
    process.exit(2)
  }
  const dir = path.join(ART_ROOT, runId)
  const rawDir = path.join(dir, RAW)
  if (!existsSync(rawDir)) {
    console.error(`art:metrics: ${rawDir} fehlt – SC-18 aufnehmen (pnpm art:record --scope SC-18).`)
    process.exit(2)
  }
  const raws = readdirSync(rawDir)
    .filter((f) => /^R\d{2}-(engine|off)-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(path.join(rawDir, f), 'utf8')) as RawRun)
  const layout: Record<string, number | null> = {}
  for (const route of new Set(raws.map((r) => r.route))) {
    const t = path.join(dir, 'traces', `SC-18-${route}.json`)
    layout[route] = existsSync(t) ? countLayoutEvents(JSON.parse(readFileSync(t, 'utf8'))) : null
  }
  const report = buildPerfReport(runId, raws, layout)
  mkdirSync(path.join(dir, 'metrics'), { recursive: true })
  const out = path.join(dir, 'metrics', 'perf.json')
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
  const failed = report.gates.filter((g) => !g.pass)
  console.log(
    `art:metrics: ${raws.length} Läufe, ${Object.keys(report.routes).length} Routen → ${out}; Gates ${
      failed.length ? `rot: ${failed.map((g) => `${g.route} ${g.id}`).join(', ')}` : 'grün'
    }; Last max ${report.host.load1Max ?? '?'} bei ${report.host.cpus ?? '?'} Kernen${
      report.host.reliable === false
        ? ' – UNTER LAST, Messung bei ruhiger Maschine wiederholen'
        : ''
    }`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
