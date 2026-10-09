import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  databaseUrl,
  DEFAULT_DB,
  DEFAULT_PORT,
  latestArtRun,
  parseArgs,
  planSteps,
  ports,
  repoFromRemote,
  SKIP_MARKER,
  envFor,
  inheritedEnv,
  serverEnv,
  STRIPPED_ENV,
  stepsFor,
  summarize,
  UsageError,
  type RunContext,
  type StepReport,
} from '../../../scripts/ci/local-plan'

// P14.15 (U-65/U-66): Planung der lokalen Prüfschleuse `pnpm ci:local` – Optionen, Umgebung, Schritte je Modus. Die
// Schritte selbst laufen hier nicht (das belegt der Probelauf in der Sitzung).

const ROOT = path.resolve(__dirname, '../../..')
const ids = (mode: 'quick' | 'full' | 'art') => stepsFor(mode).map((s) => s.id)
const cmdOf = (mode: 'quick' | 'full' | 'art', id: string, ctx?: Partial<RunContext>) => {
  const step = stepsFor(mode).find((s) => s.id === id)!
  const full: RunContext = { opts: parseArgs([mode]), ...ctx }
  return typeof step.cmd === 'function' ? step.cmd(full) : step.cmd
}

describe('parseArgs', () => {
  it('Standardwerte: DB planetclaire_ci, Port 3300, kein Status, anhalten bei Rot', () => {
    expect(parseArgs(['quick'])).toEqual({
      mode: 'quick',
      db: DEFAULT_DB,
      port: DEFAULT_PORT,
      only: null,
      from: null,
      status: false,
      keepGoing: false,
      e2eArgs: [],
      dryRun: false,
    })
    expect(DEFAULT_DB).toBe('planetclaire_ci')
    expect(DEFAULT_PORT).toBe(3300)
  })

  it('Optionen und Playwright-Argumente nach --', () => {
    const o = parseArgs([
      'full',
      '--db',
      'planetclaire_ci2',
      '--port',
      '3400',
      '--only',
      'build-debug, e2e-desktop',
      '--status',
      '--keep-going',
      '--',
      'tests/e2e/home.e2e.spec.ts',
      '--grep',
      'x',
    ])
    expect(o).toMatchObject({
      mode: 'full',
      db: 'planetclaire_ci2',
      port: 3400,
      only: ['build-debug', 'e2e-desktop'],
      status: true,
      keepGoing: true,
      e2eArgs: ['tests/e2e/home.e2e.spec.ts', '--grep', 'x'],
    })
    expect(parseArgs(['art', '--from', 'art-record']).from).toBe('art-record')
  })

  it('Fehler: ohne/unbekannter Modus, fremde Datenbank, _test-Name, Port, --only mit --from, unbekannte Option', () => {
    for (const argv of [
      [],
      ['nightly'],
      ['quick', '--db', 'planetclaire'],
      ['quick', '--db', 'planetclaire_test'],
      ['quick', '--db', 'planetclaire_ci_test'],
      ['quick', '--db', 'postgres'],
      ['quick', '--port', '80'],
      ['quick', '--port', 'x'],
      ['quick', '--only', 'a', '--from', 'b'],
      ['quick', '--fast'],
      ['quick', '--db'],
    ])
      expect(() => parseArgs(argv), JSON.stringify(argv)).toThrow(UsageError)
  })
})

