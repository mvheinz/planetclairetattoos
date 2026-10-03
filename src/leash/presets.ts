import type { LoopKind, PresetId, SpritePose } from './types'

// Preset-Tabelle der Tuschelinie (DESIGN §9.7, Rinnen §5.3, Wackel §9.3 Nr. 6, Scroll-Wege §9.6/§11.4) als Daten.
// Rein und framework-frei; `geometry.ts` und `runtime.ts` lesen nur von hier. Nur Laufzeitwerte – Routen, Linienform und
// Notizen je Preset (reine Doku) stehen in `presetDocs.ts`, damit sie nicht in die Engine gebündelt werden (§9.10).

/** Wie die Linie erscheint (§9.7 Spalte „Zeichnen“). */
export type DrawMode =
  /** scrollgekoppelt (Lesezeile, §9.6) */
  | 'scroll'
  /** je Kartenreihe einmal beim Eintritt (IO-Schwelle) */
  | 'rowEnter'
  /** je Karte/Formular einmal beim Eintritt */
  | 'enter'
  /** einmal nach LCP + Idle */
  | 'once'
  /** nie – Stufe C, statisch */
  | 'never'

export type CocoSize = 'leash' | 's' | 'm' | 'xxl' | 'tiny'

export interface PresetConfig {
  /** Rinne in px: mobil / ab 768 (§5.3). */
  gutter: { mobile: number; desktop: number }
  /** Lage der Linie in der Rinne: Mitte (`journey`, `about`) oder Randlinie bei x = 7 bzw. 11 (`legal`, `margin`). */
  rail: 'center' | 'margin' | 'none'
  draw: DrawMode
  /** Intro beim Aufbau (nur `journey`, MI-10). */
  intro: boolean
  /** Dauer einer einmaligen Zeichnung in ms (§9.7, ≤ `--dur-draw-max`). */
  durationMs: number | null
  /** Strichstärke: `--leash-w` oder `--leash-w-calm`. */
  width: 'leash' | 'calm'
  /** Wackel-Profil (§9.3 Nr. 6). */
  wobble: 'normal' | 'calm'
  /** Erlaubte Schlaufen; andere Anker-Schlaufen werden zu `none`. */
  loops: readonly LoopKind[]
  coco: { size: CocoSize } | null
}

export const PRESET_CONFIG: Readonly<Record<PresetId, PresetConfig>> = {
  journey: {
    gutter: { mobile: 44, desktop: 64 },
    rail: 'center',
    draw: 'scroll',
    intro: true,
    durationMs: 900,
    width: 'leash',
    wobble: 'normal',
    loops: ['right', 'left', 'spiral', 'lasso', 'orbit', 'contour'],
    coco: { size: 'leash' },
  },
  about: {
    gutter: { mobile: 44, desktop: 64 },
    rail: 'center',
    draw: 'scroll',
    intro: false,
    durationMs: null,
    width: 'leash',
    wobble: 'normal',
    loops: ['right', 'left'],
    coco: { size: 'leash' },
  },
  shopString: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'rowEnter',
    intro: false,
    durationMs: 500,
    width: 'leash',
    wobble: 'normal',
    loops: [],
    coco: { size: 'm' },
  },
  product: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'once',
    intro: false,
    durationMs: 600,
    width: 'leash',
    wobble: 'normal',
    loops: ['hook'],
    coco: { size: 's' },
  },
  calm: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'never',
    intro: false,
    durationMs: null,
    width: 'calm',
    wobble: 'calm',
    loops: [],
    coco: { size: 's' },
  },
  stencil: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'enter',
    intro: false,
    durationMs: 700,
    width: 'leash',
    wobble: 'normal',
    loops: ['contour'],
    coco: { size: 'm' },
  },
  frame: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'enter',
    intro: false,
    durationMs: 700,
    width: 'leash',
    wobble: 'normal',
    loops: ['contour'],
    coco: { size: 'm' },
  },
  legal: {
    gutter: { mobile: 16, desktop: 24 },
    rail: 'margin',
    draw: 'never',
    intro: false,
    durationMs: null,
    width: 'calm',
    wobble: 'calm',
    loops: [],
    coco: null,
  },
  margin: {
    gutter: { mobile: 16, desktop: 24 },
    rail: 'margin',
    draw: 'scroll',
    intro: false,
    durationMs: null,
    width: 'leash',
    wobble: 'normal',
    loops: [],
    coco: null,
  },
  thanks: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'once',
    intro: false,
    durationMs: 900,
    width: 'leash',
    wobble: 'normal',
    loops: ['heart'],
    coco: { size: 'xxl' },
  },
  lost: {
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'once',
    intro: false,
    durationMs: 700,
    width: 'leash',
    wobble: 'normal',
    loops: ['coil'],
    coco: { size: 'tiny' },
  },
}

