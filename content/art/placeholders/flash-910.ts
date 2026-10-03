// Flash F910 „Herz mit Beinen“: Herz mit zwei dünnen Beinen und kleinen Schuhen, läuft nach rechts.
import type { Motif } from '../../../scripts/art/lib/handline'
import { heartWalking, place } from './_parts'

const motif: Motif = {
  tilt: 2.2,
  ...place(heartWalking(), { x: 196, y: 398, s: 2.2 }),
  shadow: { x: 170, y: 418, w: 70, count: 5, len: 14 },
}
export default motif
