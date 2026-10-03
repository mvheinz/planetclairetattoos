import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

import sharp from 'sharp'

import { buildGeometryWithSamples } from '../../src/leash/geometry'
import { aboutInput, journeyInput } from '../../tests/unit/leash/fixtures'
import { MODULE_BUDGETS, measureModules } from '../check-bundle'
import { KUNST_QA_FILE, parseCriteria, severityOf, type Criterion } from './lib/criteria'
import * as art from './lib/checks/art'
import { noData, type CheckResult } from './lib/checks/common'
import * as line from './lib/checks/line'
import * as rt from './lib/checks/runtime'
import { ART_PROFILES, ART_ROOT, existingRuns } from './lib/run'
import { labelTime, linePoints, rects, type ProbeFile } from './lib/probe'
import { ART } from './lib/handline'
import { OUTPUT_DIR as PLACEHOLDER_DIR, placeholderWashes } from './placeholders'

// `pnpm art:check [<lauf-id>] [--evidence]` (KUNST-QA §3.3, §5; PLAN P9.5/P9.6): prüft alle „auto“-Kriterien aus
// KUNST-QA §5 gegen den Lauf `artifacts/art-qa/<lauf-id>/` (ohne ID: der neueste) und die Dateien des Repos; schreibt
// `check.json` und `check.md` in den Lauf, Exit ≠ 0 bei FAIL. Urteilspunkte der Linsen (R1/R2/R3) stehen in `check.md`
// als offen – sie gelten nie automatisch als bestanden. `--evidence` führt die Test-Nachweise aus (CT-01 Kontrast-Test,
// IM-01 AK-DS-17 gegen die Test-DB) und legt sie in `metrics/evidence.json` ab; sonst werden vorhandene wiederverwendet.

export interface Evidence {
  pass: boolean
  detail: string
}

export interface CheckInputs {
  runDir: string | null
  probes: ProbeFile[]
  axe: rt.AxeFile[]
  timeCompare: { profile: string; identical: boolean }[]
  perf: rt.PerfJson | null
  images: art.ImagesJson | null
  evidence: Record<string, Evidence>
}

// ---------- Laden ----------

const readJson = <T>(file: string): T | null =>
  existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null

function walkFiles(dir: string, re: RegExp, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walkFiles(p, re, out)
    else if (re.test(name)) out.push(p)
  }
  return out
}

export function loadRun(runDir: string): Omit<CheckInputs, 'evidence'> {
  const raw = path.join(runDir, 'raw')
  const probes = walkFiles(raw, /^probes\.json(\.gz)?$/)
    // im Bündel gzip-komprimiert (art:bundle); ungepackte Fassung hat Vorrang
    .filter((f) => !f.endsWith('.gz') || !existsSync(f.slice(0, -3)))
    .map((f) =>
      f.endsWith('.gz')
        ? (JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) as ProbeFile)
        : readJson<ProbeFile>(f)!,
    )
  const axe = walkFiles(raw, /^axe-.*\.json$/).map((f) => {
    const [sc, profile, variant] = path.relative(raw, f).split(path.sep)
    return {
      sc: sc!,
      profile: profile!,
      variant: variant!,
      label: path.basename(f, '.json').slice(4),
      ...readJson<{ url: string }>(f)!,
    }
  })
  const timeCompare = ART_PROFILES.flatMap((profile) => {
    const t = readJson<{ t0VsT2000Identical: boolean }>(
      path.join(raw, 'SC-02', profile, 'reduced', 'time-compare.json'),
    )
    return t ? [{ profile, identical: t.t0VsT2000Identical }] : []
  })
  return {
    runDir,
    probes,
    axe,
    timeCompare,
    perf: readJson<rt.PerfJson>(path.join(runDir, 'metrics', 'perf.json')),
    images: readJson<art.ImagesJson>(path.join(runDir, 'metrics', 'images.json')),
  }
}

