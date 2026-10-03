// Flash F904 „Schmetterling mit Tupfen“: von oben, Flügel mit Tupfen, Fühler mit Punkten.
import type { Motif } from '../../../scripts/art/lib/handline'
import { butterfly, place } from './_parts'

const motif: Motif = {
  tilt: -2.4,
  ...place(butterfly(), { x: 200, y: 254, s: 1.98 }),
}
export default motif
