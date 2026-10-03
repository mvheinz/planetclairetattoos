import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ALL_SCENARIOS,
  BUNDLE_MAX_BYTES,
  CALIBRATION_SHEET,
  EXPECTED,
  buildManifest,
  isFullRun,
  missingRecordings,
  selectFiles,
  type RunFile,
} from '../../../scripts/art/lib/bundle'
import { ART_PROFILES } from '../../../scripts/art/lib/run'
import { cocoGroups, frameCaption, sheetCategory } from '../../../scripts/art/sheets'

// P9.5 `pnpm art:bundle` / `pnpm art:sheets` (KUNST-QA §4.3, §4.5, §8): Vollständigkeit aller Aufnahmen je Szenario,
// Profil und Variante, Manifest, Budget ≤ 100 MB; Kontaktbogen-Beschriftung und Coco-Gruppen.

/** Ein vollständiger Lauf laut Erwartungstabelle (je Kombination ein Video, wo verlangt, und ein Frame). */
function fullRun(): RunFile[] {
  const files: RunFile[] = [
    { path: 'run.json', bytes: 500 },
    { path: 'check.json', bytes: 1000 },
    { path: 'metrics/images.json', bytes: 1000 },
    { path: CALIBRATION_SHEET, bytes: 100_000 },
  ]
  for (const e of EXPECTED) {
    if (e.raw) {
      files.push({ path: `${e.raw}/R01-engine-1.json`, bytes: 2000 })
      continue
    }
    for (const p of e.profiles)
      for (const v of e.variants) {
        files.push({ path: `frames/${e.sc}/${p}/${v}/001-top-y0000.webp`, bytes: 50_000 })
        files.push({ path: `videos/${e.sc}/${p}/${v}/clip.webm`, bytes: 1_000_000 })
      }
  }
  return files
}

describe('P9.5 Bündel: Vollständigkeit (KUNST-QA §4.3)', () => {
  it('Erwartungstabelle deckt SC-00…SC-18 ab und stimmt mit den Tags der Szenario-Dateien überein', () => {
    expect(ALL_SCENARIOS).toEqual(
      Array.from({ length: 19 }, (_, i) => `SC-${String(i).padStart(2, '0')}`),
    )
    const specs = readdirSync('tests/art').filter((f) => /^sc-\d{2}\.art\.spec\.ts$/.test(f))
    for (const spec of specs) {
      const sc = `SC-${spec.slice(3, 5)}`
      const src = readFileSync(`tests/art/${spec}`, 'utf8')
      const m = /artTags\((?:'all'|\[([^\]]*)\])(?:,\s*\[([^\]]*)\])?\)/.exec(src)!
      const profiles = m[1] ? [...m[1].matchAll(/'([\w-]+)'/g)].map((x) => x[1]) : [...ART_PROFILES]
      const variants = m[2]
        ? [...m[2].matchAll(/'([\w-]+)'/g)].map((x) => x[1])
        : ['motion', 'reduced']
      const e = EXPECTED.find((x) => x.sc === sc)!
      expect([...e.profiles].sort(), sc).toEqual(profiles.sort())
      expect([...e.variants].sort(), sc).toEqual(variants.sort())
    }
  })

  it('vollständiger Lauf: nichts fehlt', () => {
    expect(isFullRun(ALL_SCENARIOS)).toBe(true)
    expect(missingRecordings(fullRun(), ALL_SCENARIOS)).toEqual([])
  })

  it('fehlt ein Video, eine Frame-Sequenz, die Tempo-Rohdaten oder der Kalibrierbogen → gemeldet', () => {
    const files = fullRun().filter(
      (f) =>
        f.path !== 'videos/SC-04/art-iphone15/reduced/clip.webm' &&
        f.path !== 'frames/SC-14/art-desktop/motion/001-top-y0000.webp' &&
        !f.path.startsWith('raw/SC-18/') &&
        f.path !== CALIBRATION_SHEET,
    )
    expect(missingRecordings(files, ALL_SCENARIOS)).toEqual([
      'SC-04 art-iphone15/reduced: Video fehlt',
      'SC-14 art-desktop/motion: Frames fehlen',
      'SC-18: Rohdaten raw/SC-18/art-pixel7/tempo/ fehlen',
      `Kalibrierbogen ${CALIBRATION_SHEET} fehlt (pnpm art:sheets)`,
    ])
  })

  it('Teil-Lauf (--scope) prüft nur die Szenarien im Umfang', () => {
    const scope = ['SC-00', 'SC-12']
    expect(isFullRun(scope)).toBe(false)
    const files = fullRun().filter((f) => !f.path.includes('SC-04'))
    expect(missingRecordings(files, scope)).toEqual([])
  })
})

