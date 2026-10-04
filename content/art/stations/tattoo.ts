// Station „Tattoo“ (DESIGN §12.4): Kelch mit Schlange nach Juttas Flash (`post-DbJ1QRrjCcb.jpg`), frei mit der Handlinie
// neu gezeichnet (P9.12, kein Pausen): die Schlange steigt aus dem Kelch, legt eine Schlinge über den Rand und hebt
// den Kopf mit gespaltener Zunge; Bauchschuppen als Leiter quer zum Körper. Der Schatten des Kelchs ist – wie in Juttas
// Skizzen – eine lockere, schräge Schraffur (unterschiedlich lange Striche), keine Fläche.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

/** Schräge Schraffur rechts im Kelch (≈ 40°), Strichlängen leicht unterschiedlich (deterministisch). */
function shade(): string[] {
  const out: string[] = []
  for (let j = 0; j < 7; j++) {
    const y = 214 + j * 15
    const xEnd = 286 - j * 6
    for (let x = 246 + (j % 2) * 4; x < xEnd; x += 10) {
      const len = 9 + Math.round(Math.sin(j * 1.9 + x * 0.13) * 3)
      out.push(`M${x} ${y + len}L${x + len * 0.85} ${y}`)
    }
  }
  return out
}

const ink: Ink = merge({
  strokes: [
    // Kelchrand (hinten und vorn), Schale offen mit Absetzer
    'M110 190C150 182 250 180 292 188',
    'M108 196C150 205 250 205 294 194',
    { d: 'M108 196C106 250 120 300 160 326', double: true },
    'M294 194C296 252 282 300 240 326',
    'M160 326C180 334 222 334 240 326',
    // Stiel, Knauf, Fuß
    'M188 334C186 360 186 382 184 398',
    'M214 334C216 360 216 382 218 398',
    'M178 400C172 388 186 380 200 380C216 380 228 390 222 402C218 414 186 416 178 400',
    'M186 414C184 432 180 446 168 456',
    'M216 414C218 432 222 446 236 456',
    'M130 462C150 450 252 448 274 462C278 474 248 484 200 484C150 484 124 476 130 462',
    // Schlange: S-Körper aus dem Kelch nach oben rechts
    { d: 'M168 192C150 160 146 128 160 100C174 74 204 66 222 50C232 40 236 30 248 26', double: true },
    'M190 190C176 160 174 132 186 112C198 92 222 84 236 66C242 58 248 50 256 46',
    // Kopf, gespaltene Zunge
    'M248 26C262 19 279 21 285 30C289 38 278 46 256 46',
    'M287 33C299 31 309 28 317 22',
    'M309 28C316 30 322 33 327 31',
    // Bauchschuppen als Leiter
    'M152 172L177 171',
    'M155 150L179 147',
    'M160 128L184 123',
    'M170 108L192 107',
    'M184 92L203 96',
    'M199 80L214 86',
    'M213 66L227 72',
    // Schlinge über den Rand, außen herunterhängend, Schwanz eingerollt
    'M126 192C114 210 111 236 123 256C131 268 144 270 146 258C148 248 139 244 132 250',
    'M144 195C134 212 132 232 140 248',
    'M117 220L133 222',
    'M119 240L135 238',
    // Schatten unter dem Fuß
    'M150 494L158 488M166 495L174 489M182 496L190 490M198 496L206 490M214 495L222 489',
    ...shade(),
  ],
  dots: [dot(265, 31, 8, 6)],
})

export default { ink, tilt: -2, viewBox: '60 0 300 500' }
