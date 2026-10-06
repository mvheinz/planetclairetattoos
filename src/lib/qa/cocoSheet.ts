import type { CocoBridge, CocoFrame, CocoSize } from '@/leash/cocoSprite'
import type { SpritePose } from '@/leash/types'

// Inventar der Coco-QA-Seite (KUNST-QA §3.2, SC-12): 6 Posen × 3 Boil-Frames + 4 Brücken = 22 Symbole in allen
// Größenklassen (DESIGN §10.5) mit dem zugehörigen `data-size`-Strich. Gleiche Werte wie der Kalibrierbogen
// (`scripts/art/calibration-sheet.ts`).

export const QA_POSES: readonly SpritePose[] = [
  'rennen',
  'schnueffeln',
  'sitzen',
  'schlafen',
  'springen',
  'kopfschief',
]
export const QA_BRIDGES: readonly CocoBridge[] = [
  'bremsen',
  'abspringen',
  'einrollen-1',
  'einrollen-2',
]

export interface QaCocoSize {
  /** Breite in px. */
  w: number
  size: CocoSize
  /** gerenderter Strich in px. */
  stroke: number
}

export const QA_COCO_SIZES: readonly QaCocoSize[] = [
  { w: 24, size: 'horizon', stroke: 1.2 },
  { w: 40, size: 's', stroke: 1.6 },
  { w: 42, size: 'leash', stroke: 1.6 },
  { w: 64, size: 'leash', stroke: 1.8 },
  { w: 72, size: 'm', stroke: 1.8 },
  { w: 180, size: 'xl', stroke: 2.2 },
  { w: 240, size: 'xxl', stroke: 2.2 },
]

export const QA_PARTS = [
  'head',
  'snout',
  'nose',
  'eye-l',
  'eye-r',
  'ear-l',
  'ear-r',
  'body',
  'tail',
  'leg-fl',
  'leg-fr',
  'leg-hl',
  'leg-hr',
  'harness',
  'ring',
] as const

export interface QaCocoQuery {
  parts: boolean
  frame: CocoFrame | null
  boil: boolean
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** `?parts=1`, `?frame=a|b|c`, `?boil=0` (Boil aus). */
export function parseQaCocoQuery(q: Record<string, string | string[] | undefined>): QaCocoQuery {
  const frame = first(q.frame)
  return {
    parts: first(q.parts) === '1',
    frame: frame === 'a' || frame === 'b' || frame === 'c' ? frame : null,
    boil: first(q.boil) !== '0',
  }
}

/** Inhalt eines Symbols aus dem Sprite-Text (für `?parts=1`: inline statt `<use>`, damit Seiten-CSS greift). */
export function symbolContent(spriteSvg: string, id: string): string | null {
  const re = new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)</symbol>`)
  return re.exec(spriteSvg)?.[1] ?? null
}
