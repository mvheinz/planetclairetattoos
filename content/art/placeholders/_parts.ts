// Gezeichnete Bausteine für die Platzhalter (PLAN P8.12/P8.13): Figuren und Dinge als Bezier-Kontrollpunkte von Hand
// gesetzt (keine Formen-Primitive), in einem eigenen kleinen Koordinatensystem; die Motive setzen sie mit `place()`.
// Stil nach Juttas Skizzen (`content/art/jutta-skizzen/README.md`): offene Konturen, Kulleraugen mit Seitenblick,
// nur Pupillen/Nase gefüllt, wenig Details, Humor.
import { type Ink, merge, place } from '../../../scripts/art/lib/handline'

export { merge, place }
export type { Ink }

const ink = (strokes: Ink['strokes'], extra: Omit<Ink, 'strokes'> = {}): Ink => ({ strokes, ...extra })

/**
 * Kulleraugen: eiförmiger Ring (zwei Bögen, absichtlich ungleich) mit Pupille im Seitenblick und Glanzpunkt.
 * `look` −1 … 1 = Blick nach links … rechts.
 */
export function eye(cx: number, cy: number, r: number, look = 0.6, lift = 0): Ink {
  const ring = `M${cx - r} ${cy + 0.2}C${cx - r * 1.02} ${cy - r * 1.28} ${cx + r * 0.94} ${cy - r * 1.34} ${cx + r * 1.02} ${cy - r * 0.08}C${cx + r * 1.08} ${cy + r * 1.08} ${cx - r * 0.72} ${cy + r * 1.24} ${cx - r} ${cy + 0.2}`
  const pr = r * 0.52
  const px = cx + look * r * 0.42
  const py = cy + r * 0.12 - lift * r * 0.3
  const pupil = `M${px - pr} ${py}C${px - pr * 0.96} ${py - pr * 1.3} ${px + pr * 1.04} ${py - pr * 1.26} ${px + pr} ${py + 0.1}C${px + pr * 0.94} ${py + pr * 1.28} ${px - pr * 1.06} ${py + pr * 1.2} ${px - pr} ${py}Z`
  const lr = Math.max(0.55, pr * 0.34)
  const lx = px - pr * 0.36
  const ly = py - pr * 0.4
  const light = `M${lx - lr} ${ly}C${lx - lr} ${ly - lr * 1.3} ${lx + lr} ${ly - lr * 1.3} ${lx + lr} ${ly}C${lx + lr} ${ly + lr * 1.3} ${lx - lr} ${ly + lr * 1.3} ${lx - lr} ${ly}Z`
  return ink([{ d: ring }], { dots: [pupil], lights: r >= 4.5 ? [light] : [] })
}

/** Kleiner gefüllter Punkt (Nase, Tupfen, Pfotenballen) – leicht schief, nie zirkelrund. */
export function dot(cx: number, cy: number, w: number, h = w * 0.8): string {
  return `M${cx - w / 2} ${cy}C${cx - w / 2} ${cy - h * 0.7} ${cx + w * 0.55} ${cy - h * 0.66} ${cx + w / 2} ${cy + h * 0.05}C${cx + w * 0.45} ${cy + h * 0.7} ${cx - w * 0.48} ${cy + h * 0.66} ${cx - w / 2} ${cy}Z`
}

// ---------------------------------------------------------------------------------------------------------------
// Gesichts-Stile (P12.12, U-23, KUNST-QA AR-05): jede Figur bekommt ihr eigenes Gesicht – Augen, Brauen und Mund
// werden einzeln von Hand gesetzt, nicht aus einer Schablone. Fünf Stile neben den Kulleraugen (`ring`).

export type FaceStyle = 'ring' | 'schlaf' | 'punkt' | 'blinzel' | 'schief' | 'staunen'
export const FACE_STYLES: readonly FaceStyle[] = [
  'ring',
  'schlaf',
  'punkt',
  'blinzel',
  'schief',
  'staunen',
]

/** Gefüllter, leicht schiefer Tupfer (Pupille) mit eigener Neigung. */
const blob = (cx: number, cy: number, rx: number, ry: number, skew = 0.12): string =>
  `M${cx - rx} ${cy + ry * skew}C${cx - rx * 1.04} ${cy - ry * 1.3} ${cx + rx * 0.96} ${cy - ry * 1.26} ${cx + rx} ${cy - ry * skew}C${cx + rx * 0.94} ${cy + ry * 1.3} ${cx - rx * 1.06} ${cy + ry * 1.22} ${cx - rx} ${cy + ry * skew}Z`

/**
 * Augen, Brauen und Mund eines Gesichts im gewählten Stil. `l`/`r` = linkes/rechtes Auge (x, y, Radius), `m` = Mundmitte
 * (x, y, Breite), `look` −1 … 1 Blickrichtung. Der Mund ersetzt den Standardmund der Figur (`mouth = false` lässt ihn stehen).
 */
