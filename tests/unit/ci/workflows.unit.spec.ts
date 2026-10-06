import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// P1.33 (ARCHITEKTUR §6.2–§6.4, AK-A-6-01 Teil, AK-A-6-02, AK-A-3-01): Die Workflow-Dateien werden geparst und auf
// Auslöser (kein `push`), Pflichtschritte, Umgebung, `permissions`, Upload-Bedingung, Aufbewahrung, Budget-Schritt und
// die Dependabot-Einstellung geprüft. Den Lauf selbst belegt der Phasenende-Lauf in CI.

type Step = {
  name?: string
  id?: string
  if?: string
  run?: string
  uses?: string
  with?: Record<string, unknown>
  env?: Record<string, unknown>
  'continue-on-error'?: boolean
}
type Job = {
  name?: string
  'timeout-minutes'?: number
  needs?: string | string[]
  if?: string
  env?: Record<string, unknown>
  services?: Record<string, { image?: string; env?: Record<string, unknown> }>
  steps: Step[]
  permissions?: Record<string, string>
  outputs?: Record<string, string>
  strategy?: { 'fail-fast'?: boolean; matrix?: Record<string, unknown> }
}
type Workflow = {
  name: string
  on: Record<string, unknown>
  concurrency?: { group: string; 'cancel-in-progress': boolean }
  permissions?: Record<string, string>
  env?: Record<string, unknown>
  jobs: Record<string, Job>
}

const ROOT = path.resolve(__dirname, '../../..')
const WF_DIR = path.join(ROOT, '.github/workflows')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const load = (file: string) => parse(readFileSync(path.join(WF_DIR, file), 'utf8')) as Workflow
const workflowFiles = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f))
/** Erlaubte Schreibrechte je Job (ARCHITEKTUR §6.5). */
const WRITE_ALLOWED: Record<string, string[]> = {
  'preview-export.yml/export': ['actions', 'pull-requests'],
  // P9.7: ältere art-qa-* vor dem Upload löschen (KUNST-QA §8)
  'art-qa.yml/art-qa': ['actions'],
  // P10.21: nur `publish` legt das Release an (ARCHITEKTUR §6.6); Probelauf und verify-asset bleiben bei `read`
  'release.yml/publish': ['contents'],
}

const ci = load('ci.yml')
const quick = ci.jobs.quick!
const stepIndex = (re: RegExp) => quick.steps.findIndex((s) => re.test(s.run ?? ''))

describe('Workflows allgemein (§6.2)', () => {
  it('AK-A-6-01 kein Workflow hat einen push-Auslöser (release.yml erst ab P10)', () => {
    for (const file of workflowFiles) {
      const wf = load(file)
      if (file === 'release.yml') continue
      expect(Object.keys(wf.on), file).not.toContain('push')
    }
  })

  it('jede Datei hat concurrency, minimale permissions und timeout-minutes je Job', () => {
    for (const file of workflowFiles) {
      const wf = load(file)
      // release.yml (P10.21): eigene Gruppe `release`, nie abbrechen – geprüft in tests/unit/release/config.unit.spec.ts
      if (file !== 'release.yml') {
        expect(wf.concurrency?.group, file).toContain('${{ github.ref }}')
        expect(wf.concurrency?.['cancel-in-progress'], file).toBe(true)
      }
      expect(wf.permissions?.contents, file).toBe('read')
      for (const [name, job] of Object.entries(wf.jobs)) {
        expect(job['timeout-minutes'], `${file}/${name}`).toBeGreaterThan(0)
        const perms = { ...wf.permissions, ...job.permissions }
        for (const [scope, level] of Object.entries(perms)) {
          // Schreibrechte nur, wo die Aufgabe sie verlangt (preview-export P2.28; release P10)
          const allowed = WRITE_ALLOWED[`${file}/${name}`] ?? []
          if (allowed.includes(scope)) continue
          expect(level, `${file}/${name} ${scope}`).toBe('read')
        }
      }
    }
  })

  it('Playwright-Browser-Cache: Schlüssel je Browser-Satz, Installation immer mit --with-deps (WebKit nie aus Chromium-Cache)', () => {
    const jobs = workflowFiles.flatMap((file) =>
      Object.entries(load(file).jobs).map(([id, job]) => ({ id: `${file}/${id}`, job })),
    )
    const keys = { webkit: new Set<string>(), chromium: new Set<string>() }
    let checked = 0
    for (const { id, job } of jobs) {
      const cache = job.steps.find((s) => s.with?.path === '~/.cache/ms-playwright')
      const install = job.steps.find((s) => /playwright install/.test(s.run ?? ''))
      if (!cache && !install) continue
      checked++
      expect(cache, id).toBeDefined()
      expect(install, id).toBeDefined()
      const run = install!.run!.trim()
      expect(run, id).not.toContain('install-deps')
      expect(run, id).not.toContain('cache-hit')
      const m =
        /^pnpm exec playwright install --with-deps ((?:chromium|webkit)(?: (?:chromium|webkit))*)$/.exec(
          run,
        )
      expect(m, `${id}: ${run}`).not.toBeNull()
      const browsers = m![1]!.split(' ').sort()
      const key = String(cache!.with?.key)
      expect(key, id).toBe(
        `playwright-\${{ runner.os }}-${browsers.join('-')}-\${{ steps.pw.outputs.version }}`,
      )
      keys[browsers.includes('webkit') ? 'webkit' : 'chromium'].add(key)
      expect(job.steps.indexOf(cache!), id).toBeLessThan(job.steps.indexOf(install!))
    }
    expect(checked).toBeGreaterThanOrEqual(5)
    expect(keys.webkit.size).toBeGreaterThan(0)
    expect(keys.chromium.size).toBeGreaterThan(0)
    for (const k of keys.webkit) expect(keys.chromium.has(k)).toBe(false)
  })

  it('Actions sind per Major-Tag eingebunden', () => {
    for (const file of workflowFiles) {
      for (const job of Object.values(load(file).jobs)) {
        for (const s of job.steps) {
          if (s.uses) expect(s.uses, file).toMatch(/^[\w.-]+\/[\w.-]+@v\d+$/)
        }
      }
    }
  })
})

