// Station „Keramik“ (DESIGN §12.4): Juttas Schale mit dem Hund (`post-DdUPhoZOoMW.jpg`, oben rechts), frei mit der
// Handlinie neu gezeichnet (P9.12, kein Pausen): die Schale von oben als schiefer, offener Kreis, darin der Hund mit
// einem hohen und einem Schlappohr, Ringaugen mit Seitenblick und langer Schnauze. Nur Pupillen und Nase sind gefüllt.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

const ink: Ink = merge({
  strokes: [
    // Schale von oben: Außenrand (offen, doppelt nachgezogen) und Innenkante oben
    { d: 'M200 42C300 36 372 110 370 222C368 340 290 420 196 422C100 420 30 340 32 230C34 122 100 46 186 42', double: true },
    'M78 126C120 78 262 70 324 122',
    // Hund (Kopf schräg nach unten links, lange Schnauze wie auf Juttas Schalen): spitzes Ohr, Klappohr
    'M198 120C198 98 204 72 214 56C222 72 228 98 228 124',
    'M232 132C252 126 270 132 276 146C270 156 256 156 244 150',
    // Stirn bis Nase, Unterkiefer und Hinterkopf (offen), Ringaugen mit Seitenblick nach unten, Maul
    'M206 118C186 120 168 140 156 168C146 190 136 210 126 226',
    'M140 240C160 238 180 228 196 212C214 194 232 178 240 152C244 134 232 120 216 117',
    'M168 160C166 150 178 146 184 152C190 160 182 168 174 166',
    'M196 148C196 138 210 136 214 144C216 152 208 158 200 156',
    'M142 226C151 228 158 224 164 218',
    // Zunge (frech raus, wie bei Juttas Schalen-Hunden)
    'M150 228C148 240 156 246 162 238C164 233 163 228 161 224',
    // Hals, Rücken, Vorderbein mit Pfote, Bauch
    'M214 214C226 240 232 270 228 300',
    'M242 162C270 188 292 230 292 280C292 300 286 318 276 330',
    'M228 300C226 320 224 336 214 344C206 350 220 354 232 348',
    'M240 332C252 342 266 344 276 330',
    // Schatten der Schale
    'M300 420L308 412M314 414L322 406M328 406L336 398M342 396L350 388M354 384L362 376',
  ],
  dots: [dot(172, 162, 8, 7), dot(199, 151, 8, 7), dot(127, 231, 15, 12)],
})

const station = { ink, tilt: 2, viewBox: '0 0 400 500' }
export default station
