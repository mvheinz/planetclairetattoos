// Flash F903 „Fuchs mit Kulleraugen“: sitzender Fuchs von vorn, Schwanz um die Pfoten, drei Schnurrhaare je Seite.
import type { Motif } from '../../../scripts/art/lib/handline'
import { foxSitting, place } from './_parts'

const motif: Motif = {
  tilt: 1.8,
  ...place(foxSitting(), { x: 200, y: 392, s: 1.72 }),
  shadow: { x: 214, y: 416, w: 70, count: 5, len: 16 },
}
export default motif
