// S29 Anhänger „Rehköpfchen“: Rehköpfchen mit großen Ohren und drei Tupfen auf der Stirn, Öse oben.
import type { Motif } from '../../../scripts/art/lib/handline'
import { deerHead, loop, merge, place } from './_parts'

const motif: Motif = {
  tilt: 2.8,
  ...merge(loop(202, 124), place(deerHead(true, -0.4), { x: 202, y: 274, s: 4.6 })),
  wash: 'M160 168C150 136 176 124 202 124C232 124 256 140 248 170C248 230 230 300 202 322C170 300 156 230 160 168Z',
  shadow: { x: 214, y: 372, w: 70, count: 6, len: 14 },
}
export default motif
