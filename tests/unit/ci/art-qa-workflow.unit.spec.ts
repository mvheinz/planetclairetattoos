import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// P9.7 `.github/workflows/art-qa.yml` (KUNST-QA §8/§9, ARCHITEKTUR §6.2): Auslöser inkl. `[ci:art]` und Label `art`,
// kein `push`, Kennung ohne Checkout, Chromium + WebKit, Schrittfolge, Löschen vor dem Upload, Rot-Pfad mit
// `if: failure()` nach dem Budget-Schritt, `retention-days`. Dazu: die schnelle Teilmenge läuft in `ci-full.yml`.

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
  'timeout-minutes'?: number
  permissions?: Record<string, string>
  services?: Record<string, { image?: string }>
  steps: Step[]
}
type Workflow = {
  on: Record<string, { types?: string[] } | null>
  permissions: Record<string, string>
  env: Record<string, string>
  jobs: Record<string, Job>
}

const ROOT = path.resolve(__dirname, '../../..')
const raw = readFileSync(path.join(ROOT, '.github/workflows/art-qa.yml'), 'utf8')
const wf = parse(raw) as Workflow
const job = wf.jobs['art-qa']!
const step = (name: string) => {
  const s = job.steps.find((x) => x.name === name)
  expect(s, name).toBeDefined()
  return s!
}
const index = (name: string) => job.steps.findIndex((x) => x.name === name)

/** Kennungs-Skript mit Ereignis, Nachricht und Labels lokal nachspielen (bash). */
function decide(event: string, action: string, msg: string, labels: string, label = ''): boolean {
  const script = step('Kennung')
    .run!.replace(/\$\{\{ github\.event_name \}\}/g, event)
    .replace(/\$\{\{ github\.event\.pull_request\.head\.sha \}\}/g, 'abcdef0123')
    .replace(/\$\{\{ github\.sha \}\}/g, 'abcdef0123')
    .replace(/\$\{\{ github\.repository \}\}/g, 'o/r')
    .replace(/msg=\$\(gh api [^)]*\)/, 'msg="$MSG"')
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'art-qa-')), 'output')
  execFileSync('bash', ['-c', script], {
    env: {
      ...process.env,
      MSG: msg,
      EVENT_ACTION: action,
      LABEL_NAME: label,
      PR_LABELS: labels,
      GITHUB_OUTPUT: out,
      GITHUB_STEP_SUMMARY: '/dev/null',
    },
  })
  return /^run=true$/m.test(readFileSync(out, 'utf8'))
}

describe('P9.7 art-qa.yml – Auslöser und Kennung', () => {
  it('nur pull_request (opened, synchronize, reopened, labeled) und workflow_dispatch, kein push', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['pull_request', 'workflow_dispatch'])
    expect(wf.on.pull_request!.types!.sort()).toEqual([
      'labeled',
      'opened',
      'reopened',
      'synchronize',
    ])
    expect(raw).not.toMatch(/^\s*push:/m)
  })

  it('Kennung zuerst ohne Checkout; alle weiteren Schritte hängen an run bzw. an der Lauf-ID', () => {
    expect(job.steps[0]!.name).toBe('Kennung')
    expect(job.steps[0]!.run).toContain(
      'gh api "repos/${{ github.repository }}/commits/$sha" --jq .commit.message',
    )
    for (const s of job.steps.slice(1))
      expect(s.if ?? '', s.name ?? s.uses).toMatch(
        /steps\.(mode\.outputs\.run == 'true'|runid\.outputs\.id != '')/,
      )
  })

  it('[ci:art] im Kopf-Commit oder Label art startet; normale PR-Commits und fremde Labels nicht', () => {
    expect(
      decide('pull_request', 'synchronize', 'chore(P9.18): record iteration 01 [ci:art]', ''),
    ).toBe(true)
    expect(decide('pull_request', 'synchronize', 'feat(P9.9): redraw [ci:full]', '')).toBe(false)
    expect(decide('pull_request', 'synchronize', 'feat(P9.9): redraw', 'art')).toBe(true)
    expect(decide('pull_request', 'labeled', 'feat: x', 'art', 'art')).toBe(true)
    expect(decide('pull_request', 'labeled', 'feat: x', 'art,doku', 'doku')).toBe(false)
    expect(decide('pull_request', 'opened', 'feat: x', 'artwork')).toBe(false)
    expect(decide('workflow_dispatch', '', '', '')).toBe(true)
  })
})

