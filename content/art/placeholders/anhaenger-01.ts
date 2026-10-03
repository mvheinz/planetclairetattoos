// S27 Anhänger „Coco mit Planetenring“: Cocos Kopf mit einem Planetenring drumherum, Öse oben, ohne Kette.
import type { Motif } from '../../../scripts/art/lib/handline'
import { cocoHead, loop, merge, place } from './_parts'

const motif: Motif = {
  tilt: -2,
  ...merge(
    loop(206, 112),
    place(cocoHead(-0.4, true), { x: 206, y: 256, s: 1.8 }),
    {
      strokes: [
        { d: 'M58 296C46 330 160 340 260 312C330 292 372 262 352 236', double: true },
        'M58 296C62 284 76 274 98 266',
        'M352 236C346 226 330 222 310 222',
      ],
    },
  ),
  wash: 'M122 200C120 150 148 118 206 118C262 118 296 150 290 204C292 260 268 300 206 304C150 304 124 262 122 200Z',
  shadow: { x: 214, y: 400, w: 80, count: 6, len: 15 },
}
export default motif
