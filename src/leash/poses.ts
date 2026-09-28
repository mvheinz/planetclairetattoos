import type { CocoPose } from '../lib/enums'

import type { SpritePose } from './types'

// CMS-Werte der Coco-Posen (`COCO_POSES`, DATENMODELL §4) → Sprite-IDs der Zeichnungen (DESIGN §9.1, §10.3).
// Einzige Übersetzungsstelle; `CocoPose` nur als Typ (reines Modul, framework-frei).
export const COCO_POSE_TO_SPRITE: Record<CocoPose, SpritePose> = {
  run: 'rennen',
  sniff: 'schnueffeln',
  sit: 'sitzen',
  sleep: 'schlafen',
  jump: 'springen',
  head_tilt: 'kopfschief',
}

export const SPRITE_POSES: readonly SpritePose[] = Object.values(COCO_POSE_TO_SPRITE)

/** Sprite-Pose aus einem CMS-Wert oder einer Sprite-ID (z. B. aus `data-leash-pose`); sonst `undefined`. */
export function toSpritePose(value: string | null | undefined): SpritePose | undefined {
  if (!value) return undefined
  if (value in COCO_POSE_TO_SPRITE) return COCO_POSE_TO_SPRITE[value as CocoPose]
  return (SPRITE_POSES as readonly string[]).includes(value) ? (value as SpritePose) : undefined
}
