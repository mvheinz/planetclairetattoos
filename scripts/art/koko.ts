// `pnpm art:koko` (PLAN P12.6, U-08): „Koko, Vorsitzende der Goth Dogs Berlin“ – sauber nachgezeichnet nach Juttas
// auf ein T-Shirt gemalter Vorlage `content/art/jutta-skizzen/koko-vorsitzende-goth-dogs-01.jpg`, freigestellt (ohne
// Shirt-Falten, Hintergrund und ohne das Knochenkreuz). Schwarzes Fell mit Tuschestrich-Struktur, orange Flächen,
// weiße Brust und Pfoten, Narrenkappe mit grünen Bommeln, Seitenblick-Augen. Nur die Pupillen werden animiert (CSS in
// `ChairwomanKoko`); sie sind deshalb eigene Pfade. Deterministisch, nur <path>, ≤ 16 KB.
// Ausgabe: `src/art/koko/koko.json` (Teile mit Pfad und Farb-Token) – gerendert von `src/components/home/ChairwomanKoko.tsx`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { blob, mulberry32, retrace, toPath, type P } from './draw-coco'

export const KOKO_JSON = 'src/art/koko/koko.json'
export const KOKO_VERSION = 1
/** Ausgelieferte Zeichnung (ohne Pupillen); Pupillen sind CSS-Elemente darüber (nur sie bewegen sich, kein Inline-SVG im HTML). */
export const KOKO_SVG = `public/art/koko.v${KOKO_VERSION}.svg`
export const KOKO_W = 300
export const KOKO_H = 390
export const KOKO_MAX_BYTES = 16_000

const rand = mulberry32(0x6b6f6b6f)

/** Handgezogene Kontur: Stützpunkte um ≤ k Einheiten versetzt, als glatter Zug. */
const stroke = (pts: P[], k = 0.9, closed = false): string =>
  toPath(retrace(pts, rand, k), closed, true)

/** Punkt im Polygon (gerade/ungerade). */
function inside(poly: readonly P[], [x, y]: P): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Fell-Striche: kurze Linien, die von `from` weg nach unten/außen laufen (Tuschestrich-Struktur auf Schwarz). */
function furStrokes(
  poly: readonly P[],
  from: P,
  n: number,
  len: [number, number],
  seedBias = 0,
): string {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  let d = ''
  let px = 0
  let py = 0
  let made = 0
  for (let tries = 0; made < n && tries < n * 40; tries++) {
    const p: P = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)]
    if (!inside(poly, p)) continue
    // Richtung: von der Nase weg, mit nach unten gezogener Neigung (Fell fällt)
    const a =
      Math.atan2(p[1] - from[1], p[0] - from[0]) * 0.6 +
      Math.PI * 0.2 +
      seedBias +
      (rand() - 0.5) * 0.5
    const l = len[0] + rand() * (len[1] - len[0])
    const q: P = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]
    if (!inside(poly, q)) continue
    const sx = Math.round(p[0])
    const sy = Math.round(p[1])
    d += `m${sx - px} ${sy - py}l${Math.round(q[0] - p[0])} ${Math.round(q[1] - p[1])}`
    px = sx + Math.round(q[0] - p[0])
    py = sy + Math.round(q[1] - p[1])
    made++
  }
  return d.replace(/^m/, 'M')
}

export interface KokoPart {
  id: string
  /** Farb-Token der Fläche (`ink`, `orange`, `paper`, `green`, `white`) bzw. `none`. */
  fill: string
  /** Strichfarbe: `ink`, `paper`, `green-dark` oder `none`. */
  stroke: string
  /** Strichbreite in Einheiten (0 = keine). */
  w: number
  /** Deckkraft 0–1. */
  o?: number
  d: string
}

