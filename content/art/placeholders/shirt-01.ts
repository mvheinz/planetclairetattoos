// S10 T-Shirt „Hasen-Parade“: T-Shirt flach liegend, auf der Brust ein marschierender Hase (vorher zwei, R1-07-02).
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunnyMini, merge, place, tshirt } from './_parts'

const motif: Motif = {
  tilt: 1.4,
  ...merge(
    tshirt(),
    place(bunnyMini(1), { x: 204, y: 292, s: 1.1, r: -4 }),
  ),
  wash: 'M170 126C200 136 214 134 230 126C262 132 296 140 322 154C332 174 338 192 342 208C326 214 310 216 296 214L296 396C236 402 170 402 116 396L116 214C102 218 86 216 60 208C66 190 72 172 80 156C108 140 140 132 170 126Z',
  shadow: { x: 300, y: 300, w: 30, count: 5, len: 22 },
}
export default motif
