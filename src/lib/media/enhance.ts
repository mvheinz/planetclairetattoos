// Foto-Look (DESIGN §12.2 Schritte 4–6): Weißabgleich und Belichtung als reine Rechnung auf RGB-Rohdaten.
// Rein (kein sharp, kein Server-Code): `analyzeLook` bestimmt Kanal-Verstärkungen und Gamma, `buildLuts` liefert die
// Tonwerttabellen, die `pipeline.ts` auf das Bild anwendet. Alles ist begrenzt, damit Holz, Haut und Papier ihren
// Charakter behalten (KUNST-QA IM-03).

/** Begrenzung der Kanal-Verstärkung (Schritt 4). */
export const GAIN_RANGE = [0.92, 1.08] as const
/** Durchgänge des Weißabgleichs (P9.17: 2 – zweiter Durchgang auf dem abgeglichenen Bild). */
export const WB_PASSES = 2
/** Anteil „heller“ Pixel für den Neutralpunkt (oberes 5 %-Quantil der Helligkeit). */
export const NEUTRAL_QUANTILE = 0.95
/** Höchste Buntheit (Lab) eines „unbunten“ Pixels. */
export const NEUTRAL_CHROMA = 12
/** Mindestanteil geeigneter Pixel, sonst kein Abgleich (z. B. grüne Matte). */
export const NEUTRAL_MIN_SHARE = 0.005
/** Belichtung: Ziel-Median und Toleranzband (L*), Gamma-Grenzen (Schritt 5). */
export const EXPOSURE_TARGET = 62
export const EXPOSURE_BAND = [56, 68] as const
export const GAMMA_RANGE = [0.7, 1.25] as const
/** Mehr als dieser Anteil geclippter Pixel halbiert den Abstand von γ zu 1. */
export const CLIP_LIMIT = 0.01

/** Kategorie je Bild: `drawing` (Zeichnungen, Platzhalter) bekommt den halben Weißabgleich. */
export type EnhanceCategory = 'photo' | 'drawing'

export interface EnhancePlan {
  /** Kanal-Verstärkung R, G, B (1 = unverändert). */
  gains: [number, number, number]
  /** Gamma der Tonwertkurve (1 = unverändert). */
  gamma: number
  /** Anteil der für den Neutralpunkt geeigneten Pixel (0…1). */
  neutralShare: number
  /** Median-L* des mittleren 60 %-Bereichs vor der Korrektur. */
  medianL: number
  /** Anteil geclippter Pixel nach der Korrektur (L* ≥ 99 oder ≤ 1). */
  clipped: number
  /** Es gibt nichts zu tun – die Datei bleibt unverändert. */
  noop: boolean
}

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)

/** sRGB (0–255) → CIELAB (D65). */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const fx = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047)
  const fy = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B)
  const fz = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Rechenfehler-sichere Halbierung der Stärke: `1 + (g − 1) / 2`. */
const half = (g: number) => 1 + (g - 1) / 2

/** Tonwerttabelle eines Kanals: Verstärkung, dann `v' = v^γ` (normiert 0–1). */
export function buildLut(gain: number, gamma: number): Uint8Array {
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.min(1, (i / 255) * gain) ** gamma)
  return lut
}

export function buildLuts(plan: EnhancePlan): [Uint8Array, Uint8Array, Uint8Array] {
  return [
    buildLut(plan.gains[0], plan.gamma),
    buildLut(plan.gains[1], plan.gamma),
    buildLut(plan.gains[2], plan.gamma),
  ]
}

/**
 * Plan aus RGB(A)-Rohdaten (am besten ein auf ≈ 320 px verkleinertes Abbild). `channels` ≥ 3; Pixel mit Alpha < 128
 * zählen nicht.
 */
