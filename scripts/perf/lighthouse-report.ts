import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { loadBudgets, type Budgets } from '../check-bundle'

// Bericht zu `pnpm test:perf` (ARCHITEKTUR §7.7, T-10): liest die von `lhci upload --target=filesystem` abgelegten
// Lighthouse-Berichte (`.lighthouseci/reports/manifest.json`), bildet je Seite den Median aus den Läufen und stellt
// ihn Gate und Ziel aus tests/perf/budgets.json gegenüber. Blockiert nicht selbst – das tut `lhci assert` (Gates).
// In GitHub Actions zusätzlich als Tabelle in die Job-Zusammenfassung.

export interface ManifestEntry {
  url: string
  jsonPath: string
}

export interface Metric {
  label: string
  audit: string
  unit: 'ms' | '' | 'B'
  max: number
  target: number
}

export function metrics(b: Budgets): Metric[] {
  return [
    { label: 'LCP', audit: 'largest-contentful-paint', unit: 'ms', ...b.lighthouse.lcpMs },
    { label: 'CLS', audit: 'cumulative-layout-shift', unit: '', ...b.lighthouse.cls },
    { label: 'TBT', audit: 'total-blocking-time', unit: 'ms', ...b.lighthouse.tbtMs },
    { label: 'Seitengewicht', audit: 'total-byte-weight', unit: 'B', ...b.pageWeight.R01! },
  ]
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor((s.length - 1) / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid]! + s[mid + 1]!) / 2
}

export type Verdict = 'Ziel erreicht' | 'Gate eingehalten, Ziel verfehlt' | 'GATE ÜBERSCHRITTEN'

export function verdict(value: number, m: Pick<Metric, 'max' | 'target'>): Verdict {
  if (value > m.max) return 'GATE ÜBERSCHRITTEN'
  if (value > m.target) return 'Gate eingehalten, Ziel verfehlt'
  return 'Ziel erreicht'
}

const fmt = (v: number, unit: Metric['unit']) =>
  unit === 'ms' ? `${Math.round(v)} ms` : unit === 'B' ? `${(v / 1e6).toFixed(2)} MB` : v.toFixed(3)

export function buildReport(
  entries: { url: string; audits: Record<string, number> }[],
  b: Budgets,
): string[] {
  const byUrl = new Map<string, Record<string, number>[]>()
  for (const e of entries) byUrl.set(e.url, [...(byUrl.get(e.url) ?? []), e.audits])
  const rows = [
    '| Seite | Messgröße | Median | Gate | Ziel | Ergebnis |',
    '|---|---|---|---|---|---|',
  ]
  for (const [url, runs] of byUrl) {
    for (const m of metrics(b)) {
      const v = median(runs.map((r) => r[m.audit] ?? Number.NaN))
      rows.push(
        `| ${new URL(url).pathname} (${runs.length} Läufe) | ${m.label} | ${fmt(v, m.unit)} | ≤ ${fmt(m.max, m.unit)} | ≤ ${fmt(m.target, m.unit)} | ${verdict(v, m)} |`,
      )
    }
  }
  return rows
}

function main(): void {
  const dir = path.resolve('.lighthouseci/reports')
  const manifestFile = path.join(dir, 'manifest.json')
  if (!existsSync(manifestFile)) {
    console.error(
      'lighthouse-report: .lighthouseci/reports/manifest.json fehlt – erst lhci collect/upload.',
    )
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as ManifestEntry[]
  const entries = manifest.map((m) => {
    const lhr = JSON.parse(readFileSync(path.resolve(dir, m.jsonPath), 'utf8')) as {
      audits: Record<string, { numericValue?: number }>
    }
    const audits = Object.fromEntries(
      Object.entries(lhr.audits).map(([k, a]) => [k, a.numericValue ?? Number.NaN]),
    )
    return { url: m.url, audits }
  })
  const rows = buildReport(entries, loadBudgets())
  console.log(`Lighthouse mobil (Median, ARCHITEKTUR §7.7):\n${rows.join('\n')}`)
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) appendFileSync(summary, `### Lighthouse mobil (T-10)\n\n${rows.join('\n')}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
