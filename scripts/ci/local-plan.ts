// Lokale Prüfschleuse (`pnpm ci:local`, U-65/U-66, ARCHITEKTUR §6): Planung ohne Seiteneffekte – Optionen lesen,
// Umgebung der Schritte bauen, Schritte je Modus auswählen. Ausgeführt werden sie in `scripts/ci-local.ts`.
// Die Schritte bilden die bisherigen Workflows nach: `quick` = ci.yml (ohne Int/Build/Rauchtest, die in `full` laufen),
// `full` = quick + ci-full.yml (quality, e2e-full je Gerät, docker) + preview-export.yml + restore-drill.yml,
// `art` = art-qa.yml.

export const MODES = ['quick', 'full', 'art'] as const
export type Mode = (typeof MODES)[number]

export const DEFAULT_DB = 'planetclaire_ci'
export const DEFAULT_PORT = 3300
export const GITLEAKS_VERSION = '8.30.1'
export const GITLEAKS_SHA256 = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'

export interface Options {
  mode: Mode
  /** Datenbank-Grundname; `<db>` und `<db>_test` (beide per `db:ensure` angelegt). */
  db: string
  /** Erster Port; die Schritte nutzen `port` … `port + 5` (siehe `ports`). */
  port: number
  only: string[] | null
  from: string | null
  /** Commit-Status über die GitHub-API setzen (nur vollständiger Lauf, sauberer Baum, HEAD gepusht). */
  status: boolean
  /** Nach einem roten Schritt weitermachen (Standard: anhalten). */
  keepGoing: boolean
  /** Zusätzliche Playwright-Argumente für die E2E-Schritte (z. B. einzelne Specs), nach `--`. */
  e2eArgs: string[]
  /** Nur planen und ausgeben. */
  dryRun: boolean
}

export class UsageError extends Error {}

export const USAGE = `Aufruf: pnpm ci:local <quick|full|art> [Optionen]
  --db <name>        Datenbank-Grundname (Standard ${DEFAULT_DB}; dazu <name>_test)
  --port <n>         erster Port (Standard ${DEFAULT_PORT}; belegt n … n+5)
  --only <a,b>       nur diese Schritte
  --from <schritt>   ab diesem Schritt (Wiederaufnahme)
  --keep-going       nach einem roten Schritt weitermachen
  --status           Commit-Status lokal/ci-<modus> setzen (nur vollständiger Lauf, sauberer Baum, HEAD gepusht)
  --dry-run          nur die geplanten Schritte zeigen
  -- <args>          weitere Playwright-Argumente für die E2E-Schritte (z. B. tests/e2e/home.e2e.spec.ts)`