describe('ci.yml – Job quick (§6.3)', () => {
  it('AK-A-6-01 Auslöser nur pull_request (Typen laut §6.2) und workflow_dispatch', () => {
    expect(ci.name).toBe('CI')
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'workflow_dispatch'])
    expect((ci.on.pull_request as { types: string[] }).types).toEqual([
      'opened',
      'synchronize',
      'reopened',
      'ready_for_review',
    ])
    expect(ci.permissions).toEqual({ contents: 'read', actions: 'read' })
  })

  it('Job quick gegen planetclaire_test mit den Testwerten aus §6.3', () => {
    expect(quick.name).toBe('quick')
    // 60 min: Integrationstests allein ~30 min trotz 3 Workern (P8, Beispielbestand), danach Build, Budgets und Rauchtest.
    expect(quick['timeout-minutes']).toBeLessThanOrEqual(60)
    expect(quick.services?.postgres?.image).toBe('postgres:17-alpine')
    expect(quick.services?.postgres?.env?.POSTGRES_DB).toBe('planetclaire_test')
    const env = quick.env ?? {}
    const db = 'postgres://postgres:postgres@localhost:5432/planetclaire_test'
    expect(env).toMatchObject({
      APP_ENV: 'test',
      TZ: 'UTC',
      DATABASE_URL: db,
      DATABASE_URL_TEST: db,
      DB_POOL_MAX: '25',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      ADMIN_ROUTE: '/werkstatt',
      SEED_PREVIEW_MODE: 'true',
      SEED_NOW: '2026-10-15T10:00:00+02:00',
      SEED_ADMIN_EMAIL: 'admin@example.com',
      SEED_ADMIN_PASSWORD: 'ci-only-password-2026',
      STORAGE_DRIVER: 'local',
      EMAIL_DRIVER: 'file',
      PAYMENTS_DRIVER: 'mock',
      TRANSLATION_DRIVER: 'mock',
      NEXT_PUBLIC_LEASH_DEBUG: '1',
      NEXT_TELEMETRY_DISABLED: '1',
      E2E_SERVER: 'start',
    })
    expect(String(env.PAYLOAD_SECRET)).toMatch(/^ci-only-/)
    expect(String(env.CRON_SECRET)).toMatch(/^ci-only-/)
    expect(String(env.CRON_SECRET).length).toBeGreaterThanOrEqual(32)
  })

  it('AK-A-3-01 ohne Zugangsdaten: keine secrets, keine echten Treiber', () => {
    expect(read('.github/workflows/ci.yml')).not.toMatch(/\$\{\{\s*secrets\./)
    for (const [key, value] of Object.entries(quick.env ?? {})) {
      expect(String(value), key).not.toMatch(/sk_live|sk_test|rk_live|stripe|deepl|s3\b/i)
    }
  })

  it('Pflichtschritte 1–12 in der Reihenfolge aus §6.3', () => {
    const order = [
      /^pnpm install --frozen-lockfile$/,
      /pnpm run lint/,
      /pnpm run typecheck/,
      /pnpm run check:static/,
      /pnpm run test:unit/,
      /pnpm payload migrate && pnpm run check:migrations/,
      /pnpm run test:int/,
      /pnpm run seed && pnpm run build/,
      /pnpm run check:bundle && pnpm run check:external --built/,
      /pnpm run test:e2e --grep @smoke --project=desktop --project=iphone-15/,
      /gitleaks" detect/,
      /pnpm audit --prod --audit-level=critical/,
    ]
    const indices = order.map((re) => stepIndex(re))
    expect(
      indices.every((i) => i >= 0),
      JSON.stringify(indices),
    ).toBe(true)
    expect([...indices].sort((a, b) => a - b)).toEqual(indices)
  })

  it('Kennung zuerst: [ci:update-snapshots]/[ci:art] überspringen alle Schritte', () => {
    const first = quick.steps[0]!
    expect(first.id).toBe('mode')
    expect(first.run).toContain('\\[ci:update-snapshots\\]|\\[ci:art\\]')
    for (const s of quick.steps.slice(1)) {
      expect(s.if ?? '', s.name ?? s.uses).toMatch(/steps\.(mode|budget)\.outputs\./)
    }
  })

  it('Playwright Chromium + WebKit, Browser gecacht; gitleaks gepinnt mit Prüfsumme; audit high als Warnung', () => {
    const install = quick.steps.find((s) => /playwright install/.test(s.run ?? ''))!
    expect(install.run).toMatch(/chromium webkit/)
    const cache = quick.steps.find((s) => s.with?.path === '~/.cache/ms-playwright')
    expect(cache?.uses).toMatch(/^actions\/cache@/)
    expect(String(cache?.with?.key)).toContain('steps.pw.outputs.version')
    const leaks = quick.steps.find((s) => /gitleaks/.test(s.run ?? ''))!
    expect(leaks.env?.GITLEAKS_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(leaks.env?.GITLEAKS_SHA256).toMatch(/^[a-f0-9]{64}$/)
    expect(leaks.run).toContain('sha256sum -c')
    expect(existsSync(path.join(ROOT, '.gitleaks.toml'))).toBe(true)
    const audit = quick.steps[stepIndex(/pnpm audit/)]!
    expect(audit.run).toMatch(/--audit-level=high[\s\S]*GITHUB_STEP_SUMMARY/)
  })

  it('AK-A-6-02 Upload nur bei Fehler und upload_optional=true, 2 Tage, Budget-Schritt davor', () => {
    const budgetAt = quick.steps.findIndex((s) => s.run === 'pnpm run ci:artifacts')
    const uploadAt = quick.steps.findIndex((s) => /upload-artifact/.test(s.uses ?? ''))
    expect(budgetAt).toBeGreaterThan(0)
    expect(uploadAt).toBeGreaterThan(budgetAt)
    const budget = quick.steps[budgetAt]!
    expect(budget.id).toBe('budget')
    expect(budget.if).toMatch(/failure\(\)/)
    expect(budget.env?.GH_TOKEN).toBe('${{ github.token }}')
    const upload = quick.steps[uploadAt]!
    expect(upload.if).toMatch(/failure\(\)/)
    expect(upload.if).toContain("steps.budget.outputs.upload_optional == 'true'")
    expect(upload.with?.['retention-days']).toBe(2)
    expect(String(upload.with?.path)).toContain('playwright-report/')
    expect(String(upload.with?.path)).toContain('test-results/')
    expect(String(upload.with?.name)).toMatch(/^ci-report-\$\{\{ steps\.mode\.outputs\.sha7 \}\}$/)
    // Nur ein Upload, und der ist optional (Pflicht-Uploads erst ab P2)
    expect(quick.steps.filter((s) => /upload-artifact/.test(s.uses ?? ''))).toHaveLength(1)
  })

  it('Playwright: Traces nur bei Fehlern, kein Video (P1.31)', () => {
    const config = read('playwright.config.ts')
    expect(config).toMatch(/trace:\s*'retain-on-failure'/)
    expect(config).toMatch(/video:\s*'off'/)
    expect(config).not.toMatch(/video:\s*'(on|retain-on-failure|on-first-retry)'/)
  })

  it('Skripte aus §6.10 sind in package.json registriert', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
      .scripts
    expect(scripts['ci:artifacts']).toBe('tsx scripts/ci/artifact-budget.ts')
    expect(scripts['check:bundle']).toBe('tsx scripts/check-bundle.ts')
    expect(scripts['ci:minutes']).toBe('tsx scripts/ci/minutes.ts')
  })
})

