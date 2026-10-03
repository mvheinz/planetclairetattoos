// Station „Zeichnungen“ (DESIGN §12.4): zwei Figuren aus Juttas Zeichnung (`post-DaJH_kADpsK.jpg`, Ausschnitt) als
// echte Linienzeichnung – Kontrollpunkte von Hand nach dem Foto nachgezeichnet (P9.12, statt potrace-Flächen). Links
// die Frau mit langen Haaren und kariertem Kleid, rechts die kopfüber hängende Figur; das dicht gekritzelte Kleid nur
// als Umriss mit wenigen parallelen Strichen. Koordinaten im Ausschnitt `crop` (sources.json) auf 400 Einheiten Breite.
import type { Ink } from '../../../scripts/art/lib/handline'
import { merge } from '../placeholders/_parts'

const ink: Ink = merge({
  strokes: [
    // linke Figur: Haare
    { d: 'M100 12C70 12 46 34 38 70C30 108 24 136 18 160', double: true },
    'M100 12C128 12 146 40 150 80C152 108 150 128 146 146',
    'M86 22C70 46 60 82 58 122',
    'M122 22C136 44 142 82 138 130',
    // Gesicht, geschlossene Augen, Nase, Mund
    'M64 62C60 92 66 120 80 138C92 150 112 150 124 138C134 124 138 96 134 66',
    'M76 62C82 66 90 66 96 62',
    'M106 60C112 64 120 64 126 59',
    'M101 70C98 76 99 80 104 82',
    'M90 96C96 99 104 99 110 95',
    // Schultern und Kleid
    'M80 148C62 154 44 160 30 166',
    'M124 144C142 150 158 156 172 160',
    { d: 'M30 166C24 222 28 300 34 360C38 400 40 430 44 460', double: true },
    'M172 160C176 222 178 300 176 360C174 400 178 432 180 460',
    // Karo: ungleich, schief, nicht durchgezogen (wie mit der Hand gezogen)
    'M62 172C56 240 60 330 66 412',
    'M100 168C98 236 104 300 102 370C100 410 104 440 108 460',
    'M138 166C142 230 138 300 144 380',
    'M30 214C70 208 112 210 150 202',
    'M60 262C100 256 140 258 176 250',
    'M34 318C80 314 120 308 168 310',
    'M44 372C90 366 136 364 176 360',
    'M40 420C74 416 110 418 150 410',
    // rechte Figur, kopfüber: Beine, Stange
    'M212 0C210 40 208 80 206 122',
    'M236 0C238 40 240 78 244 108',
    'M290 0C298 28 304 54 310 76C340 80 370 78 400 76',
    // Oberkörper (Kleid, dicht gekritzelt) als offener Umriss, Arm nach rechts oben mit Hand
    { d: 'M206 122C198 170 196 236 202 298C206 322 212 338 222 350', double: true },
    'M244 108C270 102 292 106 304 118C322 160 332 226 336 286C338 306 336 322 330 334',
    'M304 116C332 110 356 104 378 104C392 102 398 112 392 120C384 128 370 128 360 126',
    'M376 104C384 96 394 96 398 102',
    'M310 150C330 144 350 140 368 130',
    'M336 250C356 260 378 268 400 278',
    // Kritzel nur als Akzent: lange, gleichgerichtete Striche
    'M222 136C218 180 222 230 228 280',
    'M240 128C236 176 242 224 246 274C248 290 252 304 256 314',
    'M262 120C262 170 268 220 272 270',
    'M284 124C288 172 292 222 296 274C298 290 300 304 304 314',
    'M306 150C312 190 318 236 318 284',
    'M232 196C246 210 262 230 274 252',
    'M258 170C270 186 282 208 292 232',
    // Kopf unten, umgedreht: Kinn oben, Nase unten rechts, geschlossenes Auge, Ohr
    'M222 350C234 344 252 342 266 346C284 352 302 348 318 342C330 338 336 336 334 344',
    'M222 350C214 368 224 388 246 396C266 402 288 400 308 398',
    'M308 398C316 392 322 388 328 392C336 398 336 404 330 408C322 412 312 408 308 398',
    'M334 344C344 358 344 376 336 390',
    'M262 372C268 366 278 366 284 372',
    'M246 362C250 358 256 360 256 366C256 372 248 374 244 370',
    'M282 388C290 392 298 392 304 388',
    // Haare hängen nach unten
    'M226 396C220 420 224 440 226 462',
    'M252 400C254 422 250 442 256 462',
  ],
})

export default { ink, tilt: 0, viewBox: '0 0 400 462', strokeWidth: 2.6 }
