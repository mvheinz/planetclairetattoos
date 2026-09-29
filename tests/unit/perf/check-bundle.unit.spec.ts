import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  evaluatePages,
  expandGlob,
  firstLoadBudget,
  loadBudgets,
  pageTargets,
  parseArgs,
  staticFileFor,
  type Budgets,
  type PageMeasurement,
} from '../../../scripts/check-bundle'
import { hasSamplePath } from '../../../src/lib/routes/paths'
import { ROUTES } from '../../../src/lib/routes/registry'

// P2.23 Tempo-Budgets (ARCHITEKTUR §7.7, DESIGN §9.10, AK-DS-04): `tests/perf/budgets.json` und `pnpm check:bundle`
// (T-09). Die Messung gegen `next start` läuft im CI-Schritt „Budgets“; hier die Logik und der Abbruch bei
// Überschreitung mit einem Fixture-Budget.

const budgets = loadBudgets()
const clone = (): Budgets => JSON.parse(JSON.stringify(budgets)) as Budgets

let dir: string | null = null
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

const measurement = (routeId: string, jsGzipBytes: number, extra: Partial<PageMeasurement> = {}) =>
  ({
    routeId,
    locale: 'de',
    path: `/de/${routeId}`,
    status: 200,
    scripts: [{ url: 'http://localhost/_next/static/chunks/a.js', gzipBytes: jsGzipBytes }],
    jsGzipBytes,
    pathDataBytes: 1000,
    svgRawBytes: 1000,
    ...extra,
  }) satisfies PageMeasurement

describe('T-09 budgets.json enthält alle Werte aus ARCHITEKTUR §7.7 und DESIGN §9.10', () => {
  it('JS beim ersten Laden: R01 ≤ 170 KB, übrige ≤ 150 KB, R06/R07 ≤ 220 KB, Ziel R01 140 KB', () => {
    expect(firstLoadBudget('R01', budgets)).toBe(170_000)
    for (const id of ['R02', 'R04', 'R11', 'R18', 'R19', 'R21', 'R26', 'R27', 'R28'])
      expect(firstLoadBudget(id, budgets), id).toBe(150_000)
    expect(firstLoadBudget('R06', budgets)).toBe(220_000)
    expect(firstLoadBudget('R07', budgets)).toBe(220_000)
    expect(budgets.firstLoadJs.gzipTarget.R01).toBe(140_000)
  })

  it('Lazy-Module: Engine ≤ 12 KB, Coco ≤ 3 KB, Mikro ≤ 4 KB, statischer Renderer ≤ 4 KB', () => {
    const byEntry = Object.fromEntries(
      budgets.modules
        .filter((m) => !m.name.startsWith('Mikro-Interaktionen'))
        .map((m) => [m.entries.join(','), m.gzipMax]),
    )
    expect(byEntry).toEqual({
      'src/leash/runtime.ts': 12_000,
      'src/leash/coco.ts': 3_000,
      'src/leash/static.ts': 4_000,
    })
    // Mikro-Interaktionen: je gemeinsam geladener Gruppe von Verhaltensmodulen ≤ 4 KB (OFFENE-PUNKTE P3.4)
    const micro = budgets.modules.filter((m) => m.name.startsWith('Mikro-Interaktionen'))
    expect(micro.length).toBeGreaterThanOrEqual(2)
    for (const m of micro) {
      expect(m.gzipMax).toBe(4_000)
      expect(m.entries.every((e) => e.startsWith('src/behaviors/'))).toBe(true)
    }
  })

  it('Schriften 3 Dateien ≤ 100 KB; R01-Seitengewicht ≤ 1,5 MB (Ziel 1,0 MB); SVG-Budgets', () => {
    expect(budgets.fonts).toEqual({ files: 3, maxBytes: 100_000 })
    expect(budgets.pageWeight.R01).toEqual({ max: 1_500_000, target: 1_000_000 })
    expect(budgets.svg).toMatchObject({
      cocoSprite: { rawMax: 45_000, gzipMax: 12_000 },
      stationRawMax: 8_000,
      iconRawMax: 600,
      homeTotalRawMax: 60_000,
      pathDataPerPageMax: 60_000,
    })
  })

  it('Lighthouse (T-10) und @perf: LCP 2,5 s, CLS 0,1, TBT 200 ms, INP-Ersatz 200 ms, Frame ≤ 6 ms', () => {
    expect(budgets.lighthouse).toMatchObject({
      routes: ['R01'],
      runs: 3,
      lcpMs: { max: 2500, target: 2000 },
      cls: { max: 0.1, target: 0.05 },
      tbtMs: { max: 200, target: 150 },
    })
    expect(budgets.interaction).toMatchObject({
      cpuThrottling: 4,
      inpMs: { max: 200, target: 150 },
      frameWorkMs: { max: 6 },
    })
  })
})

