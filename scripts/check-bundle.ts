import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build } from 'esbuild'

// `pnpm check:bundle` (ARCHITEKTUR §6.3 Schritt 9, §7.7) – Gerüst aus P1.33: meldet nur die Gesamtgröße der
// JavaScript-Dateien in `.next/static` (roh und gzip Stufe 9). Die Budgets je Seitentyp (tests/perf/budgets.json,
// Messung per Playwright gegen `next start`) folgen in P2.23. Scheitert, wenn kein Build vorliegt.
// Ab P2.4 zusätzlich AK-DS-04 (DESIGN §4.1): genau 3 ausgelieferte `.woff2`, zusammen ≤ 100 KB, und kein Verweis auf
// Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`, R-131) in `.next/static` oder im erzeugten HTML.
// Ab P2.17 Modul-Budgets der Tuschelinie (DESIGN §9.10): jedes Modul einzeln mit esbuild gebündelt und minifiziert
// (unabhängig von der Chunk-Aufteilung durch Next), gzip Stufe 9.

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

export interface ModuleBudget {
  name: string
  entry: string
  /** Höchstgröße gzip in Bytes (1 KB = 1000 B, streng). */
  gzipMax: number
}

/** Budgets JS (gzip) laut DESIGN §9.10. */
export const MODULE_BUDGETS: readonly ModuleBudget[] = [
  { name: 'Engine (Geometrie + Laufzeit)', entry: 'src/leash/runtime.ts', gzipMax: 12_000 },
  { name: 'Statischer Renderer', entry: 'src/leash/static.ts', gzipMax: 4_000 },
  { name: 'Coco-Steuerung', entry: 'src/leash/coco.ts', gzipMax: 3_000 },
]

/** Budget SVG (DESIGN §9.10): Coco-Sprite ≤ 45 KB roh / ≤ 12 KB gz (1 KB = 1000 B). */
export const SPRITE_BUDGET = {
  file: 'public/art/coco-sprite.v1.svg',
  rawMax: 45_000,
  gzipMax: 12_000,
}

export function measureFile(file: string): { rawBytes: number; gzipBytes: number } {
  const data = readFileSync(file)
  return { rawBytes: data.length, gzipBytes: gzipSync(data, { level: 9 }).length }
}

export interface ModuleReport extends ModuleBudget {
  rawBytes: number
  gzipBytes: number
  ok: boolean
}

/** Bündelt jedes Modul einzeln (ESM, minifiziert, Browser) und misst roh/gzip. */
export async function measureModules(
  budgets: readonly ModuleBudget[] = MODULE_BUDGETS,
): Promise<ModuleReport[]> {
  const out: ModuleReport[] = []
  for (const b of budgets) {
    const res = await build({
      entryPoints: [b.entry],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
    })
    const data = res.outputFiles[0]!.contents
    const gzipBytes = gzipSync(data, { level: 9 }).length
    out.push({ ...b, rawBytes: data.length, gzipBytes, ok: gzipBytes <= b.gzipMax })
  }
  return out
}

async function main(): Promise<void> {
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
  let failed = fonts.errors.length > 0
  for (const e of fonts.errors) console.error(`check:bundle: ${e}`)
  for (const m of await measureModules()) {
    const line = `check:bundle: ${m.name} (${m.entry}) gzip ${m.gzipBytes} B, Budget ${m.gzipMax} B.`
    if (m.ok) console.log(line)
    else {
      console.error(`${line} ÜBERSCHRITTEN`)
      failed = true
    }
  }
  const sprite = measureFile(SPRITE_BUDGET.file)
  const spriteLine = `check:bundle: Coco-Sprite ${sprite.rawBytes} B roh / ${sprite.gzipBytes} B gz, Budget ${SPRITE_BUDGET.rawMax} / ${SPRITE_BUDGET.gzipMax} B.`
  if (sprite.rawBytes <= SPRITE_BUDGET.rawMax && sprite.gzipBytes <= SPRITE_BUDGET.gzipMax)
    console.log(spriteLine)
  else {
    console.error(`${spriteLine} ÜBERSCHRITTEN`)
    failed = true
  }
  if (failed) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main()
