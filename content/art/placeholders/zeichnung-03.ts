// S25 Skizze „Ein Hase“: Skizzenblatt A5 (Spiralbindung oben); ein einzelner Hase sitzt mitten im Blatt (Stufe 1 der Stil-Leiter,
// vorher drei Hasen, R1-07-02).
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunny, merge, place } from './_parts'

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
    place(bunny(0.4, -8), { x: 204, y: 300, s: 1.5, sy: 1.7, r: -2 }),
  ),
  wash: 'M96 100C166 98 236 96 304 94C306 196 308 300 310 408C240 410 166 412 94 412C96 300 96 200 96 100Z',
}
export default motif