/** Test-Nachweise (CT-01, IM-01) – nur mit `--evidence`, Ergebnis in `metrics/evidence.json`. */
export function runEvidence(): Record<string, Evidence> {
  const run = (args: string[], env: Record<string, string> = {}) => {
    const res = spawnSync('pnpm', ['exec', ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    })
    const out = `${res.stdout}\n${res.stderr}`
    const tests = /Tests\s+(.+)/.exec(out)?.[1]?.trim() ?? `Exit ${res.status}`
    return { pass: res.status === 0, detail: tests.replace(/\x1b\[[0-9;]*m/g, '') }
  }
  return {
    'CT-01': run([
      'vitest',
      'run',
      '--config',
      './vitest.unit.config.mts',
      'tests/unit/design/contrast.unit.spec.ts',
    ]),
    'IM-01': run(
      [
        'vitest',
        'run',
        '--config',
        './vitest.config.mts',
        'tests/int/collections/media.int.spec.ts',
        '-t',
        'AK-DS-17',
      ],
      { PC_DB_READY: '1', NODE_OPTIONS: '--no-deprecation' },
    ),
  }
}

// ---------- Pixel-Eingaben ----------

async function loadRaster(file: string, width?: number): Promise<line.Raster> {
  const img = sharp(file).removeAlpha()
  const { data, info } = await (width ? img.resize({ width }) : img)
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height,
    channels: info.channels,
  }
}

/** LQ-01/LQ-06: Standbilder aus SC-01 (motion) mit gezeichneter Linie, höchstens `perProfile` je Profil. */
export async function lineFrames(
  runDir: string,
  files: readonly ProbeFile[],
  perProfile = 10,
): Promise<line.LineFrame[]> {
  const out: line.LineFrame[] = []
  for (const f of files.filter((x) => x.sc === 'SC-01' && x.variant === 'motion')) {
    const cand = f.probes.filter(
      (p) => p.frame && p.leash && p.leash.pts.length > 30 && /^station/.test(p.label),
    )
    for (const p of cand.slice(0, perProfile)) {
      const file = path.join(runDir, p.frame!)
      if (!existsSync(file)) continue
      const s = p.scale
      const ex = [...rects(p.text), ...(p.coco ? [p.coco] : [])].map((r) => ({
        x: r.x * s - 2,
        y: r.y * s - 2,
        w: r.w * s + 4,
        h: r.h * s + 4,
      }))
      out.push({
        label: `${f.profile} ${p.label}`,
        raster: await loadRaster(file),
        pts: linePoints(p.leash!.pts).map((q) => ({ len: q.len, x: q.x * s, y: q.y * s })),
        halfW: p.leash!.halfW * s,
        seams: p.leash!.seams,
        exclude: ex,
      })
    }
  }
  return out
}

/** MO-15: Zeitsequenzen (Bilder mit `t` im Label) aus SC-01 (Intro), SC-03, SC-09, SC-10 in 96 px Breite. */
export async function flashSequences(runDir: string): Promise<rt.Sequence[]> {
  const out: rt.Sequence[] = []
  for (const sc of ['SC-01', 'SC-03', 'SC-09', 'SC-10']) {
    for (const profile of ART_PROFILES) {
      const dir = path.join(runDir, 'frames', sc, profile, 'motion')
      if (!existsSync(dir)) continue
      const groups = new Map<string, { t: number; file: string }[]>()
      for (const name of readdirSync(dir).sort()) {
        const label = name.replace(/^\d{3}-/, '').replace(/\.webp$/, '')
        const t = labelTime(label)
        if (t === null) continue
        const prefix = label.replace(/-?t\d+.*$/, '') || 'seq'
        groups.set(prefix, [...(groups.get(prefix) ?? []), { t, file: path.join(dir, name) }])
      }
      for (const [prefix, frames] of groups) {
        if (frames.length < 3) continue
        frames.sort((a, b) => a.t - b.t)
        const lum: Float32Array[] = []
        for (const fr of frames) {
          const r = await loadRaster(fr.file, 96)
          const l = new Float32Array(r.width * r.height)
          for (let k = 0; k < l.length; k++)
            l[k] = rt.relLum(
              r.data[k * r.channels]!,
              r.data[k * r.channels + 1]!,
              r.data[k * r.channels + 2]!,
            )
          lum.push(l)
        }
        if (new Set(lum.map((l) => l.length)).size !== 1) continue
        out.push({
          label: `${sc}/${profile}/${prefix}`,
          t: frames.map((f) => f.t),
          lum,
          areaFrac: (0.25 * 341 * 256) / (1024 * 768),
        })
      }
    }
  }
  return out
}

