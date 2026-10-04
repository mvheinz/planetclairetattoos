// G4 verheiltes Tattoo „Winziger Planet“ (F907) am Handgelenk: Umriss Handgelenk, feine Linie.
import type { Motif } from '../../../scripts/art/lib/handline'
import { merge, planet, place, star4 } from './_parts'

const motif: Motif = {
  zoom: 0.92,
  tilt: 2.2,
  strokes: [
    { d: 'M132 430C136 370 142 300 146 236C148 206 140 176 134 148C130 130 130 116 134 104', double: true },
    'M134 104C144 88 182 80 214 86C236 90 246 102 246 120',
    'M268 430C264 370 262 300 262 238C264 214 276 196 290 180C302 166 304 154 296 148',
    'M296 148C286 144 274 152 264 164C258 172 252 176 248 170',
    'M152 240C182 246 220 246 254 238',
    'M154 252C182 256 216 256 248 250',
    'M176 108C180 120 182 132 182 146M214 102C218 114 220 128 220 140',
  ],
  wash: 'M136 430C140 370 146 300 150 236C152 206 144 176 138 148C134 128 140 98 214 92C240 96 244 110 244 124C246 160 252 172 262 166C276 150 292 152 284 172C270 190 262 212 262 238C262 300 262 370 264 430Z',
  inset: {
    width: 1.8,
    ink: merge(place(planet(), { x: 204, y: 318, s: 2.1, r: -12 }), place(star4(), { x: 236, y: 290, s: 0.55, r: 8 })),
  },
  shadow: { x: 214, y: 448, w: 70, count: 5, len: 14 },
}
export default motif
