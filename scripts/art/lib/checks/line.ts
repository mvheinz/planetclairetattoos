import { srgbToLab } from '../lab'
import { mean, medianOf, noData, result, round, std, type CheckResult } from './common'

// Tuschelinie (KUNST-QA §5.1 LQ-01…LQ-06). LQ-02…LQ-05 rechnen auf der Geometrie der Engine (`buildGeometryWithSamples`,
// gewackelte und glatte Linie, Breiten), LQ-01/LQ-06 auf Standbildern mit den Linienpunkten aus den Aufnahme-Sonden
// (`raw/<SC>/…/probes.json`). Rein bis auf die Eingaben.

export const INK_HEX = '#1C1A17'

export interface LineSamples {
  s: ArrayLike<number>
  x: ArrayLike<number>
  y: ArrayLike<number>
  w: ArrayLike<number>
  sx: ArrayLike<number>
  sy: ArrayLike<number>
}

export interface LineCase {
  label: string
  samples: LineSamples
  /** `--leash-w` in px. */
  baseWidth: number
  /** Schlaufen als Bogenlängen-Bereiche. */
  loops: { id: string; len0: number; len1: number }[]
}

/** Anfangs-/Endverjüngung der Engine (Schritt 7, `geometry.ts`) – für LQ-02 ausgenommen. */
const TAPER = { start: 28, end: 18 }

export function lq02(cases: readonly LineCase[]): CheckResult {
  const th = 'Mittel 0,95–1,10 × --leash-w; Variationskoeffizient 0,08–0,20'
  if (!cases.length) return noData('LQ-02', th, 'keine Liniengeometrie')
  const bad: string[] = []
  const vals: string[] = []
  for (const c of cases) {
    const total = c.samples.s[c.samples.s.length - 1]!
    const w: number[] = []
    for (let i = 0; i < c.samples.s.length; i++) {
      const s = c.samples.s[i]!
      if (s >= TAPER.start && s <= total - TAPER.end) w.push(c.samples.w[i]!)
    }
    const ratio = mean(w) / c.baseWidth
    const cv = std(w) / mean(w)
    vals.push(`${c.label} ${round(ratio, 3)}× / CV ${round(cv, 3)}`)
    if (!(ratio >= 0.95 && ratio <= 1.1)) bad.push(`${c.label}: Mittel ${round(ratio, 3)} × Grundbreite`)
    if (!(cv >= 0.08 && cv <= 0.2)) bad.push(`${c.label}: Variationskoeffizient ${round(cv, 3)}`)
  }
  return result('LQ-02', bad.length === 0, vals.join('; '), th, bad)
}

/** Längste Abschnitte (Bogenlänge ≥ `minLen`), deren Punkte < `tol` px von der Sehne abweichen. */
export function straightRuns(
  s: ArrayLike<number>,
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  minLen = 120,
  tol = 0.3,
): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = []
  const n = s.length
  let j = 0
  for (let i = 0; i < n; i += 5) {
    while (j < n - 1 && s[j]! - s[i]! < minLen) j++
    if (s[j]! - s[i]! < minLen) break
    const ax = x[i]!
    const ay = y[i]!
    const dx = x[j]! - ax
    const dy = y[j]! - ay
    const len = Math.hypot(dx, dy) || 1
    let maxDev = 0
    for (let k = i + 1; k < j && maxDev < tol; k++)
      maxDev = Math.max(maxDev, Math.abs((x[k]! - ax) * dy - (y[k]! - ay) * dx) / len)
    if (maxDev < tol) {
      const last = runs[runs.length - 1]
      if (last && s[i]! <= last.to) last.to = s[j]!
      else runs.push({ from: s[i]!, to: s[j]! })
    }
  }
  return runs
}

export function lq03(cases: readonly LineCase[]): CheckResult {
  const th = 'RMS Wackel 0,35–1,3 px; 0 gerade Strecken ≥ 120 px (Abweichung < 0,3 px)'
  if (!cases.length) return noData('LQ-03', th, 'keine Liniengeometrie')
  const bad: string[] = []
  const vals: string[] = []
  for (const c of cases) {
    const { x, y, sx, sy, s } = c.samples
    let sum = 0
    for (let i = 0; i < x.length; i++) sum += (x[i]! - sx[i]!) ** 2 + (y[i]! - sy[i]!) ** 2
    const rms = Math.sqrt(sum / x.length)
    const runs = straightRuns(s, x, y)
    vals.push(`${c.label} RMS ${round(rms, 3)} px, ${runs.length} gerade`)
    if (!(rms >= 0.35 && rms <= 1.3)) bad.push(`${c.label}: RMS ${round(rms, 3)} px`)
    for (const r of runs) bad.push(`${c.label}: gerade Strecke s=${round(r.from, 0)}…${round(r.to, 0)}`)
  }
  return result('LQ-03', bad.length === 0, vals.join('; '), th, bad)
}

