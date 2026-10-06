// S23 Zeichnung „Coco auf dem Mond“: Blatt mit Klebeband-Ecken; Coco sitzt auf einer Mondsichel und lässt die Beine
// baumeln.
import type { Motif } from '../../../scripts/art/lib/handline'
import { cocoDangling, merge, moon, place, sheet, star4 } from './_parts'

const motif: Motif = {
  tilt: -2.4,
  ...merge(
    sheet(),
    place(moon(), { x: 196, y: 286, s: 4.4, r: -96 }),
    place(cocoDangling(-0.5), { x: 204, y: 250, s: 1.25 }),
    place(star4(), { x: 112, y: 150, s: 1.56 }),
    place(star4(), { x: 290, y: 132, s: 1.3, r: 10 }),
  ),
  wash: 'M84 96C160 94 240 92 314 88C316 190 318 300 320 398C240 400 156 402 80 402C80 300 82 200 84 96Z',
}
export default motif
