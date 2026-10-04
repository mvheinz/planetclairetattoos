// S07 Teller „Hasen-Reigen“: runder Teller schräg von oben, am Rand fünf kleine Hasen mit Kulleraugen hintereinander
// im Kreis, in der Mitte ein kleiner Planet mit Ring.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunnyHop, merge, place, planet } from './_parts'

// Lage der Hasen auf dem Rand (Winkel in Grad); sie hoppeln einander nach, leicht zur Laufrichtung geneigt
const rim = [-112, -40, 32, 104, 176].map((a, i) => {
  const t = (a * Math.PI) / 180
  return place(bunnyHop(), {
    x: 200 + 128 * Math.cos(t),
    y: 254 + 100 * Math.sin(t),
    s: 0.96 + (i % 2) * 0.08,
    r: 22 * Math.cos(t),
    flip: Math.sin(t) < 0,
  })
})

const motif: Motif = {
  tilt: -2.2,
  ...merge(
    {
      strokes: [
        'M32 254C30 172 108 108 204 110C296 112 370 170 368 246C366 330 292 392 198 390C104 388 34 334 32 258',
        'M122 252C124 218 156 196 202 196C248 198 280 222 278 254C276 288 244 312 200 310C156 308 120 286 122 256',
      ],
    },
    ...rim,
    place(planet(), { x: 200, y: 252, s: 2.6, r: -10 }),
  ),
  wash: 'M40 252C40 176 112 116 204 118C292 120 360 174 360 248C358 326 290 384 198 382C108 380 42 330 40 252Z',
  shadow: { x: 70, y: 380, w: 60, count: 5, len: 20 },
}
export default motif
