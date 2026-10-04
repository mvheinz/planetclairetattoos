// G4 verheiltes Tattoo „Winziger Planet“ (F907) am Handgelenk: Unterarm mit Hand (Finger, Daumen, Knöchel), feine Linie.
import type { Motif } from '../../../scripts/art/lib/handline'
import { merge, planet, place, star4 } from './_parts'

const motif: Motif = {
  zoom: 0.92,
  tilt: 2.2,
  strokes: [
    // Unterarm mit Handgelenk-Knöchel, Hand mit vier Fingern und Daumen (Prüf-Linse P9.13: vorher „Fäustling“)
    { d: 'M132 430C136 370 142 300 146 236', double: true },
    'M268 430C264 370 262 300 262 238',
    'M146 236C139 228 140 218 148 213',
    'M148 213C146 190 146 170 150 150',
    'M150 150C148 130 150 116 158 114C166 114 168 128 168 148',
    'M168 146C166 118 168 96 178 94C188 94 190 116 188 144',
    'M188 142C188 110 190 86 202 86C214 86 214 112 210 142',
    'M210 142C212 116 216 98 228 98C238 100 236 124 230 150',
    'M230 150C236 166 240 175 250 172',
    'M250 172C262 160 276 150 286 154C292 160 284 172 272 184C263 196 261 216 262 238',
    // Falte am Handgelenk
    'M154 246C182 252 218 252 254 244',
  ],
  wash: 'M136 430C140 370 146 300 150 236C146 200 146 160 152 116C170 92 200 82 228 98C236 120 234 150 250 170C270 150 292 152 282 170C266 190 262 214 262 238C262 300 262 370 264 430Z',
  inset: {
    width: 1.8,
    ink: merge(place(planet(), { x: 204, y: 318, s: 2.1, r: -12 }), place(star4(), { x: 236, y: 290, s: 0.55, r: 8 })),
  },
  shadow: { x: 214, y: 448, w: 70, count: 5, len: 14 },
}
export default motif
