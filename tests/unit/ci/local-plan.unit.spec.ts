import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ART_CI_MARKER,
  ART_PATHS,
  ART_SCRIPT_SCENARIOS,
  ART_STATUS_CONTEXT,
  artBase,
  artBaseline,
  artGate,
  artMarkerRun,
  artRunInfo,
  artScenarios,
  databaseUrl,
  DEFAULT_DB,
  DEFAULT_PORT,
  describeIphone,
  e2eFilters,
  globToRegExp,
  hasFileFilter,
  IPHONE_CORE,
  isArtRelevant,
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
  statusSuccess,
  stepsFor,
  summarize,
  UsageError,
  type ArtGateInput,
  type ArtRunInfo,
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
      iphoneAll: false,
      force: false,
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
    expect(parseArgs(['full', '--iphone-all']).iphoneAll).toBe(true)
    expect(parseArgs(['art', '--force']).force).toBe(true)
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
      ['quick', '--iphone-all'],
      ['art', '--iphone-all'],
      ['full', '--force'],
      ['quick', '--force'],
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
    for (const p of ['desktop', 'pixel-7'])
      expect(cmdOf('full', `e2e-${p}`)).toBe(
        `pnpm run test:e2e --project=${p} --grep-invert "@visual|@perf" && pnpm run ci:flaky`,
      )
    // U-67 a: iPhone nur mit den Kernfällen
    expect(cmdOf('full', 'e2e-iphone-15')).toBe(
      `pnpm run test:e2e --project=iphone-15 --grep-invert "@visual|@perf" ${IPHONE_CORE.map((c) => `'${c.spec}'`).join(' ')} && pnpm run ci:flaky`,
    )
    expect(step('docker').requires).toBe('docker')
    expect(cmdOf('full', 'docker')).toMatch(/docker build .*524288000.*1001/s)
    expect(cmdOf('full', 'preview')).toMatch(
      /preview:export && pnpm run test:preview-export && .*budget/s,
    )
  })

  it('E2E-Filter nach -- werden (gequotet) an jeden E2E-Schritt gehängt', () => {
    const opts = parseArgs(['full', '--', "tests/e2e/it's.e2e.spec.ts", '--grep', '@smoke'])
    for (const p of ['desktop', 'iphone-15', 'pixel-7']) {
      const step = stepsFor('full').find((s) => s.id === `e2e-${p}`)!
      expect((step.cmd as (c: RunContext) => string)({ opts })).toBe(
        `pnpm run test:e2e --project=${p} --grep-invert "@visual|@perf" 'tests/e2e/it'\\''s.e2e.spec.ts' '--grep' '@smoke' && pnpm run ci:flaky`,
      )
    }
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

describe('U-67 a: iPhone 15 am Phasenende nur mit den Kernfällen', () => {
  const E2E = path.join(ROOT, 'tests/e2e')
  const specs = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory()
        ? specs(path.join(dir, d.name))
        : d.name.endsWith('.e2e.spec.ts')
          ? [path.relative(ROOT, path.join(dir, d.name)).split(path.sep).join('/')]
          : [],
    )
  const all = specs(E2E)

  it('jeder Eintrag: vorhandene Datei bzw. Ordner, Begründung, keine Doppelten', () => {
    expect(IPHONE_CORE.length).toBeGreaterThanOrEqual(15)
    expect(new Set(IPHONE_CORE.map((c) => c.spec)).size).toBe(IPHONE_CORE.length)
    for (const c of IPHONE_CORE) {
      const abs = path.join(ROOT, c.spec)
      expect(existsSync(abs), c.spec).toBe(true)
      expect(statSync(abs).isDirectory(), c.spec).toBe(c.spec.endsWith('/'))
      expect(c.covers.length, c.spec).toBeGreaterThan(20)
    }
  })

  it('Playwright liest Dateifilter als RegExp (ohne Groß/klein) – jeder trifft genau seine Datei bzw. seinen Ordner', () => {
    for (const c of IPHONE_CORE) {
      const re = new RegExp(c.spec, 'i')
      const hits = all.filter((f) => re.test(path.join(ROOT, f)))
      const own = all.filter((f) => (c.spec.endsWith('/') ? f.startsWith(c.spec) : f === c.spec))
      expect(own.length, c.spec).toBeGreaterThan(0)
      expect(hits, c.spec).toEqual(own)
    }
  })

  it('deckt die mobilen Kernabläufe ab (Kauf, Bestellknopf, Widerruf, Datenschutz, Kopf, Startseite)', () => {
    const list = IPHONE_CORE.map((c) => c.spec)
    for (const must of [
      'tests/e2e/home.e2e.spec.ts',
      'tests/e2e/home-tour.e2e.spec.ts',
      'tests/e2e/menu.e2e.spec.ts',
      'tests/e2e/language-switch.e2e.spec.ts',
      'tests/e2e/shop/product-page.e2e.spec.ts',
      'tests/e2e/shop/gallery.e2e.spec.ts',
      'tests/e2e/shop/add-to-cart.e2e.spec.ts',
      'tests/e2e/cart/cart.e2e.spec.ts',
      'tests/e2e/checkout/overview.e2e.spec.ts',
      'tests/e2e/legal/checkout-compliance.e2e.spec.ts',
      'tests/e2e/purchase/card-paypal.e2e.spec.ts',
      'tests/e2e/legal/withdrawal-flow.e2e.spec.ts',
      'tests/e2e/privacy/cart-cookie.e2e.spec.ts',
      'tests/e2e/privacy/p4-pages.e2e.spec.ts',
      'tests/e2e/privacy.e2e.spec.ts',
      'tests/e2e/a11y/keyboard.e2e.spec.ts',
      'tests/e2e/keyboard.e2e.spec.ts',
    ])
      expect(list, must).toContain(must)
    // Routen-Durchläufe mit eigener Fenstergröße bzw. reiner DOM-Prüfung (≈ 9 min auf dem iPhone) bleiben bei
    // desktop und pixel-7
    for (const not of ['tests/e2e/legal/footer.e2e.spec.ts', 'tests/e2e/a11y.e2e.spec.ts'])
      expect(list, not).not.toContain(not)
    expect(all.length).toBeGreaterThan(list.length * 4)
  })

  it('Specs, die pixel-7 auslassen (Paar desktop + iphone-15), stehen in der Liste – sonst liefe ihr Mobil-Teil auf keinem Telefon', () => {
    const covered = (f: string) =>
      IPHONE_CORE.some((c) => (c.spec.endsWith('/') ? f.startsWith(c.spec) : f === c.spec))
    const skipsPixel = all.filter((f) =>
      /test\.skip\(\s*(?:testInfo\.project\.name === 'pixel-7'|!\[\s*'desktop',\s*'iphone-15'\s*\]\.includes)/.test(
        readFileSync(path.join(ROOT, f), 'utf8'),
      ),
    )
    expect(skipsPixel).toEqual(
      expect.arrayContaining([
        'tests/e2e/shop/gallery.e2e.spec.ts',
        'tests/e2e/privacy.e2e.spec.ts',
        'tests/e2e/keyboard.e2e.spec.ts',
      ]),
    )
    for (const f of skipsPixel) expect(covered(f), f).toBe(true)
  })

  it('Dateifilter nach -- erkennen: Optionen mit Wert zählen nicht als Spec', () => {
    expect(hasFileFilter([])).toBe(false)
    expect(hasFileFilter(['--grep', '@smoke', '--shard=1/8', '--repeat-each', '2'])).toBe(false)
    expect(hasFileFilter(['-g', 'tests/e2e/x'])).toBe(false)
    expect(hasFileFilter(['tests/e2e/home.e2e.spec.ts'])).toBe(true)
    expect(hasFileFilter(['--repeat-each=2', 'tests/e2e/a.e2e.spec.ts'])).toBe(true)
    expect(hasFileFilter(['--headed', 'tests/e2e/a.e2e.spec.ts'])).toBe(true)
  })

  it('--iphone-all = alles; eigene Specs nach -- ersetzen die Kernfälle; Optionen nach -- gelten zusätzlich', () => {
    const core = IPHONE_CORE.map((c) => c.spec)
    expect(e2eFilters('iphone-15', parseArgs(['full']))).toEqual(core)
    expect(e2eFilters('iphone-15', parseArgs(['full', '--iphone-all']))).toEqual([])
    expect(
      e2eFilters('iphone-15', parseArgs(['full', '--', 'tests/e2e/menu.e2e.spec.ts'])),
    ).toEqual(['tests/e2e/menu.e2e.spec.ts'])
    expect(e2eFilters('iphone-15', parseArgs(['full', '--', '--shard=1/2']))).toEqual([
      ...core,
      '--shard=1/2',
    ])
    expect(e2eFilters('desktop', parseArgs(['full']))).toEqual([])
    expect(e2eFilters('pixel-7', parseArgs(['full', '--', '--grep', 'x']))).toEqual(['--grep', 'x'])
    const all = parseArgs(['full', '--iphone-all'])
    expect(
      (stepsFor('full').find((s) => s.id === 'e2e-iphone-15')!.cmd as (c: RunContext) => string)({
        opts: all,
      }),
    ).toBe(
      'pnpm run test:e2e --project=iphone-15 --grep-invert "@visual|@perf" && pnpm run ci:flaky',
    )
    expect(describeIphone(parseArgs(['full']))[0]).toMatch(/Kernfälle \(U-67, \d+ Filter/)
    expect(describeIphone(all)).toEqual(['alle E2E-Tests (--iphone-all)'])
  })
})

describe('U-67 b: Kunst-QA nur bei Kunst-Änderungen', () => {
  const run = (id: string, over: Partial<ArtRunInfo> = {}): ArtRunInfo => ({
    id,
    commit: `${id.slice(-7)}${'0'.repeat(33)}`,
    dirty: false,
    ciLocal: true,
    ciOk: true,
    pass: true,
    gaps: [],
    ...over,
  })
  const files = (dir: string): string[] =>
    existsSync(path.join(ROOT, dir))
      ? readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
          d.isDirectory() ? files(path.posix.join(dir, d.name)) : [path.posix.join(dir, d.name)],
        )
      : []

  it('Glob: ** beliebig tief, * innerhalb eines Ordners, Klammern wörtlich', () => {
    expect(globToRegExp('src/leash/**').test('src/leash/a/b.ts')).toBe(true)
    expect(globToRegExp('src/components/**/*.css').test('src/components/a.css')).toBe(true)
    expect(globToRegExp('src/components/**/*.css').test('src/components/shop/x/P.module.css')).toBe(
      true,
    )
    expect(globToRegExp('src/components/Coco*').test('src/components/Coco.tsx')).toBe(true)
    expect(globToRegExp('src/components/Coco*').test('src/components/home/Coco.tsx')).toBe(false)
    expect(globToRegExp('content/seed/*/**').test('content/seed/data/products.json')).toBe(true)
    expect(globToRegExp('content/seed/*/**').test('content/seed/SEED-SPEC.md')).toBe(false)
    expect(
      globToRegExp('src/app/(frontend)/[locale]/page.tsx').test(
        'src/app/(frontend)/[locale]/page.tsx',
      ),
    ).toBe(true)
    expect(
      globToRegExp('src/app/(frontend)/[locale]/page.tsx').test('src/app/frontend/l/page.tsx'),
    ).toBe(false)
  })

  it('kunst-relevant: Linie, Zeichnungen, Coco, Seiten und Bausteine, Texte, Beispielbestand, QA-Werkzeuge, Budgets', () => {
    for (const f of [
      'src/leash/runtime.ts',
      'src/art/stations/keramik.svg',
      'content/art/stations/sources.json',
      'public/art/coco-sprite.v3.svg',
      'src/components/Coco.tsx',
      'src/components/home/Koko.module.css',
      'src/components/leash/LeashLayer.tsx',
      'src/components/layout/MenuOverlay.tsx',
      'src/components/layout/SiteDocument.tsx',
      'src/components/layout/PresetBody.tsx',
      'src/components/errors/ErrorArt.tsx',
      'src/components/ui/EmptyState.tsx',
      'src/components/checkout/ReservationCountdown.tsx',
      'src/components/shop/ListPage.tsx',
      'src/components/shop/ProductCard.tsx',
      'src/components/BehaviorHost.tsx',
      'src/components/shop/product/ProductPage.module.css',
      'src/app/(frontend)/[locale]/cart/page.tsx',
      'src/app/(frontend)/[locale]/cart/page.module.css',
      'src/app/(frontend)/[locale]/thank-you/[token]/page.tsx',
      'src/app/(frontend)/[locale]/page.tsx',
      'src/app/(frontend)/[locale]/qa/coco/page.tsx',
      'src/app/global-not-found.tsx',
      'src/app/icon.svg',
      'src/og/templates.tsx',
      'src/lib/routes/registry.ts',
      'src/lib/shop/priceTag.ts',
      'src/proxy.ts',
      'src/lib/security/csp.ts',
      'src/behaviors/price-tag-swing.ts',
      'src/styles/tokens.css',
      'src/lib/media/pipeline.ts',
      'src/i18n/messages/de.json',
      'src/globals/SiteTexts.ts',
      'content/seed/data/pages.json',
      'content/seed/owner/own-jutta-coco.webp',
      'content/seed/coco/coco-frontal-nah-01.jpg',
      'src/lib/seed/drawings.ts',
      'tests/art/sc-01.art.spec.ts',
      'scripts/art/check.ts',
      'docs/design/KUNST-QA.md',
      'tests/perf/budgets.json',
      'pnpm-lock.yaml',
      './src/leash/presets.ts',
    ])
      expect(isArtRelevant(f), f).toBe(true)
    // Überspringen lohnt sich weiter für Verwaltung, Datenmodell, Logik, Tests und Doku
    for (const f of [
      'src/collections/Products.ts',
      'src/admin/views/orders/Orders.module.css',
      'src/endpoints/withdrawal.ts',
      'src/jobs/tasks/sendMail.ts',
      'src/lib/commerce/reserve.ts',
      'src/lib/email/templates.ts',
      'src/lib/security/rateLimit.ts',
      'src/migrations/20261010_x.ts',
      'src/preview-runtime/leash.ts',
      'content/seed/SEED-SPEC.md',
      'tests/e2e/home.e2e.spec.ts',
      'tests/unit/leash/presets.unit.spec.ts',
      'docs/OFFENE-PUNKTE.md',
      'PLAN.md',
      'scripts/ci/local-plan.ts',
    ])
      expect(isArtRelevant(f), f).toBe(false)
  })

  it('Wächter: jede Datei unter src/, die Linie, Coco, Zeichnungen oder Mikro-Interaktionen einbindet, ist kunst-relevant', () => {
    const uses =
      /from\s+['"](?:@\/|(?:\.\.?\/)+)(?:art|leash|behaviors|components\/Coco|components\/leash)\b|data-leash/
    // Die Vorschau-Datei prüft der Schritt `preview` in `full`, nicht die Kunst-Abnahme.
    const outside = (f: string) => f.startsWith('src/preview-runtime/')
    const hits = files('src').filter(
      (f) => /\.(ts|tsx)$/.test(f) && uses.test(readFileSync(path.join(ROOT, f), 'utf8')),
    )
    expect(hits.length).toBeGreaterThan(20)
    expect(hits.filter((f) => !outside(f) && !isArtRelevant(f))).toEqual([])
  })

  it('jedes Muster in ART_PATHS trifft mindestens eine vorhandene Datei', () => {
    for (const p of ART_PATHS) {
      expect(p.why.length, p.glob).toBeGreaterThan(5)
      if (!p.glob.includes('*')) {
        expect(existsSync(path.join(ROOT, p.glob)), p.glob).toBe(true)
        continue
      }
      // Ordner vor dem ersten `*` durchsuchen
      const fixed = p.glob.split('*')[0]!
      const dir = fixed.endsWith('/') ? fixed.slice(0, -1) : path.posix.dirname(fixed)
      const re = globToRegExp(p.glob)
      expect(
        files(dir).some((f) => re.test(f)),
        p.glob,
      ).toBe(true)
    }
  })

  it('Szenarien eines vollständigen Laufs wie art:record (tests/art + Skript-Szenarien)', () => {
    const all = artScenarios(readdirSync(path.join(ROOT, 'tests/art')))
    expect(all).toContain('SC-00')
    expect(all).toContain('SC-16')
    expect(all).toContain('SC-18')
    expect(artScenarios(['sc-01.art.spec.ts', 'helpers', 'sc-01.art.spec.ts'])).toEqual([
      'SC-01',
      'SC-16',
    ])
    const record = readFileSync(path.join(ROOT, 'scripts/art/record.ts'), 'utf8')
    const keys = [
      ...(/SCRIPT_SCENARIOS[^=]*=\s*\{([^}]*)\}/.exec(record)?.[1] ?? '').matchAll(/'(SC-\d{2})'/g),
    ].map((m) => m[1])
    expect(keys).toEqual([...ART_SCRIPT_SCENARIOS])
  })

  it('Lauf-Ordner lesen: Marke von ci:local art, check.json, Lücken (Szenarien, WebKit, Profile)', () => {
    const sha = 'f91d6ff965250e2aa2e3ccd94791d66d9818e77e'
    const scenarios = ['SC-00', 'SC-01', 'SC-16']
    const profiles = ['art-iphone15', 'art-pixel7', 'art-desktop']
    const full = {
      run: { commit: sha, dirty: false, scope: scenarios, webkit: 'webkit' },
      check: { pass: true },
      marker: { sha, ok: true },
      profiles: [...profiles, 'script'],
    }
    expect(artRunInfo('20261010-iter06-f91d6ff', full, scenarios)).toEqual({
      id: '20261010-iter06-f91d6ff',
      commit: sha,
      dirty: false,
      ciLocal: true,
      ciOk: true,
      pass: true,
      gaps: [],
    })
    // Handlauf ohne Marke, Marke zu anderem Commit, rote Schritte
    expect(artRunInfo('x', { ...full, marker: null }, scenarios).ciLocal).toBe(false)
    expect(artRunInfo('x', { ...full, marker: { sha: 'abc', ok: true } }, scenarios).ciLocal).toBe(
      false,
    )
    expect(artRunInfo('x', { ...full, marker: { sha, ok: false } }, scenarios).ciOk).toBe(false)
    // Teilmenge per --scope (iter02/iter03), Teilmenge per --project, WebKit emuliert, ohne check.json
    expect(
      artRunInfo('x', { ...full, run: { ...full.run, scope: ['SC-01'] } }, scenarios).gaps,
    ).toEqual(['Szenarien fehlen: SC-00, SC-16'])
    expect(
      artRunInfo('x', { ...full, profiles: ['art-desktop', 'script'] }, scenarios).gaps,
    ).toEqual(['Profile fehlen: art-iphone15, art-pixel7'])
    expect(
      artRunInfo(
        'x',
        { ...full, run: { ...full.run, webkit: 'WebKit emuliert (Chromium, PW_SKIP_WEBKIT=1)' } },
        scenarios,
      ).gaps,
    ).toEqual(['WebKit emuliert'])
    expect(artRunInfo('x', { ...full, check: null }, scenarios)).toMatchObject({
      pass: false,
      gaps: ['check.json fehlt'],
    })
    expect(
      artRunInfo('x', { run: null, check: null, marker: null, profiles: [] }, scenarios),
    ).toMatchObject({ commit: null, ciLocal: false, pass: false })
    expect(
      artRunInfo('x', { ...full, run: { ...full.run, commit: 'nope' } }, scenarios).commit,
    ).toBe(null)
  })

  it('Vergleichs-Lauf: neuester Lauf aus ci:local art (grün oder rot); Handläufe und Probeläufe zählen nicht', () => {
    const runs = [
      run('20261009-iter01-aaaaaaa'),
      run('20261010-iter02-bbbbbbb', { pass: false }), // rot – bleibt Vergleichs-Lauf, Gate läuft dann
      run('20261010-iter03-ccccccc', { ciLocal: false }), // Handlauf art:record (z. B. --scope SC-01)
      run('20261010-iter04-ddddddd', { dirty: true }), // Probelauf --allow-dirty
      run('nicht-ein-lauf'),
    ]
    expect(artBaseline(runs)?.id).toBe('20261010-iter02-bbbbbbb')
    expect(artBaseline(runs.filter((r) => r.id !== '20261010-iter02-bbbbbbb'))?.id).toBe(
      '20261009-iter01-aaaaaaa',
    )
    expect(artBaseline([run('20261010-iter03-ccccccc', { ciLocal: false })])).toBeUndefined()
    expect(artBaseline([])).toBeUndefined()
    expect(artBase(runs[1], 'eeee')).toEqual({
      sha: runs[1]!.commit,
      label: 'Kunst-Lauf 20261010-iter02-bbbbbbb (bbbbbbb)',
    })
    expect(artBase(undefined, '0123456789abcdef')).toEqual({
      sha: '0123456789abcdef',
      label: 'origin/main (0123456)',
    })
    expect(artBase(undefined, null)).toBeNull()
  })

  it('Marke nur für eine neue Aufnahme aus einem vollständigen, nicht übersprungenen ci:local art', () => {
    const art = parseArgs(['art'])
    const before = ['20261010-iter05-babd5d7']
    expect(artMarkerRun(art, false, before, '20261010-iter06-f91d6ff')).toBe(
      '20261010-iter06-f91d6ff',
    )
    expect(artMarkerRun(art, false, before, '20261010-iter05-babd5d7')).toBeNull() // Aufnahme scheiterte vor dem Ordner
    expect(artMarkerRun(art, false, before, undefined)).toBeNull()
    expect(artMarkerRun(art, true, before, '20261010-iter06-f91d6ff')).toBeNull()
    expect(
      artMarkerRun(
        parseArgs(['art', '--from', 'art-record']),
        false,
        before,
        '20261010-iter06-f91d6ff',
      ),
    ).toBeNull()
    expect(
      artMarkerRun(
        parseArgs(['art', '--only', 'art-record']),
        false,
        before,
        '20261010-iter06-f91d6ff',
      ),
    ).toBeNull()
    expect(artMarkerRun(parseArgs(['full']), false, [], '20261010-iter06-f91d6ff')).toBeNull()
    expect(ART_CI_MARKER).toBe('ci-local.json')
  })

  it('Commit-Status lokal/ci-art aus der GitHub-Antwort lesen', () => {
    expect(ART_STATUS_CONTEXT).toBe('lokal/ci-art')
    const res = (state: string, context = 'lokal/ci-art') => ({
      state,
      statuses: [
        { context: 'lokal/ci-full', state: 'success' },
        { context, state },
      ],
    })
    expect(statusSuccess(res('success'), 'lokal/ci-art')).toBe(true)
    expect(statusSuccess(res('failure'), 'lokal/ci-art')).toBe(false)
    expect(statusSuccess(res('success', 'lokal/ci-quick'), 'lokal/ci-art')).toBe(false)
    expect(statusSuccess({ state: 'pending', statuses: [] }, 'lokal/ci-art')).toBe(false)
    expect(statusSuccess(null, 'lokal/ci-art')).toBe(false)
  })

  it('Entscheidung: im Zweifel läuft die Kunst-QA; übersprungen nur ohne Kunst-Änderung seit nachweislich grünem Stand', () => {
    const baseline = run('20261010-iter02-bbbbbbb')
    const input: ArtGateInput = {
      force: false,
      partial: false,
      baseline,
      base: artBase(baseline, null),
      mainVerified: false,
      changed: ['src/lib/commerce/reserve.ts', 'docs/PLAN.md'],
    }
    const skip = artGate(input)
    expect(skip.run).toBe(false)
    expect(skip.reason).toMatch(
      /keine Kunst-Änderung seit Kunst-Lauf 20261010-iter02-bbbbbbb .*grün.*--force/,
    )
    expect(artGate({ ...input, force: true })).toMatchObject({ run: true, reason: '--force' })
    expect(artGate({ ...input, partial: true }).run).toBe(true)
    // rot: check.json oder ein Schritt von ci:local art
    expect(artGate({ ...input, baseline: { ...baseline, pass: false } })).toMatchObject({
      run: true,
      reason: expect.stringMatching(/ist rot \(check\.json\)/),
    })
    expect(artGate({ ...input, baseline: { ...baseline, ciOk: false } })).toMatchObject({
      run: true,
      reason: expect.stringMatching(/ist rot \(ein Schritt/),
    })
    // unvollständig: Teilmenge, emuliertes WebKit, fehlende Profile
    for (const gaps of [
      ['Szenarien fehlen: SC-00'],
      ['WebKit emuliert'],
      ['Profile fehlen: art-iphone15'],
    ])
      expect(artGate({ ...input, baseline: { ...baseline, gaps } })).toMatchObject({
        run: true,
        reason: expect.stringMatching(/unvollständig/),
      })
    expect(artGate({ ...input, changed: null }).run).toBe(true)
    expect(artGate({ ...input, base: null }).run).toBe(true)
    // Kunst-Änderungen: Bausteine mit Coco, Texte, Beispielbestand
    for (const f of [
      'src/leash/presets.ts',
      'src/components/layout/MenuOverlay.tsx',
      'src/i18n/messages/de.json',
      'content/seed/data/products.json',
    ]) {
      const art = artGate({ ...input, changed: [...input.changed!, f] })
      expect(art, f).toMatchObject({ run: true, artFiles: [f] })
      expect(art.reason).toMatch(/1 Kunst-Datei\(en\) geändert seit Kunst-Lauf/)
    }
    // ohne eigenen Lauf: origin/main nur mit Nachweis lokal/ci-art = success
    const main = { ...input, baseline: undefined, base: artBase(undefined, 'abcdef1234') }
    expect(artGate(main)).toMatchObject({
      run: true,
      reason: expect.stringMatching(/origin\/main \(abcdef1\) ohne Commit-Status lokal\/ci-art/),
    })
    const verified = artGate({ ...main, mainVerified: true })
    expect(verified).toMatchObject({ run: false })
    expect(verified.reason).toMatch(/seit origin\/main \(abcdef1\), lokal\/ci-art grün/)
    expect(artGate({ ...input, changed: [] }).run).toBe(false)
  })

  it('Runner: Entscheidung vor den Ports, Schritte „übersprungen“, Urteil ÜBERSPRUNGEN, Marke, Status-Nachweis', () => {
    const runner = readFileSync(path.join(ROOT, 'scripts/ci-local.ts'), 'utf8')
    expect(runner).toContain('decideArt(opts)')
    expect(runner).toContain("result: 'skipped'")
    expect(runner).toContain("'ÜBERSPRUNGEN'")
    expect(runner).toMatch(/'merge-base', 'origin\/main', 'HEAD'/)
    expect(runner).toContain('artMarkerRun(opts, !!plannedSkip, artRunsBefore, ctx.artRunId)')
    expect(runner).toContain('ART_CI_MARKER')
    expect(runner).toMatch(/repos\/\$\{repo\}\/commits\/\$\{sha\}\/status/)
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
