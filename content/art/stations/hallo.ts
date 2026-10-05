// Station „Hallo!“ (DESIGN §12.4): Coco frontal, eine Pfote zum Gruß erhoben – frei mit der Handlinie gezeichnet nach Juttas
// Filzstift-Skizze `coco-oh-01.jpg` (P9.18a, R1-05-03): offene Konturen mit Absetzern, Ringaugen mit Seitenblick, dicke Nase, ein
// Bogen als Mund. Keine Fläche, kein Geschirr-Rot, nur Pupillen und Nase sind gefüllt – nicht aus dem Sprite abgeleitet.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

const ink: Ink = merge({
  strokes: [
    // Ohren: hoch, offen an der Wurzel, das linke etwas schief
    'M126 128C114 92 120 58 138 34C154 54 168 78 174 104',
    'M262 104C268 76 284 50 302 34C312 62 312 98 300 128',
    // Kopf: Scheitel mit Lücke, Wangen, Kinn (nichts ist rund nachgezogen)
    { d: 'M112 176C116 130 156 92 204 92', double: true },
    'M226 94C272 98 304 132 308 178',
    'M108 194C106 232 128 266 160 284',
    'M308 196C308 232 290 262 254 282',
    'M178 296C200 300 224 296 242 288',
    // Augen: Ringe, Pupillen schauen zur Seite (rechts)
    'M142 186C142 168 160 162 172 170C182 182 174 202 158 202C146 200 142 194 142 186',
    'M234 182C236 168 254 164 264 174C272 186 264 204 250 204C240 202 234 194 234 182',
    // Nasenrücken, Mund als Bogen
    'M205 206C203 216 204 224 206 230',
    'M206 250C198 266 178 268 164 260',
    'M206 250C216 266 238 266 252 256',
    // Schultern und Brust, offen
    'M152 294C122 324 106 384 112 444C114 472 132 488 160 494',
    'M262 292C284 312 298 346 300 384',
    // Halsband als zwei Striche mit D-Ring
    'M160 312C190 326 226 326 258 310',
    'M200 330C198 322 210 318 216 326C218 336 206 340 200 332',
    // Linke Pfote ruht, rechter Arm winkt (Handlauf: Arm, Pfote, Wellen)
    'M150 446C160 428 186 424 202 436',
    'M156 462C170 454 190 456 200 466',
    'M296 392C322 360 344 322 342 282',
    'M326 284C322 268 336 258 348 266C356 278 350 296 340 296',
    'M366 244L382 232M372 268L392 266M362 224L370 208',
  ],
  dots: [dot(166, 190, 14, 16), dot(258, 194, 14, 16), dot(206, 238, 32, 24)],
})

const station = { ink, tilt: 2, viewBox: '0 0 400 500' }
export default station