describe('P9.5 Bündel: Budget und Manifest (KUNST-QA §8)', () => {
  it('Pflichtteil immer; Videos motion vor reduced; Summe ≤ 100 MB; nie das Bündel selbst', () => {
    const files: RunFile[] = [
      { path: 'check.md', bytes: 1000 },
      { path: 'sheets/motion/SC-01-a.webp', bytes: 1_400_000 },
      { path: 'videos/SC-01/art-pixel7/motion/a.webm', bytes: 60_000_000 },
      { path: 'videos/SC-01/art-pixel7/reduced/a.webm', bytes: 50_000_000 },
      { path: 'frames/SC-01/art-pixel7/motion/001-t0000.webp', bytes: 30_000_000 },
      { path: 'bundle/check.md', bytes: 1000 },
    ]
    const sel = selectFiles(files)
    expect(sel.included.map((f) => f.path)).toEqual([
      'check.md',
      'sheets/motion/SC-01-a.webp',
      'videos/SC-01/art-pixel7/motion/a.webm',
      'frames/SC-01/art-pixel7/motion/001-t0000.webp',
    ])
    expect(sel.omitted.map((f) => f.path)).toEqual(['videos/SC-01/art-pixel7/reduced/a.webm'])
    expect(sel.totalBytes).toBeLessThanOrEqual(BUNDLE_MAX_BYTES)
    expect(sel.requiredBytes).toBe(1_401_000)
  })

  it('manifest.json nach §8 inkl. toolVersions und Markierung „WebKit emuliert“', () => {
    const sel = selectFiles(fullRun())
    const tools = { playwright: '1.58.2', chromium: '145', webkit: '26.0', node: 'v24' }
    const run = {
      runId: '20261003-iter01-abcdef0',
      commit: 'abcdef0',
      date: '2026-10-03T00:00:00Z',
      scope: ALL_SCENARIOS,
    }
    const m = buildManifest({ run, selection: sel, missing: [], tools })
    expect(Object.keys(m)).toEqual(
      expect.arrayContaining([
        'runId',
        'commit',
        'date',
        'scope',
        'profiles',
        'variants',
        'scenarios',
        'toolVersions',
        'sizes',
      ]),
    )
    expect(m.toolVersions.webkit).toBe('26.0')
    expect(m.profiles).toEqual(['art-desktop', 'art-iphone15', 'art-pixel7', 'script'])
    expect(m.variants).toEqual(['motion', 'none', 'reduced'])
    expect(m.scenarios.find((s) => s.id === 'SC-01')!.files.length).toBeGreaterThan(0)
    expect(m.sizes.totalMB).toBeLessThanOrEqual(100)
    expect(m.complete).toBe(true)
    const emu = buildManifest({
      run: { ...run, webkit: 'WebKit emuliert (Chromium, PW_SKIP_WEBKIT=1)' },
      selection: sel,
      missing: [],
      tools,
    })
    expect(emu.toolVersions.webkit).toMatch(/WebKit emuliert/)
  })
})

describe('P9.5 Kontaktbögen (KUNST-QA §4.5)', () => {
  it('Kategorie art/motion/a11y und Beschriftung mit Szenario, Profil und t/y', () => {
    expect(sheetCategory('SC-12', 'motion')).toBe('art')
    expect(sheetCategory('SC-01', 'motion')).toBe('motion')
    expect(sheetCategory('SC-01', 'reduced')).toBe('a11y')
    expect(sheetCategory('SC-17', 'motion')).toBe('a11y')
    expect(frameCaption('SC-01', 'art-pixel7', 'motion', '012-intro-t0300.webp')).toBe(
      'SC-01 · pixel7 · intro-t0300',
    )
  })

  it('Coco-Gruppen: Frames A/B/C und ?parts=1 je Pose', () => {
    const g = cocoGroups([
      '001-rennen-a-y0000.webp',
      '011-rennen-b-y0000.webp',
      '021-rennen-c-y0000.webp',
      '031-rennen-parts-y0000.webp',
      '041-boil-k0-y0000.webp',
    ])
    expect([...g.keys()]).toEqual(['rennen'])
    expect(g.get('rennen')).toEqual({
      a: '001-rennen-a-y0000.webp',
      b: '011-rennen-b-y0000.webp',
      c: '021-rennen-c-y0000.webp',
      parts: '031-rennen-parts-y0000.webp',
    })
  })
})