export function parseArgs(argv: readonly string[]): Options {
  const dashdash = argv.indexOf('--')
  const own = dashdash >= 0 ? argv.slice(0, dashdash) : [...argv]
  const e2eArgs = dashdash >= 0 ? argv.slice(dashdash + 1) : []
  const opts: Options = {
    mode: 'quick',
    db: DEFAULT_DB,
    port: DEFAULT_PORT,
    only: null,
    from: null,
    status: false,
    keepGoing: false,
    e2eArgs,
    dryRun: false,
  }
  let mode: string | null = null
  const value = (i: number, flag: string): string => {
    const v = own[i + 1]
    if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} braucht einen Wert.`)
    return v
  }
  for (let i = 0; i < own.length; i++) {
    const a = own[i]!
    if (a === '--db') opts.db = value(i++, a)
    else if (a === '--port') opts.port = Number(value(i++, a))
    else if (a === '--only')
      opts.only = value(i++, a)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    else if (a === '--from') opts.from = value(i++, a)
    else if (a === '--status') opts.status = true
    else if (a === '--keep-going') opts.keepGoing = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a.startsWith('--')) throw new UsageError(`Unbekannte Option ${a}.`)
    else if (mode === null) mode = a
    else throw new UsageError(`Unerwartetes Argument ${a}.`)
  }
  if (mode === null) throw new UsageError('Modus fehlt (quick, full oder art).')
  if (!(MODES as readonly string[]).includes(mode))
    throw new UsageError(`Unbekannter Modus ${mode} (quick, full oder art).`)
  opts.mode = mode as Mode
  // Nie die Entwicklungs- oder Produktionsdatenbank: eigener Name mit Präfix planetclaire_ und „ci“.
  if (!/^planetclaire_[a-z0-9_]*ci[a-z0-9_]*$/.test(opts.db) || opts.db.endsWith('_test'))
    throw new UsageError(
      `--db ${opts.db} ungültig: planetclaire_…ci… (a–z, 0–9, _), ohne _test (das hängt das Skript an).`,
    )
  if (!Number.isInteger(opts.port) || opts.port < 1024 || opts.port > 65530)
    throw new UsageError(`--port ${opts.port} ungültig: ganze Zahl 1024–65530.`)
  if (opts.only && opts.from) throw new UsageError('--only und --from nicht zusammen.')
  return opts
}

/** Ports der Schritte (alle frei zu Beginn, sonst Abbruch). */
export function ports(base: number) {
  return {
    app: base, // E2E, visuell (Playwright-Server)
    bundle: base + 1, // check:bundle (eigener next start)
    perf: base + 2, // Lighthouse HTTPS-Vorschaltserver
    perfUpstream: base + 3, // Lighthouse next start
    preview: base + 4, // Vorschau-Export
    art: base + 5, // Kunst-QA-Server
  }
}

/** Gleicher Postgres-Server wie `sourceUrl`, andere Datenbank. */
export function databaseUrl(sourceUrl: string, name: string): string {
  const u = new URL(sourceUrl)
  u.pathname = `/${name}`
  u.search = ''
  return u.toString()
}

/**
 * Testwerte wie in `ci.yml` (ARCHITEKTUR §6.3), aber mit eigener Datenbank. Gilt für die Prüf-Schritte von `quick`
 * (dieselben Werte wie der frühere Job, damit Unit-Tests nichts anderes sehen als dort).
 */
export function stepEnv(opts: Options, sourceDbUrl: string): Record<string, string> {
  return {
    CI: '1',
    APP_ENV: 'test',
    TZ: 'UTC',
    ADMIN_ROUTE: '/werkstatt',
    DATABASE_URL: databaseUrl(sourceDbUrl, opts.db),
    DATABASE_URL_TEST: databaseUrl(sourceDbUrl, `${opts.db}_test`),
    DB_POOL_MAX: '25',
    PC_INT_WORKERS: '3',
    PAYLOAD_SECRET: 'ci-only-secret-not-used-anywhere-else-0000',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    SEED_PREVIEW_MODE: 'true',
    SEED_NOW: '2026-10-15T10:00:00+02:00',
    SEED_ADMIN_EMAIL: 'admin@example.com',
    SEED_ADMIN_PASSWORD: 'ci-only-password-2026',
    STORAGE_DRIVER: 'local',
    EMAIL_DRIVER: 'file',
    PAYMENTS_DRIVER: 'mock',
    TRANSLATION_DRIVER: 'mock',
    CARRIER_DRIVER: 'manual',
    CRON_SECRET: 'ci-only-cron-secret-000000000000000000',
    NEXT_PUBLIC_LEASH_DEBUG: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    E2E_SERVER: 'start',
  }
}

/** Zusätzlich für Schritte mit Server/Datenbank (alles außer den Prüf-Schritten von `quick`): eigene Ports. */
export function serverEnv(opts: Options): Record<string, string> {
  const p = ports(opts.port)
  // Kunst-QA: Server, Build und E2E-Helfer zeigen auf den QA-Server (art-qa.yml: Port 3200)
  const app = opts.mode === 'art' ? p.art : p.app
  return {
    NEXT_PUBLIC_SITE_URL: `http://localhost:${app}`,
    PORT: String(p.app),
    E2E_BASE_URL: `http://localhost:${app}`,
    PERF_PORT: String(p.perf),
    PERF_UPSTREAM_PORT: String(p.perfUpstream),
    PREVIEW_EXPORT_DB_NAME: `${opts.db}_preview`,
    PREVIEW_EXPORT_PORT: String(p.preview),
    ART_PORT: String(p.art),
  }
}