/** CT-02 Stichprobe: Textzeilen auf Shop/Archiv-Standbildern – dunkelster Text gegen dunkelsten Hintergrund (Raster). */
export async function contrastSamples(
  runDir: string,
  files: readonly ProbeFile[],
  maxRects = 20,
): Promise<rt.ContrastSample[]> {
  const out: rt.ContrastSample[] = []
  for (const f of files.filter((x) => x.sc === 'SC-04' && x.variant === 'reduced')) {
    for (const p of f.probes.filter((x) => x.frame && /-top/.test(x.label))) {
      const file = path.join(runDir, p.frame!)
      if (!existsSync(file)) continue
      const r = await loadRaster(file)
      const s = p.scale
      for (const t of rects(p.text)
        .filter((q) => q.h >= 10 && q.w >= 20)
        .slice(0, maxRects)) {
        const lum: number[] = []
        for (let y = Math.floor(t.y * s); y < Math.ceil((t.y + t.h) * s); y++)
          for (let x = Math.floor(t.x * s); x < Math.ceil((t.x + t.w) * s); x++) {
            if (x < 0 || y < 0 || x >= r.width || y >= r.height) continue
            const k = (y * r.width + x) * r.channels
            lum.push(rt.relLum(r.data[k]!, r.data[k + 1]!, r.data[k + 2]!))
          }
        if (lum.length < 50) continue
        lum.sort((a, b) => a - b)
        const text = lum[Math.floor(lum.length * 0.01)]!
        const bgPart = lum.filter((v) => v > (text + lum[lum.length - 1]!) / 2 + 0.15)
        if (bgPart.length < 10) continue
        const bg = bgPart[Math.floor(bgPart.length * 0.02)]!
        out.push({
          label: `${f.profile} ${p.label} (${Math.round(t.x)},${Math.round(t.y)})`,
          ratio: (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05),
        })
      }
    }
  }
  return out
}

// ---------- Repo-Eingaben ----------

function lineCases(): line.LineCase[] {
  const out: line.LineCase[] = []
  for (const [label, input] of [
    ['journey 390', journeyInput({ w: 390, h: 844 })],
    ['journey 1440', journeyInput({ w: 1440, h: 900 })],
    ['about 390', aboutInput({ w: 390, h: 844 })],
  ] as const) {
    const { geometry, samples } = buildGeometryWithSamples(input)
    out.push({
      label,
      samples,
      baseWidth: input.baseWidth,
      loops: geometry.stations.map((s) => ({ id: s.id, len0: s.loopLen0, len1: s.loopLen1 })),
    })
  }
  return out
}

async function stationPairs(sources: art.SourcesJson): Promise<art.StrokePair[]> {
  const out: art.StrokePair[] = []
  for (const v of sources.vectorize) {
    const file = path.join('content', 'seed', 'instagram', v.file)
    const svgFile = path.join('src', 'art', 'stations', `${v.id}.svg`)
    if (!existsSync(file) || !existsSync(svgFile)) continue
    const buf = await sharp(readFileSync(file)).rotate().toBuffer()
    const m = await sharp(buf).metadata()
    const c = v.crop ?? { x: 0, y: 0, w: 100, h: 100 }
    const left = Math.round((c.x / 100) * m.width!)
    const top = Math.round((c.y / 100) * m.height!)
    const crop = await sharp(buf)
      .extract({
        left,
        top,
        width: Math.min(m.width! - left, Math.round((c.w / 100) * m.width!)),
        height: Math.min(m.height! - top, Math.round((c.h / 100) * m.height!)),
      })
      .png()
      .toBuffer()
    out.push(await art.strokePair(v.id, readFileSync(svgFile, 'utf8'), crop, v.threshold))
  }
  return out
}

const svgFiles = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.svg'))
        .sort()
    : []

