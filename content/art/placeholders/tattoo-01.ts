// G3 frisches Tattoo „Hasen-Trio“ (F902) am Knöchel: Umriss Knöchel/Fuß seitlich, Linie des Tattoos etwas
// kräftiger (frisch).
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunny, merge, place } from './_parts'

const motif: Motif = {
  tilt: -1.8,
  strokes: [
    { d: 'M170 78C168 150 172 222 182 290', double: true },
    'M182 290C200 320 240 340 290 350C318 356 340 362 348 376',
    'M348 376C352 390 340 398 316 398C260 400 200 402 150 404',
    'M150 404C124 404 110 392 112 370C114 350 120 330 118 300',
    'M118 300C112 230 106 156 104 78',
    'M148 300C156 294 164 298 164 308',
    'M330 366C334 374 334 382 330 388',
  ],
  wash: 'M110 80L168 80C168 150 172 222 184 292C220 330 290 346 340 366C352 380 344 394 316 394L150 400C120 400 112 384 116 360C118 340 118 320 116 300C110 230 108 156 110 80Z',
  inset: {
    width: 3,
    ink: merge(
      place(bunny(-0.8, -9, 'schlaf'), { x: 214, y: 386, s: 0.56, sy: 0.72, r: 4, flip: true }),
    ),
  },
  shadow: { x: 200, y: 424, w: 90, count: 6, len: 15 },
}
export default motif