export function buildKoko(): { w: number; h: number; parts: KokoPart[] } {
  const parts: KokoPart[] = []
  const P_ = (id: string, fill: string, stroke_: string, w: number, d: string, o?: number) =>
    parts.push({ id, fill, stroke: stroke_, w, d, ...(o !== undefined ? { o } : {}) })

  // --- Körper (orange Flächen, dünner Tuschestrich) ---
  const tail: P[] = [
    [64, 276],
    [44, 280],
    [22, 292],
    [10, 308],
    [14, 322],
    [30, 326],
    [52, 318],
    [70, 306],
    [62, 296],
    [44, 302],
    [34, 308],
    [48, 294],
    [66, 288],
  ]
  P_('tail', 'orange', 'ink', 0.9, stroke(tail, 0.7, true))
  const body: P[] = [
    [100, 178],
    [96, 214],
    [88, 252],
    [78, 288],
    [86, 320],
    [106, 336],
    [140, 334],
    [158, 316],
    [190, 322],
    [222, 314],
    [236, 282],
    [250, 230],
    [252, 196],
    [234, 176],
  ]
  P_('body', 'orange', 'ink', 0.9, stroke(body, 0.8, true))
  // Oberschenkel links (große Keule) und rechts, helle Stellen als Papier
  P_(
    'haunch-l',
    'orange',
    'ink',
    1.1,
    stroke(
      [
        [92, 260],
        [88, 292],
        [100, 320],
        [126, 330],
        [146, 314],
        [150, 284],
        [136, 262],
        [112, 254],
      ],
      0.7,
      true,
    ),
  )
  P_(
    'haunch-r',
    'orange',
    'ink',
    1.1,
    stroke(
      [
        [160, 268],
        [158, 304],
        [176, 326],
        [204, 322],
        [222, 300],
        [218, 270],
        [196, 258],
        [174, 258],
      ],
      0.7,
      true,
    ),
  )
  // Brust (weiß)
  P_(
    'chest',
    'white',
    'ink',
    0.9,
    stroke(
      [
        [142, 176],
        [134, 196],
        [136, 222],
        [150, 244],
        [172, 250],
        [194, 240],
        [204, 216],
        [200, 188],
        [188, 172],
      ],
      0.7,
      true,
    ),
  )
  // Vorderbeine (weiß) mit Pfoten
  P_(
    'leg-l',
    'white',
    'ink',
    0.9,
    stroke(
      [
        [126, 238],
        [122, 280],
        [116, 322],
        [106, 350],
        [100, 366],
        [114, 376],
        [134, 372],
        [140, 352],
        [142, 318],
        [146, 284],
        [148, 250],
      ],
      0.7,
      true,
    ),
  )
  P_(
    'leg-r',
    'white',
    'ink',
    0.9,
    stroke(
      [
        [190, 244],
        [196, 282],
        [210, 316],
        [226, 338],
        [232, 358],
        [246, 364],
        [262, 354],
        [254, 332],
        [240, 306],
        [232, 276],
        [222, 246],
      ],
      0.7,
      true,
    ),
  )
  P_(
    'toes',
    'none',
    'ink',
    1,
    stroke(
      [
        [112, 372],
        [114, 362],
      ],
      0.3,
    ) +
      stroke(
        [
          [124, 374],
          [126, 362],
        ],
        0.3,
      ) +
      stroke(
        [
          [238, 360],
          [240, 350],
        ],
        0.3,
      ) +
      stroke(
        [
          [250, 360],
          [252, 350],
        ],
        0.3,
      ),
  )
  // Schwanzspitze/Pfote rechts unten (weiß)
  P_(
    'tip',
    'white',
    'ink',
    1,
    stroke(
      [
        [252, 322],
        [268, 318],
        [282, 322],
        [290, 330],
        [278, 336],
        [262, 334],
        [252, 330],
      ],
      0.6,
      true,
    ),
  )
  // Orange Schattierung (Aquarell-Anmutung): kurze Striche im Fell
  P_(
    'orange-shade',
    'none',
    'orange-dark',
    0.8,
    furStrokes(body, [172, 190], 46, [6, 12], 1.2),
    0.5,
  )

  // --- Kopf: schwarzes Fell mit Tuschestrich-Struktur ---
  // Kopf: runde Oberseite (glatter Zug), unten der gezackte Fellkragen (spitze Zacken, wie in der Vorlage)
  const headTop: P[] = [
    [98, 176],
    [104, 146],
    [110, 118],
    [104, 90],
    [112, 64],
    [140, 54],
    [180, 52],
    [220, 64],
    [238, 94],
    [238, 130],
    [250, 164],
  ]
  const hem: P[] = [
    [236, 188],
    [226, 168],
    [214, 190],
    [200, 168],
    [186, 192],
    [172, 168],
    [158, 190],
    [144, 168],
    [130, 190],
    [118, 170],
    [108, 188],
  ]
  const headPoly: P[] = [...headTop, ...hem]
  P_(
    'head',
    'ink',
    'ink',
    1,
    `${stroke(headTop, 1)}${hem.map((q) => `L${Math.round(q[0] + (rand() - 0.5) * 1.6)} ${Math.round(q[1] + (rand() - 0.5) * 1.6)}`).join('')}Z`,
  )
  const head = headPoly
  // Fell-Striche in Papierfarbe (hell auf Schwarz) und zusätzliche dunkle Härchen am Rand
  P_('fur-light', 'none', 'paper', 0.7, furStrokes(head, [172, 130], 320, [5, 12]), 0.42)
  P_('fur-dark', 'none', 'ink', 1.4, furStrokes(head, [172, 130], 60, [7, 14], 0.6))

  // --- Narrenkappe: zwei Zipfel mit grünen Bommeln ---
  const hatL: P[] = [
    [124, 60],
    [104, 66],
    [86, 78],
    [70, 94],
    [78, 104],
    [96, 96],
    [116, 90],
    [130, 84],
  ]
  const hatR: P[] = [
    [196, 60],
    [214, 52],
    [226, 38],
    [236, 20],
    [248, 8],
    [254, 20],
    [250, 38],
    [240, 58],
    [228, 78],
    [210, 92],
  ]
  P_('hat-l', 'ink', 'ink', 1, stroke(hatL, 0.8, true))
  P_('hat-r', 'ink', 'ink', 1, stroke(hatR, 0.8, true))
  P_('hat-l-fur', 'none', 'paper', 0.7, furStrokes(hatL, [100, 80], 22, [4, 8]), 0.38)
  P_('hat-r-fur', 'none', 'paper', 0.7, furStrokes(hatR, [232, 40], 30, [4, 9]), 0.38)
  P_('pom-l', 'green', 'green-dark', 1.2, stroke(blob([72, 100], 14, 13, -10, 10, 0.14), 0.5, true))
  P_('pom-r', 'green', 'green-dark', 1.2, stroke(blob([248, 11], 14, 13, 8, 10, 0.14), 0.5, true))
  // Bommel-Glanz (zarte Tuschestriche)
  P_(
    'pom-shade',
    'none',
    'green-dark',
    0.7,
    stroke(
      [
        [66, 102],
        [74, 108],
      ],
      0.2,
    ) +
      stroke(
        [
          [243, 12],
          [251, 16],
        ],
        0.2,
      ),
    0.7,
  )

  // --- Gesicht: Seitenblick-Augen, dicke Nase ---
  // Augen: große weiße Ovale mit schwerem, schräg abgeschnittenem Lid (müder Blick), Seitenblick
  const eyeL: P[] = [
    [126, 92],
    [134, 80],
    [152, 74],
    [172, 80],
    [178, 96],
    [168, 110],
    [148, 114],
    [132, 106],
  ]
  const eyeR: P[] = [
    [186, 84],
    [198, 74],
    [218, 72],
    [232, 82],
    [232, 98],
    [220, 108],
    [202, 108],
    [190, 98],
  ]
  P_('eye-l', 'white', 'ink', 1.4, stroke(eyeL, 0.5, true))
  P_('eye-r', 'white', 'ink', 1.4, stroke(eyeR, 0.5, true))
  P_(
    'lids',
    'ink',
    'ink',
    1,
    stroke(
      [
        [122, 90],
        [140, 70],
        [168, 70],
        [182, 82],
        [166, 80],
        [146, 82],
        [128, 94],
      ],
      0.4,
      true,
    ) +
      stroke(
        [
          [184, 84],
          [202, 66],
          [230, 70],
          [236, 84],
          [216, 78],
          [198, 82],
        ],
        0.4,
        true,
      ),
  )
  // Pupillen (animiert): Mittelpunkt = Ruhelage, Seitenblick nach rechts unten
  const pupilL = blob([158, 97], 9, 9.4, 0, 8, 0.06)
  const pupilR = blob([214, 92], 8.6, 9, 0, 8, 0.06)
  P_('pupil-l', 'ink', 'none', 0, toPath(pupilL, true, true))
  P_('pupil-r', 'ink', 'none', 0, toPath(pupilR, true, true))
  // Nase: dunkles Dreieck mit Glanz (Papier)
  P_(
    'nose',
    'ink',
    'paper',
    0.8,
    stroke(
      [
        [158, 126],
        [180, 122],
        [186, 134],
        [172, 146],
        [160, 138],
      ],
      0.6,
      true,
    ),
  )
  P_(
    'nose-shine',
    'none',
    'paper',
    1,
    stroke(
      [
        [168, 129],
        [176, 128],
      ],
      0.2,
    ),
    0.8,
  )
  return { w: KOKO_W, h: KOKO_H, parts }
}

