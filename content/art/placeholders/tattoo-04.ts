// G6 verheiltes Tattoo „Herz mit Beinen“ (F910) am Schienbein: Unterschenkel mit Wade, Kniescheibe und Fuß.
import type { Motif } from '../../../scripts/art/lib/handline'
import { heartWalking, place } from './_parts'

const motif: Motif = {
  zoom: 0.92,
  tilt: -2.4,
  strokes: [
    // Wade (Rückseite gewölbt), Schienbein, Kniescheibe, Knöchel und Fuß (Prüf-Linse P9.13: vorher „Sack“)
    { d: 'M150 92C126 140 122 190 136 240C148 290 160 350 166 404', double: true },
    'M258 92C262 150 258 220 250 290C246 340 244 380 246 404',
    'M190 102C198 88 226 88 236 100C242 114 234 128 214 130C198 130 188 118 190 102',
    'M240 404C246 398 253 402 250 411',
    'M166 404C160 414 160 426 168 436',
    'M168 436C176 442 214 446 250 446C268 447 282 449 290 446C298 442 294 434 286 430C272 424 258 418 250 411',
  ],
  wash: 'M152 94C200 86 230 86 256 94C262 150 258 220 250 290C246 340 244 380 248 408C262 420 290 430 292 442C260 450 200 446 168 436C160 420 164 404 164 404C158 350 146 290 136 240C124 190 128 140 152 94Z',
  inset: { width: 2, ink: place(heartWalking(), { x: 204, y: 378, s: 0.95 }) },
  shadow: { x: 200, y: 466, w: 80, count: 5, len: 14 },
}
export default motif