describe('P9.7 art-qa.yml – Ablauf (KUNST-QA §9)', () => {
  it('Postgres-Service, Testwerte ohne secrets, minimale permissions (nur actions: write im Job)', () => {
    expect(job.services!.postgres!.image).toBe('postgres:17-alpine')
    expect(raw).not.toContain('secrets.')
    expect(wf.permissions).toEqual({ contents: 'read' })
    expect(job.permissions).toEqual({ contents: 'read', actions: 'write' })
    expect(wf.env.PAYMENTS_DRIVER).toBe('mock')
    expect(job['timeout-minutes']).toBeLessThanOrEqual(60)
  })

  it('Aufnahme mit 2 Workern für die Bild-Läufe (Laufzeit, OFFENE-PUNKTE 2026-10-05 P9.7)', () => {
    expect((step('Aufnahme') as { env?: Record<string, string> }).env?.ART_WORKERS).toBe('2')
  })

  it('Kassen-Szenarien (SC-06/07/09) laufen getrennt von den übrigen und mit höchstens 2 Workern', () => {
    const rec = readFileSync(path.join(ROOT, 'scripts/art/record.ts'), 'utf8')
    expect(rec).toContain('sc-0[679]')
    expect(rec).toContain('Math.min(workers, 2)')
    expect(readFileSync(path.join(ROOT, 'tests/art/helpers/commerce.ts'), 'utf8')).toMatch(
      /höchstens 2 parallele Worker/,
    )
  })

  it('Chromium und WebKit, nie PW_SKIP_WEBKIT', () => {
    expect(step('Playwright Chromium + WebKit').run).toBe(
      'pnpm exec playwright install --with-deps chromium webkit',
    )
    expect(raw).not.toContain('PW_SKIP_WEBKIT')
  })

  it('Schritte in der Reihenfolge Install → migrate → seed → art:build → Start → record → metrics → sheets → check → bundle → löschen → Upload', () => {
    const order = [
      'Installation',
      'Migrationen',
      'Beispielbestand',
      'QA-Build',
      'QA-Server starten',
      'Aufnahme',
      'Auswertung',
      'Kontaktbögen',
      'Prüfung',
      'Bündel',
      'Ältere Bündel löschen',
      'Bündel hochladen',
    ]
    const idx = order.map(index)
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(step('Migrationen').run).toContain('pnpm payload migrate')
    expect(step('Beispielbestand').run).toBe('pnpm run seed')
    expect(step('QA-Build').run).toBe('pnpm run art:build')
    expect(step('Aufnahme').run).toBe('pnpm run art:record')
    expect(step('Prüfung').run).toContain('pnpm run art:check')
    expect(step('Bündel').run).toContain('pnpm run art:bundle')
  })

  it('grün: erst alle älteren art-qa-* löschen, dann art-qa-<lauf-id> (Ordner bundle/) für 30 Tage', () => {
    const del = step('Ältere Bündel löschen')
    expect(del.if).toMatch(/^success\(\)/)
    expect(del.run).toContain('startswith("art-qa-")')
    expect(del.run).toContain('gh api -X DELETE')
    const up = step('Bündel hochladen')
    expect(index('Ältere Bündel löschen')).toBeLessThan(index('Bündel hochladen'))
    expect(up.if).toMatch(/^success\(\)/)
    expect(up.uses).toBe('actions/upload-artifact@v7')
    expect(up.with).toMatchObject({
      name: 'art-qa-${{ steps.runid.outputs.id }}',
      'retention-days': 30,
      'if-no-files-found': 'error',
    })
    expect(String(up.with!.path)).toContain('/bundle/')
  })

  it('rot: Budget-Schritt (ci:artifacts) mit if: failure(), dann nur art-qa-check-<lauf-id> mit check.* und metrics, 2 Tage', () => {
    const budget = step('Artefakt-Budget')
    expect(budget.if).toMatch(/^failure\(\)/)
    expect(budget.run).toBe('pnpm run ci:artifacts')
    expect(budget['continue-on-error']).toBe(true)
    const up = step('Prüfbericht hochladen')
    expect(index('Artefakt-Budget')).toBeLessThan(index('Prüfbericht hochladen'))
    expect(up.if).toMatch(/^failure\(\) && steps\.budget\.outputs\.upload_optional == 'true'/)
    expect(up.with!.name).toBe('art-qa-check-${{ steps.runid.outputs.id }}')
    expect(up.with!['retention-days']).toBe(2)
    const paths = String(up.with!.path)
      .trim()
      .split('\n')
      .map((p) => p.trim())
    expect(
      paths.map((p) =>
        p.replace(/^artifacts\/art-qa\/\$\{\{ steps\.runid\.outputs\.id \}\}\//, ''),
      ),
    ).toEqual(['check.json', 'check.md', 'metrics/*.json'])
  })
})

describe('P9.7 Dauer-Gate in ci-full.yml', () => {
  it('e2e-full führt tests/e2e (inkl. art-gate.e2e.spec.ts) in jedem [ci:full …]-Lauf aus, Projekt pixel-7 in der Matrix', () => {
    const full = parse(readFileSync(path.join(ROOT, '.github/workflows/ci-full.yml'), 'utf8')) as {
      jobs: Record<
        string,
        { if?: string; strategy?: { matrix?: { project?: string[] } }; steps: Step[] }
      >
    }
    const e2e = full.jobs['e2e-full']!
    expect(e2e.if).toBe("needs.mode.outputs.full == 'true'")
    // P14.13: Projekte aus dem Job mode – Phasenende alle drei; im Zwischenlauf ohne pixel-7-Jobs läuft das Gate in
    // desktop 1/2 mit `--project=pixel-7` (workflows.unit.spec.ts prüft die Kennung).
    expect(e2e.strategy!.matrix!.project).toBe('${{ fromJSON(needs.mode.outputs.projects) }}')
    const gate = e2e.steps.find((s) => /art-gate\.e2e\.spec\.ts/.test(s.run ?? ''))!
    expect(gate.run).toContain('--project=pixel-7')
    expect(gate.if).toContain("!contains(needs.mode.outputs.projects, 'pixel-7')")
    const run = e2e.steps.find((s) => /test:e2e/.test(s.run ?? ''))!.run!
    expect(run).not.toMatch(/art-gate|@art/)
    const cfg = readFileSync(path.join(ROOT, 'playwright.config.ts'), 'utf8')
    expect(cfg).not.toContain('art-gate')
    const spec = readFileSync(path.join(ROOT, 'tests/e2e/art-gate.e2e.spec.ts'), 'utf8')
    for (const id of ['AK-DS-09', 'AK-DS-11', 'AK-DS-13', 'AK-DS-14', 'LG-01'])
      expect(spec).toContain(id)
  })
})
