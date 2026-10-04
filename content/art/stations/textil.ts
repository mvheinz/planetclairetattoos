// Station „Textil“ (DESIGN §12.4): das Wesen mit Narrenkappe von Juttas pinker Cap (`post-DcT7ErBDsWi.jpg`, schwarze
// Linien) als echte Linienzeichnung – Kontrollpunkte von Hand nach dem Foto nachgezeichnet (P9.12, statt potrace-
// Flächen); Kappe und Mähne nur als Umriss und wenige Striche (gefüllt sind nur Pupillen, Nase, Schellen).
// Koordinaten im Ausschnitt `crop` (sources.json) auf 400 Einheiten Breite.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

const ink: Ink = merge({
  strokes: [
    // Narrenkappe: Zipfel nach oben (Schelle) und Zipfel nach links unten (Schelle), Krempe über der Stirn
    { d: 'M96 62C104 104 108 146 118 186', double: true },
    'M96 62C84 96 72 140 60 176C46 198 26 224 14 262',
    'M118 186C150 182 186 186 214 196',
    'M14 262C34 232 58 214 86 206C104 202 112 200 118 196',
    // drei kurze Striche Kappenschatten
    'M88 110L98 140',
    'M80 134L90 166',
    'M72 160L80 186',
    // Mähne: spitze Büschel nach rechts
    'M160 190C176 178 190 168 204 160',
    'M168 204C184 196 200 190 214 188',
    'M172 220C188 218 202 220 214 226',
    'M166 236C180 240 192 250 200 262',
    // Gesicht: Augen schräg, Blick zur Seite
    'M56 252C60 238 78 232 92 238C102 246 98 262 86 266C72 270 58 266 56 252',
    { d: 'M110 228C118 212 146 208 162 218C176 228 168 244 150 248C132 252 114 246 110 228', exact: true },
    // Wange, Schnauze, Kinn
    'M88 270C92 290 104 306 122 310C140 312 156 300 162 282',
    // Schnurrhaare
    'M110 296C92 304 74 318 60 338',
    'M116 302C104 316 92 334 84 354',
    'M138 298C156 304 172 314 184 328',
    'M140 292C160 292 178 296 194 304',
    // Rücken, Kruppe, Schwanz mit Zacken
    'M214 196C244 182 270 168 296 156C312 150 324 138 330 120',
    // buschiger Zackenschwanz (wie in Juttas Narrenkappen-Skizze): Innenkante glatt, Außenkante gezackt
    'M318 132C312 110 298 90 278 74C262 62 242 56 222 56',
    { d: 'M330 120L348 108L332 100L346 84L324 80L330 60L306 64L306 42L284 52L278 32L262 48L248 30L240 48L222 38L222 56', exact: true },
    // Bauch
    'M206 278C230 290 258 294 284 288C304 282 318 270 328 256',
    // Hinterbeine
    'M330 120C340 160 348 198 352 236C356 268 368 298 384 328C390 338 388 346 378 344',
    'M328 256C334 282 344 306 360 330C364 338 358 344 350 340',
    'M304 268C306 290 318 312 336 332',
    // Vorderbeine mit Pfoten
    'M198 286C192 320 190 360 198 396C202 412 214 420 230 418',
    'M232 300C238 334 242 366 238 398C236 410 244 420 254 416',
    'M206 410L208 420',
    'M220 412L222 422',
  ],
  dots: [
    dot(74, 254, 13, 11),
    dot(124, 228, 16, 13),
    // Nase und Schnurrbart-Tupfer
    'M118 286C120 278 132 276 140 280C146 286 140 294 130 294C122 294 116 292 118 286Z',
    // Schellen an den Zipfeln
    dot(94, 54, 16, 14),
    dot(12, 268, 14, 12),
  ],
})

const station = { ink, tilt: 0, viewBox: '0 0 400 492' }
export default station
