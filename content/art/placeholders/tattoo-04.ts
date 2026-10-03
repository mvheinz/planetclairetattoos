// G6 verheiltes Tattoo „Herz mit Beinen“ (F910) am Schienbein: Umriss Unterschenkel mit Knie.
import type { Motif } from '../../../scripts/art/lib/handline'
import { heartWalking, place } from './_parts'

const motif: Motif = {
  zoom: 0.95,
  tilt: -2.4,
  strokes: [
    { d: 'M140 92C130 120 128 160 134 206C140 262 154 330 164 412', double: true },
    'M262 92C276 130 282 176 278 224C272 290 252 350 242 412',
    'M162 104C178 94 220 94 238 106C244 122 238 136 222 142C204 148 180 146 166 136',
    'M164 412C170 424 180 428 190 426',
    'M242 412C234 422 224 426 214 424',
  ],
  wash: 'M144 96C200 90 230 90 258 96C274 132 280 176 276 224C270 290 252 350 242 410C220 424 186 424 164 410C154 330 142 262 138 206C134 160 136 120 144 96Z',
  inset: { width: 2, ink: place(heartWalking(), { x: 204, y: 378, s: 0.95 }) },
  shadow: { x: 210, y: 446, w: 70, count: 5, len: 14 },
}
export default motif
