// Flash F906 „Coco sitzt“: Coco sitzend, Kopf leicht schief, große Ohren, rotes Geschirr.
import type { Motif } from '../../../scripts/art/lib/handline'
import { cocoSitting, place } from './_parts'

const motif: Motif = {
  tilt: -1.2,
  ...place(cocoSitting(-0.5, -9), { x: 204, y: 408, s: 1.9 }),
  shadow: { x: 186, y: 428, w: 76, count: 6, len: 15 },
}
export default motif
