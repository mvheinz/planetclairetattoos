// Easing-Kurven der Tuschelinie als Funktionen (DESIGN §11.2) – für rAF-Abläufe mit `performance.now()` (§9.10).

/** `cubic-bezier(x1, y1, x2, y2)` als Funktion `t ∈ [0, 1] → [0, 1]` (Newton + Bisektion). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx
  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let u = t
    for (let i = 0; i < 6; i++) {
      const err = sampleX(u) - t
      const d = slopeX(u)
      if (Math.abs(err) < 1e-6) return sampleY(u)
      if (Math.abs(d) < 1e-6) break
      u -= err / d
    }
    let lo = 0
    let hi = 1
    u = t
    for (let i = 0; i < 30; i++) {
      const x = sampleX(u)
      if (Math.abs(x - t) < 1e-6) break
      if (x < t) lo = u
      else hi = u
      u = (lo + hi) / 2
    }
    return sampleY(u)
  }
}

/** `--ease-ink-out`: Feder setzt schnell an und läuft weich aus. */
export const easeInkOut = cubicBezier(0.3, 0.7, 0.2, 1)