// ---------- LQ-04: Kegelschnitt-Anpassung ----------

/** Eigenvektor zum kleinsten Eigenwert einer symmetrischen Matrix (Jacobi). */
function smallestEigenvector(a: number[][]): number[] {
  const n = a.length
  const m = a.map((r) => [...r])
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += m[p]![q]! ** 2
    if (off < 1e-18) break
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(m[p]![q]!) < 1e-30) continue
        const theta = (m[q]![q]! - m[p]![p]!) / (2 * m[p]![q]!)
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const mkp = m[k]![p]!
          const mkq = m[k]![q]!
          m[k]![p] = c * mkp - s * mkq
          m[k]![q] = s * mkp + c * mkq
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p]![k]!
          const mqk = m[q]![k]!
          m[p]![k] = c * mpk - s * mqk
          m[q]![k] = s * mpk + c * mqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k]![p]!
          const vkq = v[k]![q]!
          v[k]![p] = c * vkp - s * vkq
          v[k]![q] = s * vkp + c * vkq
        }
      }
  }
  let best = 0
  for (let i = 1; i < n; i++) if (m[i]![i]! < m[best]![best]!) best = i
  return v.map((r) => r[best]!)
}

/** Kreis-/Ellipsen-Anpassung (allgemeiner Kegelschnitt): RMS-Residuum (Sampson-Abstand, px) und Radiusschwankung. */
export function loopFit(pts: readonly { x: number; y: number }[]): { residual: number; radiusVar: number } {
  const n = pts.length
  const cx = pts.reduce((a, p) => a + p.x, 0) / n
  const cy = pts.reduce((a, p) => a + p.y, 0) / n
  const sc = Math.sqrt(pts.reduce((a, p) => a + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / n) || 1
  const q = pts.map((p) => ({ x: (p.x - cx) / sc, y: (p.y - cy) / sc }))
  const s = Array.from({ length: 6 }, () => new Array<number>(6).fill(0))
  for (const p of q) {
    const row = [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y, 1]
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) s[i]![j]! += row[i]! * row[j]!
  }
  const [A, B, C, D, E, F] = smallestEigenvector(s) as [number, number, number, number, number, number]
  let sum = 0
  for (const p of q) {
    const f = A * p.x * p.x + B * p.x * p.y + C * p.y * p.y + D * p.x + E * p.y + F
    const gx = 2 * A * p.x + B * p.y + D
    const gy = B * p.x + 2 * C * p.y + E
    const g = Math.hypot(gx, gy) || 1e-12
    sum += (f / g) ** 2
  }
  const residual = Math.sqrt(sum / n) * sc
  const r = pts.map((p) => Math.hypot(p.x - cx, p.y - cy))
  return { residual, radiusVar: std(r) / mean(r) }
}

export function lq04(cases: readonly LineCase[]): CheckResult {
  const th = 'je Schlaufe Kreis-/Ellipsen-Residuum RMS ≥ 0,6 px und Radiusschwankung ≥ 6 %'
  const bad: string[] = []
  const vals: string[] = []
  let count = 0
  for (const c of cases)
    for (const loop of c.loops) {
      // Kern der Schlaufe (mittlere 70 % des Bereichs), ohne Zu- und Ablauf.
      const span = loop.len1 - loop.len0
      const a = loop.len0 + span * 0.15
      const b = loop.len1 - span * 0.15
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i < c.samples.s.length; i++)
        if (c.samples.s[i]! >= a && c.samples.s[i]! <= b)
          pts.push({ x: c.samples.x[i]!, y: c.samples.y[i]! })
      if (pts.length < 8) continue
      count++
      const fit = loopFit(pts)
      vals.push(`${c.label}/${loop.id} ${round(fit.residual, 2)} px, ${round(fit.radiusVar * 100, 1)} %`)
      if (fit.residual < 0.6 || fit.radiusVar < 0.06)
        bad.push(
          `${c.label}/${loop.id}: Residuum ${round(fit.residual, 2)} px, Radiusschwankung ${round(fit.radiusVar * 100, 1)} %`,
        )
    }
  if (count === 0) return noData('LQ-04', th, 'keine Schlaufen in der Geometrie')
  return result('LQ-04', bad.length === 0, vals.join('; '), th, bad)
}

