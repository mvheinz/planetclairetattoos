import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// `pnpm check:bundle` (ARCHITEKTUR §6.3 Schritt 9, §7.7) – Gerüst aus P1.33: meldet nur die Gesamtgröße der
// JavaScript-Dateien in `.next/static` (roh und gzip Stufe 9). Die Budgets je Seitentyp (tests/perf/budgets.json,
// Messung per Playwright gegen `next start`) folgen in P2.23. Scheitert nur, wenn kein Build vorliegt.

export interface BundleReport {
  files: number
  rawBytes: number
  gzipBytes: number
}

function listJs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = path.join(dir, name)
    if (statSync(abs).isDirectory()) return listJs(abs)
    return name.endsWith('.js') ? [abs] : []
  })
}

export function measureBundle(staticDir: string): BundleReport {
  const report: BundleReport = { files: 0, rawBytes: 0, gzipBytes: 0 }
  for (const file of listJs(staticDir)) {
    const data = readFileSync(file)
    report.files++
    report.rawBytes += data.length
    report.gzipBytes += gzipSync(data, { level: 9 }).length
  }
  return report
}

const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`

function main(): void {
  const staticDir = path.resolve('.next/static')
  try {
    statSync(staticDir)
  } catch {
    console.error('check:bundle: .next/static fehlt – zuerst `pnpm build` ausführen.')
    process.exit(1)
  }
  const r = measureBundle(staticDir)
  console.log(
    `check:bundle: ${r.files} JS-Dateien in .next/static, zusammen ${kb(r.rawBytes)} (gzip ${kb(r.gzipBytes)}). Budgets je Seite folgen in P2.23.`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
