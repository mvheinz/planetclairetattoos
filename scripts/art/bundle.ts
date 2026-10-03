import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { zipSync, type Zippable } from 'fflate'

import {
  BUNDLE_MAX_BYTES,
  buildManifest,
  isFullRun,
  missingRecordings,
  selectFiles,
  type RunFile,
} from './lib/bundle'
import { ART_ROOT, existingRuns } from './lib/run'

// `pnpm art:bundle [<lauf-id>] [--zip]` (KUNST-QA §3.3, §8; PLAN P9.5): stellt das Bündel eines Laufs unter
// `artifacts/art-qa/<lauf-id>/bundle/` zusammen (Pflichtteil: manifest, check, metrics, Rohdaten, Kontaktbögen; dann
// Videos der Variante motion, Kunst-Standbilder, übrige Videos und Frames, solange ≤ 100 MB) und schreibt
// `manifest.json` (§8 inkl. `toolVersions.webkit` bzw. „WebKit emuliert“). Exit ≠ 0, wenn bei einem vollständigen Lauf
// (`art:record` ohne `--scope`) ein Video, eine Frame-Sequenz, die Tempo-Rohdaten oder der Kalibrierbogen fehlen, oder
// wenn schon der Pflichtteil das Budget sprengt. `--zip` legt zusätzlich `<lauf-id>.zip` an (nur lokal nötig; CI lädt
// den Ordner hoch).

function listFiles(dir: string, base = dir, out: RunFile[] = []): RunFile[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (path.relative(base, p) === 'bundle') continue
      listFiles(p, base, out)
    } else out.push({ path: path.relative(base, p).split(path.sep).join('/'), bytes: st.size })
  }
  return out
}

function toolVersions(): {
  playwright: string | null
  chromium: string | null
  webkit: string | null
  node: string
} {
  const req = createRequire(import.meta.url)
  const read = (id: string) => {
    try {
      return JSON.parse(readFileSync(req.resolve(id), 'utf8')) as Record<string, unknown>
    } catch {
      return null
    }
  }
  const pw = read('@playwright/test/package.json') as { version?: string } | null
  let browsers: { name: string; browserVersion?: string }[] = []
  try {
    const core = path.dirname(
      createRequire(req.resolve('@playwright/test/package.json')).resolve(
        'playwright-core/package.json',
      ),
    )
    browsers = (
      JSON.parse(readFileSync(path.join(core, 'browsers.json'), 'utf8')) as {
        browsers: typeof browsers
      }
    ).browsers
  } catch {
    browsers = []
  }
  const v = (n: string) => browsers.find((b) => b.name === n)?.browserVersion ?? null
  return {
    playwright: pw?.version ?? null,
    chromium: v('chromium'),
    webkit: v('webkit'),
    node: process.version,
  }
}

function place(src: string, dst: string): void {
  mkdirSync(path.dirname(dst), { recursive: true })
  try {
    linkSync(src, dst)
  } catch {
    copyFileSync(src, dst)
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const runId = args.find((a) => !a.startsWith('--')) ?? existingRuns().sort().at(-1)
  const runDir = runId ? path.join(ART_ROOT, runId) : null
  if (!runId || !runDir || !existsSync(path.join(runDir, 'run.json'))) {
    console.error(`art:bundle: Lauf ${runId ?? '(keiner)'} ohne run.json unter ${ART_ROOT}/.`)
    process.exit(2)
  }
  const run = JSON.parse(readFileSync(path.join(runDir, 'run.json'), 'utf8')) as {
    runId: string
    commit: string
    date: string
    scope: string[]
    webkit?: string
  }
  // Sonden (raw/**/probes.json, zusammen ~40 MB) gehen gzip-komprimiert ins Bündel (`art:check` liest beides).
  const gz = new Map<string, Buffer>()
  const files = listFiles(runDir)
    .filter((f) => f.path !== 'manifest.json')
    .map((f) => {
      if (!/^raw\/.*\/probes\.json$/.test(f.path)) return f
      const buf = gzipSync(readFileSync(path.join(runDir, f.path)), { level: 9 })
      gz.set(`${f.path}.gz`, buf)
      return { path: `${f.path}.gz`, bytes: buf.length }
    })
  const missing = missingRecordings(files, run.scope)
  const full = isFullRun(run.scope)
  const selection = selectFiles(files)
  const manifest = buildManifest({ run, selection, missing, tools: toolVersions() })
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`
  writeFileSync(path.join(runDir, 'manifest.json'), manifestJson)

  const out = path.join(runDir, 'bundle')
  rmSync(out, { recursive: true, force: true })
  for (const f of selection.included) {
    const buf = gz.get(f.path)
    if (buf) {
      mkdirSync(path.dirname(path.join(out, f.path)), { recursive: true })
      writeFileSync(path.join(out, f.path), buf)
    } else place(path.join(runDir, f.path), path.join(out, f.path))
  }
  writeFileSync(path.join(out, 'manifest.json'), manifestJson)

  const errors: string[] = []
  if (full && missing.length) errors.push(...missing)
  if (!full && missing.some((m) => m.startsWith('Kalibrierbogen')))
    errors.push(missing.find((m) => m.startsWith('Kalibrierbogen'))!)
  if (selection.requiredBytes > BUNDLE_MAX_BYTES)
    errors.push(`Pflichtteil ${manifest.sizes.requiredMB} MB > ${BUNDLE_MAX_BYTES / 1e6} MB`)
  if (selection.totalBytes > BUNDLE_MAX_BYTES)
    errors.push(`Bündel ${manifest.sizes.totalMB} MB > 100 MB`)

  if (args.includes('--zip') && !errors.length) {
    const z: Zippable = {}
    for (const f of [...selection.included, { path: 'manifest.json', bytes: 0 }])
      z[f.path] = [
        new Uint8Array(readFileSync(path.join(out, f.path))),
        { level: /\.(webm|webp|png|gz)$/.test(f.path) ? 0 : 6 },
      ]
    writeFileSync(path.join(ART_ROOT, `${runId}.zip`), zipSync(z))
  }
  console.log(
    `art:bundle: ${runId} → ${out}: ${selection.included.length} Dateien, ${manifest.sizes.totalMB} MB (Pflichtteil ${manifest.sizes.requiredMB} MB; ausgelassen ${manifest.sizes.omittedFiles} Dateien / ${manifest.sizes.omittedMB} MB); ${full ? 'vollständiger Lauf' : `Teil-Lauf (${run.scope.join(', ')})`}${missing.length ? `; fehlt: ${missing.length}` : ''}`,
  )
  if (errors.length) {
    for (const e of errors) console.error(`art:bundle: ${e}`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