// P2.28 (ARCHITEKTUR §6.2, §6.4, §6.5, §7.6; AK-A-6-01, AK-A-6-02, AK-12-02): Die Kennungs-Schritte werden mit einem
// Ersatz-`gh` in bash ausgeführt, damit die Regeln der Kennungstabelle §6.2 wirklich gelten (nicht nur als Text).
const SCRATCH = mkdtempSync(path.join(tmpdir(), 'pc-wf-'))
afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }))

/** Ersatz für `gh`: `api -X …` protokolliert, sonst gibt er $FAKE_OUT aus (Commit-Nachricht bzw. jq-Ergebnis). */
const fakeBin = path.join(SCRATCH, 'bin')
mkdirSync(fakeBin)
writeFileSync(
  path.join(fakeBin, 'gh'),
  '#!/bin/sh\nif [ "$1 $2" = "api -X" ]; then echo "$3 $4" >> "$FAKE_LOG"; exit 0; fi\nprintf \'%s\\n\' "$FAKE_OUT"\n',
)
chmodSync(path.join(fakeBin, 'gh'), 0o755)

interface RunOpts {
  event: 'pull_request' | 'workflow_dispatch'
  out?: string
  env?: Record<string, string>
}

const HEAD_SHA = 'abcdef1234567890'
const DISPATCH_SHA = '1234567fedcba098'

