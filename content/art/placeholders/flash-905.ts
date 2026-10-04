// Flash F905 „Schnecke mit Planetenhaus“: Kulleraugen auf Stielen, das Haus ist ein Planet mit Ring.
import type { Motif } from '../../../scripts/art/lib/handline'
import { merge, place, snail, star4 } from './_parts'

const motif: Motif = {
  tilt: 2,
  ...merge(place(snail(), { x: 186, y: 352, s: 1.9 }), place(star4(), { x: 92, y: 120, s: 1.6, r: 10 })),
  shadow: { x: 130, y: 380, w: 90, count: 7, len: 15 },
}
export default motif
