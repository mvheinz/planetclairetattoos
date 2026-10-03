// S10 T-Shirt „Hasen-Parade“: T-Shirt flach liegend, auf der Brust vier Hasen in einer Reihe im Gleichschritt.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunnyMini, merge, place, tshirt } from './_parts'

const motif: Motif = {
  tilt: 1.4,
  ...merge(
    tshirt(),
    ...[138, 180, 222, 264].map((x, i) => place(bunnyMini(i % 2 ? 0.7 : 1), { x, y: 290 + (i % 2) * 3, s: 0.58, r: i % 2 ? 3 : -3 })),
  ),
  wash: 'M170 126C200 136 214 134 230 126C262 132 296 140 322 154C332 174 338 192 342 208C326 214 310 216 296 214L296 396C236 402 170 402 116 396L116 214C102 218 86 216 60 208C66 190 72 172 80 156C108 140 140 132 170 126Z',
  shadow: { x: 300, y: 300, w: 30, count: 5, len: 22 },
}
export default motif