export function analyzeLook(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  category: EnhanceCategory = 'photo',
): EnhancePlan {
  const n = width * height
  const L = new Float32Array(n)
  const C = new Float32Array(n)
  const valid = new Uint8Array(n)
  let count = 0
  for (let p = 0; p < n; p++) {
    const i = p * channels
    if (channels === 4 && data[i + 3]! < 128) continue
    const [l, a, b] = srgbToLab(data[i]!, data[i + 1]!, data[i + 2]!)
    L[p] = l
    C[p] = Math.hypot(a, b)
    valid[p] = 1
    count++
  }
  const noop: EnhancePlan = {
    gains: [1, 1, 1],
    gamma: 1,
    neutralShare: 0,
    medianL: EXPOSURE_TARGET,
    clipped: 0,
    noop: true,
  }
  if (count === 0) return noop

  // Schritt 4: Neutralpunkt aus hellen, unbunten Pixeln. Zwei Durchgänge (P9.17): der zweite misst Helligkeit und
  // Buntheit auf dem schon abgeglichenen Bild neu – nach dem ersten Abgleich zählen oft andere Pixel als „unbunt“, und
  // ein Rest-Farbstich (z. B. b* ≈ 4 auf cremefarbener Glasur) bliebe sonst stehen. Gesamtverstärkung bleibt begrenzt.
  const sortedL = Float32Array.from(L.filter((_, p) => valid[p] === 1)).sort()
  const threshold =
    sortedL[Math.min(sortedL.length - 1, Math.floor(NEUTRAL_QUANTILE * (sortedL.length - 1)))]!
  let gains: [number, number, number] = [1, 1, 1]
  let neutralShare = 0
  for (let pass = 0; pass < WB_PASSES; pass++) {
    const luts = pass === 0 ? null : gains.map((g) => buildLut(g, 1))
    let sr = 0
    let sg = 0
    let sb = 0
    let ne = 0
    for (let p = 0; p < n; p++) {
      if (!valid[p]) continue
      const i = p * channels
      let r = data[i]!
      let g = data[i + 1]!
      let b = data[i + 2]!
      let l = L[p]!
      let c = C[p]!
      if (luts) {
        r = luts[0]![r]!
        g = luts[1]![g]!
        b = luts[2]![b]!
        const lab = srgbToLab(r, g, b)
        l = lab[0]
        c = Math.hypot(lab[1], lab[2])
      }
      if (l < threshold || c >= NEUTRAL_CHROMA) continue
      sr += r
      sg += g
      sb += b
      ne++
    }
    if (pass === 0) neutralShare = ne / count
    if (neutralShare < NEUTRAL_MIN_SHARE || ne === 0) break
    const mr = sr / ne
    const mg = sg / ne
    const mb = sb / ne
    const mean = (mr + mg + mb) / 3
    if (mean <= 8) break
    const g = [mean / mr, mean / mg, mean / mb].map((v, k) =>
      clamp(gains[k]! * (category === 'drawing' ? half(v) : v), GAIN_RANGE[0], GAIN_RANGE[1]),
    )
    gains = [g[0]!, g[1]!, g[2]!]
  }

  // Schritt 5: Belichtung – Median-L* des mittleren 60 %-Bereichs (Fenster 20–80 % je Achse), nach dem Abgleich
  const lutsWb = [buildLut(gains[0], 1), buildLut(gains[1], 1), buildLut(gains[2], 1)]
  const x0 = Math.floor(width * 0.2)
  const x1 = Math.ceil(width * 0.8)
  const y0 = Math.floor(height * 0.2)
  const y1 = Math.ceil(height * 0.8)
  const mid: number[] = []
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = y * width + x
      if (!valid[p]) continue
      const i = p * channels
      mid.push(
        srgbToLab(lutsWb[0]![data[i]!]!, lutsWb[1]![data[i + 1]!]!, lutsWb[2]![data[i + 2]!]!)[0],
      )
    }
  mid.sort((a, b) => a - b)
  const medianL = mid.length ? mid[mid.length >> 1]! : EXPOSURE_TARGET
  let gamma = 1
  if (medianL < EXPOSURE_BAND[0] || medianL > EXPOSURE_BAND[1]) {
    gamma = clamp(
      Math.log(EXPOSURE_TARGET / 100) / Math.log(Math.max(1, medianL) / 100),
      GAMMA_RANGE[0],
      GAMMA_RANGE[1],
    )
  }
  const clipShare = (gm: number) => {
    const luts = [buildLut(gains[0], gm), buildLut(gains[1], gm), buildLut(gains[2], gm)]
    let clip = 0
    for (let p = 0; p < n; p++) {
      if (!valid[p]) continue
      const i = p * channels
      const l = srgbToLab(luts[0]![data[i]!]!, luts[1]![data[i + 1]!]!, luts[2]![data[i + 2]!]!)[0]
      if (l >= 99 || l <= 1) clip++
    }
    return clip / count
  }
  let clipped = clipShare(gamma)
  if (gamma !== 1 && clipped > CLIP_LIMIT) {
    gamma = 1 + (gamma - 1) / 2
    clipped = clipShare(gamma)
  }
  const isNoop = gamma === 1 && gains.every((g) => Math.abs(g - 1) < 0.002)
  return { gains, gamma, neutralShare, medianL, clipped, noop: isNoop }
}

/** Wendet Tabellen auf RGB(A)-Rohdaten an (in place; Alpha bleibt). */
export function applyLuts(
  data: Uint8Array,
  channels: number,
  luts: [Uint8Array, Uint8Array, Uint8Array],
): void {
  for (let i = 0; i + 2 < data.length; i += channels) {
    data[i] = luts[0][data[i]!]!
    data[i + 1] = luts[1][data[i + 1]!]!
    data[i + 2] = luts[2][data[i + 2]!]!
  }
}

/** ΔE2000 zweier Lab-Farben (Sharma 2005) – für Tests und Prüfungen. */
export function deltaE2000(l1: [number, number, number], l2: [number, number, number]): number {
  const [L1, a1, b1] = l1
  const [L2, a2, b2] = l2
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h = (b: number, a: number) => (Math.atan2(b, a) / rad + 360) % 360
  const h1p = C1p === 0 ? 0 : h(b1, a1p)
  const h2p = C2p === 0 ? 0 : h(b2, a2p)
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2)
  const Lpm = (L1 + L2) / 2
  const Cpm = (C1p + C2p) / 2
  let hpm = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hpm /= 2
    else hpm = (hpm + (h1p + h2p < 360 ? 360 : -360)) / 2
  }
  const T =
    1 -
    0.17 * Math.cos((hpm - 30) * rad) +
    0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) -
    0.2 * Math.cos((4 * hpm - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2)
  const Sc = 1 + 0.045 * Cpm
  const Sh = 1 + 0.015 * Cpm * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  )
}