export function lq05(cases: readonly LineCase[]): CheckResult {
  const th = 'Breite erste 4 px ≤ 0,45 ×, letzte 4 px ≤ 0,5 × Grundbreite'
  if (!cases.length) return noData('LQ-05', th, 'keine Liniengeometrie')
  const bad: string[] = []
  const vals: string[] = []
  for (const c of cases) {
    const { s, w } = c.samples
    const total = s[s.length - 1]!
    let head = 0
    let tail = 0
    for (let i = 0; i < s.length; i++) {
      if (s[i]! <= 4) head = Math.max(head, w[i]!)
      if (s[i]! >= total - 4) tail = Math.max(tail, w[i]!)
    }
    const h = head / c.baseWidth
    const t = tail / c.baseWidth
    vals.push(`${c.label} Anfang ${round(h, 3)}×, Ende ${round(t, 3)}×`)
    if (h > 0.45) bad.push(`${c.label}: Anfang ${round(h, 3)} × Grundbreite`)
    if (t > 0.5) bad.push(`${c.label}: Ende ${round(t, 3)} × Grundbreite`)
  }
  return result('LQ-05', bad.length === 0, vals.join('; '), th, bad)
}

// ---------- Pixel: LQ-01, LQ-06 ----------

export interface Raster {
  data: Uint8Array
  width: number
  height: number
  channels: number
}

/** Ein Standbild mit der gezeichneten Linie in Bildpunkten (Sonde × Skalierung). */
export interface LineFrame {
  label: string
  raster: Raster
  /** Mittellinie (Bildpunkte) mit Bogenlänge, nur gezeichneter, sichtbarer Teil. */
  pts: { len: number; x: number; y: number }[]
  /** Halbe Linienbreite in Bildpunkten. */
  halfW: number
  /** Segmentgrenzen als Bogenlänge. */
  seams: number[]
  /** Bereiche, die nicht zur Linie zählen (Coco, Text) in Bildpunkten. */
  exclude?: { x: number; y: number; w: number; h: number }[]
}

const lab = (r: Raster, x: number, y: number) => {
  const i = (y * r.width + x) * r.channels
  return srgbToLab(r.data[i]!, r.data[i + 1]!, r.data[i + 2]!)
}
const inside = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
  p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h

/** CIEDE2000 (Sharma et al. 2005). */
export function deltaE2000(l1: readonly number[], l2: readonly number[]): number {
  const [L1, a1, b1] = l1 as [number, number, number]
  const [L2, a2, b2] = l2 as [number, number, number]
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0
    const v = Math.atan2(b, a) / rad
    return v < 0 ? v + 360 : v
  }
  const h1p = h(b1, a1p)
  const h2p = h(b2, a2p)
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad)
  const Lbp = (L1 + L2) / 2
  const Cbp = (C1p + C2p) / 2
  let hbp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
    else hbp = (h1p + h2p) / 2
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2)
  const Sc = 1 + 0.045 * Cbp
  const Sh = 1 + 0.015 * Cbp * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  )
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', ''), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

