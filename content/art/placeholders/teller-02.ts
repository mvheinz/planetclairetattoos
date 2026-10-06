// S08 Kleiner Teller „Fuchs auf dem Mond“: ein Fuchs mit Kulleraugen liegt eingerollt in einer Mondsichel, drei
// vierzackige Sterne.
import type { Motif } from '../../../scripts/art/lib/handline'
import { foxCurled, merge, moon, place, star4 } from './_parts'

const motif: Motif = {
  tilt: 1.8,
  ...merge(
    {
      strokes: [
        { d: 'M58 250C56 178 120 118 204 120C286 122 346 178 344 250C342 322 282 378 200 376C118 374 60 320 58 254', double: true },
      ],
    },
    place(moon(), { x: 206, y: 266, s: 5.6, r: -96 }),
    place(foxCurled(), { x: 206, y: 240, s: 1.55, r: -4 }),
    place(star4(), { x: 120, y: 196, s: 1.69 }),
    place(star4(), { x: 286, y: 186, s: 1.3, r: 12 }),
  ),
  wash: 'M64 250C64 182 124 126 204 128C282 130 338 182 336 250C334 318 278 370 200 368C120 366 66 316 64 250Z',
  shadow: { x: 112, y: 396, w: 60, count: 5, len: 16 },
}
export default motif