/** View Transitions hinein/hinaus erlaubt (§9.8: nie bei `calm`). */
export const viewTransitionAllowed = (preset: PresetId): boolean => preset !== 'calm'

/** Breakpoints (DESIGN §5.2). */
export const BP_TABLET = 768
export const BP_DESKTOP = 1200

/** Wackel der Hand (§9.3 Nr. 6): Amplituden in px, Wellenlängen in px Bogenlänge. */
export const WOBBLE = {
  normal: { a1Mobile: 0.9, a1Desktop: 1.2, a2: 0.22 },
  calm: { a1Mobile: 0.5, a1Desktop: 0.5, a2: 0.12 },
  lambda1: 90,
  lambda2: 13,
} as const

/** Lesezeile: `readingY = scrollY + READING_LINE × innerHeight` (§9.6). */
export const READING_LINE = 0.72

/** Scroll-Weg einer Schlaufe (§9.6, §11.4): mobil / ab 768. */
export function loopScroll(loop: LoopKind, viewportW: number): number {
  const desktop = viewportW >= BP_TABLET
  if (loop === 'spiral') return desktop ? 220 : 180
  if (loop === 'contour') return desktop ? 240 : 200
  return desktop ? 180 : 140
}

/** Rinnenbreite eines Presets bei gegebener Viewport-Breite (§5.3). */
export function gutterFor(preset: PresetId, viewportW: number): number {
  const g = PRESET_CONFIG[preset].gutter
  return viewportW >= BP_TABLET ? g.desktop : g.mobile
}

/** x der Linie relativ zur linken Rinnenkante (§5.3: Mitte bzw. 7 / 11 px). */
export function railOffset(preset: PresetId, gutter: number): number {
  const rail = PRESET_CONFIG[preset].rail
  if (rail === 'center') return gutter / 2
  if (rail === 'margin') return gutter / 2 - 1
  return 0
}

export const isScrollCoupled = (preset: PresetId): boolean =>
  PRESET_CONFIG[preset].draw === 'scroll'

/**
 * Ruhe-Pose je Preset (DESIGN §10.6, Frame A): bei reduzierter Bewegung und ohne JS. `journey`/`about`: `sitzen` an der
 * ersten Station; `lost` (404): nicht sichtbar; Presets ohne Coco: `null`.
 */
export const REST_POSE: Readonly<Record<PresetId, SpritePose | null>> = {
  journey: 'sitzen',
  about: 'sitzen',
  shopString: 'sitzen',
  product: 'sitzen',
  calm: 'sitzen',
  stencil: 'kopfschief',
  frame: 'sitzen',
  legal: null,
  margin: null,
  thanks: 'sitzen',
  lost: null,
}

/** Ruhe-Presets ohne Laufzeit (Stufe C, §9.4). */
export const isStaticPreset = (preset: PresetId): boolean => PRESET_CONFIG[preset].draw === 'never'

/**
 * Browser-Ausnahmen für Stufe B „Feder“ (§9.4): User-Agent-Muster, bei denen die Masken-Stufe A ruckelt
 * (z. B. nach KUNST-QA). Derzeit leer – pflegbar ohne Code-Änderung an der Runtime.
 */
export const TIER_B_USER_AGENTS: readonly RegExp[] = []

/** Schwellen der Laufzeit-Abstufung A → B (§9.4). */
export const DOWNGRADE = {
  windowMs: 2000,
  slowFrameMs: 20,
  maxSlowShare: 0.25,
  minFrames: 12,
} as const