function gsapUses(): string[] {
  const out: string[] = []
  const pkg = readFileSync('package.json', 'utf8')
  if (/"gsap"/.test(pkg)) out.push('package.json')
  for (const f of walkFiles('src', /\.(tsx?|css)$/))
    if (/from ['"]gsap|require\(['"]gsap/.test(readFileSync(f, 'utf8'))) out.push(f)
  return out
}

// ---------- Prüfen ----------

export async function runAllChecks(inp: CheckInputs): Promise<CheckResult[]> {
  const read = (f: string) => readFileSync(f, 'utf8')
  const tokens = read('src/styles/tokens.css')
  const cocoCss = read('src/styles/coco.css')
  const design = read('docs/design/DESIGN.md')
  const sprite = read('public/art/coco-sprite.v1.svg')
  const manifest = JSON.parse(read('src/art/coco/coco-sprite.json')) as {
    symbols: art.ManifestSymbol[]
  }
  const sources = JSON.parse(read('content/art/sources.json')) as art.SourcesJson
  const tattoo = JSON.parse(read('content/seed/data/tattoo.json')) as {
    gallery: { image: string; showsCustomer: boolean }[]
  }
  const customerCodes = tattoo.gallery
    .filter((g) => g.showsCustomer)
    .map((g) => g.image.replace(/^media:ig:/, '').split('#')[0]!)
  const files = inp.probes
  const R: CheckResult[] = []

  // LQ
  const cases = lineCases()
  const frames = inp.runDir ? await lineFrames(inp.runDir, files) : []
  R.push(
    line.lq01(frames),
    line.lq02(cases),
    line.lq03(cases),
    line.lq04(cases),
    line.lq05(cases),
    line.lq06(frames),
  )

  // CO
  const syms = art.spriteSymbols(sprite)
  const props: art.CocoProportions[] = []
  for (const s of syms) props.push(await art.cocoProportions(s))
  const masks = await art.silhouettes(sprite)
  const small = await art.silhouettes(sprite, 128)
  R.push(
    art.co01(sprite),
    art.co02(props),
    art.co04(manifest.symbols),
    art.co05(masks),
    art.co06(sprite, props),
    art.co07(sprite, small),
    art.co08(art.cocoStrokeTable(tokens, cocoCss)),
  )

  // AR
  const stations = svgFiles('src/art/stations').map((f) => f.replace(/\.svg$/, ''))
  R.push(art.ar01(sources, stations, customerCodes))
  R.push(art.ar02(await stationPairs(sources)))
  const size = (f: string) => statSync(f).size
  const placeholders = svgFiles(PLACEHOLDER_DIR)
  R.push(
    art.ar03([
      ...stations.map((n) => ({
        kind: 'station' as const,
        name: n,
        bytes: size(`src/art/stations/${n}.svg`),
      })),
      ...placeholders.map((n) => ({
        kind: 'placeholder' as const,
        name: n,
        bytes: size(path.join(PLACEHOLDER_DIR, n)),
      })),
      { kind: 'motif' as const, name: 'planet.svg', bytes: size('src/art/planet.svg') },
      ...svgFiles('src/art/icons').map((n) => ({
        kind: 'icon' as const,
        name: n,
        bytes: size(`src/art/icons/${n}`),
      })),
      { kind: 'wordmark' as const, name: 'wordmark.svg', bytes: size('public/art/wordmark.svg') },
    ]),
  )
  const washes = placeholderWashes()
  const phInputs: art.PlaceholderInput[] = []
  for (const n of placeholders) {
    const name = n.replace(/\.svg$/, '')
    const svg = read(path.join(PLACEHOLDER_DIR, n))
    const wash = washes.get(name)
    phInputs.push({
      name,
      svg,
      wash: wash ? ART.wash[wash] : null,
      washes: Object.values(ART.wash),
      inkHeight: await art.inkHeightRatio(svg),
    })
  }
  R.push(art.ar04(phInputs))
  R.push(
    art.ar06(
      rt.entries(files, { sc: 'SC-01' }).map((e) => ({
        label: `${e.profile}/${e.variant} ${e.p.label}`,
        starsInView: e.p.marks.stars,
        maxPerStation: e.p.marks.perStation,
      })),
    ),
  )

  // IM
  const lcpBytes =
    rt
      .entries(files, { sc: 'SC-05', profile: 'art-pixel7' })
      .map((e) => e.p.lcp?.bytes ?? null)
      .find((b) => b !== null) ?? null
  R.push(
    art.im01(inp.evidence['IM-01'] ?? null),
    art.im02(inp.images),
    art.im05(inp.images, lcpBytes),
  )

  // MO
  R.push(
    rt.mo01(files, rt.allowedDurations(tokens, design)),
    rt.mo02(files, rt.allowedEasings(tokens)),
    rt.mo03(cocoCss, tokens, manifest.symbols),
    rt.mo04(files),
    rt.mo05(files),
    rt.mo06(files),
    rt.mo07(files),
    rt.mo08(files),
    rt.mo09(files),
    rt.mo10(files),
    rt.mo13(files),
    rt.mo14(files),
    rt.mo15(inp.runDir ? await flashSequences(inp.runDir) : []),
  )

  // LG
  R.push(rt.lg01(files), rt.lg02(files), rt.lg03(files), rt.lg04(files))

  // PF
  const gate = (id: string, th: string) => rt.perfFromGates(id, inp.perf, th)
  let modules: rt.ModuleSize[] | null = null
  try {
    modules = (await measureModules(MODULE_BUDGETS)).map((m) => ({
      name: m.name,
      gzipBytes: m.gzipBytes,
      gzipMax: m.gzipMax,
    }))
  } catch {
    modules = null
  }
  R.push(
    gate('PF-01', '0 LoAF/Long Tasks > 50 ms aus leash/coco/micro (Pixel 7, 4×)'),
    gate('PF-02', 'p95 rAF ≤ Grundlinie + 3 ms; Anteil > 33,4 ms ≤ Grundlinie + 3 pp'),
    rt.pf03(inp.perf, files),
    rt.pf04(inp.perf, files),
    gate('PF-05', '≤ 3 Layout-Ereignisse in 5 s Scrollen, 0 Forced reflow aus Engine-Code'),
    gate('PF-06', 'Engine-CLS-Beitrag 0; Seiten-CLS mit Engine ≤ Grundlinie'),
    gate('PF-07', 'LCP mit Engine − Grundlinie ≤ 100 ms (EK-01: Lighthouse-CI)'),
    gate('PF-08', 'Event-Timing Menü und „In den Korb“ ≤ 150 ms (4×)'),
    rt.pf09(modules, gsapUses()),
    rt.pf10({ raw: Buffer.byteLength(sprite), gz: gzipSync(sprite, { level: 9 }).length }, files),
    rt.pf11(files),
    rt.pf12(files),
  )

  // A11Y
  R.push(
    rt.a11y01(files, inp.timeCompare),
    rt.a11y02(files),
    rt.a11y03(files),
    rt.a11y04(inp.axe),
    rt.a11y05(files),
    rt.a11y06(files),
    rt.a11y07(files),
  )

  // CT
  R.push(
    rt.evidence(
      'CT-01',
      'DESIGN AK-DS-01 grün',
      inp.evidence['CT-01'] ?? null,
      'Kontrast-Test nicht ausgeführt (pnpm art:check --evidence)',
    ),
    rt.ct02(inp.axe, inp.runDir ? await contrastSamples(inp.runDir, files) : []),
    rt.ct03(files),
  )

  // RZ
  R.push(rt.rz01(files), rt.rz02(files))
  return R
}

/** IDs, die `runAllChecks` liefert (Abgleich mit KUNST-QA §5 im Parser-Test). */
export const AUTO_IDS = [
  ...['LQ-01', 'LQ-02', 'LQ-03', 'LQ-04', 'LQ-05', 'LQ-06'],
  ...['CO-01', 'CO-02', 'CO-04', 'CO-05', 'CO-06', 'CO-07', 'CO-08'],
  ...['AR-01', 'AR-02', 'AR-03', 'AR-04', 'AR-06'],
  ...['IM-01', 'IM-02', 'IM-05'],
  ...[
    'MO-01',
    'MO-02',
    'MO-03',
    'MO-04',
    'MO-05',
    'MO-06',
    'MO-07',
    'MO-08',
    'MO-09',
    'MO-10',
    'MO-13',
    'MO-14',
    'MO-15',
  ],
  ...['LG-01', 'LG-02', 'LG-03', 'LG-04'],
  ...[
    'PF-01',
    'PF-02',
    'PF-03',
    'PF-04',
    'PF-05',
    'PF-06',
    'PF-07',
    'PF-08',
    'PF-09',
    'PF-10',
    'PF-11',
    'PF-12',
  ],
  ...['A11Y-01', 'A11Y-02', 'A11Y-03', 'A11Y-04', 'A11Y-05', 'A11Y-06', 'A11Y-07'],
  ...['CT-01', 'CT-02', 'CT-03'],
  ...['RZ-01', 'RZ-02'],
] as const

// ---------- Bericht ----------

export interface CheckReport {
  runId: string | null
  date: string
  pass: boolean
  summary: { auto: number; pass: number; fail: number; judgement: number }
  criteria: (Criterion & { result: CheckResult | null; open: string | null })[]
}

export function buildReport(
  runId: string | null,
  criteria: readonly Criterion[],
  results: readonly CheckResult[],
  date = new Date(),
): CheckReport {
  const byId = new Map(results.map((r) => [r.id, r]))
  const rows = criteria.map((c) => {
    const result = c.auto
      ? (byId.get(c.id) ?? noData(c.id, c.threshold, 'keine Prüfung implementiert'))
      : null
    return { ...c, result, open: c.judgement ? c.judgement : null }
  })
  const auto = rows.filter((r) => r.result)
  const fail = auto.filter((r) => r.result!.status === 'FAIL').length
  return {
    runId,
    date: date.toISOString(),
    pass: fail === 0,
    summary: {
      auto: auto.length,
      pass: auto.length - fail,
      fail,
      judgement: rows.filter((r) => r.open).length,
    },
    criteria: rows,
  }
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function renderMarkdown(report: CheckReport): string {
  const out: string[] = [
    `# Kunst-QA – automatische Prüfung (${report.runId ?? 'ohne Lauf'})`,
    '',
    `Stand ${report.date.slice(0, 16).replace('T', ' ')} UTC · **${report.pass ? 'PASS' : 'FAIL'}** · auto ${report.summary.pass}/${report.summary.auto} bestanden, ${report.summary.fail} rot · ${report.summary.judgement} Urteilspunkte offen (R1/R2/R3, nie automatisch bestanden).`,
    '',
  ]
  let section = ''
  for (const r of report.criteria) {
    if (r.section !== section) {
      section = r.section
      out.push(
        `## ${r.section} ${r.area} – Linse ${r.lens}`,
        '',
        '| ID | Kriterium | Ergebnis | Messwert | Schwelle | Schwere | Urteil |',
        '|---|---|---|---|---|---|---|',
      )
    }
    const res = r.result ? (r.result.status === 'PASS' ? 'PASS' : '**FAIL**') : '—'
    const val = r.result ? r.result.value : 'Urteil der Linse'
    const th = r.result ? r.result.threshold : r.threshold
    out.push(
      `| ${r.id} | ${cell(r.title)} | ${res} | ${cell(val)} | ${cell(th)} | ${severityOf(r)} | ${r.open ? `${r.open} offen` : '–'} |`,
    )
  }
  const failed = report.criteria.filter((r) => r.result?.status === 'FAIL')
  if (failed.length) {
    out.push('', '## Befunde (FAIL)', '')
    for (const r of failed) {
      out.push(`- **${r.id}** (${severityOf(r)}): ${r.result!.value}`)
      for (const d of r.result!.details ?? []) out.push(`  - ${d}`)
    }
  }
  return `${out.join('\n')}\n`
}

// ---------- CLI ----------

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const runId = args.find((a) => !a.startsWith('--')) ?? existingRuns().sort().at(-1) ?? null
  const runDir = runId ? path.join(ART_ROOT, runId) : null
  if (!runDir || !existsSync(runDir)) {
    console.error(`art:check: Lauf ${runId ?? '(keiner)'} nicht gefunden unter ${ART_ROOT}/.`)
    process.exit(2)
  }
  const evidenceFile = path.join(runDir, 'metrics', 'evidence.json')
  let evidence = readJson<Record<string, Evidence>>(evidenceFile) ?? {}
  if (args.includes('--evidence')) {
    evidence = runEvidence()
    writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  const inputs: CheckInputs = { ...loadRun(runDir), evidence }
  const results = await runAllChecks(inputs)
  const report = buildReport(runId, parseCriteria(readFileSync(KUNST_QA_FILE, 'utf8')), results)
  writeFileSync(path.join(runDir, 'check.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(path.join(runDir, 'check.md'), renderMarkdown(report))
  const failed = report.criteria.filter((r) => r.result?.status === 'FAIL').map((r) => r.id)
  console.log(
    `art:check: ${runId}: ${report.summary.pass}/${report.summary.auto} auto-Kriterien bestanden${failed.length ? `, rot: ${failed.join(', ')}` : ''}; ${report.summary.judgement} Urteilspunkte offen → ${path.join(runDir, 'check.md')}`,
  )
  process.exit(report.pass ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