/** Führt ein `run:`-Skript aus einem Workflow aus und liefert $GITHUB_OUTPUT, Summary und das DELETE-Protokoll. */
function runStep(script: string, opts: RunOpts) {
  const expr: Record<string, string> = {
    'github.event_name': opts.event,
    'github.event.pull_request.head.sha': HEAD_SHA,
    'github.sha': DISPATCH_SHA,
    'github.repository': 'owner/repo',
  }
  const body = script.replace(/\$\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    if (!(key in expr)) throw new Error(`Ausdruck ohne Testwert: ${m}`)
    return expr[key]!
  })
  const dir = mkdtempSync(path.join(SCRATCH, 'run-'))
  const files = {
    GITHUB_OUTPUT: path.join(dir, 'out'),
    GITHUB_STEP_SUMMARY: path.join(dir, 'summary'),
    FAKE_LOG: path.join(dir, 'log'),
  }
  for (const f of Object.values(files)) writeFileSync(f, '')
  execFileSync('bash', ['-e', '-c', body], {
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      FAKE_OUT: opts.out ?? '',
      ...files,
      ...opts.env,
    },
  })
  const output = Object.fromEntries(
    readFileSync(files.GITHUB_OUTPUT, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )
  return {
    output,
    summary: readFileSync(files.GITHUB_STEP_SUMMARY, 'utf8'),
    deleted: readFileSync(files.FAKE_LOG, 'utf8').split('\n').filter(Boolean),
  }
}

const PR_TYPES = ['opened', 'synchronize', 'reopened', 'ready_for_review']
const findStep = (job: Job, re: RegExp) => job.steps.findIndex((s) => re.test(s.run ?? ''))
const usesOf = (job: Job) => job.steps.filter((s) => s.uses).map((s) => s.uses!.split('@')[0])

/** Budget-Schritt vor dem einzigen optionalen Upload (nur bei Fehler, 2 Tage, §6.2). */
function expectBudgetBeforeOptionalUpload(job: Job, namePrefix: string) {
  const budgetAt = job.steps.findIndex((s) => s.run === 'pnpm run ci:artifacts')
  const uploads = job.steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => /upload-artifact/.test(s.uses ?? '') && /failure\(\)/.test(s.if ?? ''))
  expect(uploads).toHaveLength(1)
  const { s: upload, i: uploadAt } = uploads[0]!
  expect(budgetAt).toBeGreaterThan(0)
  expect(uploadAt).toBeGreaterThan(budgetAt)
  const budget = job.steps[budgetAt]!
  expect(budget.id).toBe('budget')
  expect(budget.if).toMatch(/failure\(\)/)
  expect(budget['continue-on-error']).toBe(true)
  expect(budget.env?.GH_TOKEN).toBe('${{ github.token }}')
  expect(upload.if).toContain("steps.budget.outputs.upload_optional == 'true'")
  expect(upload.with?.['retention-days']).toBe(2)
  expect(String(upload.with?.name)).toMatch(
    new RegExp(`^${namePrefix}-\\$\\{\\{ [\\w.]+sha7 \\}\\}$`),
  )
}

