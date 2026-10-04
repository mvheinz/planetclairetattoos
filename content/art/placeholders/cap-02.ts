// S18 Cap „Kleiner Planet“: Cap von der Seite, kleiner Planet mit Ring und zwei Sterne.
import type { Motif } from '../../../scripts/art/lib/handline'
import { dot, merge, place, planet, star4 } from './_parts'

const motif: Motif = {
  tilt: 2.2,
  ...merge(
    {
      strokes: [
        { d: 'M56 336C48 226 120 124 216 120C304 122 350 214 342 320', double: true },
        'M58 338C140 348 250 348 332 336',
        'M318 326C354 324 386 338 394 358C362 374 300 368 260 354',
        'M70 316C80 302 96 302 104 318',
        'M216 124C196 190 188 270 190 344',
      ],
      dots: [dot(216, 120, 11, 7)],
    },
    place(planet(), { x: 270, y: 246, s: 2.6, r: -14 }),
    place(star4(), { x: 118, y: 236, s: 1.56 }),
    place(star4(), { x: 148, y: 300, s: 1.3, r: 14 }),
  ),
  wash: 'M62 334C56 228 124 130 216 128C298 130 342 216 334 318C290 336 240 344 168 346C120 346 86 342 62 334Z',
  shadow: { x: 260, y: 398, w: 110, count: 6, len: 13 },
}
export default motif
