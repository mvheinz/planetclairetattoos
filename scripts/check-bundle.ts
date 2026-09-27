import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// `pnpm check:bundle` (ARCHITEKTUR §6.3 Schritt 9, §7.7) – Gerüst aus P1.33: meldet nur die Gesamtgröße der
// JavaScript-Dateien in `.next/static` (roh und gzip Stufe 9). Die Budgets je Seitentyp (tests/perf/budgets.json,
// Messung per Playwright gegen `next start`) folgen in P2.23. Scheitert, wenn kein Build vorliegt.
// Ab P2.4 zusätzlich AK-DS-04 (DESIGN §4.1): genau 3 ausgelieferte `.woff2`, zusammen ≤ 100 KB, und kein Verweis auf
// Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`, R-131) in `.next/static` oder im erzeugten HTML.

export interface BundleReport {
  files: number
  rawBytes: number
  gzipBytes: number
}

function listFiles(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = path.join(dir, name)
    if (statSync(abs).isDirectory()) return listFiles(abs, match)
    return match(name) ? [abs] : []
  })
}

const listJs = (dir: string) => listFiles(dir, (n) => n.endsWith('.js'))

/** Budget AK-DS-04: genau so viele Schriftdateien, zusammen höchstens so viele Bytes. */
export const FONT_FILES = 3
export const FONT_BUDGET_BYTES = 100 * 1000
const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/

export interface FontReport {
  files: string[]
  bytes: number
  errors: string[]
}

/** AK-DS-04: ausgelieferte WOFF2 in `.next/static` und Google-Fonts-Verweise in Build-Ausgaben. */
export function checkFonts(staticDir: string, extraDirs: string[] = []): FontReport {
  const fonts = listFiles(staticDir, (n) => n.endsWith('.woff2'))
  const bytes = fonts.reduce((sum, f) => sum + statSync(f).size, 0)
  const errors: string[] = []
  if (fonts.length !== FONT_FILES)
    errors.push(`${fonts.length} .woff2-Dateien ausgeliefert, erwartet genau ${FONT_FILES}.`)
  if (bytes > FONT_BUDGET_BYTES)
    errors.push(`Schriften zusammen ${bytes} B, Budget ${FONT_BUDGET_BYTES} B.`)
  const scanned = [staticDir, ...extraDirs].flatMap((d) =>
    listFiles(d, (n) => /\.(js|css|html|rsc)$/.test(n)),
  )
  for (const file of scanned) {
    if (GOOGLE_FONTS.test(readFileSync(file, 'utf8')))
      errors.push(`Google-Fonts-Verweis in ${path.relative(process.cwd(), file)}.`)
  }
  return { files: fonts.map((f) => path.basename(f)), bytes, errors }
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
  const serverApp = path.resolve('.next/server/app')
  let extra: string[] = []
  try {
    statSync(serverApp)
    extra = [serverApp]
  } catch {
    // Kein vorgerendertes HTML – nur .next/static prüfen.
  }
  const fonts = checkFonts(staticDir, extra)
  console.log(
    `check:bundle: ${fonts.files.length} Schriftdateien, zusammen ${(fonts.bytes / 1000).toFixed(1)} KB (AK-DS-04, Budget 100 KB).`,
  )
  if (fonts.errors.length > 0) {
    for (const e of fonts.errors) console.error(`check:bundle: ${e}`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