/** Aus der Umgebung des Aufrufs nie übernehmen (Ports/Ziele einer anderen Arbeitskopie, eigener Build-Ordner). */
export const STRIPPED_ENV = [
  'PORT',
  'E2E_BASE_URL',
  'PERF_PORT',
  'PERF_UPSTREAM_PORT',
  'PREVIEW_EXPORT_DB_NAME',
  'PREVIEW_EXPORT_PORT',
  'PREVIEW_PHASE',
  'ART_PORT',
  'ART_BASE_URL',
  'ART_DIST_DIR',
  'NEXT_DIST_DIR',
] as const

/** Aufruf-Umgebung ohne `STRIPPED_ENV`. */
export function inheritedEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const out = { ...env }
  for (const k of STRIPPED_ENV) delete out[k]
  return out
}

/** Umgebung eines Schritts: Testwerte, für Server-Schritte die Ports, dann die Werte des Schritts. */
export function envFor(step: Step, opts: Options, sourceDbUrl: string): Record<string, string> {
  return {
    ...stepEnv(opts, sourceDbUrl),
    ...(step.modes.includes('quick') || step.noServerEnv ? {} : serverEnv(opts)),
    ...step.env,
  }
}

/** Kontext zur Laufzeit (für Schritte, deren Befehl erst dann feststeht). */
export interface RunContext {
  opts: Options
  /** Lauf-ID der Kunst-Aufnahme (nach `art-record`). */
  artRunId?: string
}

export type Requirement = 'docker'

export interface Step {
  id: string
  title: string
  modes: readonly Mode[]
  /** Shell-Befehl (bash -c); Funktion, wenn er vom Lauf abhängt. */
  cmd: string | ((ctx: RunContext) => string)
  env?: Record<string, string>
  /** Fehlt die Voraussetzung, wird der Schritt als „übersprungen“ gemeldet (nie still grün). */
  requires?: Requirement
  /** Läuft auch nach einem roten Schritt (wie `if: always()` im Workflow), sofern ausführbar. */
  always?: boolean
  /** Ohne Server-Ports (Testwerte wie `quick`): Int-/Unit-Läufe erwarten die CI-Werte (z. B. Website-Adresse :3000). */
  noServerEnv?: boolean
  timeoutMin: number
}

/** Gibt ein Schritt diese Zeile aus, gilt er als „übersprungen“ (mit dem Rest der Zeile als Grund). */
export const SKIP_MARKER = 'CI_LOCAL_SKIP:'

const FETCH_CACHE =
  "node -e \"require('node:fs').rmSync('.next/cache/fetch-cache',{recursive:true,force:true})\""
/** Frische Datenbank wie je GitHub-Job: der Beispielbestand ließe Reservierungen früherer Läufe stehen. */
const FRESH_DB =
  'tsx --import=./scripts/lib/register-server-only.mjs scripts/ci/fresh-db.ts && pnpm payload migrate'
const E2E_GREP = '--grep-invert "@visual|@perf"'
const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const e2eExtra = (ctx: RunContext) => ctx.opts.e2eArgs.map(quote).join(' ')

function e2eStep(project: 'desktop' | 'iphone-15' | 'pixel-7'): Step {
  return {
    id: `e2e-${project}`,
    title: `E2E ${project} (ohne @visual/@perf, Debug-Build) + Flaky-Wächter`,
    modes: ['full'],
    cmd: (ctx) =>
      `pnpm run test:e2e --project=${project} ${E2E_GREP} ${e2eExtra(ctx)}`.trim() +
      ' && pnpm run ci:flaky',
    timeoutMin: 240,
  }
}

