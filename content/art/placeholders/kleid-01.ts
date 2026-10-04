// S13 Kleid „Hasen-Bordüre“: ärmelloses Sommerkleid auf einem Bügel, am Saum eine Bordüre aus Hasenköpfen im
// Wechsel mit Tupfen.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunnyFace, dot, hanger, merge, place } from './_parts'

const border = [118, 214, 292].map((x, i) =>
  place(bunnyFace(), { x, y: 384 + Math.abs(x - 200) * 0.06, s: 0.8 + (i % 2) * 0.1, r: (i - 1) * 6 }),
)

const motif: Motif = {
  zoom: 0.9,
  tilt: -2,
  ...merge(
    hanger(),
    {
      strokes: [
        'M166 136C176 168 224 168 234 136',
        'M166 136C162 134 156 134 152 137C150 158 142 174 128 182',
        { d: 'M128 184C132 214 134 236 128 258C110 310 90 360 74 412', double: true },
        'M76 414C150 426 250 426 326 410',
        'M272 184C268 214 266 236 272 258C290 310 310 360 326 406',
        'M234 136C238 134 244 134 248 137C250 158 258 174 272 182',
        'M132 256C176 266 224 266 268 256',
        'M88 366C160 376 240 376 312 364',
      ],
      dots: [166, 254].map((x) => dot(x, 392 + Math.abs(x - 200) * 0.06, 5, 4.4)),
    },
    ...border,
  ),
  wash: 'M156 140C176 162 224 162 244 140C252 160 262 176 268 186C264 214 262 236 268 258C286 310 306 360 318 404C246 418 154 418 82 406C96 360 116 310 134 258C138 236 136 214 132 186C140 176 150 160 156 140Z',
  shadow: { x: 96, y: 446, w: 60, count: 6, len: 12 },
}
export default motif