describe('Schritte je Modus (bilden die bisherigen Workflows nach)', () => {
  it('quick: lint, Format, Typen, statisch, Unit UTC + Berlin, env:example, Geheimnis-Scan, audit', () => {
    expect(ids('quick')).toEqual([
      'eslint',
      'format',
      'typecheck',
      'static',
      'unit',
      'unit-berlin',
      'env-example',
      'secrets',
      'audit',
    ])
    const berlin = stepsFor('quick').find((s) => s.id === 'unit-berlin')!
    expect(berlin.env?.TZ).toBe('Europe/Berlin')
    expect(cmdOf('quick', 'env-example')).toContain(
      'git diff --exit-code -- .env.example .env.production.example',
    )
    expect(cmdOf('quick', 'audit')).toContain('pnpm audit --prod --audit-level=critical')
  })

  it('full: quick + quality (ohne Debug) → E2E je Gerät (mit Debug) → Docker → Vorschau-Export', () => {
    const full = ids('full')
    expect(full.slice(0, ids('quick').length)).toEqual(ids('quick'))
    expect(full.slice(ids('quick').length)).toEqual([
      'db',
      'coverage',
      'restore-drill',
      'build',
      'no-debug',
      'bundle',
      'external',
      'visual',
      'lighthouse',
      'inp',
      'build-debug',
      'e2e-desktop',
      'e2e-iphone-15',
      'e2e-pixel-7',
      'docker',
      'preview',
    ])
    const step = (id: string) => stepsFor('full').find((s) => s.id === id)!
    expect(step('build').env?.NEXT_PUBLIC_LEASH_DEBUG).toBe('')
    expect(step('build-debug').env?.NEXT_PUBLIC_LEASH_DEBUG).toBe('1')
    expect(cmdOf('full', 'build')).toContain('fetch-cache')
    expect(cmdOf('full', 'no-debug')).toBe('pnpm run check:no-debug --no-build')
    expect(cmdOf('full', 'coverage')).toBe('pnpm run test:coverage')
    expect(cmdOf('full', 'bundle')).toBe('pnpm run check:bundle --port 3301')
    expect(cmdOf('full', 'external')).toBe('pnpm run check:external --built')
    expect(cmdOf('full', 'lighthouse')).toBe('tsx scripts/ci/lighthouse-calibrated.ts')
    expect(cmdOf('full', 'inp')).toMatch(
      /lighthouse-calibrated\.ts --rate.*pnpm run test:e2e --grep @perf --project=pixel-7$/,
    )
    expect(cmdOf('full', 'visual')).toContain(SKIP_MARKER)
    for (const p of ['desktop', 'iphone-15', 'pixel-7'])
      expect(cmdOf('full', `e2e-${p}`)).toBe(
        `pnpm run test:e2e --project=${p} --grep-invert "@visual|@perf" && pnpm run ci:flaky`,
      )
    expect(step('docker').requires).toBe('docker')
    expect(cmdOf('full', 'docker')).toMatch(/docker build .*524288000.*1001/s)
    expect(cmdOf('full', 'preview')).toMatch(
      /preview:export && pnpm run test:preview-export && .*budget/s,
    )
  })

  it('E2E-Filter nach -- werden (gequotet) an jeden E2E-Schritt gehängt', () => {
    const opts = parseArgs(['full', '--', "tests/e2e/it's.e2e.spec.ts", '--grep', '@smoke'])
    const step = stepsFor('full').find((s) => s.id === 'e2e-desktop')!
    expect((step.cmd as (c: RunContext) => string)({ opts })).toBe(
      `pnpm run test:e2e --project=desktop --grep-invert "@visual|@perf" 'tests/e2e/it'\\''s.e2e.spec.ts' '--grep' '@smoke' && pnpm run ci:flaky`,
    )
  })

  it('art: wie art-qa.yml; Auswertung/Bögen/Prüfung laufen auch nach Rot, mit der Lauf-ID', () => {
    expect(ids('art')).toEqual([
      'db',
      'art-seed',
      'art-build',
      'art-record',
      'art-metrics',
      'art-sheets',
      'art-check',
      'art-bundle',
    ])
    const always = stepsFor('art')
      .filter((s) => s.always)
      .map((s) => s.id)
    expect(always).toEqual(['art-metrics', 'art-sheets', 'art-check'])
    expect(stepsFor('art').find((s) => s.id === 'art-record')!.env?.ART_WORKERS).toBe('2')
    const id = '20261009-iter03-abcdef1'
    expect(cmdOf('art', 'art-check', { artRunId: id })).toBe(`pnpm run art:check ${id} --evidence`)
    expect(() => cmdOf('art', 'art-bundle')).toThrow(/art-record/)
  })

  it('planSteps: --only in Plan-Reihenfolge, --from zum Wiederaufnehmen, unbekannte Schritte mit Liste', () => {
    expect(
      planSteps({ mode: 'full', only: ['e2e-desktop', 'build-debug'], from: null }).map(
        (s) => s.id,
      ),
    ).toEqual(['build-debug', 'e2e-desktop'])
    expect(planSteps({ mode: 'full', only: null, from: 'docker' }).map((s) => s.id)).toEqual([
      'docker',
      'preview',
    ])
    expect(() => planSteps({ mode: 'quick', only: ['docker'], from: null })).toThrow(
      /Gültig: eslint, format/,
    )
  })

  it('jeder Schritt hat eine Zeitgrenze, eindeutige IDs je Modus', () => {
    for (const mode of ['quick', 'full', 'art'] as const) {
      const list = stepsFor(mode)
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length)
      for (const s of list) expect(s.timeoutMin, s.id).toBeGreaterThan(0)
    }
  })
})