export function faceParts(
  style: FaceStyle,
  l: [number, number, number],
  r: [number, number, number],
  look: number,
  m: [number, number, number],
): { eyes: Ink; mouth: Ink | null } {
  const [lx, ly, lr] = l
  const [rx, ry, rr] = r
  const [mx, my, mw] = m
  const h = mw / 2
  switch (style) {
    case 'schlaf':
      // schwere Lider: ein Bogen über halb geschlossenem Auge, darunter nur ein Pupillen-Halbmond, Wimpernstrich außen
      return {
        eyes: ink(
          [
            `M${lx - lr} ${ly - 0.4}C${lx - lr * 0.4} ${ly + lr * 0.5} ${lx + lr * 0.5} ${ly + lr * 0.52} ${lx + lr} ${ly - 0.2}`,
            `M${rx - rr} ${ry - 0.2}C${rx - rr * 0.4} ${ry + rr * 0.54} ${rx + rr * 0.5} ${ry + rr * 0.5} ${rx + rr} ${ry - 0.5}`,
            `M${lx - lr} ${ly - 0.4}L${lx - lr * 1.3} ${ly - lr * 0.5}`,
            `M${rx + rr} ${ry - 0.5}L${rx + rr * 1.3} ${ry - rr * 0.46}`,
            `M${lx - lr * 0.5} ${ly - lr * 0.62}C${lx} ${ly - lr * 0.82} ${lx + lr * 0.5} ${ly - lr * 0.7} ${lx + lr * 0.8} ${ly - lr * 0.4}`,
          ],
          {
            dots: [
              blob(lx + look * lr * 0.2, ly + lr * 0.12, lr * 0.46, lr * 0.2),
              blob(rx + look * rr * 0.2, ry + rr * 0.1, rr * 0.46, rr * 0.2),
            ],
          },
        ),
        mouth: ink([`M${mx - h * 0.8} ${my}C${mx - h * 0.2} ${my + 1.4} ${mx + h * 0.3} ${my + 1.2} ${mx + h * 0.7} ${my - 0.6}`]),
      }
    case 'punkt':
      // Knopfaugen: zwei ungleiche Tupfer, eine Braue hoch, kleines „w“ als Mund
      return {
        eyes: ink(
          [`M${rx - rr * 0.9} ${ry - rr * 1.5}C${rx - rr * 0.2} ${ry - rr * 2} ${rx + rr * 0.6} ${ry - rr * 1.9} ${rx + rr} ${ry - rr * 1.4}`],
          {
            dots: [
              blob(lx + look * lr * 0.12, ly, lr * 0.62, lr * 0.7, 0.2),
              blob(rx + look * rr * 0.12, ry, rr * 0.78, rr * 0.82, -0.1),
            ],
          },
        ),
        mouth: ink([
          `M${mx - h} ${my - 0.4}C${mx - h * 0.8} ${my + 2.4} ${mx - h * 0.1} ${my + 2.4} ${mx} ${my - 0.4}C${mx + h * 0.1} ${my + 2.4} ${mx + h * 0.8} ${my + 2.4} ${mx + h} ${my - 0.6}`,
        ]),
      }
    case 'blinzel':
      // ein Auge offen mit Seitenblick, das andere ein zugekniffener Bogen („^“), Zungenspitze
      return {
        eyes: merge(
          eye(lx, ly, lr, look, 0.1),
          ink([`M${rx - rr * 0.95} ${ry + rr * 0.3}C${rx - rr * 0.4} ${ry - rr * 0.9} ${rx + rr * 0.4} ${ry - rr * 0.9} ${rx + rr} ${ry + rr * 0.35}`]),
        ),
        mouth: ink(
          [
            `M${mx - h} ${my - 1}C${mx - h * 0.4} ${my + 3.4} ${mx + h * 0.6} ${my + 3.6} ${mx + h} ${my - 1.4}`,
            `M${mx + h * 0.2} ${my + 2.2}C${mx + h * 0.3} ${my + 5.4} ${mx + h * 0.8} ${my + 5.2} ${mx + h * 0.7} ${my + 1.8}`,
          ],
          { dots: [dot(mx + h * 0.5, my + 3.6, mw * 0.16, mw * 0.12)] },
        ),
      }
    case 'schief':
      // ungleich groß, Blick weit zur Seite, schräge Braue, Mund ein schiefer Strich
      return {
        eyes: merge(
          ink([`M${lx - lr * 1.1} ${ly - lr * 1.5}L${lx + lr * 0.8} ${ly - lr * 1.9}`]),
          eye(lx, ly, lr * 1.18, -look * 0.9 || 0.9),
          eye(rx + 1, ry + 1, rr * 0.72, look * 0.7 || -0.7),
        ),
        mouth: ink([`M${mx - h} ${my + 1.6}C${mx - h * 0.3} ${my - 0.4} ${mx + h * 0.5} ${my + 0.4} ${mx + h} ${my - 1.8}`]),
      }
    case 'staunen':
      // große Ringe mit winzigen Pupillen, zwei Brauenbögen hoch, Mund als offenes „o“
      return {
        eyes: ink(
          [
            `M${lx - lr * 1.05} ${ly - lr * 0.1}C${lx - lr * 1.1} ${ly - lr * 1.5} ${lx + lr * 1.0} ${ly - lr * 1.5} ${lx + lr * 1.08} ${ly}C${lx + lr * 1.1} ${ly + lr * 1.4} ${lx - lr * 0.9} ${ly + lr * 1.36} ${lx - lr * 1.05} ${ly - lr * 0.1}`,
            `M${rx - rr * 1.0} ${ry}C${rx - rr * 1.04} ${ry - rr * 1.4} ${rx + rr * 1.06} ${ry - rr * 1.44} ${rx + rr * 1.02} ${ry + rr * 0.1}C${rx + rr} ${ry + rr * 1.3} ${rx - rr * 1.0} ${ry + rr * 1.34} ${rx - rr * 1.0} ${ry}`,
            `M${lx - lr} ${ly - lr * 2.1}C${lx - lr * 0.3} ${ly - lr * 2.7} ${lx + lr * 0.7} ${ly - lr * 2.6} ${lx + lr * 1.1} ${ly - lr * 2.1}`,
            `M${rx - rr * 1.1} ${ry - rr * 2.1}C${rx - rr * 0.4} ${ry - rr * 2.7} ${rx + rr * 0.6} ${ry - rr * 2.6} ${rx + rr} ${ry - rr * 2.0}`,
          ],
          { dots: [blob(lx + look * lr * 0.25, ly + 0.2, lr * 0.3, lr * 0.32), blob(rx + look * rr * 0.25, ry + 0.2, rr * 0.3, rr * 0.32)] },
        ),
        mouth: ink([`M${mx - h * 0.45} ${my}C${mx - h * 0.5} ${my - 3} ${mx + h * 0.5} ${my - 3} ${mx + h * 0.45} ${my}C${mx + h * 0.5} ${my + 3.2} ${mx - h * 0.5} ${my + 3.2} ${mx - h * 0.45} ${my}`]),
      }
    default:
      return { eyes: merge(eye(lx, ly, lr, look), eye(rx, ry, rr, look)), mouth: null }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Weltraum (DESIGN §12.5)

/** Planet mit Ring, Körper-Radius 10 (Ring hinter dem Körper unterbrochen, vorne drüber). */
export const planet = (): Ink =>
  ink([
    { d: 'M-9.4 -2.2C-9.2 -7.6 -4.2 -10.6 1 -10C6.4 -9.4 10.4 -4.6 9.8 1C9.2 6.6 4.2 10.2 -1.2 9.8C-6.2 9.2 -9.6 5.6 -9.6 0.6' },
    'M-17.4 -0.6C-18.6 4.2 -7 6.8 4.4 4.8C13.6 3.2 19.4 -1.6 17.2 -5.4',
    'M-17.4 -0.6C-16.8 -3.2 -13.8 -4.8 -9.8 -5.4',
    'M17.2 -5.4C16.2 -7.2 13.6 -8.2 9.8 -8.4',
  ])

/** Vierzackiger Funkelstern, Radius 12: `outline` als geschwungener Umriss (groß), sonst als Funkelkreuz (klein). */
export const star4 = (outline = true): Ink =>
  outline
    ? ink([{ d: 'M0.4 -12.4C1.2 -4 2.6 -1.4 11.6 -0.2C3 0.8 1.2 3 0.2 12.2C-0.8 3.2 -2.8 1.2 -11.8 0.4C-3.4 -0.8 -1.2 -3.2 0.6 -12', exact: true }])
    : ink([
        { d: 'M0.4 -12C1.2 -4 -0.6 4 0.2 12.4', exact: true },
        { d: 'M-11.6 0.6C-4 -0.6 4 0.8 11.8 -0.4', exact: true },
      ])

/** Mondsichel, Höhe ~30 (Öffnung rechts). */
export const moon = (): Ink =>
  ink([
    'M5 -15C-8 -15.4 -15.4 -4 -13.2 6C-11 14.6 -1 18.6 8.6 14.2',
    'M8.6 14.2C-0.6 12.6 -5.6 4.6 -3.8 -3.8C-2.6 -9.6 0.6 -13.2 5 -15',
  ])

// ---------------------------------------------------------------------------------------------------------------
// Hase (Fußpunkt unten Mitte, Höhe ~115, Blick nach rechts)

export function bunnyHead(look = 0.7, earTilt = 0, style: FaceStyle = 'ring'): Ink {
  const f = faceParts(style, [-7.5, -49, 5.6], [8.5, -49.5, 5.4], look, [1, -33.5, 9])
  return merge(
    ink(
      [
        `M-12 -64C-21 -82 ${-24 - earTilt} -103 ${-16 - earTilt} -110C-9 -115 -4 -98 -3 -70`,
        `M5 -69C9 -90 ${18 + earTilt} -107 ${25 + earTilt} -103C31 -97 22 -80 13 -66`,
        'M15 -95C13 -88 11 -81 9 -74',
        { d: 'M-13 -64C-24 -58 -27 -41 -18 -33C-10 -25.5 8 -24.5 17 -31C25 -38 24 -56 15 -64', double: false },
        'M1 -36.5L1 -33.5',
        ...(f.mouth ? [] : ['M-3.5 -32.4C-1.6 -30.4 0.6 -31 1 -33.5C1.6 -31 3.8 -30.4 6 -32.6']),
      ],
      { dots: [dot(1.4, -38.6, 4.2, 3.2)] },
    ),
    f.eyes,
    ...(f.mouth ? [f.mouth] : []),
  )
}

export function bunny(look = 0.7, earTilt = 0, style: FaceStyle = 'ring'): Ink {
  return merge(
    bunnyHead(look, earTilt, style),
    ink([
      'M-16 -30C-30 -20 -32 -4 -22 1.5',
      'M15.5 -31C26 -24 31 -10 26.5 -1',
      'M-24 2.5C-10 4.5 10 4.4 27.5 1.2',
      'M-6.5 -7C-7.5 -1.5 -2.5 0.8 -0.4 -3',
      'M4 -6.5C4 -1 9 1 10.4 -3.2',
      'M27 -13C34 -15 36.5 -6.5 30.4 -4.6',
    ]),
  )
}

/** Hase im Gleichschritt (aufrecht, ein Bein vor, Arm schwingt). */
export function bunnyMarch(look = 0.8, earTilt = 0, style: FaceStyle = 'ring'): Ink {
  return merge(
    bunnyHead(look, earTilt, style),
    ink([
      'M-15 -30C-24 -20 -24 -8 -16 -2',
      'M15 -31C22 -22 22 -10 16 -2',
      'M-16 -2C-10 2 8 2 16 -2',
      'M-8 0C-10 8 -14 13 -20 15.5C-23.5 17 -21 19.5 -14 19',
      'M8 -0.5C12 6 15 11 20 13.5C24 15.5 25 18.5 18 18.6',
      'M-14 -24C-20 -18 -22 -13 -20 -9',
      'M14 -25C20 -21 25 -18 28 -14',
      'M20 -10C26 -12 27 -6 22 -5',
    ]),
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Fuchs

/** Fuchskopf von vorn (Mitte), Breite ~90: große Ohren, Gesicht läuft spitz zur Schnauze, müde Lidstriche wie in
 * Juttas Fuchs-Aquarell, drei Schnurrhaare je Seite. */
export function foxHead(look = -0.4): Ink {
  return merge(
    ink([
      'M-24 -24C-32 -40 -36.6 -56 -32.4 -66.4C-22 -58 -14.6 -46.4 -10.4 -36',
      { d: 'M10.4 -36.4C16.4 -48.6 26 -60 36.6 -64C38.6 -52 34.6 -38 26.4 -26', double: true },
      'M-29.6 -54C-26.6 -48 -23 -43 -19.6 -39.6',
      'M31.6 -54.6C29 -48 26 -43 22.6 -39',
      'M-10.4 -36C-3.4 -38.4 4 -38.6 10.4 -36.4',
      'M-24.4 -24C-34.4 -12 -32.6 -1.6 -24.4 6.4C-16.4 14.4 -8.4 22 -3.6 29.4',
      'M26.4 -26C34.4 -12.4 32 0 24 8.4C16 16.4 8.4 23.6 3.6 29.6',
      'M-3.6 37.4C-1 39.6 2 39.2 4 36.6',
      'M-6.4 24C-20 18 -34 16 -48.6 18.6',
      'M-6.2 27.4C-20 26.4 -33.4 28.6 -46 33',
      'M-5 30.4C-16 32.6 -27.4 38.4 -37.4 45',
      'M6.6 23.6C20 17.4 33 15.4 46.6 17.4',
      'M6.4 27C19.6 26.2 32 28 44.4 32.6',
      'M5.4 30.4C15.6 33 26.4 38.4 35.4 44.6',
    ], { dots: [dot(0, 30.6, 9.4, 7)] }),
    eye(-11.6, -7, 7.8, look),
    eye(11.8, -7.6, 7.4, look),
  )
}
/** Sitzender Fuchs von vorn, Schwanz um die Pfoten gelegt (Fußpunkt unten Mitte, Höhe ~150). */
export function foxSitting(): Ink {
  return merge(
    place(foxHead(-0.5), { x: 0, y: -122, s: 0.8 }),
    ink([
      'M-20 -93C-30 -74 -34 -40 -27 -14',
      'M20 -93.6C30 -76 35 -44 29 -16',
      'M-11 -86L-7 -80L-3.6 -86.6L0.4 -79.6L4 -86.4L7.4 -80.4L11 -86',
      'M-10.4 -2C-11.6 -26 -10.4 -48 -8 -62',
      'M9.6 -61C11 -44 11.4 -24 10.8 -2.4',
      'M-17.4 -0.6C-14 -4.6 -7.4 -4.6 -4 -0.8',
      'M5 -1C8.4 -4.8 14.6 -4.8 17.6 -1',
      { d: 'M28 -15C46 -12 50 2 36 8C18 15 -16 15.4 -32 9C-40 5.6 -38 -2.4 -29 -0.8', double: true },
      'M-26 5.6C-22 2.6 -22 -2 -25 -4',
    ]),
  )
}

/** Eingerollter Fuchs (schläft), Breite ~110. */
export function foxCurled(): Ink {
  return merge(
    ink([
      { d: 'M-24 -18C-12 -34 18 -36 34 -22C46 -10 44 8 30 16', double: true },
      'M-38 10C-30 20 -8 26 12 24C24 23 32 18 34 12',
      'M30 16C20 30 -12 32 -34 22C-44 17 -46 8 -40 4',
      'M-28 18L-24 13M-20 22L-16 16M-11 24L-8 18',
      'M-36 -2C-46 -8 -50 -20 -46 -30C-40 -24 -36 -20 -32 -16',
      'M-20 -22C-16 -30 -10 -36 -4 -38C-4 -30 -8 -22 -12 -18',
      'M-44 -2C-46 6 -40 10 -32 8C-24 6 -18 2 -16 -6',
      'M-34 1.6C-31.6 3.4 -29 3 -28 1',
    ], { dots: [dot(-45, -1.4, 4, 3)] }),
    ink(['M-34 -12.4C-31.6 -14.6 -28 -14.6 -26 -12.4', 'M-23 -14.6C-20.6 -16.6 -17.4 -16.4 -15.6 -14']),
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Reh

/** Rehkopf von vorn mit großen Ohren (Mitte), Breite ~70. */
export function deerHead(spots = true, look = 0.5): Ink {
  return merge(
    ink([
      'M-10 -10C-14 -24 -6 -33 1 -33C9 -33 14 -24 11 -11',
      'M-10.6 -9.6C-11.4 0 -6 10 -0.6 12.4C4.6 10.4 10 1.4 11.4 -10.4',
      'M-11 -24C-21 -30 -31 -30 -36.4 -23.4C-29 -16.6 -19.4 -16 -11.6 -19',
      'M-30 -23.6C-25 -22 -20 -21.6 -15 -22.2',
      'M11.6 -24.4C21.4 -31 31.6 -31.4 37 -24.6C29.6 -17.6 20 -16.6 12.2 -19.4',
      'M3.6 6.6C1.8 8.4 -0.6 8.6 -2.4 7.2',
    ], {
      dots: [dot(0.6, 4, 5, 3.6), ...(spots ? [dot(-4, -26, 2.6), dot(1.6, -28.6, 2.4), dot(6.4, -25.4, 2.6)] : [])],
    }),
    eye(-5.2, -14, 4.4, look),
    eye(6.4, -14.4, 4.2, look),
  )
}

/** Stehendes Reh im Profil, Kopf zur Betrachterin gedreht, Tupfen auf dem Rücken (Fußpunkt unten Mitte, Höhe ~160). */
export function deer(look = 0.4): Ink {
  return merge(
    place(deerHead(false, look), { x: 33, y: -118 }),
    ink([
      { d: 'M-42 -68C-20 -75 8 -75 26 -71', double: true },
      'M24 -100C26 -88 26 -80 26 -72',
      'M38 -100C41 -90 42 -80 39 -72C42 -64 40 -56 34 -50',
      'M27 -47.6C10 -44 -16 -44 -33 -49.6',
      'M-42 -68C-50 -64 -50 -54 -40 -48',
      'M-44 -69C-50 -76 -53 -72 -48 -65',
      'M31.4 -50C32.4 -32 33.4 -14 34.6 0',
      'M24 -48C23 -30 22 -14 22.4 0.4',
      'M-29 -50C-27 -37 -35 -26 -31 -14C-30 -8 -30 -4 -30.4 0.4',
      'M-38 -49.6C-38 -36 -44 -26 -40.6 -14C-39.6 -8 -40 -4 -40.4 0',
    ], {
      dots: [
        dot(-22, -64, 3.2),
        dot(-8, -66.6, 3),
        dot(6, -64.6, 3.2),
        dot(-14, -58, 2.8),
        dot(14, -60, 2.6),
        dot(-30, -60, 2.8),
      ],
    }),
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Coco (DESIGN §10.1: große aufrechte Ohren, asymmetrisch; dunkle Augen mit Glanzpunkt; rotes Geschirr)

/**
 * Cocos Kopf nach Juttas Skizze `content/art/jutta-skizzen/coco-oh-01.jpg` (P9.13) und ihren Coco-Fotos
 * (`content/seed/coco/`, 04.10.2026): runder Kopf, große aufrechte Ohren mit gerundeter Spitze (das rechte etwas
 * größer), große runde Augen mit großer Pupille und Glanzpunkt, dicke gefüllte Nase, Lächeln mit Haken. Mitte, Breite ~90; `collar` = roter Halsring.
 */
export function cocoHead(look = -0.4, collar = true, style: FaceStyle = 'ring'): Ink {
  const f = faceParts(style, [-15, -18, 9], [12, -19, 9.8], look, [-2, 12, 20])
  const face = merge(
    ink([
      // runder Kopf, oben und am Kinn offen
      { d: 'M-30 -36C-42 -24 -44 -4 -38 10C-32 22 -18 28 -4 28', double: true },
      'M-24 -42C-16 -47 -6 -49 4 -48',
      'M12 -46C26 -42 36 -30 38 -14C40 2 34 16 22 23',
      // große aufrechte Ohren mit gerundeter Spitze, leicht nach außen (Juttas Coco-Fotos), rechts etwas größer
      'M-30 -38C-37 -50 -40 -64 -37 -76C-35 -81 -31 -81 -28 -77C-24 -69 -19 -58 -16 -48',
      'M-31 -50C-32 -57 -32 -64 -31 -70',
      'M6 -48C10 -59 17 -72 27 -81C30 -84 34 -83 34 -79C35 -67 36 -52 33 -38',
      'M14 -54C18 -61 23 -68 28 -73',
      // Lächeln mit Haken, Kinn (je Stil eigener Mund)
      ...(f.mouth ? [] : ['M-14 9C-8 15 2 16 9 10C10 9 11 8 10 6']),
      'M-9 19C-3 22 5 22 11 18',
      // Schnurrhaare kurz
      'M-22 6C-31 5 -39 7 -45 11',
      'M-21 11C-29 12 -36 15 -41 20',
      'M20 4C29 2 37 4 43 8',
    ], {
      // dicke Nase: schiefer, gefüllter Tupfer zwischen den Augen
      dots: [dot(-3, 1, 14, 11)],
    }),
    style === 'ring' ? merge(eye(-15, -18, 9, look, 0.15), eye(12, -19, 9.8, look, 0.15)) : f.eyes,
    ...(f.mouth ? [f.mouth] : []),
  )
  // große runde Pupillen, Glanzpunkt bleibt
  if (style !== 'ring') return finish(face, collar)
  const big = (cx: number, cy: number, r: number) =>
    `M${cx - r} ${cy}C${cx - r} ${cy - r * 1.3} ${cx + r * 1.04} ${cy - r * 1.26} ${cx + r} ${cy}C${cx + r * 0.96} ${cy + r * 1.2} ${cx - r} ${cy + r * 1.16} ${cx - r} ${cy}Z`
  face.dots = [
    ...(face.dots ?? []),
    big(-15 + look * 2.4, -17.4, 5.4),
    big(12 + look * 2.4, -18.4, 5.8),
  ]
  face.lights = [
    `M${-17.4 + look * 2.4} -20.6c0-1.8 2.4-1.8 2.4 0s-2.4 1.8-2.4 0Z`,
    `M${9.4 + look * 2.4} -21.8c0-1.8 2.4-1.8 2.4 0s-2.4 1.8-2.4 0Z`,
  ]
  return finish(face, collar)
}

function finish(face: Ink, collar: boolean): Ink {
  if (!collar) return face
  return merge(
    face,
    ink(['M-16 26C-4 31 10 30 21 23', 'M-15 32C-3 37 11 36 22 29'], {
      harness: ['M-16 26C-4 31 10 30 21 23L22 29C11 36 -3 37 -15 32Z'],
    }),
  )
}

/** Coco sitzend (Seitenansicht nach links, Kopf leicht schief), Schwanz als Sichel; Geschirr mit Halsring,
 * Bauchgurt und D-Ring. Fußpunkt unten Mitte, Höhe ~150. */
export function cocoSitting(look = -0.4, tilt = -8, style: FaceStyle = 'ring'): Ink {
  return merge(
    place(cocoHead(look, false, style), { x: -6, y: -106, s: 0.74, r: tilt }),
    ink([
      'M-24 -88C-31 -74 -31 -56 -24 -42',
      { d: 'M14 -94C25 -84 33 -64 33 -42C33 -26 27 -12 17 -7', double: true },
      'M29 -48C19 -46 12 -34 13.6 -12C13.6 -5 9 -1.4 2.6 -1',
      'M-21.6 -45C-21.6 -31 -22 -15 -22.4 -1.6',
      'M-11.4 -41C-11.4 -29 -11.4 -15 -12 -1.6',
      'M-28.6 0C-26.6 -3.4 -20 -3.6 -17.6 -0.2',
      'M-17 -0.2C-14.6 -3.6 -8 -3.6 -6 0',
      'M32 -28C46 -32 53 -48 47 -62C45 -66 42 -64.6 43 -60.6',
      'M-25.4 -84C-14 -79 2 -80 12.6 -87.6',
      'M-26.4 -78C-14.6 -72.6 2.6 -73.6 14 -81',
      'M23.6 -80C15 -70 6 -58 -4 -47.6',
      'M29 -74.6C20.4 -64 11.4 -52 1.4 -43',
      'M17 -88C18.4 -92.6 23.6 -92.6 23.6 -88.4C23.6 -85.4 19.6 -84.4 17.6 -86.4',
    ], {
      harness: [
        'M-25.4 -84C-14 -79 2 -80 12.6 -87.6L14 -81C2.6 -73.6 -14.6 -72.6 -26.4 -78Z',
        'M23.6 -80C15 -70 6 -58 -4 -47.6L1.4 -43C11.4 -52 20.4 -64 29 -74.6Z',
      ],
    }),
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Flammenwesen (eigene Figur), Herz mit Beinen, Schnecke, Schmetterling

/** Vierbeiniges Wesen mit Flammenmähne im Sprung (gestreckt wie Juttas springender Hund), Breite ~210. */
export function flameCreature(): Ink {
  return merge(
    ink([
      { d: 'M-60 -10C-30 -18 10 -20 40 -22', double: true },
      'M40 -22C48 -30 58 -34 68 -32C80 -30 90 -24 96.6 -18C90 -14 80 -12 70 -12',
      'M70 -12C60 -8 52 -2 46 2',
      'M46 4C20 14 -20 17 -50 10',
      'M50 -2C70 0 92 4 110 6C114 7 113 11 108 11C88 10 66 8 44 6',
      'M40 8C60 16 82 24 100 30C104 32 102 36 98 35C80 30 58 22 34 14',
      'M-50 -6C-70 0 -88 8 -104 16C-108 18 -106 22 -102 21C-86 16 -68 10 -52 6',
      'M-44 10C-62 20 -80 30 -96 40C-100 42 -98 46 -94 44C-78 36 -62 26 -40 16',
      'M-58 -10C-70 -22 -74 -38 -68 -50C-66 -54 -63 -52 -64 -48C-66 -38 -62 -24 -52 -14',
      'M46 -25C36 -40 50 -50 40 -68C54 -56 56 -40 52 -28',
      'M56 -29C52 -46 66 -54 60 -76C72 -60 70 -44 62 -32',
      'M66 -33C70 -46 82 -48 82 -64C90 -50 84 -40 72 -32',
      'M38 -21C26 -30 32 -44 18 -54C34 -50 42 -38 44 -26',
      'M28 -19C16 -22 14 -32 0 -36C14 -38 26 -30 34 -22',
      'M74 -32C82 -36 92 -34 98 -44C98 -34 90 -28 80 -28',
      'M88 -15C83 -13 78 -13 74 -14',
    ], { dots: [dot(95.6, -18.4, 4.4, 3.6)] }),
    eye(71, -24.6, 4.8, 1, 0.3),
  )
}

/** Herz mit zwei dünnen Beinen und kleinen Schuhen, läuft nach rechts. Fußpunkt unten Mitte, Höhe ~150. */
export function heartWalking(): Ink {
  return ink([
    { d: 'M2 -112C-6 -128 -32 -134 -42 -116C-52 -98 -36 -76 -2 -52', double: true },
    'M2 -112C10 -128 36 -132 44 -114C52 -94 34 -72 2 -52',
    'M-12 -56C-14 -40 -18 -24 -22 -8',
    'M10 -58C14 -42 22 -28 30 -14',
    'M-22 -8C-28 -6 -34 -2 -34 2C-26 4 -18 3 -14 0C-14 -4 -18 -8 -22 -8',
    'M30 -14C30 -8 34 -4 42 -4C46 -4 46 -9 41 -12C38 -14 34 -16 30 -14',
    'M-34 2C-34 4 -30 4.6 -24 4.2',
  ])
}

/** Schnecke mit Kulleraugen auf Stielen, Haus = Planet mit Ring. Fußpunkt unten Mitte, Breite ~180. */
export function snail(): Ink {
  return merge(
    place(planet(), { x: -14, y: -58, s: 4.2, r: -6 }),
    ink([
      { d: 'M-88 0C-40 4 30 4 62 -2C72 -4 76 -12 72 -22', double: true },
      'M-88 0C-94 -2 -94 -8 -84 -10C-70 -12 -60 -14 -56 -18',
      'M72 -22C70 -32 64 -38 60 -40',
      'M60 -40C60 -56 62 -70 66 -82',
      'M68 -36C74 -50 82 -60 92 -70',
      'M60 -18C62 -16 66 -16 68 -18',
    ]),
    eye(66.4, -88, 6, 0.8),
    eye(95, -75, 6, 0.8),
  )
}

/** Schmetterling von oben, Flügel mit Tupfen, Fühler mit Punkten. Mitte, Breite ~200. */
export function butterfly(): Ink {
  return ink(
    [
      { d: 'M-2 -50C-4 -30 -4 10 0 52', double: true },
      'M4 -50C6 -30 6 10 3 50',
      'M-4 -38C-24 -76 -78 -92 -92 -64C-102 -40 -64 -14 -6 -4',
      'M-6 2C-50 4 -84 26 -72 58C-62 76 -26 64 -6 22',
      'M6 -38C26 -80 80 -94 94 -62C104 -38 66 -12 8 -4',
      'M8 2C52 6 86 28 72 60C62 78 26 66 8 24',
      'M-2 -50C-8 -64 -18 -76 -30 -82',
      'M4 -50C10 -66 20 -76 32 -80',
    ],
    {
      dots: [
        dot(-60, -60, 9, 7),
        dot(-34, -44, 7, 6),
        dot(-74, -40, 6, 5),
        dot(-40, 30, 8, 7),
        dot(56, -58, 9, 7.4),
        dot(34, -40, 6.6, 6),
        dot(70, -38, 6, 5),
        dot(44, 36, 8, 6.6),
        dot(-31.4, -83.4, 4.2, 3.6),
        dot(33.4, -81.4, 4.2, 3.6),
      ],
    },
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Kleine Figuren für Bordüren und Ränder

/** Hase im Profil (hoppelt nach rechts), Mitte, ~70 × 64. */
export function bunnyHop(): Ink {
  return merge(
    ink([
      'M2 -21C-4 -33 -6.4 -43.6 -2.4 -48C1.6 -50.6 6 -40 8 -24',
      'M8.6 -22C10.6 -33.6 14 -41.6 18 -42C22 -40.6 18.6 -30 13.4 -21.4',
      'M0 -20C-6 -12 -2 -2 8 -1C16 0 22 -4 24 -9C24.6 -16 18.6 -21.6 12.6 -22',
      'M-2 -16C-14 -20.6 -28 -14 -32 -2C-34 8 -28 14 -18 14',
      'M-14 14.4C-4 14.6 4 12.4 8.6 8',
      'M-24 12C-20 16.4 -12 17.4 -6 16',
      'M6 2C8 8 10 12 14.6 13',
      'M-32 -4C-38.4 -6 -40.6 0.4 -35 2.4',
    ], { dots: [dot(24, -9.6, 3, 2.6)] }),
    eye(11, -12.6, 4.4, 0.9),
  )
}

/** Hasengesicht für Bordüren (Ohren, Kopf, Punktaugen), Mitte, Höhe ~50. */
export function bunnyFace(): Ink {
  return ink(
    [
      'M-6 -14C-11 -24 -12.6 -34 -8.6 -37.4C-4.6 -40 -2 -30 -1.4 -16',
      'M2.6 -16C4 -28 8 -36.6 12 -35.6C15.4 -33 10.6 -24 7 -14.6',
      'M-8 -12.6C-15.4 -8 -15 3.4 -8 8C-2 11.4 6 11 10.4 6.4C15 0.4 13.6 -9.6 7.6 -13.4',
      'M-1.4 3.4C0 5 1.4 5 2.6 3.4',
    ],
    { dots: [dot(-4.4, -3, 3, 3.4), dot(5.6, -3.4, 3, 3.4), dot(0.6, 1, 2.4, 1.8)] },
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Dinge (im 400×500-Rahmen gezeichnet)

/** T-Shirt flach liegend (Ausschnitt oben bei y≈118, Saum bei y≈404). */
export function tshirt(): Ink {
  return ink([
    'M168 122C180 140 220 141 233 121',
    'M168 122C182 116.6 218 115.4 233 121',
    { d: 'M168 122C140 128 104 136 76 152C66 172 58 192 52 210C70 220 88 224 104 220C106 208 109 196 112 186', double: true },
    'M112 192C112 260 110 330 112 398',
    'M108 402C170 408 236 407 292 400',
    'M289 188C288 260 290 330 290 396',
    'M233 121C262 127 298 134 326 150C336 170 343 190 348 208C330 218 312 222 296 218C294 206 291 196 289 186',
  ])
}

/** Bügel (Haken oben bei y≈70, Stange bei y≈128). */
export function hanger(): Ink {
  return ink([
    'M200 98C198.6 86 201 74 209 71.4C217 69.4 221.4 78 215 84.6',
    'M200 98C176 108 152 118 130 128C124 131 125.6 136 132 136C178 137 224 137 268 136C274.6 135.6 276 130.6 270 128C246 118 222 108 201 98.6',
  ])
}

/** Zeichenblatt, leicht schief, mit Klebeband-Ecken oben (Blatt ~ y 84 … 410). */
export function sheet(): Ink {
  return ink([
    'M80 92C160 90 240 88 318 84',
    'M320.6 88C322 190 324 300 326 402',
    'M324 406.6C240 408 156 410 74 410',
    { d: 'M72 406C74 300 76 200 78.6 96', double: true },
    'M60 103C70 93 81 83 91 73.6M70 114.6C80 104 91 94 101.6 84.6M60 103L70.4 114M91 73.6L101.6 84.6',
    'M298 72.4C308 82 318 92 328 102M288 82.6C298 92 308 102 318 112.4M298 72.4L288 82.6M328 102L318 112.4',
  ])
}

/** Öse eines Anhängers (Mitte unten bei `x`, `y`). */
export function loop(x: number, y: number): Ink {
  return ink([
    `M${x - 4} ${y}C${x - 15} ${y - 14} ${x - 9} ${y - 34} ${x + 2} ${y - 34}C${x + 14} ${y - 33.6} ${x + 17} ${y - 14} ${x + 5} ${y + 0.4}`,
  ])
}

/** Kleiner Hase im Gleichschritt für Bordüren (Punktaugen statt Kulleraugen), Fußpunkt unten Mitte, Höhe ~110. */
export function bunnyMini(step = 1): Ink {
  return ink(
    [
      'M-10 -66C-18 -84 -20 -102 -13 -108C-7 -112 -3 -96 -3 -70',
      'M5 -70C9 -90 16 -104 22 -101C28 -96 20 -80 12 -66',
      'M-12 -64C-24 -56 -26 -38 -16 -31C-8 -25.6 8 -25.4 16 -32C24 -40 22 -58 14 -65',
      'M-14 -29C-22 -18 -22 -8 -14 -2C-6 2 8 2 14 -3C22 -10 22 -20 14 -30',
      `M-6 0C-8 8 ${-12 * step} 14 ${-18 * step} 16`,
      `M6 0C10 8 ${14 * step} 12 ${20 * step} 14`,
      'M-14 -22C-20 -16 -22 -10 -21 -6',
      'M14 -23C21 -20 25 -16 28 -12',
    ],
    { dots: [dot(-6, -48, 6, 7), dot(8, -48.6, 6, 7), dot(1, -38, 4.6, 3.4)] },
  )
}

/** Hase, der über eine Kante guckt: Ohren, Kopf oben, Kulleraugen, zwei Pfoten auf der Kante (Kante bei y = 0). */
export function bunnyPeek(look = 0.5, earTilt = 0, style: FaceStyle = 'ring'): Ink {
  const f = faceParts(style, [-7.5, -19, 5.8], [8.5, -19.5, 5.6], look, [1, -9, 8])
  return merge(
    ink([
      `M-12 -34C-21 -52 ${-24 - earTilt} -73 ${-16 - earTilt} -80C-9 -85 -4 -68 -3 -40`,
      `M5 -39C9 -60 ${18 + earTilt} -77 ${25 + earTilt} -73C31 -67 22 -50 13 -36`,
      'M15 -65C13 -58 11 -51 9 -44',
      'M-13 -34C-22 -28 -25 -14 -22 -1',
      'M15 -34C23 -27 25 -14 23 -1',
      'M-20 0C-20 -6 -12 -6 -11 0',
      'M12 0C12 -6 20 -6 21 0',
    ]),
    f.eyes,
    ...(f.mouth ? [f.mouth] : []),
  )
}

/** Coco sitzt auf einer Kante und lässt die Beine baumeln (Sitzfläche bei y = 0, Beine hängen nach unten). */
export function cocoDangling(look = -0.4, style: FaceStyle = 'ring'): Ink {
  return merge(
    place(cocoHead(look, false, style), { x: -4, y: -80, s: 0.72, r: -6 }),
    ink([
      'M-22 -62C-30 -48 -30 -30 -24 -16',
      { d: 'M14 -68C26 -56 32 -36 30 -16C29 -6 22 0 12 1', double: true },
      'M-24 -16C-20 -6 -12 -2 -4 -1',
      'M-18 -20C-22 -2 -26 18 -32 34C-34 38 -30 41 -26 38',
      'M-8 -18C-10 0 -10 20 -14 38C-15 42 -11 44 -8 41',
      'M4 -4C4 12 2 26 0 38C0 42 4 43 6 40',
      'M30 -12C44 -14 52 -26 50 -42C49 -46 46 -45 46 -41',
      'M-22 -58C-10 -52 4 -54 14 -62',
      'M-22.6 -52C-10.6 -46 4.6 -48 15.4 -56',
    ], {
      harness: ['M-22 -58C-10 -52 4 -54 14 -62L15.4 -56C4.6 -48 -10.6 -46 -22.6 -52Z'],
    }),
  )
}