export const sizeOf = (k: ReturnType<typeof buildKoko>) => JSON.stringify(k).length

/** Farben der Zeichnung (fest eingebrannt: das Bild wird als <img> geladen und hat keinen Zugriff auf Seiten-Token). */
export const KOKO_COLORS: Record<string, string> = {
  ink: '#1C1A17',
  orange: '#D9892B',
  'orange-dark': '#9A5A14',
  paper: '#F4EFE6',
  white: '#FBF8F1',
  green: '#4E7A52',
  'green-dark': '#24402A',
  none: 'none',
}

/** Pupillen als Mittelpunkt und Halbachsen (Einheiten der viewBox) – die Komponente legt CSS-Elemente darüber. */
export function pupilsOf(k: ReturnType<typeof buildKoko>) {
  return k.parts
    .filter((p) => p.id.startsWith('pupil-'))
    .map((p) => {
      const nums = [...p.d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
      const xs = nums.filter((_, i) => i % 2 === 0)
      const ys = nums.filter((_, i) => i % 2 === 1)
      const x0 = Math.min(...xs)
      const x1 = Math.max(...xs)
      const y0 = Math.min(...ys)
      const y1 = Math.max(...ys)
      return {
        id: p.id,
        cx: (x0 + x1) / 2,
        cy: (y0 + y1) / 2,
        rx: (x1 - x0) / 2,
        ry: (y1 - y0) / 2,
      }
    })
}

export function kokoSvg(k: ReturnType<typeof buildKoko>): string {
  const body = k.parts
    .filter((p) => !p.id.startsWith('pupil-'))
    .map(
      (p) =>
        `<path d="${p.d}" fill="${KOKO_COLORS[p.fill]}"${p.stroke !== 'none' ? ` stroke="${KOKO_COLORS[p.stroke]}" stroke-width="${p.w}"` : ''}${p.o !== undefined ? ` opacity="${p.o}"` : ''}/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${k.w} ${k.h}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const koko = buildKoko()
  mkdirSync('src/art/koko', { recursive: true })
  mkdirSync('public/art', { recursive: true })
  writeFileSync(KOKO_JSON, `${JSON.stringify({ w: koko.w, h: koko.h, pupils: pupilsOf(koko) })}\n`)
  writeFileSync(KOKO_SVG, kokoSvg(koko))
  console.log(
    `art:koko: ${KOKO_SVG} ${kokoSvg(koko).length} B (Budget ${KOKO_MAX_BYTES} B), ${KOKO_JSON}.`,
  )
}
