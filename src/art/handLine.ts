// Statische, handgezeichnete Linien (DESIGN KO-02 Kopf-Unterkante, KO-04 Fuß-Oberkante): ein leicht wackliger
// SVG-Pfad fester Länge (2400 px), links verankert und rechts abgeschnitten (kein `preserveAspectRatio="none"`).
// Deterministisch je Seed (gleiche Variante auf Server und Client, keine Hydration-Abweichung). Framework-frei.

/** Kleiner, deterministischer Zufallsgenerator (mulberry32). */
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

const r1 = (n: number) => Math.round(n * 10) / 10

export interface HandLineOptions {
  length?: number
  /** Mittellinie (y) im viewBox. */
  y?: number
  /** Größte Abweichung nach oben/unten in px. */
  amplitude?: number
  /** Mittlere Segmentlänge in px. */
  step?: number
}

/** Pfad `M … Q …` einer Handlinie von x = 0 bis `length`. */
export function handLinePath(seed: number, options: HandLineOptions = {}): string {
  const { length = 2400, y = 4, amplitude = 1.1, step = 90 } = options
  const rand = mulberry32(seed)
  let x = 0
  let cy = y + (rand() - 0.5) * amplitude
  let d = `M0 ${r1(cy)}`
  while (x < length) {
    const next = Math.min(length, x + step * (0.6 + rand() * 0.8))
    const ctrlX = (x + next) / 2 + (rand() - 0.5) * step * 0.2
    const ctrlY = y + (rand() - 0.5) * 2 * amplitude
    cy = y + (rand() - 0.5) * amplitude
    d += `Q${r1(ctrlX)} ${r1(ctrlY)} ${r1(next)} ${r1(cy)}`
    x = next
  }
  return d
}

/** Die drei Varianten der Kopf-Unterkante (Wahl nach Routen-Seed, KO-02). */
export const HEADER_LINE_PATHS: readonly string[] = [11, 23, 37].map((seed) => handLinePath(seed))

/** Obere Kante des Fußbereichs (KO-04), eine feste Variante. */
export const FOOTER_LINE_PATH = handLinePath(53)

export const HAND_LINE_LENGTH = 2400
export const HAND_LINE_HEIGHT = 8
