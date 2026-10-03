// S25 Skizze „Fünf Hasen im Halbkreis“: Skizzenblatt A5 (Spiralbindung oben); fünf Hasen stehen im Halbkreis und
// beraten.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunnyMini, merge, place } from './_parts'

const motif: Motif = {
  tilt: 2.6,
  ...merge(
    {
      strokes: [
        { d: 'M92 96C164 94 236 92 308 90', double: true },
        'M310 94C312 196 314 300 316 410',
        'M314 414C240 416 166 418 90 418',
        'M88 414C90 300 90 200 92 100',
        'M112 88C110 80 118 76 122 84M152 87C150 79 158 75 162 83M192 86C190 78 198 74 202 82M232 85C230 77 238 73 242 81M272 84C270 76 278 72 282 80',
      ],
    },
    place(bunnyMini(), { x: 132, y: 352, s: 0.82, r: 8 }),
    place(bunnyMini(0.8), { x: 158, y: 272, s: 0.7, r: 4 }),
    place(bunnyMini(), { x: 206, y: 244, s: 0.66 }),
    place(bunnyMini(0.8), { x: 254, y: 270, s: 0.7, r: -4, flip: true }),
    place(bunnyMini(), { x: 280, y: 352, s: 0.82, r: -8, flip: true }),
  ),
  wash: 'M96 100C166 98 236 96 304 94C306 196 308 300 310 408C240 410 166 412 94 412C96 300 96 200 96 100Z',
}
export default motif
