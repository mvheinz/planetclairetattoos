import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
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
}
type Workflow = {
  name: string
  on: Record<string, unknown>
  concurrency?: { group: string; 'cancel-in-progress': boolean }
  permissions?: Record<string, string>
  jobs: Record<string, Job>
}

const ROOT = path.resolve(__dirname, '../../..')
const WF_DIR = path.join(ROOT, '.github/workflows')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const load = (file: string) => parse(readFileSync(path.join(WF_DIR, file), 'utf8')) as Workflow
const workflowFiles = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f))

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
      expect(wf.concurrency?.group, file).toContain('${{ github.ref }}')
      expect(wf.concurrency?.['cancel-in-progress'], file).toBe(true)
      expect(wf.permissions?.contents, file).toBe('read')
      for (const [name, job] of Object.entries(wf.jobs)) {
        expect(job['timeout-minutes'], `${file}/${name}`).toBeGreaterThan(0)
        const perms = { ...wf.permissions, ...job.permissions }
        for (const [scope, level] of Object.entries(perms)) {
          // Schreibrechte erst mit ihren Aufgaben (preview-export, release, P2/P10)
          expect(level, `${file}/${name} ${scope}`).toBe('read')
        }
      }
    }
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
    expect(quick['timeout-minutes']).toBeLessThanOrEqual(30)
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

describe('ci-full.yml – Gerüst (§6.4)', () => {
  const full = load('ci-full.yml')

  it('nur workflow_dispatch mit Eingabe update_snapshots, kein push', () => {
    expect(Object.keys(full.on)).toEqual(['workflow_dispatch'])
    const inputs = (full.on.workflow_dispatch as { inputs: Record<string, { type: string }> })
      .inputs
    expect(inputs.update_snapshots?.type).toBe('boolean')
  })

  it('Job mode und E2E-Skelett, das an mode hängt', () => {
    expect(Object.keys(full.jobs)).toEqual(['mode', 'e2e-full'])
    expect(full.jobs['e2e-full']!.needs).toBe('mode')
    expect(full.jobs['e2e-full']!.if).toContain("needs.mode.outputs.full == 'true'")
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