describe('ci-full.yml (§6.4, P2.28)', () => {
  const full = load('ci-full.yml')
  const modeJob = full.jobs.mode!
  const kennung = modeJob.steps[0]!
  const mode = (msg: string) => runStep(kennung.run!, { event: 'pull_request', out: msg }).output
  const dispatch = (update: boolean) =>
    runStep(kennung.run!, {
      event: 'workflow_dispatch',
      env: { UPDATE_SNAPSHOTS: String(update) },
    }).output

  it('AK-A-6-01 Auslöser pull_request (Typen wie ci.yml) und workflow_dispatch mit update_snapshots, kein push', () => {
    expect(Object.keys(full.on).sort()).toEqual(['pull_request', 'workflow_dispatch'])
    expect((full.on.pull_request as { types: string[] }).types).toEqual(PR_TYPES)
    const inputs = (full.on.workflow_dispatch as { inputs: Record<string, { type: string }> })
      .inputs
    expect(inputs.update_snapshots?.type).toBe('boolean')
    expect(full.permissions).toEqual({ contents: 'read', actions: 'read' })
  })

  it('Job mode liest die Kennung ohne Checkout per gh api (Kopf-Commit des PR)', () => {
    expect(usesOf(modeJob)).toEqual([])
    expect(modeJob['timeout-minutes']).toBeLessThanOrEqual(5)
    expect(kennung.run).toContain(
      'gh api "repos/${{ github.repository }}/commits/$sha" --jq .commit.message',
    )
    expect(kennung.run).toContain('${{ github.event.pull_request.head.sha }}')
    expect(kennung.env?.GH_TOKEN).toBe('${{ github.token }}')
    expect(kennung.run).toContain('\\[ci:full\\s+(p[0-9]+)\\]')
    expect(Object.keys(modeJob.outputs ?? {}).sort()).toEqual([
      'art',
      'full',
      'phase',
      'sha7',
      'snapshots',
    ])
  })

  it('AK-A-6-01 Kennungstabelle §6.2: [ci:full pN], [ci:full], [ci:update-snapshots], [ci:art], ohne Kennung', () => {
    expect(mode('chore(P2): finish phase [ci:full p2]')).toMatchObject({
      full: 'true',
      phase: 'p2',
      snapshots: 'false',
      sha7: 'abcdef1',
    })
    expect(mode('chore(P10): finish phase [ci:full   p10]\n\nbody')).toMatchObject({
      full: 'true',
      phase: 'p10',
    })
    expect(mode('feat(P4.3): checkout [ci:full]')).toMatchObject({ full: 'true', phase: 'px' })
    expect(mode('test(P2.24): refs [ci:update-snapshots]')).toMatchObject({
      full: 'false',
      snapshots: 'true',
      phase: 'px',
    })
    expect(mode('chore(P9.18a): run art-qa [ci:art]')).toMatchObject({
      full: 'false',
      snapshots: 'false',
      art: 'true',
    })
    expect(mode('build(deps): bump foo')).toMatchObject({
      full: 'false',
      snapshots: 'false',
      art: 'false',
    })
    expect(dispatch(false)).toMatchObject({ full: 'true', snapshots: 'false', sha7: '1234567' })
    expect(dispatch(true)).toMatchObject({ full: 'false', snapshots: 'true' })
  })

  it('Jobs e2e-full, quality, snapshots hängen an mode und laufen nur in ihrem Fall', () => {
    expect(Object.keys(full.jobs)).toEqual(['mode', 'e2e-full', 'quality', 'docker', 'snapshots'])
    for (const name of ['e2e-full', 'quality', 'docker']) {
      expect(full.jobs[name]!.needs).toBe('mode')
      expect(full.jobs[name]!.if).toBe("needs.mode.outputs.full == 'true'")
    }
    expect(full.jobs.snapshots!.needs).toBe('mode')
    expect(full.jobs.snapshots!.if).toBe("needs.mode.outputs.snapshots == 'true'")
  })

  it('AK-A-3-01 Testwerte wie quick (ohne Debug-Flag auf Workflow-Ebene), keine secrets, Postgres-Service', () => {
    const { NEXT_PUBLIC_LEASH_DEBUG: _debug, ...quickEnv } = quick.env ?? {}
    expect(full.env).toEqual(quickEnv)
    expect(read('.github/workflows/ci-full.yml')).not.toMatch(/\$\{\{\s*secrets\./)
    for (const name of ['e2e-full', 'quality', 'snapshots']) {
      expect(full.jobs[name]!.services?.postgres?.image).toBe('postgres:17-alpine')
      expect(full.jobs[name]!.services?.postgres?.env?.POSTGRES_DB).toBe('planetclaire_test')
      expect(usesOf(full.jobs[name]!).slice(0, 3)).toEqual([
        'actions/checkout',
        'pnpm/action-setup',
        'actions/setup-node',
      ])
    }
  })

  it('e2e-full: je Projekt desktop, iphone-15 (WebKit), pixel-7 zwei Matrix-Jobs (Playwright-Hälften) mit je einem Build (Debug-Flag), ohne @visual/@perf (P3.16)', () => {
    const job = full.jobs['e2e-full']!
    expect(job.env?.NEXT_PUBLIC_LEASH_DEBUG).toBe('1')
    expect(job.strategy?.['fail-fast']).toBe(false)
    expect(job.strategy?.matrix?.project).toEqual(['desktop', 'iphone-15', 'pixel-7'])
    expect(job.strategy?.matrix?.shard).toEqual([1, 2])
    expect(job.name).toContain('${{ matrix.project }}')
    expect(job['timeout-minutes']).toBeLessThanOrEqual(40)
    const build = findStep(job, /pnpm run seed && pnpm run build/)
    const e2e = findStep(job, /pnpm run test:e2e/)
    expect(build).toBeGreaterThan(0)
    expect(e2e).toBeGreaterThan(build)
    expect(job.steps.filter((s) => /pnpm run build/.test(s.run ?? ''))).toHaveLength(1)
    const cmd = job.steps[e2e]!.run!
    expect(cmd).toContain('--project=${{ matrix.project }}')
    expect(cmd).toContain('--shard=${{ matrix.shard }}/2')
    expect(cmd).toContain('--grep-invert "@visual|@perf"')
    expect(cmd).not.toMatch(/--grep[ =]"?@/)
    expect(job.steps.find((s) => /playwright install/.test(s.run ?? ''))?.run).toMatch(
      /chromium webkit/,
    )
    expectBudgetBeforeOptionalUpload(
      job,
      'ci-full-e2e-report-\\$\\{\\{ matrix\\.project \\}\\}-\\$\\{\\{ matrix\\.shard \\}\\}',
    )
  })

  it('quality: Abdeckung → Build ohne Debug → check:no-debug → test:visual → test:perf → @perf auf pixel-7', () => {
    const job = full.jobs.quality!
    expect(job.env?.NEXT_PUBLIC_LEASH_DEBUG).toBeUndefined()
    expect(full.env?.NEXT_PUBLIC_LEASH_DEBUG).toBeUndefined()
    const order = [
      // P4.25 / §7.8: Abdeckung (Unit + Int) vor dem Seed, weil sie die Test-DB zurücksetzt.
      /^pnpm run test:coverage$/,
      /pnpm run seed && pnpm run build/,
      /^pnpm run check:no-debug$/,
      /^pnpm run test:visual$/,
      /^pnpm run test:perf$/,
      /^pnpm run test:e2e --grep @perf --project=pixel-7$/,
    ].map((re) => findStep(job, re))
    expect(
      order.every((i) => i >= 0),
      JSON.stringify(order),
    ).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const s of job.steps)
      expect(s['continue-on-error'] ?? false, s.name).toBe(s.id === 'budget')
    expectBudgetBeforeOptionalUpload(job, 'ci-full-quality-report')
  })

  it('P4.2/P10.1 e2e-full: alle Unit-Tests zusätzlich mit TZ=Europe/Berlin', () => {
    const job = full.jobs['e2e-full']!
    const step = findStep(job, /^pnpm run test:unit$/)
    expect(step).toBeGreaterThan(findStep(job, /pnpm install --frozen-lockfile/))
    expect(job.steps[step]!.env?.TZ).toBe('Europe/Berlin')
    expect(full.env?.TZ).toBe('UTC')
  })

  it('T-12 quality: fehlende Referenzbilder = Hinweis im Summary (nicht rot), vorhandene werden streng geprüft', () => {
    const job = full.jobs.quality!
    const refs = job.steps.find((s) => s.id === 'visual-refs')!
    const visual = job.steps[findStep(job, /^pnpm run test:visual$/)]!
    expect(visual.if).toBe("steps.visual-refs.outputs.present == 'true'")
    const cwd = mkdtempSync(path.join(SCRATCH, 'refs-'))
    const run = () =>
      execFileSync('bash', ['-e', '-c', `cd "${cwd}"\n${refs.run!}`], {
        env: {
          ...process.env,
          GITHUB_OUTPUT: path.join(cwd, 'out'),
          GITHUB_STEP_SUMMARY: path.join(cwd, 'summary'),
        },
      })
    run()
    expect(readFileSync(path.join(cwd, 'out'), 'utf8')).toBe('present=false\n')
    expect(readFileSync(path.join(cwd, 'summary'), 'utf8')).toMatch(
      /Noch keine visuellen Referenzbilder.*\[ci:update-snapshots\]/,
    )
    const dir = path.join(cwd, 'tests/visual/__screenshots__/pages.visual.spec.ts')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'home-desktop-linux.png'), '')
    writeFileSync(path.join(cwd, 'out'), '')
    run()
    expect(readFileSync(path.join(cwd, 'out'), 'utf8')).toBe('present=true\n')
  })

  it('T-12 snapshots: Build ohne Debug, test:visual --update-snapshots, Pflicht-Upload visual-snapshots-<sha7> (2 Tage)', () => {
    const job = full.jobs.snapshots!
    expect(job.env?.NEXT_PUBLIC_LEASH_DEBUG).toBeUndefined()
    const build = findStep(job, /pnpm run seed && pnpm run build/)
    const update = findStep(job, /^pnpm run test:visual --update-snapshots$/)
    expect(build).toBeGreaterThan(0)
    expect(update).toBeGreaterThan(build)
    const upload = job.steps.find((s) => /upload-artifact/.test(s.uses ?? ''))!
    expect(upload.if).toBeUndefined()
    expect(upload.with).toMatchObject({
      name: 'visual-snapshots-${{ needs.mode.outputs.sha7 }}',
      path: 'tests/visual/__screenshots__/',
      'retention-days': 2,
      'if-no-files-found': 'error',
    })
  })
})