const ALL: Step[] = [
  // ---------- quick (ci.yml) ----------
  {
    id: 'eslint',
    title: 'ESLint',
    modes: ['quick', 'full'],
    cmd: 'pnpm exec eslint .',
    env: { NODE_OPTIONS: '--no-deprecation' },
    timeoutMin: 20,
  },
  {
    id: 'format',
    title: 'Prettier (format:check)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run format:check',
    timeoutMin: 10,
  },
  {
    id: 'typecheck',
    title: 'Typen (tsc)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run typecheck',
    timeoutMin: 20,
  },
  {
    id: 'static',
    title: 'Statische Prüfungen (check:static)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run check:static',
    timeoutMin: 10,
  },
  {
    id: 'unit',
    title: 'Unit-Tests (UTC)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run test:unit',
    timeoutMin: 30,
  },
  {
    id: 'unit-berlin',
    title: 'Unit-Tests (TZ=Europe/Berlin)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run test:unit',
    env: { TZ: 'Europe/Berlin' },
    timeoutMin: 30,
  },
  {
    id: 'env-example',
    title: '.env.example aktuell (env:example-Abgleich)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run env:example && git diff --exit-code -- .env.example .env.production.example',
    timeoutMin: 5,
  },
  {
    id: 'secrets',
    title: 'Geheimnis-Scan (gitleaks)',
    modes: ['quick', 'full'],
    cmd: 'internal:secrets',
    timeoutMin: 10,
  },
  {
    id: 'audit',
    title: 'Abhängigkeiten (pnpm audit, critical blockiert)',
    modes: ['quick', 'full'],
    cmd: 'pnpm audit --prod --audit-level=high || echo "CI_LOCAL_WARN: pnpm audit meldet Lücken der Stufe high (blockiert nur bei critical, siehe Log)"; pnpm audit --prod --audit-level=critical',
    timeoutMin: 5,
  },
  // ---------- full: Datenbank, Int + Abdeckung (quality) ----------
  {
    id: 'db',
    title: 'Datenbanken anlegen + migrieren + Drift',
    modes: ['full', 'art'],
    cmd: 'pnpm run db:ensure && pnpm payload migrate && pnpm run check:migrations',
    timeoutMin: 15,
  },
  {
    id: 'coverage',
    title: 'Int + Unit mit Abdeckung (test:coverage)',
    modes: ['full'],
    cmd: 'pnpm run test:coverage',
    noServerEnv: true,
    // Auf einem geteilten Rechner (mehrere Sitzungen) brauchte der Lauf > 90 min (CI ohne Last: 37 min).
    timeoutMin: 180,
  },
  // Wie restore-drill.yml: eine Datenbank für Bestand und Übung (die Testdatenbank).
  {
    id: 'restore-drill',
    title: 'Wiederherstellungs-Übung (synthetischer Bestand)',
    modes: ['full'],
    cmd: 'export DATABASE_URL="$DATABASE_URL_TEST" && pnpm run db:reset --test --seed=all && pnpm exec tsx --import=./scripts/lib/register-server-only.mjs scripts/ci/restore-drill.ts',
    timeoutMin: 20,
  },
  // ---------- full: Produktions-Build ohne Debug (quality) ----------
  {
    id: 'build',
    title: 'Seed + Build ohne Debug-Flag',
    modes: ['full'],
    cmd: `${FETCH_CACHE} && ${FRESH_DB} && pnpm run seed && pnpm run build`,
    env: { NEXT_PUBLIC_LEASH_DEBUG: '' },
    timeoutMin: 45,
  },
  {
    id: 'no-debug',
    title: 'Kein Debug im Build (check:no-debug)',
    modes: ['full'],
    cmd: 'pnpm run check:no-debug --no-build',
    timeoutMin: 10,
  },
  {
    id: 'bundle',
    title: 'Tempo-Budgets (check:bundle)',
    modes: ['full'],
    cmd: (ctx) => `pnpm run check:bundle --port ${ports(ctx.opts.port).bundle}`,
    timeoutMin: 30,
  },
  {
    id: 'external',
    title: 'Fremd-URLs im Build (check:external --built)',
    modes: ['full'],
    cmd: 'pnpm run check:external --built',
    timeoutMin: 10,
  },
  {
    id: 'visual',
    title: 'Visuelle Regression (test:visual)',
    modes: ['full'],
    cmd: `if [ "$(find tests/visual/__screenshots__ -name \'*-linux.png\' 2>/dev/null | wc -l)" -gt 0 ]; then pnpm run test:visual; else echo "${SKIP_MARKER} keine visuellen Referenzbilder (tests/visual/__screenshots__)"; fi`,
    timeoutMin: 60,
  },
  {
    id: 'lighthouse',
    title: 'Lighthouse-CI (test:perf, CPU-Drosselung an den Rechner angepasst)',
    modes: ['full'],
    cmd: 'tsx scripts/ci/lighthouse-calibrated.ts',
    timeoutMin: 30,
  },
  {
    id: 'inp',
    title: 'INP-Ersatzmessung (@perf, pixel-7)',
    modes: ['full'],
    // CPU-Drosselung wie Lighthouse an den Rechner angepasst (benchmarkIndex des Lighthouse-Schritts, sonst 4×)
    cmd: 'PERF_CPU_RATE="$(tsx scripts/ci/lighthouse-calibrated.ts --rate)" && echo "CPU-Drosselung ${PERF_CPU_RATE}×" && PERF_CPU_RATE="$PERF_CPU_RATE" pnpm run test:e2e --grep @perf --project=pixel-7',
    timeoutMin: 30,
  },
  // ---------- full: E2E je Gerät mit Debug-Build (e2e-full) ----------
  {
    id: 'build-debug',
    title: 'Seed + Build mit NEXT_PUBLIC_LEASH_DEBUG=1',
    modes: ['full'],
    cmd: `${FETCH_CACHE} && ${FRESH_DB} && pnpm run seed && pnpm run build`,
    env: { NEXT_PUBLIC_LEASH_DEBUG: '1' },
    timeoutMin: 45,
  },
  e2eStep('desktop'),
  e2eStep('iphone-15'),
  e2eStep('pixel-7'),
  // ---------- full: Docker (docker-Job) ----------
  {
    id: 'docker',
    title: 'Docker-Image (Build ohne DB, ≤ 500 MB, UID 1001)',
    modes: ['full'],
    requires: 'docker',
    cmd: 'docker build -t planetclaire-ci:local . && size=$(docker image inspect planetclaire-ci:local --format "{{.Size}}") && echo "Image: $((size / 1024 / 1024)) MB" && test "$size" -le 524288000 && test "$(docker run --rm --entrypoint id planetclaire-ci:local -u)" = "1001"',
    timeoutMin: 45,
  },
  // ---------- full: Vorschau-Export (preview-export.yml) ----------
  {
    id: 'preview',
    title: 'Vorschau-Export + Export-Test + Budget',
    modes: ['full'],
    cmd: "pnpm run preview:export && pnpm run test:preview-export && node -e \"const r=require('./dist/planet-claire-vorschau.report.json');const b=r.budget&&r.budget.result;console.log('Budget:',b);if(b==='fail')process.exit(1)\"",
    timeoutMin: 60,
  },
  // ---------- art (art-qa.yml) ----------
  {
    id: 'art-seed',
    title: 'Beispielbestand',
    modes: ['art'],
    cmd: 'pnpm run seed',
    timeoutMin: 15,
  },
  {
    id: 'art-build',
    title: 'QA-Build (art:build, .next-art)',
    modes: ['art'],
    cmd: 'pnpm run art:build',
    timeoutMin: 45,
  },
  {
    id: 'art-record',
    title: 'Aufnahme (art:record, 2 Worker)',
    modes: ['art'],
    cmd: 'pnpm run art:record',
    env: { ART_WORKERS: '2' },
    timeoutMin: 90,
  },
  {
    id: 'art-metrics',
    always: true,
    title: 'Auswertung (art:metrics)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:metrics ${artRun(ctx)}`,
    timeoutMin: 20,
  },
  {
    id: 'art-sheets',
    always: true,
    title: 'Kontaktbögen (art:sheets)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:sheets ${artRun(ctx)}`,
    timeoutMin: 20,
  },
  {
    id: 'art-check',
    always: true,
    title: 'Prüfung (art:check --evidence)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:check ${artRun(ctx)} --evidence`,
    timeoutMin: 20,
  },
  {
    id: 'art-bundle',
    title: 'Bündel (art:bundle, lokal)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:bundle ${artRun(ctx)}`,
    timeoutMin: 20,
  },
]

