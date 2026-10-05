// S14 Kleid „Planeten-Nacht“: langärmliges Kleid auf einem Bügel, verstreute Planeten und Sterne; am Saum hinten eine
// kleine Fläche ohne Muster.
import type { Motif } from '../../../scripts/art/lib/handline'
import { hanger, merge, place, planet, star4 } from './_parts'

const motif: Motif = {
  zoom: 0.92,
  tilt: 1.6,
  ...merge(
    hanger(),
    {
      strokes: [
        'M170 136C180 160 220 160 230 136',
        { d: 'M170 136C146 140 124 148 110 160C102 210 96 270 92 322C100 327 110 328 120 324C122 280 126 238 132 196', double: true },
        'M132 196C134 230 130 270 122 300C112 340 104 380 100 414',
        'M102 416C168 426 236 426 302 414',
        'M268 196C266 230 270 270 278 300C288 340 296 380 300 412',
        'M230 136C254 140 276 148 290 160C298 210 304 270 308 322C300 327 290 328 280 324C278 280 274 238 268 196',
      ],
    },
    place(planet(), { x: 172, y: 226, s: 1.5, r: -12 }),
    place(planet(), { x: 236, y: 300, s: 1.8, r: 8 }),
    place(planet(), { x: 150, y: 360, s: 1.2, r: -20 }),
    place(planet(), { x: 296, y: 270, s: 1, r: 4 }),
    // ein einziger Stern (R1-05-05: vorher zwei, wirkte wie ein Sternenmuster)
    place(star4(), { x: 258, y: 372, s: 1.3, r: -10 }),
  ),
  wash: 'M172 140C182 158 218 158 228 140C252 144 272 152 284 162C292 212 298 270 302 318C294 322 286 322 278 320L294 410C232 420 168 420 106 410L122 320C114 322 106 322 98 318C102 270 108 212 116 162C128 152 148 144 172 140Z',
  shadow: { x: 236, y: 440, w: 70, count: 5, len: 14 },
}
export default motif
