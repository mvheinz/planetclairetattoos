import { fnv1a } from '../lib/stringHash'

// Deterministischer Zufall der Tuschelinie (DESIGN §9.1, §9.3): gleiche Route → gleiche Linie, nie Zeit/Math.random.

/** FNV-1a, 32 Bit – Seed der Linie: `fnv1a32(`${preset}:${routeKey}`)`. */
export const fnv1a32: (str: string) => number = fnv1a

/** Kleiner, schneller PRNG (Mulberry32); liefert Zahlen in `[0, 1)`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gitterwert in `[-1, 1]` für Ganzzahl `i` (Integer-Hash, unendlich, ohne Tabelle). */
function lattice(i: number, seed: number): number {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ seed
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/**
 * Geglättetes 1D-Value-Noise (Gitter im Abstand 1, Übergang mit Smootherstep, stetig differenzierbar).
 * Liefert eine Funktion `x → [-1, 1]`; gleiche Seeds liefern gleiche Werte.
 */
export function valueNoise1D(seed: number, tremor = false): (x: number) => number {
  const s = seed >>> 0
  // Zittern (Tuschelinie, LQ-03): Gitterwerte mit wechselndem Vorzeichen und Betrag 0,8–1 – nie 120 px lang gerade.
  const at = (i: number) => {
    const v = lattice(i, s)
    return tremor ? (i & 1 ? -1 : 1) * (0.8 + 0.1 * (v + 1)) : v
  }
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * f * (f * (f * 6 - 15) + 10)
    const a = at(i)
    const b = at(i + 1)
    return a + (b - a) * u
  }
}
