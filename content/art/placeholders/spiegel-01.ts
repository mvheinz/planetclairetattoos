// S30 Spiegel „Hasen am Rahmen“: rechteckiger Spiegel im Holzrahmen, drei diagonale Glanzstriche, oben gucken zwei
// Hasen über die Rahmenkante.
import type { Motif } from '../../../scripts/art/lib/handline'
import { bunnyPeek, merge, place } from './_parts'

const motif: Motif = {
  zoom: 0.88,
  tilt: -1.4,
  ...merge(
    {
      strokes: [
        { d: 'M96 166C166 164 236 162 306 160', double: true },
        'M308 164C310 250 312 340 312 428',
        'M310 432C238 434 166 434 92 434',
        'M90 430C92 340 94 250 96 170',
        'M124 192C176 190 228 190 280 188M282 192C284 266 284 340 286 406M284 408C232 408 178 408 124 408M122 406C122 340 122 266 124 196',
        'M104 220C106 240 106 260 105 276M298 316C300 332 300 350 299 366M180 420C196 421 212 421 226 420',
        'M150 270L196 224M164 298L224 238M232 376L270 338',
      ],
    },
    place(bunnyPeek(0.7, 1, 'punkt'), { x: 156, y: 165, s: 1.15 }),
    place(bunnyPeek(-0.7, -2, 'schief'), { x: 252, y: 162, s: 1.1, flip: true }),
  ),
  wash: 'M128 196C178 194 228 194 278 192C280 266 280 340 282 402C230 404 178 404 128 404C128 340 126 266 128 196Z',
  shadow: { x: 318, y: 420, w: 26, count: 5, len: 24 },
}
export default motif
