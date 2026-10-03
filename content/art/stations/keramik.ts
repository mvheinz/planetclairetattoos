// Station „Keramik“ (DESIGN §12.4): der Hund aus Juttas Schale (`post-DdUPhoZOoMW.jpg`, oben rechts) als echte
// Linienzeichnung – Kontrollpunkte von Hand nach dem Foto nachgezeichnet (P9.12, statt potrace-Flächen). Koordinaten im
// Ausschnitt `crop` (sources.json) auf 400 Einheiten Breite; nur Pupillen und Nase sind gefüllt.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

const ink: Ink = merge({
  strokes: [
    // linkes Schlappohr: Spitze, Oberkante, Innenkante
    { d: 'M32 56C52 44 86 44 112 52C120 64 124 98 128 138', double: true },
    'M32 56C44 70 62 86 72 106C82 128 84 160 82 196',
    // rechtes Ohr: hochgestellt, schmal
    'M128 138C124 102 124 60 132 30C138 16 152 12 164 20',
    'M164 20C176 40 180 82 186 112C190 128 196 142 202 150',
    // Kopf links (lange Wange) und innere Linie
    { d: 'M66 226C46 256 38 300 42 352C46 400 60 440 92 498', double: true },
    'M80 302C96 296 104 300 98 318C90 346 92 392 106 432C114 456 124 474 132 500',
    // Kopf rechts: großer Bogen und innerer Bogen
    'M242 156C292 166 336 196 364 236C382 262 394 286 398 304',
    'M256 228C266 210 286 204 306 214C336 232 354 270 364 316C370 346 374 370 376 388',
    // Augen: schräge Ringe, Blick nach unten links
    'M116 236C112 254 122 282 146 294C162 300 176 290 170 268C164 248 144 230 128 230',
    'M166 210C170 196 192 186 212 196C228 206 230 232 222 248C214 258 196 254 186 244',
    // Stirnfalte zwischen den Augen, Schnauze
    'M124 222C140 236 156 252 172 264',
    'M176 304C190 324 206 350 222 374',
    'M228 248C236 274 240 300 246 318C250 330 256 338 258 348',
  ],
  dots: [
    dot(152, 280, 34, 28),
    dot(206, 242, 28, 22),
    // Nase: kräftiger, schiefer Tupfer
    'M232 372C236 358 256 352 272 358C284 364 282 380 270 388C254 396 234 390 232 372Z',
  ],
})

export default { ink, tilt: 0, viewBox: '0 0 400 550', strokeWidth: 4.4 }