function artRun(ctx: RunContext): string {
  if (!ctx.artRunId)
    throw new Error(
      'Keine Kunst-Aufnahme gefunden (artifacts/art-qa/<lauf-id>) – zuerst art-record.',
    )
  return ctx.artRunId
}

/** Alle Schritte eines Modus in Ausführungsreihenfolge. */
export function stepsFor(mode: Mode): Step[] {
  return ALL.filter((s) => s.modes.includes(mode))
}

/** Auswahl nach `--only`/`--from`; unbekannte Schritte → UsageError mit der Liste der gültigen. */
export function planSteps(opts: Pick<Options, 'mode' | 'only' | 'from'>): Step[] {
  const steps = stepsFor(opts.mode)
  const ids = steps.map((s) => s.id)
  const unknown = [...(opts.only ?? []), ...(opts.from ? [opts.from] : [])].filter(
    (id) => !ids.includes(id),
  )
  if (unknown.length)
    throw new UsageError(
      `Unbekannte Schritte für ${opts.mode}: ${unknown.join(', ')}. Gültig: ${ids.join(', ')}.`,
    )
  if (opts.only) return steps.filter((s) => opts.only!.includes(s.id))
  if (opts.from) return steps.slice(ids.indexOf(opts.from))
  return steps
}

/** Neueste Kunst-Lauf-ID (`YYYYMMDD-iterNN-<sha7>`) aus einer Verzeichnisliste. */
export function latestArtRun(names: readonly string[]): string | undefined {
  return names
    .filter((n) => /^[0-9]{8}-iter[0-9]{2}-[0-9a-f]{7}$/.test(n))
    .sort()
    .at(-1)
}

