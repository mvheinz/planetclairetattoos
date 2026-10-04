// S09 Fliese „Reh im Planetenregen“: quadratische Fliese, leicht schräg; stehendes Reh mit Tupfen, von oben fallen
// sieben kleine Planeten wie Tropfen.
import type { Motif } from '../../../scripts/art/lib/handline'
import { deer, merge, place, planet } from './_parts'

const drops: [number, number, number][] = [
  [118, 140, 1],
  [170, 176, 0.8],
  [236, 132, 1.1],
  [290, 168, 0.9],
  [296, 236, 1],
  [248, 196, 0.7],
]

const motif: Motif = {
  tilt: -2.6,
  ...merge(
    {
      strokes: [
        { d: 'M70 110C160 108 246 106 330 104', double: true },
        'M332 108C334 196 335 280 336 364',
        'M334 368C246 369 158 370 66 370',
        'M64 366C66 280 68 196 70 114',
        ...drops.map(([x, y]) => `M${x - 2} ${y - 26}L${x - 1} ${y - 18}M${x + 3} ${y - 30}L${x + 3.6} ${y - 22}`),
      ],
    },
    ...drops.map(([x, y, s], i) => place(planet(), { x, y, s, r: -14 + i * 5 })),
    place(deer(-0.3), { x: 196, y: 352, s: 1.2 }),
  ),
  wash: 'M74 114C160 112 244 110 326 108C328 196 330 280 330 362C246 364 160 364 70 366C72 280 72 196 74 114Z',
  shadow: { x: 232, y: 390, w: 96, count: 7, len: 16 },
}
export default motif
