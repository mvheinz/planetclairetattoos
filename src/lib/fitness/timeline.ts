// Fitness-Coco (P12.5): Zeitplan der Schleife. Jede Übung beschreibt ihre Parameter als Summe kleiner Terme (Konstante,
// Sinus, Hüpfer, periodische Schlüsselwerte); an den Grenzen werden zwei Übungen weich überblendet, sodass Coco nie springt
// und der Schleifenpunkt unsichtbar ist. Alle Zeiten in ms. Reines TypeScript (Verhalten, Generator und Tests teilen es).
import { NEUTRAL, type ParamKey, type Params } from './rig'

/** `['m', v]` Konstante · `['s', amp, Zyklen, Phase]` Sinus · `['b', amp, Zyklen, Phase]` Hüpfer |sin| ·
 * `['k', Zyklen, [[u, v], …]]` periodische Schlüsselwerte (Kosinus-Übergänge, u in 0 … 1). Werte absolut; u = Anteil der Übung. */
export type Term =
  | ['m', number]
  | ['s', number, number, number]
  | ['b', number, number, number]
  | ['k', number, [number, number][]]

export interface Exercise {
  id: string
  /** Dauer in ms */
  ms: number
  /** Breite des Übergangs zur nächsten Übung in ms (Überblendung um die Grenze) */
  w: number
  f: Partial<Record<ParamKey, Term[]>>
}
export interface FitnessData {
  v: 2
  ex: Exercise[]
}

const TAU = Math.PI * 2
const sm = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

function term(t: Term, u: number): number {
  switch (t[0]) {
    case 'm':
      return t[1]
    case 's':
      return t[1] * Math.sin(TAU * (t[2] * u + t[3]))
    case 'b':
      return t[1] * Math.abs(Math.sin(Math.PI * (t[2] * u + t[3])))
    default: {
      const k = t[2]
      const x = (((t[1] * u) % 1) + 1) % 1
      let i = k.length - 1
      for (let j = 0; j < k.length; j++) if (k[j]![0] <= x) i = j
      const a = k[i]!,
        b = k[(i + 1) % k.length]!
      const au = a[0]
      let bu = b[0]
      if (bu <= au) bu += 1
      const xx = x < au ? x + 1 : x
      const f = (xx - au) / (bu - au)
      return a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(Math.PI * f))
    }
  }
}

/** Ruhepose = Standbild (reduzierte Bewegung, Erstanzeige); die Leinwand blendet daraus in die Schleife ein. */
export const REST: Partial<Params> = {
  hr: 5,
  hy: 6,
  swy: 1.5,
  ra1: 26,
  ra2: 18,
  la1: 16,
  la2: 10,
  mo: 1,
  lx: 0.2,
  tb: 0,
  ta: 88,
  tc: 24,
}
export const REST_POSE: Params = { ...NEUTRAL, ...REST }
/** Schleifenzeit (ms), bei der die Leinwand beginnt (Aufstehen ist vorbei, die erste Übung läuft an). */
export const START_MS = 1300

export const loopMs = (d: FitnessData) => d.ex.reduce((s, e) => s + e.ms, 0)

/** Gewicht der Übung `i` zur Zeit `t` (ms, innerhalb 0 … Schleife; berücksichtigt den Schleifenpunkt). */
export function weights(d: FitnessData, t: number): number[] {
  const total = loopMs(d)
  const out: number[] = []
  let start = 0
  d.ex.forEach((e, i) => {
    const wIn = d.ex[(i + d.ex.length - 1) % d.ex.length]!.w,
      wOut = e.w
    let w = 0
    for (const sh of [-total, 0, total]) {
      const tt = t + sh
      w += sm((tt - (start - wIn / 2)) / wIn) * (1 - sm((tt - (start + e.ms - wOut / 2)) / wOut))
    }
    out.push(w)
    start += e.ms
  })
  return out
}

function base(d: FitnessData, t: number): Params {
  const total = loopMs(d)
  const p: Params = { ...NEUTRAL }
  let start = 0
  d.ex.forEach((e, i) => {
    const wIn = d.ex[(i + d.ex.length - 1) % d.ex.length]!.w
    for (const sh of [-total, 0, total]) {
      const tt = t + sh
      const env =
        sm((tt - (start - wIn / 2)) / wIn) * (1 - sm((tt - (start + e.ms - e.w / 2)) / e.w))
      if (env <= 0) continue
      const u = (tt - start) / e.ms
      for (const k of Object.keys(e.f) as ParamKey[]) {
        const v = e.f[k]!.reduce((s, x) => s + term(x, u), 0)
        p[k] += env * (v - NEUTRAL[k])
      }
    }
    start += e.ms
  })
  return p
}

/** Alle Parameter zur Schleifenzeit `tMs` (beliebig, wird auf die Schleife abgebildet). */
export function poseAt(d: FitnessData, tMs: number, k = 1): Params {
  const total = loopMs(d)
  const t = ((tMs % total) + total) % total
  const p = base(d, t)
  // Nachschwingen der Ohren aus der senkrechten Geschwindigkeit des Beckens (Überlappung)
  const prev = base(d, (t - 70 + total) % total)
  p.ear = Math.max(-26, Math.min(26, (p.y - prev.y) * 2.4 + p.ear))
  // Schwanzwelle: ganzzahlig viele Perioden je Schleife (nahtlos)
  const n = Math.max(1, Math.round(total / 1000))
  p.tp = TAU * n * (t / total)
  // Atmen (ruhig) und Blinzeln (alle ≈ 3,7 s, 150 ms) – ebenfalls nahtlos
  const nb = Math.max(1, Math.round(total / 2100))
  p.sq += 0.012 * Math.sin(TAU * nb * (t / total))
  const nbl = Math.max(1, Math.round(total / 3700))
  const ph = ((t / total) * nbl) % 1
  const bl = Math.max(0, 1 - Math.abs(ph - 0.5) * (total / nbl / 75))
  if (bl > 0) p.lid = Math.max(p.lid, Math.min(1, bl * 1.4))
  if (k < 1)
    for (const key of Object.keys(p) as ParamKey[])
      p[key] = REST_POSE[key] + k * (p[key] - REST_POSE[key])
  return p
}
