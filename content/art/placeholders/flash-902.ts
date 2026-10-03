// Flash F902 „Hasen-Trio“: drei Hasen eng nebeneinander, der mittlere etwas größer, alle mit Kulleraugen.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunny, merge, place } from './_parts'

const motif: Motif = {
  tilt: -1.6,
  ...merge(
    place(bunny(0.9, 2), { x: 92, y: 402, s: 1.75 }),
    place(bunny(-0.8, -3), { x: 310, y: 404, s: 1.7, flip: true }),
    place(bunny(0.2, 0), { x: 202, y: 406, s: 2.3 }),
  ),
  shadow: { x: 120, y: 436, w: 150, count: 7, len: 12 },
}
export default motif
