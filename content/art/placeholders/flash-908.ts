// Flash F908 „Reh mit Tupfen“: stehendes Reh im Profil, Tupfen auf dem Rücken, Kopf zur Betrachterin gedreht.
import type { Motif } from '../../../scripts/art/lib/handline'
import { deer, place } from './_parts'

const motif: Motif = {
  tilt: 1.4,
  ...place(deer(0.3), { x: 196, y: 400, s: 1.95 }),
  shadow: { x: 128, y: 420, w: 120, count: 7, len: 14 },
}
export default motif
