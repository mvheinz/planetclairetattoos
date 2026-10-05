// Station „Jutta und Coco“ (DESIGN §12.4): Coco späht über den Rand eines Planeten, daneben zieht die Tuscheleine ihre Schleife
// – frei gezeichnet nach Juttas Skizzen (`coco-oh-01.jpg`, `narrenkappe-01.jpg`: Seitenblick, offene Linien, viel Papier). Eine
// eigene Komposition (P9.18a, R1-05-03), nicht die Sitz-Pose der Station „Hallo!“. Gefüllt sind nur Pupillen und Nase.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge, place } from '../placeholders/_parts'

// Kopf groß, Planet klein darunter (R1-07-04: vorher saß ein kleiner Kopf auf einer riesigen Kugel – las sich als Hase auf Kugel)
const planet: Ink = {
  strokes: [
    // Planet: wackliger Körper mit Lücke, Ring vorn und hinten unterbrochen
    { d: 'M100 304C104 240 156 196 214 200C274 204 318 250 314 308C310 366 268 408 210 410C154 410 108 366 100 310', double: true },
    'M52 338C78 380 190 404 302 378C360 364 374 336 350 314',
    'M62 322C58 304 86 288 116 280',
    'M312 270C346 274 366 290 358 308',
    // Schraffur als Akzent, eine Richtung
    'M236 330L262 304M228 352L274 314M244 372L284 340',
  ],
}

const coco: Ink = {
  strokes: [
    // Coco späht: Ohren, Kopfbogen, Ringaugen mit Seitenblick, Nase
    'M160 152C138 130 128 102 136 80C160 82 184 100 196 124',
    'M248 124C262 100 286 82 308 82C314 106 304 130 284 150',
    'M156 166C158 136 190 118 222 120C256 120 282 140 284 170 M286 184C288 190 288 196 284 200',
    'M176 166C176 154 190 150 198 156C206 166 200 178 190 178C182 176 176 172 176 166',
    'M236 162C238 152 252 150 260 156C266 166 260 178 250 178C242 176 236 170 236 162',
    // Halsband mit Ring (Jutta: Coco trägt immer Geschirr)
    'M164 196C190 206 232 208 270 196',
    'M214 208C212 214 220 218 224 212',
    // Pfoten über dem Rand
    'M170 202C166 188 180 182 190 190C194 196 192 204 188 208',
    'M244 204C242 192 256 186 264 194C268 202 264 208 258 210',
  ],
  dots: [dot(192, 166, 12, 14), dot(255, 168, 12, 14), dot(228, 190, 20, 14)],
}

const ink: Ink = merge(
  place(planet, { x: 71, y: 150, s: 0.62 }, true),
  place(coco, { x: -92, y: -34, s: 1.34 }, true),
  {
    strokes: [
      // Tuscheleine: läuft von links ein, Schleife am Ende
      'M30 454C90 476 156 442 236 462C296 476 338 466 366 444',
      'M366 444C382 432 394 448 382 456C372 460 364 452 368 446',
      // Strich-Funke
      'M44 196L60 180M346 60L358 46',
    ],
  },
)

const station = { ink, tilt: -2, viewBox: '0 0 400 500' }
export default station
