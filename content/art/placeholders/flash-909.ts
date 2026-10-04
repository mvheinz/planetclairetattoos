// Flash F909 „Flammenwesen“: Wesen mit Flammenmähne im Sprung, Flammen als offene Striche.
import type { Motif } from '../../../scripts/art/lib/handline'
import { flameCreature, place } from './_parts'

const motif: Motif = {
  tilt: -2.8,
  ...place(flameCreature(), { x: 200, y: 256, s: 1.7, r: -24 }),
}
export default motif
