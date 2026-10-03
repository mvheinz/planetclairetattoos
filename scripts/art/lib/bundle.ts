// Bündel eines Kunst-QA-Laufs (KUNST-QA §4.3, §8; PLAN P9.5): erwartete Aufnahmen je Szenario/Profil/Variante,
// Vollständigkeit, Auswahl der Dateien unter dem Budget (≤ 100 MB) und `manifest.json`. Rein.

import { ART_PROFILES } from './run'

export const BUNDLE_MAX_BYTES = 100 * 1000 * 1000
export const SHEET_MAX_BYTES = 1.5 * 1000 * 1000
export const CALIBRATION_SHEET = 'sheets/art/calibration-p2-placeholder.webp'

export interface Expectation {
  sc: string
  profiles: readonly string[]
  variants: readonly string[]
  /** Video laut Spalte „Aufnahmen“ (§4.3) */
  video: boolean
  /** Standbilder/Sequenzen */
  frames: boolean
  /** Rohdaten statt Bildern (SC-18) */
  raw?: string
}

const ALL = ART_PROFILES
const BOTH = ['motion', 'reduced'] as const

/** KUNST-QA §4.3, Spalten „Profile“ und „Aufnahmen“ (Varianten §4.2: jedes Szenario motion + reduced). */
export const EXPECTED: readonly Expectation[] = [
  { sc: 'SC-00', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-01', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-02', profiles: ALL, variants: ['reduced'], video: false, frames: true },
  { sc: 'SC-03', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-04', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-05', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-06', profiles: ALL, variants: BOTH, video: false, frames: true },
  { sc: 'SC-07', profiles: ALL, variants: BOTH, video: false, frames: true },
  { sc: 'SC-08', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-09', profiles: ALL, variants: BOTH, video: true, frames: true },
  { sc: 'SC-10', profiles: ALL, variants: BOTH, video: true, frames: true },
  {
    sc: 'SC-11',
    profiles: ['art-pixel7', 'art-desktop'],
    variants: BOTH,
    video: true,
    frames: true,
  },
  {
    sc: 'SC-12',
    profiles: ['art-desktop', 'art-iphone15'],
    variants: BOTH,
    video: false,
    frames: true,
  },
  { sc: 'SC-13', profiles: ['art-desktop'], variants: BOTH, video: false, frames: true },
  {
    sc: 'SC-14',
    profiles: ['art-desktop', 'art-iphone15'],
    variants: BOTH,
    video: false,
    frames: true,
  },
  { sc: 'SC-15', profiles: ['art-pixel7'], variants: BOTH, video: false, frames: true },
  { sc: 'SC-16', profiles: ['script'], variants: ['none'], video: false, frames: true },
  { sc: 'SC-17', profiles: ['art-pixel7'], variants: BOTH, video: false, frames: true },
  {
    sc: 'SC-18',
    profiles: ['art-pixel7'],
    variants: ['tempo'],
    video: false,
    frames: false,
    raw: 'raw/SC-18/art-pixel7/tempo',
  },
]

export const ALL_SCENARIOS = EXPECTED.map((e) => e.sc)

/** Ein vollständiger Lauf deckt alle Szenarien ab (`art:record` ohne `--scope`). */
export const isFullRun = (scope: readonly string[]) => ALL_SCENARIOS.every((s) => scope.includes(s))

export interface RunFile {
  /** relativ zum Lauf, mit `/` */
  path: string
  bytes: number
}

/** Fehlende Aufnahmen (Videos, Frame-Sequenzen, Rohdaten, Kalibrierbogen) für die Szenarien im Umfang. */
export function missingRecordings(files: readonly RunFile[], scope: readonly string[]): string[] {
  const has = (prefix: string, ext: string) =>
    files.some((f) => f.path.startsWith(prefix) && f.path.endsWith(ext))
  const out: string[] = []
  for (const e of EXPECTED.filter((x) => scope.includes(x.sc))) {
    if (e.raw) {
      if (!has(`${e.raw}/`, '.json')) out.push(`${e.sc}: Rohdaten ${e.raw}/ fehlen`)
      continue
    }
    for (const p of e.profiles)
      for (const v of e.variants) {
        if (e.video && !has(`videos/${e.sc}/${p}/${v}/`, '.webm'))
          out.push(`${e.sc} ${p}/${v}: Video fehlt`)
        if (e.frames && !has(`frames/${e.sc}/${p}/${v}/`, '.webp'))
          out.push(`${e.sc} ${p}/${v}: Frames fehlen`)
      }
  }
  if (scope.includes('SC-16') && !files.some((f) => f.path === 'metrics/images.json'))
    out.push('SC-16: metrics/images.json fehlt')
  if (!files.some((f) => f.path === CALIBRATION_SHEET))
    out.push(`Kalibrierbogen ${CALIBRATION_SHEET} fehlt (pnpm art:sheets)`)
  return out
}

/** Rang einer Datei im Bündel (klein = zuerst); `null` = nie ins Bündel. */
export function bundleRank(p: string): number | null {
  if (p.startsWith('bundle/') || p.endsWith('.zip')) return null
  if (/^(run|manifest|check)\.(json|md)$/.test(p) || p === 'check.md') return 0
  if (p.startsWith('metrics/') || p.startsWith('reviews/')) return 0
  if (p.startsWith('raw/')) return 0
  if (p.startsWith('sheets/')) return 0
  if (p.startsWith('videos/') && p.includes('/motion/')) return 1
  if (
    p.startsWith('frames/SC-12/') ||
    p.startsWith('frames/SC-13/') ||
    p.startsWith('frames/SC-16/')
  )
    return 2
  if (p.startsWith('videos/')) return 3
  if (p.startsWith('frames/')) return 4
  if (p.startsWith('traces/')) return 5
  return null
}

export interface Selection {
  included: RunFile[]
  omitted: RunFile[]
  requiredBytes: number
  totalBytes: number
}

/** Pflichtteil (Rang 0) immer; danach nach Rang auffüllen, solange das Budget reicht (kleinere Dateien rücken nach). */
export function selectFiles(files: readonly RunFile[], budget = BUNDLE_MAX_BYTES): Selection {
  const ranked = files
    .map((f) => ({ f, r: bundleRank(f.path) }))
    .filter((x): x is { f: RunFile; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.f.path.localeCompare(b.f.path))
  const included: RunFile[] = []
  const omitted: RunFile[] = []
  let total = 0
  let required = 0
  for (const { f, r } of ranked) {
    if (r === 0) {
      included.push(f)
      total += f.bytes
      required += f.bytes
    } else if (total + f.bytes <= budget) {
      included.push(f)
      total += f.bytes
    } else omitted.push(f)
  }
  return { included, omitted, requiredBytes: required, totalBytes: total }
}

export interface Manifest {
  runId: string
  commit: string
  date: string
  scope: string[]
  profiles: string[]
  variants: string[]
  scenarios: { id: string; files: string[] }[]
  toolVersions: {
    playwright: string | null
    chromium: string | null
    webkit: string | null
    node: string
  }
  sizes: { totalMB: number; requiredMB: number; omittedMB: number; omittedFiles: number }
  /** fehlende Aufnahmen (leer bei vollständigem Lauf) */
  missing: string[]
  complete: boolean
}

export function buildManifest(input: {
  run: { runId: string; commit: string; date: string; scope: string[]; webkit?: string }
  selection: Selection
  missing: string[]
  tools: { playwright: string | null; chromium: string | null; webkit: string | null; node: string }
}): Manifest {
  const { run, selection } = input
  const scenarioOf = (p: string) =>
    /^(?:frames|videos|raw|sheets\/\w+)\/(SC-\d{2})/.exec(p)?.[1] ??
    /(SC-\d{2})/.exec(p)?.[1] ??
    null
  const byScenario = new Map<string, string[]>()
  for (const f of selection.included) {
    const sc = scenarioOf(f.path)
    if (sc) byScenario.set(sc, [...(byScenario.get(sc) ?? []), f.path])
  }
  const all = [...selection.included, ...selection.omitted]
  const parts = (re: RegExp) =>
    [...new Set(all.map((f) => re.exec(f.path)?.[1]).filter((x): x is string => !!x))].sort()
  const mb = (b: number) => Math.round((b / 1e6) * 100) / 100
  const emulated = run.webkit && run.webkit !== 'webkit' ? run.webkit : null
  return {
    runId: run.runId,
    commit: run.commit,
    date: run.date,
    scope: run.scope,
    profiles: parts(/^(?:frames|videos)\/SC-\d{2}\/([\w-]+)\//),
    variants: parts(/^(?:frames|videos)\/SC-\d{2}\/[\w-]+\/([\w-]+)\//),
    scenarios: [...byScenario.entries()].sort().map(([id, files]) => ({ id, files })),
    toolVersions: { ...input.tools, webkit: emulated ?? input.tools.webkit },
    sizes: {
      totalMB: mb(selection.totalBytes),
      requiredMB: mb(selection.requiredBytes),
      omittedMB: mb(selection.omitted.reduce((a, f) => a + f.bytes, 0)),
      omittedFiles: selection.omitted.length,
    },
    missing: input.missing,
    complete: input.missing.length === 0,
  }
}
