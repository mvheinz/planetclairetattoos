// Flash F907 „Winziger Planet“: Planet mit Ring und ein kleiner vierzackiger Stern.
import type { Motif } from '../../../scripts/art/lib/handline'
import { merge, planet, place, star4 } from './_parts'

const motif: Motif = {
  tilt: 2.6,
  ...merge(place(planet(), { x: 186, y: 284, s: 9, r: -12 }), place(star4(), { x: 304, y: 110, s: 3.12, r: 8 })),
}
export default motif