export function lq01(frames: readonly LineFrame[], samplesWanted = 200): CheckResult {
  const th = `ΔE2000 ≤ 3 zu ${INK_HEX}, Chroma C* ≤ 4 (Median der dunkelsten 50 % an 200 Stichproben)`
  const usable = frames.filter((f) => f.pts.length > 0)
  if (!usable.length) return noData('LQ-01', th, 'keine Standbilder mit gezeichneter Linie (Sonden SC-01)')
  const perFrame = Math.max(1, Math.ceil(samplesWanted / usable.length))
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  let taken = 0
  for (const f of usable) {
    const cand = f.pts.filter(
      (p) =>
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < f.raster.width &&
        p.y < f.raster.height &&
        !(f.exclude ?? []).some((b) => inside(p, b)),
    )
    const step = Math.max(1, Math.floor(cand.length / perFrame))
    for (let k = 0; k < cand.length && taken < samplesWanted; k += step) {
      const p = cand[k]!
      const r = Math.max(1, Math.ceil(f.halfW))
      const px: { l: number; i: number }[] = []
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const x = Math.round(p.x + dx)
          const y = Math.round(p.y + dy)
          if (x < 0 || y < 0 || x >= f.raster.width || y >= f.raster.height) continue
          px.push({ l: lab(f.raster, x, y)[0], i: (y * f.raster.width + x) * f.raster.channels })
        }
      px.sort((a, b) => a.l - b.l)
      for (const q of px.slice(0, Math.max(1, Math.ceil(px.length / 2)))) {
        rs.push(f.raster.data[q.i]!)
        gs.push(f.raster.data[q.i + 1]!)
        bs.push(f.raster.data[q.i + 2]!)
      }
      taken++
    }
  }
  const col = [medianOf(rs), medianOf(gs), medianOf(bs)] as [number, number, number]
  const l = srgbToLab(...col)
  const de = deltaE2000(l, srgbToLab(...hexToRgb(INK_HEX)))
  const chroma = Math.hypot(l[1], l[2])
  const hex = `#${col.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`
  return result(
    'LQ-01',
    de <= 3 && chroma <= 4,
    `${hex}: ΔE2000 ${round(de, 2)}, C* ${round(chroma, 2)} (${taken} Stichproben)`,
    th,
    de <= 3 && chroma <= 4 ? [] : [`Median-Farbe ${hex} weicht ab`],
  )
}

/** Punkt auf der Mittellinie bei Bogenlänge `len` (lineare Interpolation). */
function pointAtLen(pts: LineFrame['pts'], len: number): { x: number; y: number } | null {
  if (!pts.length || len < pts[0]!.len || len > pts[pts.length - 1]!.len) return null
  let lo = 0
  let hi = pts.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (pts[mid]!.len <= len) lo = mid
    else hi = mid
  }
  const a = pts[lo]!
  const b = pts[hi]!
  if (b.len - a.len > 12) return null // Lücke (nicht sichtbar) – nicht interpolieren
  const k = b.len === a.len ? 0 : (len - a.len) / (b.len - a.len)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

export function lq06(frames: readonly LineFrame[]): CheckResult {
  const th = 'an jeder Segmentgrenze: L* im 8-px-Fenster nie > Median + 15'
  const usable = frames.filter((f) => f.pts.length > 1)
  if (!usable.length) return noData('LQ-06', th, 'keine Standbilder mit gezeichneter Linie (Sonden SC-01)')
  const bad: string[] = []
  let seams = 0
  let worst = -Infinity
  for (const f of usable) {
    const L = (p: { x: number; y: number }) => {
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      if (x < 0 || y < 0 || x >= f.raster.width || y >= f.raster.height) return null
      return lab(f.raster, x, y)[0]
    }
    const ls: number[] = []
    const first = f.pts[0]!.len
    const last = f.pts[f.pts.length - 1]!.len
    for (let s = first; s <= last; s += 2) {
      const p = pointAtLen(f.pts, s)
      const v = p && !(f.exclude ?? []).some((b) => inside(p, b)) ? L(p) : null
      if (v !== null) ls.push(v)
    }
    if (ls.length < 10) continue
    const med = medianOf(ls)
    for (const b of f.seams) {
      if (b - 4 < first || b + 4 > last) continue
      let max = -Infinity
      for (let s = b - 4; s <= b + 4; s += 0.5) {
        const p = pointAtLen(f.pts, s)
        if (!p || (f.exclude ?? []).some((e) => inside(p, e))) continue
        const v = L(p)
        if (v !== null) max = Math.max(max, v)
      }
      if (max === -Infinity) continue
      seams++
      worst = Math.max(worst, max - med)
      if (max > med + 15) bad.push(`${f.label}: Naht bei s=${round(b, 0)} hell (${round(max - med, 1)} L* über Median)`)
    }
  }
  if (seams === 0) return noData('LQ-06', th, 'keine Segmentgrenze im gezeichneten, sichtbaren Teil')
  return result('LQ-06', bad.length === 0, `${seams} Nähte, max. ${round(worst, 1)} L* über Median`, th, bad)
}
