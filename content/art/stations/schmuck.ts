// Station „Schmuck“ (DESIGN §12.4): Fuchs-Anhänger nach `post-Da2WrEgDpC_.jpg` als Linienzeichnung im Platzhalter-Stil
// (Foto eines Objekts → nicht vektorisieren). Gezeichnete Bezier-Kontrollpunkte, Tusche über `currentColor`.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, eye, loop, merge } from '../placeholders/_parts'

const ink: Ink = merge(
  loop(204, 118),
  {
    strokes: [
      // Ohren
      'M150 170C136 150 130 128 136 112C152 118 170 132 180 148',
      { d: 'M226 146C238 128 256 116 274 112C278 130 270 150 256 168', double: true },
      'M146 130C152 138 158 146 164 152',
      'M264 128C258 136 252 144 246 152',
      // Stirn und Wangen
      'M180 148C196 142 212 142 226 146',
      'M150 170C140 186 140 204 152 214C164 224 182 230 200 232',
      'M256 168C266 184 264 202 252 212C240 222 222 230 204 232',
      // Körper (Kegelform des Anhängers)
      'M162 222C150 262 144 312 148 352C150 388 166 412 196 418',
      { d: 'M244 220C258 262 264 312 260 352C258 388 242 412 212 418', double: true },
      'M196 418C200 420 206 420 212 418',
      // helle Brust
      'M180 238C178 270 182 306 194 330C206 306 216 270 222 238',
      // Vorderbeine mit Pfoten
      'M176 336C176 360 174 380 170 396C168 404 176 408 184 402',
      'M232 336C232 360 234 380 238 396C240 404 232 408 224 402',
      // Mund
      'M194 214C198 218 204 218 208 214',
    ],
    dots: [dot(201, 204, 12, 9)],
  },
  eye(184, 184, 7.4, 0.5),
  eye(222, 182, 7, 0.5),
)

export default { ink, tilt: -2.2 }
