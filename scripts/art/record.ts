import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'

import {
  ART_ROOT,
  existingRuns,
  gitClean,
  gitHead,
  makeRunId,
  nextIteration,
  parseScope,
  specFile,
} from './lib/run'

// `pnpm art:record [--scope SC-00,SC-12] [--project art-desktop-motion,…] [--iter N] [--allow-dirty]` (KUNST-QA §3.3, §4.1; PLAN P9.2): Aufnahme aller
// bzw. der genannten Szenarien gegen den laufenden bzw. von Playwright gestarteten QA-Server (`pnpm art:build`).
// Lauf-ID `<YYYYMMDD>-iter<NN>-<sha7>`, Ablage `artifacts/art-qa/<lauf-id>/` (nie committen). Verweigert bei
// unsauberem `git status` (Aufnahmen müssen einem Commit zuzuordnen sein); `--allow-dirty` nur für Probeläufe
// (im `run.json` vermerkt). SC-16 ist ein Skript ohne Browser (`scripts/art/sc-16.ts`).

const SCRIPT_SCENARIOS: Readonly<Record<string, string>> = { 'SC-16': 'scripts/art/sc-16.ts' }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i >= 0) return process.argv[i + 1]
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`))
  return eq?.slice(name.length + 3)
}

function allScenarios(): string[] {
  const specs = readdirSync('tests/art')
    .map((f) => /^sc-(\d{2})\.art\.spec\.ts$/.exec(f)?.[1])
    .filter((n): n is string => !!n)
    .map((n) => `SC-${n}`)
  return [...new Set([...specs, ...Object.keys(SCRIPT_SCENARIOS)])].sort()
}

function main(): void {
  const dirty = !gitClean()
  const allowDirty = process.argv.includes('--allow-dirty')
  if (dirty && !allowDirty) {
    console.error(
      'art:record: git status ist nicht leer – Aufnahmen nur auf einem sauberen Commit (KUNST-QA §4.1). Erst committen.',
    )
    process.exit(2)
  }
  const scope = parseScope(arg('scope'))
  const scenarios = scope.length > 0 ? scope : allScenarios()
  for (const sc of scenarios)
    if (!SCRIPT_SCENARIOS[sc] && !existsSync(specFile(sc))) {
      console.error(`art:record: Szenario ${sc} unbekannt (${specFile(sc)} fehlt).`)
      process.exit(2)
    }
  const iter = arg('iter') ? Number(arg('iter')) : nextIteration(existingRuns())
  const sha = gitHead()
  const runId = makeRunId(new Date(), iter, sha)
  const runDir = path.join(ART_ROOT, runId)
  mkdirSync(runDir, { recursive: true })
  const webkitEmulated = process.env.PW_SKIP_WEBKIT === '1'
  writeFileSync(
    path.join(runDir, 'run.json'),
    `${JSON.stringify(
      {
        runId,
        commit: sha,
        date: new Date().toISOString(),
        scope: scenarios,
        dirty,
        // Rechnerlast beim Start (1/5/15 min) – Tempo-Werte unter Last sind unzuverlässig (KUNST-QA §4.1).
        hostLoadAtStart: {
          loadavg: loadavg().map((l) => Math.round(l * 100) / 100),
          cpus: cpus().length,
        },
        webkit: webkitEmulated ? 'WebKit emuliert (Chromium, PW_SKIP_WEBKIT=1)' : 'webkit',
      },
      null,
      2,
    )}\n`,
  )
  console.log(`art:record: Lauf ${runId} → ${runDir} (${scenarios.join(', ')})`)
  const env = {
    ...process.env,
    ART_RUN_DIR: path.resolve(runDir),
    // Kassen-/Danke-Szenarien laden die Payload-Konfiguration im Testprozess (wie `pnpm test:e2e`).
    NODE_OPTIONS:
      '--no-deprecation --import=tsx/esm --import=./scripts/lib/register-server-only.mjs',
  }
  let status = 0
  for (const sc of scenarios.filter((s) => SCRIPT_SCENARIOS[s])) {
    const res = spawnSync(
      'pnpm',
      ['exec', 'tsx', '--import=./scripts/lib/register-server-only.mjs', SCRIPT_SCENARIOS[sc]!],
      { stdio: 'inherit', env },
    )
    status ||= res.status ?? 1
  }
  const specs = scenarios.filter((s) => !SCRIPT_SCENARIOS[s]).map(specFile)
  const projects = arg('project')
  const playwright = (files: string[], extra: string[], workers: number) =>
    spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--config=playwright.art.config.ts', ...extra, ...files],
      { stdio: 'inherit', env: { ...env, ART_WORKERS: String(workers) } },
    ).status ?? 1
  if (projects) {
    if (specs.length > 0)
      status ||= playwright(
        specs,
        projects.split(',').map((p) => `--project=${p}`),
        1,
      )
  } else {
    // Bild-Läufe auf zwei Worker verteilt (Ziel ≤ 25 min, KUNST-QA §9); Tempo-Lauf SC-18 danach allein (§4.1:
    // keine anderen CPU-lastigen Prozesse während der Messung).
    const imageSpecs = specs.filter((f) => !f.endsWith('sc-18.art.spec.ts'))
    // Beide Teile laufen immer (ein roter Bild-Lauf überspringt die Tempo-Messung nicht).
    const images =
      imageSpecs.length > 0
        ? playwright(imageSpecs, ['--grep-invert', '@tempo'], Number(process.env.ART_WORKERS || 2))
        : 0
    if (specs.some((f) => f.endsWith('sc-18.art.spec.ts')))
      console.log(
        `art:record: Tempo-Lauf SC-18 startet, Last ${loadavg()
          .map((l) => l.toFixed(2))
          .join(' / ')} bei ${cpus().length} Kernen`,
      )
    const tempo = specs.some((f) => f.endsWith('sc-18.art.spec.ts'))
      ? playwright([specFile('SC-18')], ['--project=art-pixel7-tempo'], 1)
      : 0
    status ||= images || tempo
  }
  console.log(`art:record: fertig (${status === 0 ? 'ok' : `Fehler ${status}`}) – ${runDir}`)
  process.exit(status)
}

main()