describe('preview-export.yml (§6.5, P2.28)', () => {
  const pv = load('preview-export.yml')
  const job = pv.jobs.export!
  const kennung = job.steps[0]!
  const mode = (msg: string) => runStep(kennung.run!, { event: 'pull_request', out: msg }).output
  const step = (re: RegExp) => job.steps[findStep(job, re)]!

  it('AK-A-6-01 Auslöser pull_request (Typen wie ci.yml) und workflow_dispatch, kein push; ein Job export', () => {
    expect(pv.name).toBe('Vorschau-Export')
    expect(Object.keys(pv.on).sort()).toEqual(['pull_request', 'workflow_dispatch'])
    expect((pv.on.pull_request as { types: string[] }).types).toEqual(PR_TYPES)
    expect(Object.keys(pv.jobs)).toEqual(['export'])
    expect(job['timeout-minutes']).toBeLessThanOrEqual(30)
  })

  it('permissions: Workflow nur contents: read; export zusätzlich actions: write und pull-requests: write', () => {
    expect(pv.permissions).toEqual({ contents: 'read' })
    expect(job.permissions).toEqual({
      contents: 'read',
      actions: 'write',
      'pull-requests': 'write',
    })
    expect(read('.github/workflows/preview-export.yml')).not.toMatch(/\$\{\{\s*secrets\./)
  })

  it('AK-A-6-01 Kennung zuerst, ohne Checkout: nur [ci:full pN] exportiert (Regex \\[ci:full\\s+(p\\d+)\\])', () => {
    expect(kennung.id).toBe('mode')
    expect(kennung.uses).toBeUndefined()
    expect(kennung.run).toContain(
      'gh api "repos/${{ github.repository }}/commits/$sha" --jq .commit.message',
    )
    expect(kennung.run).toContain('\\[ci:full\\s+(p[0-9]+)\\]')
    expect(mode('chore(P2): finish phase [ci:full p2]')).toMatchObject({
      run: 'true',
      phase: 'p2',
      sha7: 'abcdef1',
    })
    expect(mode('chore(P3): finish [ci:full  p3]')).toMatchObject({ run: 'true', phase: 'p3' })
    expect(mode('feat(P4.3): checkout [ci:full]')).toMatchObject({ run: 'false' })
    expect(mode('test(P2.24): refs [ci:update-snapshots]')).toMatchObject({ run: 'false' })
    expect(mode('chore(P9.18a): run art-qa [ci:art]')).toMatchObject({ run: 'false' })
    expect(mode('build(deps): bump foo')).toMatchObject({ run: 'false' })
    const skipped = runStep(kennung.run!, { event: 'pull_request', out: 'x [ci:full]' })
    expect(skipped.summary).toContain('übersprungen')
    const d = (phase: string) =>
      runStep(kennung.run!, { event: 'workflow_dispatch', env: { INPUT_PHASE: phase } }).output
    expect(d('P3')).toMatchObject({ run: 'true', phase: 'p3', sha7: '1234567' })
    expect(d('')).toMatchObject({ run: 'true', phase: '' })
    expect(d('p3; rm -rf /')).toMatchObject({ run: 'true', phase: '' })
  })

  it('alle weiteren Schritte hängen an der Kennung; Checkout des Kopf-Commits', () => {
    for (const s of job.steps.slice(1)) {
      expect(s.if ?? '', s.name ?? s.uses).toMatch(/steps\.(mode|budget)\.outputs\./)
    }
    const checkout = job.steps.find((s) => /^actions\/checkout@/.test(s.uses ?? ''))!
    expect(checkout.with?.ref).toBe('${{ steps.mode.outputs.sha }}')
    expect(usesOf(job).slice(0, 3)).toEqual([
      'actions/checkout',
      'pnpm/action-setup',
      'actions/setup-node',
    ])
    expect(job.services?.postgres?.image).toBe('postgres:17-alpine')
  })

  it('Ablauf: Installation → Chromium → preview:export (PREVIEW_PHASE) → test:preview-export ohne continue-on-error → Upload → Aufräumen → Summary → Kommentar', () => {
    const order = [
      /^pnpm install --frozen-lockfile$/,
      /playwright install --with-deps chromium$/m,
      /^pnpm run preview:export$/,
      /^pnpm run test:preview-export$/,
    ].map((re) => findStep(job, re))
    const at = (re: RegExp) => job.steps.findIndex((s) => re.test(s.name ?? ''))
    order.push(
      at(/^Vorschau hochladen$/),
      at(/aufräumen/),
      at(/^Kurzanleitung$/),
      at(/^PR-Kommentar$/),
    )
    expect(
      order.every((i) => i > 0),
      JSON.stringify(order),
    ).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(step(/^pnpm run preview:export$/).env?.PREVIEW_PHASE).toBe(
      '${{ steps.mode.outputs.phase }}',
    )
    const test = step(/^pnpm run test:preview-export$/)
    expect(test['continue-on-error']).toBeUndefined()
    expect(test.if).toBe("steps.mode.outputs.run == 'true'")
    // Nach einem Fehler läuft kein Pflicht-Schritt mehr (Standard-Bedingung success()).
    for (const s of job.steps.slice(1)) {
      if (s.id === 'budget') continue
      expect(s['continue-on-error'] ?? false, s.name ?? s.uses).toBe(false)
      if (!/upload_optional/.test(s.if ?? ''))
        expect(s.if ?? '').not.toMatch(/always\(\)|failure\(\)/)
    }
  })

  it('AK-12-02 Artefakt planet-claire-vorschau-<phase>-<sha7> mit HTML + Bericht, 30 Tage', () => {
    const nameStep = job.steps.find((s) => s.id === 'name')!
    expect(nameStep.run).toContain('dist/planet-claire-vorschau.report.json')
    expect(nameStep.run).toContain(
      'artifact=planet-claire-vorschau-$phase-${{ steps.mode.outputs.sha7 }}',
    )
    const upload = job.steps.find((s) => s.name === 'Vorschau hochladen')!
    expect(upload.uses).toBe('actions/upload-artifact@v7')
    expect(upload.with?.name).toBe('${{ steps.name.outputs.artifact }}')
    expect(String(upload.with?.path).trim().split('\n')).toEqual([
      'dist/planet-claire-vorschau.html',
      'dist/planet-claire-vorschau.report.json',
    ])
    expect(upload.with?.['retention-days']).toBe(30)
    expect(upload.with?.['if-no-files-found']).toBe('error')
  })

  it('AK-A-6-02 Aufräumen: nur die 3 neuesten planet-claire-vorschau-* bleiben', () => {
    const cleanup = job.steps.find((s) => /aufräumen/.test(s.name ?? ''))!
    expect(cleanup.env?.GH_TOKEN).toBe('${{ github.token }}')
    expect(cleanup.run).toContain('startswith("planet-claire-vorschau-")')
    // Ersatz-gh liefert das jq-Ergebnis (created_at id) von 5 Vorschau-Artefakten, unsortiert.
    const listed = [
      '2026-09-20T10:00:00Z 105',
      '2026-09-01T10:00:00Z 101',
      '2026-09-15T10:00:00Z 104',
      '2026-09-05T10:00:00Z 102',
      '2026-09-10T10:00:00Z 103',
    ].join('\n')
    const { deleted } = runStep(cleanup.run!, { event: 'pull_request', out: listed })
    expect(deleted.sort()).toEqual([
      'DELETE repos/owner/repo/actions/artifacts/101',
      'DELETE repos/owner/repo/actions/artifacts/102',
    ])
    expect(
      runStep(cleanup.run!, {
        event: 'pull_request',
        out: listed.split('\n').slice(0, 3).join('\n'),
      }).deleted,
    ).toEqual([])
  })

  it('R-182 Kurzanleitung im Summary und PR-Kommentar: Checks → Summary → Artifacts, nur privat ansehen', () => {
    const summary = job.steps.find((s) => s.name === 'Kurzanleitung')!
    expect(summary.run).toContain('GITHUB_STEP_SUMMARY')
    expect(summary.run).toMatch(/entpacken/)
    expect(summary.run).toContain('planet-claire-vorschau.html')
    const comment = job.steps.find((s) => s.name === 'PR-Kommentar')!
    const hint =
      'Nur privat ansehen, nicht weitergeben, nicht veröffentlichen – interne Vorschau mit Beispieldaten und Platzhalter-Rechtstexten.'
    expect(summary.run).toContain(hint)
    expect(comment.run).toContain(hint)
    expect(comment.run).toContain('Checks → Summary → Artifacts')
    expect(comment.run).toContain('Neue Vorschau-Datei für Phase $label')
    expect(comment.env?.PR_NUMBER).toBe('${{ github.event.pull_request.number }}')
    expect(comment.run).toContain(
      'gh pr list --repo "${{ github.repository }}" --head "$BRANCH" --state open',
    )
    // anlegen oder aktualisieren (ein Kommentar je PR, Marker)
    expect(comment.run).toMatch(
      /-X PATCH "repos\/\$\{\{ github\.repository \}\}\/issues\/comments\/\$existing"/,
    )
    expect(comment.run).toMatch(
      /-X POST "repos\/\$\{\{ github\.repository \}\}\/issues\/\$pr\/comments"/,
    )
  })

  it('AK-A-6-02 bei Fehler: kein Vorschau-Upload, Fehlerbericht nur nach dem Budget-Schritt (2 Tage)', () => {
    expectBudgetBeforeOptionalUpload(job, 'preview-export-report')
    const upload = job.steps.find((s) => s.name === 'Vorschau hochladen')!
    expect(upload.if).not.toMatch(/failure\(\)|always\(\)/)
  })
})

describe('Repo-Pflege', () => {
  it('dependabot.yml: nur Sicherheits-Updates (open-pull-requests-limit: 0), kein Automerge-Workflow', () => {
    const cfg = parse(read('.github/dependabot.yml')) as {
      version: number
      updates: { 'package-ecosystem': string; 'open-pull-requests-limit': number }[]
    }
    expect(cfg.version).toBe(2)
    expect(cfg.updates.map((u) => u['package-ecosystem']).sort()).toEqual(['github-actions', 'npm'])
    for (const u of cfg.updates) expect(u['open-pull-requests-limit']).toBe(0)
    expect(workflowFiles).not.toContain('dependabot-automerge.yml')
    for (const file of workflowFiles) {
      expect(readFileSync(path.join(WF_DIR, file), 'utf8'), file).not.toMatch(
        /gh pr merge|workflow_run/,
      )
    }
  })

  it('PR-Vorlage: deutsche Checkliste, keine Kennung zum Überspringen der CI', () => {
    const tpl = read('.github/pull_request_template.md')
    for (const part of [
      'Lokal geprüft',
      'Tests',
      '`pnpm check`',
      'docs/FORTSCHRITT.md',
      'docs/OFFENE-PUNKTE.md',
      'Vorschau-Datei',
    ]) {
      expect(tpl).toContain(part)
    }
    expect(tpl).not.toMatch(/\[skip ci\]|\[ci skip\]|\[no ci\]/i)
  })
})