describe('T-09 check:bundle – Seitenbudgets', () => {
  it('eingehalten bis einschließlich der Grenze, darüber ÜBERSCHRITTEN', () => {
    const ok = evaluatePages([measurement('R21', 150_000), measurement('R01', 170_000)], budgets)
    expect(ok.errors).toEqual([])
    expect(ok.lines.join('\n')).toMatch(/Ziel verfehlt – nur Bericht/)
    const bad = evaluatePages([measurement('R21', 150_001)], budgets)
    expect(bad.errors).toHaveLength(1)
    expect(bad.errors[0]).toMatch(/R21 de .*ÜBERSCHRITTEN/)
  })

  it('Fixture-Budget: eine Überschreitung je Messgröße (JS, Pfaddaten, SVG der Startseite) wird gemeldet', () => {
    const fixture = clone()
    fixture.firstLoadJs.gzipMax.default = 1000
    fixture.svg.pathDataPerPageMax = 10
    fixture.svg.homeTotalRawMax = 10
    const res = evaluatePages([measurement('R21', 5000), measurement('R01', 1000)], fixture)
    expect(res.errors.join('\n')).toMatch(/R21 de .*JS beim ersten Laden.*ÜBERSCHRITTEN/)
    expect(res.errors.join('\n')).toMatch(/Pfaddaten im DOM/)
    expect(res.errors.join('\n')).toMatch(/SVG der Startseite/)
  })

  it('Seiten: jede live-Seite der Registry in DE und EN sowie R28/R29', async () => {
    const targets = await pageTargets()
    // Token-Seiten (R08, R09) haben keinen Beispielpfad – ihr JS misst die eigene E2E-Suite nicht über das Budget.
    const live = ROUTES.filter(
      (r) => r.status === 'live' && r.kind === 'page' && hasSamplePath(r),
    ).map((r) => r.id)
    for (const id of live)
      expect(
        targets.filter((t) => t.routeId === id).map((t) => t.locale),
        id,
      ).toEqual(['de', 'en'])
    expect(targets.filter((t) => t.routeId === 'R28').every((t) => t.status === 404)).toBe(true)
    expect(targets.filter((t) => t.routeId === 'R29').every((t) => t.status === 500)).toBe(true)
  })

  it('Skript-URL → Datei in <distDir>/static (ohne Query), fremde Pfade → null', () => {
    expect(staticFileFor('http://localhost:3100/_next/static/chunks/a%20b.js?dpl=1', '.next')).toBe(
      path.join('.next', 'static', 'chunks', 'a b.js'),
    )
    expect(staticFileFor('http://localhost:3100/art/x.js', '.next')).toBeNull()
  })

  it('Muster und Optionen', () => {
    expect(expandGlob('src/behaviors/*.ts')).toContain(path.join('src/behaviors', 'menu.ts'))
    expect(expandGlob('src/leash/runtime.ts')).toEqual(['src/leash/runtime.ts'])
    expect(
      parseArgs(['--budgets', 'x.json', '--no-pages', '--dist', 'd', '--port', '3200']),
    ).toMatchObject({
      port: 3200,
      budgetsFile: 'x.json',
      pages: false,
      distDir: 'd',
    })
    expect(() => parseArgs(['--kaputt'])).toThrow(/unbekannte Option/)
  })
})

describe('T-09 check:bundle – Abbruch mit Fixture-Budget (CLI)', () => {
  /** Minimaler Build-Ordner: 3 kleine Schriften und ein Skript. */
  function fakeDist(): string {
    dir = mkdtempSync(path.join(tmpdir(), 'check-bundle-'))
    const chunks = path.join(dir, 'dist', 'static', 'chunks')
    const media = path.join(dir, 'dist', 'static', 'media')
    mkdirSync(chunks, { recursive: true })
    mkdirSync(media, { recursive: true })
    writeFileSync(path.join(chunks, 'a.js'), 'console.log(1)')
    for (const f of ['a', 'b', 'c']) writeFileSync(path.join(media, `${f}.woff2`), 'x')
    return path.join(dir, 'dist')
  }

  const run = (budgetsFile: string, dist: string) =>
    spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/check-bundle.ts',
        '--budgets',
        budgetsFile,
        '--dist',
        dist,
        '--no-pages',
      ],
      { encoding: 'utf8', timeout: 60_000 },
    )

  it('echte Budgets: Exit 0; Fixture mit 1 B für die Engine: Exit 1 mit ÜBERSCHRITTEN', () => {
    const dist = fakeDist()
    const ok = run('tests/perf/budgets.json', dist)
    expect(ok.status, ok.stderr).toBe(0)
    expect(ok.stdout).toMatch(/alle Budgets eingehalten/)

    const fixture = clone()
    fixture.modules[0]!.gzipMax = 1
    const fixtureFile = path.join(dir!, 'budgets.fixture.json')
    writeFileSync(fixtureFile, JSON.stringify(fixture))
    const bad = run(fixtureFile, dist)
    expect(bad.status).toBe(1)
    expect(bad.stderr).toMatch(/Engine .*ÜBERSCHRITTEN/)
    expect(bad.stderr).toMatch(/Budget überschritten/)
  }, 90_000)
})
