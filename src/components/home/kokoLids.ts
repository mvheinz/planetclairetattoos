// Geschlossene Lider für Koko (U-53, P14.4): je Auge eine Lidfläche in Fellschwarz über dem gemalten Augapfel (beschnitten auf
// dessen Umriss, `koko.json` → `ball`) mit einer zittrigen Tusche-Unterkante, die wie ein müder Bogen nach unten hängt – unten
// bleibt ein schmaler Streifen Augenweiß. Dazu zwei, drei helle Haarstriche wie in Juttas Malerei. Rein und deterministisch
// (gleiche Eingabe → gleiche Pfade), Koordinaten im Bildraster von `koko.json`.

type Pt = readonly number[]

const r1 = (v: number) => Math.round(v * 10) / 10

/** Kleines, festes Zittern der Feder (kein Zufall: gleiche Seite → gleiches HTML). */
const wobble = (i: number, seed: number) =>
  Math.sin(i * 2.3 + seed) * 0.9 + Math.sin(i * 5.1 + seed * 3) * 0.4

export interface KokoLid {
  /** Lidfläche (Fellschwarz) */
  fill: string
  /** Unterkante des Lids (Tuschestrich) */
  edge: string
  /** helle Haarstriche auf dem Lid (parallel zur Unterkante) */
  hair: string
}

export function kokoLid(ball: readonly Pt[], seed: number): KokoLid {
  const xs = ball.map((p) => p[0]!)
  const ys = ball.map((p) => p[1]!)
  const minX = Math.min(...xs) - 4
  const maxX = Math.max(...xs) + 4
  const minY = Math.min(...ys)
  const h = Math.max(...ys) - minY
  const w = maxX - minX
  const steps = 12
  const edge: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // müder Bogen: in der Mitte am tiefsten (≈ 80 % der Augenhöhe), zu den Winkeln hin höher
    const y = minY + h * (0.56 + 0.24 * (1 - (2 * t - 1) ** 2)) + wobble(i, seed)
    edge.push([r1(minX + t * w), r1(y)])
  }
  const top = r1(minY - 10)
  const fill =
    `M${r1(minX - 4)} ${top}H${r1(maxX + 4)}V${edge[steps]![1]}` +
    edge
      .slice()
      .reverse()
      .map(([x, y]) => `L${x} ${y}`)
      .join('') +
    'Z'
  const line = 'M' + edge.map(([x, y]) => `${x} ${y}`).join('L')
  // Haarstriche parallel zur Unterkante (wie die Fellschraffur der Malerei), versetzt und unterschiedlich lang
  const hair = (
    [
      [0.12, 0.5, 7],
      [0.42, 0.88, 13],
      [0.22, 0.66, 20],
    ] as const
  )
    .map(([a, b, up], k) => {
      const part = edge.filter((_, i) => i / steps >= a && i / steps <= b)
      return (
        'M' +
        part.map(([x, y], i) => `${x} ${r1(y - up - wobble(i + k * 7, seed) * 0.6)}`).join('L')
      )
    })
    .join('')
  return { fill, edge: line, hair }
}
