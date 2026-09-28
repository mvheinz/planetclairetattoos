import { inkStrokePath, type Pt } from './inkStroke'

// Statische Zeichnungen der Fehlerseiten (DESIGN KO-18): Knäuel der 500-Seite (eine verhedderte Leine aus 3 Schlingen)
// sowie offener Karabiner mit leerem roten Geschirr am Leinenende der 404-Seite. Mittellinien als handgesetzte
// Stützpunkte, geglättet (Catmull-Rom) und als Tuschestrich mit Druck und Zittern gefüllt – kein Zirkel, keine
// gleichmäßige Strichstärke. Einmal beim Laden des Moduls berechnet (deterministisch, Server = Client).

/** Catmull-Rom-Spline durch die Stützpunkte (zentripetal genug für Handpunkte), `k` Punkte je Abschnitt. */
export function smoothPoints(ctrl: readonly Pt[], k = 10): Pt[] {
  if (ctrl.length < 3) return [...ctrl]
  const out: Pt[] = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]!
    const p1 = ctrl[i]!
    const p2 = ctrl[i + 1]!
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]!
    for (let j = 0; j < k; j++) {
      const t = j / k
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  out.push(ctrl[ctrl.length - 1]!)
  return out
}

const P = (x: number, y: number): Pt => ({ x, y })

// ---------- 500: Knäuel ----------

/** viewBox des Knäuels. */
export const KNOT_VIEWBOX = { w: 240, h: 140 } as const

/** Mittellinie: kommt von links, verheddert sich in drei ineinanderliegenden Schlingen, läuft rechts offen aus. */
const KNOT_CTRL: readonly Pt[] = [
  P(4, 118),
  P(34, 112),
  P(62, 104),
  P(88, 104),
  // Schlinge 1
  P(106, 90),
  P(104, 64),
  P(84, 54),
  P(66, 66),
  P(70, 90),
  P(94, 100),
  P(120, 92),
  // Schlinge 2 (größer, schräg darüber)
  P(138, 72),
  P(132, 44),
  P(108, 36),
  P(90, 50),
  P(98, 76),
  P(126, 88),
  P(152, 82),
  // Schlinge 3 (klein, quer durch die ersten beiden)
  P(166, 64),
  P(156, 48),
  P(136, 52),
  P(126, 74),
  P(140, 96),
  P(168, 100),
  P(192, 88),
  // offenes Ende
  P(212, 74),
  P(236, 70),
]

export const KNOT_PATH: string = inkStrokePath(smoothPoints(KNOT_CTRL, 12), {
  width: 2.8,
  seed: 0x6b6e6f74,
  wobble: 0.45,
  taper: 18,
})

// ---------- 404: offener Karabiner mit leerem Geschirr ----------

/** viewBox des Leinenendes; die Leine kommt links bei `CARABINER_ATTACH` an (liegt am Boden, y = Unterkante − 6). */
export const CARABINER_VIEWBOX = { w: 100, h: 44 } as const
export const CARABINER_ATTACH: Pt = P(3, 36)

/** Karabiner liegend (D-Form): Rücken unten, Nase rechts oben, Öffnung zwischen Nase und Schnapper. */
const CARABINER_CTRL: readonly Pt[] = [
  P(36.5, 36.6),
  P(24, 38.2),
  P(12.5, 36.8),
  P(7.2, 31.5),
  P(8.6, 24.8),
  P(16, 21),
  P(28.5, 20.4),
  P(38.6, 22.4),
  P(42.8, 26.6),
  P(41.6, 29.4),
]

export const CARABINER_RING_PATH: string = inkStrokePath(smoothPoints(CARABINER_CTRL, 8), {
  width: 1.9,
  seed: 0x6b617261,
  wobble: 0.2,
  taper: 4,
  step: 1,
})

/** Schnapper: vom Gelenk unten rechts nach innen gekippt – der Karabiner ist offen. */
export const CARABINER_GATE_PATH: string = inkStrokePath(
  smoothPoints([P(37.4, 35.8), P(35.2, 31.6), P(33.6, 28.2)], 6),
  { width: 1.7, seed: 0x67617465, wobble: 0.12, taper: 2.5, step: 0.8 },
)

/** Kurzes Leinenstück vom Leinenende in die Öse (verdeckt den Übergang zur Tuschelinie). */
export const CARABINER_LEASH_PATH: string = inkStrokePath(
  smoothPoints([CARABINER_ATTACH, P(6, 35), P(8.6, 33.4)], 4),
  { width: 2.2, seed: 0x6c656173, wobble: 0.1, taper: 1.5, step: 0.8 },
)

/** Leeres Geschirr (rot, Tusche-Kontur): lose Riemenschlaufen, am Karabiner eingehakt. */
const HARNESS_CTRL: readonly Pt[] = [
  P(41, 32.5),
  P(50, 29),
  P(61, 24.5),
  P(73, 22.5),
  P(84, 25.5),
  P(87.5, 31.5),
  P(80, 37),
  P(67, 37.5),
  P(58.5, 33.5),
  P(62, 28.5),
  P(71, 29),
  P(75.5, 34),
  P(71, 39.5),
  P(58, 40.2),
  P(48, 38.6),
]

/** Rote Fläche des Riemens (breiter Strich, Kontur per `stroke`). */
export const HARNESS_STRAP_PATH: string = inkStrokePath(smoothPoints(HARNESS_CTRL, 8), {
  width: 3.4,
  seed: 0x68617273,
  wobble: 0.25,
  taper: 5,
})

/** D-Ring am Geschirr (klein, Tusche). */
export const HARNESS_RING_PATH: string = inkStrokePath(
  smoothPoints([P(42.6, 29.2), P(46, 29.8), P(46.6, 33.4), P(43.2, 35.2), P(40.4, 33.2)], 6),
  { width: 1.3, seed: 0x72696e67, wobble: 0.08, taper: 1.5, step: 0.6 },
)
