// Station „Zeichnungen“ (DESIGN §12.4): die zwei Figuren aus Juttas Zeichnung (`post-DaJH_kADpsK.jpg`) frei mit der
// Handlinie neu gezeichnet (P9.12, kein Pausen): links die Frau mit langen Haaren, geschlossenen Augen, kariertem Kleid
// und tätowierten Beinen bis zu den Zehen; rechts der Hund kopfüber, das Fell als lockeres Gekritzel (Schlaufen statt
// Umriss), Kopf unten mit Schlappohr, Auge und Nase. Koordinaten im Bildraum der Vorlage (480 × 640 px).
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

const woman: Ink = {
  strokes: [
    // Haare: lang, zu beiden Seiten, ein paar Strähnen
    { d: 'M150 22C128 22 112 40 110 66C108 92 104 112 100 130', double: true },
    'M150 22C176 20 196 36 202 62C206 86 208 104 213 122',
    'M138 30C124 50 118 80 116 110',
    'M166 28C180 46 188 74 191 102',
    'M150 24C146 36 141 44 134 51',
    // Gesicht, geschlossene Augen, Nase, Mund
    'M128 52C124 76 130 100 146 110C160 116 176 108 182 92C186 78 184 62 180 50',
    'M136 66C140 69 146 69 150 66',
    'M160 64C164 67 170 67 174 63',
    'M156 72C154 80 155 84 159 85',
    'M148 95C153 98 160 97 165 93',
    // Schultern, Kleid (schief, unten offen), Ärmel
    'M140 113C130 119 116 123 106 129',
    'M171 112C187 118 204 121 218 126',
    { d: 'M106 129C102 190 104 262 110 336', double: true },
    'M218 126C224 190 229 260 232 330',
    'M110 336C150 343 196 339 232 330',
    'M121 134C118 190 120 250 125 302',
    'M206 132C212 190 214 250 214 302',
    // Karo nur als lockere Querstreifen (eine Richtung, kein Gitter)
    'M108 170C146 165 186 168 222 161',
    'M106 214C150 210 190 214 226 207',
    'M109 258C150 255 196 258 228 251',
    'M111 300C150 297 194 301 230 293',
    // Beine bis zu den Füßen mit Zehen
    'M127 339C124 380 126 430 128 470',
    'M151 341C153 380 150 430 148 472',
    'M179 341C176 380 178 430 180 476',
    'M204 337C208 380 210 430 206 478',
    'M128 470C122 482 117 494 124 500C132 505 141 501 146 496C150 488 150 480 148 472',
    'M127 499L125 507',
    'M135 501L135 509',
    'M143 498L146 505',
    'M180 476C176 490 178 504 188 510C198 514 210 508 214 500C214 492 210 484 206 478',
    'M189 511L189 519',
    'M199 511L201 518',
    'M208 506L213 512',
    // Tattoos auf den Beinen: Herzen, Kreuzchen, Vogel
    'M136 360C131 352 123 356 127 364C129 368 134 372 137 377C139 371 144 367 146 362C148 355 140 352 137 358',
    'M191 360C187 354 180 358 182 364C184 368 188 371 191 375C193 371 198 367 198 362C198 356 192 354 191 359',
    'M134 400L143 408M143 400L134 408',
    'M187 404L196 412M196 404L187 412',
    'M129 432C133 427 137 427 140 431C142 427 146 427 150 431',
    'M193 442C189 436 182 440 184 446C186 450 190 452 193 456C195 452 200 448 200 444C200 438 194 436 193 441',
  ],
}

/**
 * Gekritzel des Hundefells: Zeilen aus kleinen, schiefen Schlaufen (deterministisch aus Sinus-Werten, kein Zufall) –
 * so wie Jutta Fell mit dem Fineliner „ausmalt“, ohne Fläche und ohne Umriss.
 */
function scribble(): string[] {
  const out: string[] = []
  for (let r = 0; r < 7; r++) {
    const y = 104 + r * 22
    const x0 = 250 + Math.round(Math.sin(r * 1.7) * 4)
    const x1 = 338 - Math.abs(r - 3) * 6
    let d = `M${x0} ${y}`
    let x = x0
    for (let k = 0; x < x1; k++) {
      const w = 11 + Math.round(Math.sin(r * 2.3 + k * 1.1) * 4)
      const h = 14 + Math.round(Math.cos(r * 1.3 + k * 0.7) * 4)
      d += `C${x + w} ${y - h} ${x + w * 1.4} ${y + h * 0.6} ${x + w * 0.6} ${y + h * 0.4}`
      x += w * 0.9
    }
    out.push(d)
  }
  return out
}

const dog: Ink = {
  strokes: [
    // Hinterbeine nach oben, Pfoten
    'M269 98C266 76 266 56 270 40C272 31 280 30 283 38',
    'M292 93C294 73 298 57 305 46C309 40 316 44 313 52',
    // Fell: dichtes Gekritzel wie in der Vorlage (Zeilen aus kleinen Schlaufen, dazu schräge Gegenstriche), links eine
    // offene Rückenkante
    { d: 'M245 104C236 150 236 210 249 254', double: true },
    ...scribble(),
    // Vorderbeine nach rechts, Pfoten
    'M332 113C352 107 370 103 384 101C391 101 393 109 387 113C374 117 358 119 341 125',
    'M337 210C355 218 371 226 386 232C393 236 389 245 380 243C366 239 352 235 341 231',
    // Kopf kopfüber: Hinterkopf, Schnauze, Schlappohr, Auge, Maul
    'M254 254C250 270 257 285 273 293C291 301 312 299 329 301',
    'M323 268C335 276 343 290 337 301',
    'M262 251C252 237 245 229 243 239C241 249 249 259 258 263',
    'M276 267C280 262 287 264 287 271C287 277 279 279 275 275',
    'M300 287C308 291 316 291 322 287',
  ],
  dots: [dot(281, 271, 7, 6), dot(334, 297, 13, 10)],
}

const ink: Ink = merge(woman, dog)

const station = { ink, tilt: 0, viewBox: '96 14 312 510' }
export default station