describe('Umgebung', () => {
  const step = (mode: 'quick' | 'full' | 'art', id: string) =>
    stepsFor(mode).find((s) => s.id === id)!
  const src = 'postgres://u:p@127.0.0.1:5432/planetclaire?x=1'

  it('Prüf-Schritte (quick): Testwerte wie ci.yml, eigene Datenbanken, keine Ports', () => {
    const opts = parseArgs(['quick'])
    const env = envFor(step('quick', 'unit'), opts, src)
    expect(env.DATABASE_URL).toBe('postgres://u:p@127.0.0.1:5432/planetclaire_ci')
    expect(env.DATABASE_URL_TEST).toBe('postgres://u:p@127.0.0.1:5432/planetclaire_ci_test')
    expect(env).toMatchObject({
      CI: '1',
      APP_ENV: 'test',
      TZ: 'UTC',
      ADMIN_ROUTE: '/werkstatt',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_LEASH_DEBUG: '1',
      E2E_SERVER: 'start',
      SEED_PREVIEW_MODE: 'true',
      SEED_NOW: '2026-10-15T10:00:00+02:00',
      PAYMENTS_DRIVER: 'mock',
      EMAIL_DRIVER: 'file',
      STORAGE_DRIVER: 'local',
      TRANSLATION_DRIVER: 'mock',
    })
    expect(env.PAYLOAD_SECRET).toMatch(/^ci-only-/)
    expect(env.CRON_SECRET).toMatch(/^ci-only-/)
    for (const k of ['PORT', 'E2E_BASE_URL', 'PREVIEW_EXPORT_PORT', 'ART_PORT', 'PERF_PORT'])
      expect(env[k], k).toBeUndefined()
    expect(envFor(step('quick', 'unit-berlin'), opts, src).TZ).toBe('Europe/Berlin')
  })

  it('Abdeckung (full) läuft mit den Testwerten von quick – ohne Server-Ports, Website-Adresse wie in CI', () => {
    const env = envFor(step('full', 'coverage'), parseArgs(['full']), src)
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000')
    for (const k of ['PORT', 'E2E_BASE_URL', 'PREVIEW_EXPORT_PORT', 'ART_PORT', 'PERF_PORT'])
      expect(env[k], k).toBeUndefined()
  })

  it('Server-Schritte (full): Ports n … n+5, Vorschau-DB mit „preview“, Build mit/ohne Debug-Flag', () => {
    const opts = parseArgs(['full'])
    const env = envFor(step('full', 'e2e-desktop'), opts, src)
    expect(env).toMatchObject({
      PORT: '3300',
      E2E_BASE_URL: 'http://localhost:3300',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3300',
      PERF_PORT: '3302',
      PERF_UPSTREAM_PORT: '3303',
      PREVIEW_EXPORT_DB_NAME: 'planetclaire_ci_preview',
      PREVIEW_EXPORT_PORT: '3304',
      ART_PORT: '3305',
    })
    // Vorschau-Export verlangt planetclaire_…preview… (scripts/preview-export/env.ts)
    expect(env.PREVIEW_EXPORT_DB_NAME).toMatch(/^planetclaire_[a-z0-9_]*preview[a-z0-9_]*$/)
    expect(envFor(step('full', 'build'), opts, src).NEXT_PUBLIC_LEASH_DEBUG).toBe('')
    expect(envFor(step('full', 'build-debug'), opts, src).NEXT_PUBLIC_LEASH_DEBUG).toBe('1')
    expect(ports(3300)).toEqual({
      app: 3300,
      bundle: 3301,
      perf: 3302,
      perfUpstream: 3303,
      preview: 3304,
      art: 3305,
    })
    expect(serverEnv(parseArgs(['full', '--port', '4000'])).PREVIEW_EXPORT_PORT).toBe('4004')
  })

  it('art: Server, Build und E2E-Helfer zeigen auf den QA-Port', () => {
    const opts = parseArgs(['art', '--port', '3400'])
    const env = envFor(step('art', 'art-record'), opts, 'postgres://u:p@h:5432/x')
    expect(env.E2E_BASE_URL).toBe('http://localhost:3405')
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3405')
    expect(env.ART_PORT).toBe('3405')
    expect(env.ART_WORKERS).toBe('2')
    expect(databaseUrl('postgres://u:p@h:5432/x', 'y')).toBe('postgres://u:p@h:5432/y')
  })

  it('Ports/Ziele aus der Aufruf-Umgebung (z. B. einer anderen Arbeitskopie) werden nicht übernommen', () => {
    const env = inheritedEnv({
      PATH: '/bin',
      PORT: '3404',
      E2E_BASE_URL: 'http://localhost:3404',
      PREVIEW_EXPORT_PORT: '3998',
      NEXT_DIST_DIR: '.next-x',
    })
    expect(env).toEqual({ PATH: '/bin' })
    expect(STRIPPED_ENV).toContain('ART_BASE_URL')
  })
})