/** `owner/repo` aus der Remote-URL (GitHub direkt oder über einen Git-Proxy …/owner/repo[.git]). */
export function repoFromRemote(url: string): string | null {
  const m = /[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim())
  return m ? `${m[1]}/${m[2]}` : null
}

export type StepResult = 'passed' | 'failed' | 'skipped' | 'warn' | 'not-run'

export interface StepReport {
  id: string
  title: string
  result: StepResult
  seconds: number
  log: string
  note?: string
}

/** Kurzbilanz für Commit-Status und Zusammenfassung, z. B. „24/24 grün in 142 min“. */
export function summarize(reports: readonly StepReport[]): {
  ok: boolean
  line: string
} {
  const count = (r: StepResult) => reports.filter((s) => s.result === r).length
  const failed = count('failed')
  const notRun = count('not-run')
  const passed = count('passed')
  const minutes = Math.round(reports.reduce((s, r) => s + r.seconds, 0) / 60)
  const extra = [
    failed ? `${failed} rot` : '',
    count('skipped') ? `${count('skipped')} übersprungen` : '',
    count('warn') ? `${count('warn')} mit Hinweis` : '',
    notRun ? `${notRun} nicht gelaufen` : '',
  ].filter(Boolean)
  const ok = failed === 0 && notRun === 0
  return {
    ok,
    line: `${passed}/${reports.length} grün${extra.length ? `, ${extra.join(', ')}` : ''} in ${minutes} min`,
  }
}
