// Flash F902 „Hasen-Trio“: drei Hasen eng nebeneinander, der mittlere etwas größer, alle mit Kulleraugen.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunny, bunnyMarch, merge, place } from './_parts'

const motif: Motif = {
  tilt: -1.6,
  ...merge(
    place(bunnyMarch(0.9, 6), { x: 84, y: 392, s: 1.8, r: -4 }),
    place(bunny(-0.8, -14), { x: 318, y: 404, s: 1.5, sy: 1.72, flip: true }),
    place(bunny(0.2, 3), { x: 204, y: 410, s: 2.4, r: 2 }),
  ),
  shadow: { x: 120, y: 436, w: 150, count: 7, len: 12 },
}
export default motif