describe('Bericht und Commit-Status', () => {
  const r = (id: string, result: StepReport['result'], seconds = 60): StepReport => ({
    id,
    title: id,
    result,
    seconds,
    log: `ci-reports/x/${id}.log`,
  })

  it('grün nur ohne rote und ohne nicht gelaufene Schritte; Übersprungenes und Hinweise stehen in der Bilanz', () => {
    expect(summarize([r('a', 'passed'), r('b', 'passed', 120)])).toEqual({
      ok: true,
      line: '2/2 grün in 3 min',
    })
    expect(summarize([r('a', 'passed'), r('b', 'skipped'), r('c', 'warn')])).toEqual({
      ok: true,
      line: '1/3 grün, 1 übersprungen, 1 mit Hinweis in 3 min',
    })
    expect(summarize([r('a', 'failed'), r('b', 'not-run', 0)])).toEqual({
      ok: false,
      line: '0/2 grün, 1 rot, 1 nicht gelaufen in 1 min',
    })
  })

  it('Repository aus der Remote-URL (GitHub oder Git-Proxy), neueste Kunst-Lauf-ID', () => {
    expect(repoFromRemote('https://github.com/mvheinz/planetclairetattoos.git')).toBe(
      'mvheinz/planetclairetattoos',
    )
    expect(repoFromRemote('git@github.com:mvheinz/planetclairetattoos.git')).toBe(
      'mvheinz/planetclairetattoos',
    )
    expect(
      repoFromRemote('http://local_proxy@127.0.0.1:36277/git/mvheinz/planetclairetattoos'),
    ).toBe('mvheinz/planetclairetattoos')
    expect(
      latestArtRun([
        '20261008-iter01-23e2909',
        'x',
        '20261009-iter02-abcdef1',
        '20261009-iter01-1234567',
      ]),
    ).toBe('20261009-iter02-abcdef1')
    expect(latestArtRun([])).toBeUndefined()
  })

  it('Skript registriert, ci-reports/ ignoriert, Runner beendet nur die eigene Prozessgruppe', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts['ci:local']).toBe('tsx scripts/ci-local.ts')
    expect(readFileSync(path.join(ROOT, '.gitignore'), 'utf8')).toMatch(/^\/ci-reports\/$/m)
    const runner = readFileSync(path.join(ROOT, 'scripts/ci-local.ts'), 'utf8')
    expect(runner).toContain('detached: true')
    expect(runner).toContain('process.kill(-current.pid')
    expect(runner).not.toMatch(/pkill|killall/)
    expect(runner).toContain("'context=lokal/ci-${mode}'".replace(/'/g, '`'))
  })
})
