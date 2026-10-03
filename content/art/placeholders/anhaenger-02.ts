// S28 Anhänger „Mini-Planet“: Mini-Planet mit Ring, Öse oben; daneben ein Streichholz als Größenvergleich.
import type { Motif } from '../../../scripts/art/lib/handline'
import { loop, merge, place, planet } from './_parts'

const motif: Motif = {
  tilt: 1.6,
  ...merge(
    loop(150, 214),
    place(planet(), { x: 150, y: 256, s: 3.6, r: -12 }),
    {
      strokes: [
        { d: 'M262 128C264 200 266 300 268 404', double: true },
        'M280 130C282 200 284 300 286 402',
        'M268 406C274 410 282 408 286 404',
        'M262 128C258 118 258 104 266 96C274 90 286 94 288 106C290 116 286 124 280 130',
      ],
      dots: ['M264 104C266 96 280 94 284 104C286 114 278 120 272 120C266 118 262 112 264 104Z'],
    },
  ),
  wash: 'M106 254C106 228 126 210 152 212C176 214 194 232 192 258C190 284 172 300 148 298C124 296 106 280 106 254Z',
  shadow: { x: 140, y: 330, w: 70, count: 5, len: 14 },
}
export default motif
