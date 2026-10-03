// S24 Zeichnung „Flammenwesen“: Blatt; vierbeiniges Wesen mit Flammenmähne im Sprung (eigene Figur).
import type { Motif } from '../../../scripts/art/lib/handline'
import { flameCreature, merge, place, sheet } from './_parts'

const motif: Motif = {
  tilt: 1.2,
  ...merge(sheet(), place(flameCreature(), { x: 198, y: 254, s: 1.08, r: -16 })),
  wash: 'M84 96C160 94 240 92 314 88C316 190 318 300 320 398C240 400 156 402 80 402C80 300 82 200 84 96Z',
}
export default motif
