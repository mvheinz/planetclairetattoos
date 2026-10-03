// S12 Ringer-Shirt „Fuchs“: Bündchen an Hals und Ärmeln als Doppelkontur, Fuchskopf mit Kulleraugen und
// Schnurrhaaren auf der Brust.
import type { Motif } from '../../../scripts/art/lib/handline'
import { foxHead, merge, place, tshirt } from './_parts'

const motif: Motif = {
  tilt: 2.4,
  ...merge(
    tshirt(),
    {
      strokes: [
        'M172 129C184 147 216 148 229 128',
        'M58 199C74 209 90 213 106 210',
        'M342 197C326 207 310 211 295 207',
      ],
    },
    place(foxHead(-0.5), { x: 200, y: 262, s: 0.95, r: -3 }),
  ),
  wash: 'M170 126C200 136 214 134 230 126C262 132 296 140 322 154C332 174 338 192 342 208C326 214 310 216 296 214L296 396C236 402 170 402 116 396L116 214C102 218 86 216 60 208C66 190 72 172 80 156C108 140 140 132 170 126Z',
  shadow: { x: 228, y: 426, w: 84, count: 6, len: 15 },
}
export default motif
