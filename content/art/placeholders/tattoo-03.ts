// G5 frisches Tattoo „Coco sitzt“ (F906) am Oberarm: Umriss Schulter und Oberarm, Linie des Tattoos kräftiger.
import type { Motif } from '../../../scripts/art/lib/handline'
import { cocoSitting, place } from './_parts'

const motif: Motif = {
  zoom: 0.95,
  tilt: 1.2,
  strokes: [
    { d: 'M124 108C94 128 88 176 100 232C110 294 120 356 128 420', double: true },
    'M124 108C154 90 196 88 230 100C250 108 262 118 270 130',
    'M270 130C278 146 280 162 278 180',
    'M278 186C292 236 294 292 284 340C280 366 278 392 280 420',
    'M132 190C152 204 180 208 212 198',
  ],
  wash: 'M126 112C156 96 196 94 228 104C262 116 276 150 278 186C290 236 292 292 282 340C276 370 276 396 278 420L130 420C122 356 112 294 104 232C92 176 98 128 126 112Z',
  inset: { width: 3, ink: place(cocoSitting(-0.4, -8, 'blinzel'), { x: 196, y: 370, s: 0.95 }) },
  shadow: { x: 210, y: 440, w: 80, count: 6, len: 14 },
}
export default motif
