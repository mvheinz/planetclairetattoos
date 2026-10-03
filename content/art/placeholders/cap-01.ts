// S17 Cap „Coco-Kopf“: Cap von vorn, darauf Cocos Kopf mit großen Ohren und dunklen Augen mit Glanzpunkt.
import type { Motif } from '../../../scripts/art/lib/handline'
import { cocoHead, dot, merge, place } from './_parts'

const motif: Motif = {
  tilt: -1.2,
  ...merge(
    {
      strokes: [
        { d: 'M52 300C48 200 118 112 200 108C284 110 352 198 348 298', double: true },
        'M54 302C150 322 250 322 346 300',
        'M40 306C76 382 324 384 360 304',
        'M64 322C110 360 290 362 336 320',
        'M84 340C130 368 270 370 316 338',
        'M200 112C150 132 112 200 108 310',
        'M200 112C252 132 290 200 294 310',
      ],
      dots: [dot(200, 108, 12, 8)],
    },
    place(cocoHead(-0.3, true), { x: 206, y: 252, s: 0.92, r: 4 }),
  ),
  wash: 'M58 298C56 204 122 118 200 116C278 118 342 204 340 296C250 316 150 316 58 298Z',
  shadow: { x: 218, y: 402, w: 90, count: 6, len: 15 },
}
export default motif
