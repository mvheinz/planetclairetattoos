import type { LoopKind, PresetId, SpritePose } from './types'

// Preset-Tabelle der Tuschelinie (DESIGN §9.7, Rinnen §5.3, Wackel §9.3 Nr. 6, Scroll-Wege §9.6/§11.4) als Daten.
// Rein und framework-frei; `geometry.ts` und `runtime.ts` lesen nur von hier.

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
  id: PresetId
  /** Routen laut KONZEPT §2.2 (nur zur Dokumentation und für Tests). */
  routes: readonly string[]
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
  /** Kurzbeschreibung der Linienform (§9.7 Spalte „Linienform“). */
  shape: string
  coco: { size: CocoSize; poses: readonly SpritePose[] } | null
  /** View Transitions hinein/hinaus erlaubt (§9.8: nie bei `calm`). */
  viewTransition: boolean
  notes: string
}

export const PRESET_CONFIG: Readonly<Record<PresetId, PresetConfig>> = {
  journey: {
    id: 'journey',
    routes: ['R01'],
    gutter: { mobile: 44, desktop: 64 },
    rail: 'center',
    draw: 'scroll',
    intro: true,
    durationMs: 900,
    width: 'leash',
    wobble: 'normal',
    loops: ['right', 'left', 'spiral', 'lasso', 'orbit', 'contour'],
    shape: 'Rinnen-Serpentine, Schlaufen je Station (§11.4), ab 1200 zusätzlich lasso',
    coco: {
      size: 'leash',
      poses: ['rennen', 'sitzen', 'schnueffeln', 'kopfschief', 'springen', 'schlafen'],
    },
    viewTransition: true,
    notes: 'Orbit um die Planet-Marke der Kopf-Station',
  },
  about: {
    id: 'about',
    routes: ['R19'],
    gutter: { mobile: 44, desktop: 64 },
    rail: 'center',
    draw: 'scroll',
    intro: false,
    durationMs: null,
    width: 'leash',
    wobble: 'normal',
    loops: ['right', 'left'],
    shape: 'wie journey, 3 Stationen (Jutta, Coco, Werkstatt), Schlaufen right/left',
    coco: { size: 'leash', poses: ['sitzen', 'kopfschief', 'schnueffeln'] },
    viewTransition: true,
    notes: 'Coco läuft ein kurzes Stück mit (KONZEPT §3.12)',
  },
  shopString: {
    id: 'shopString',
    routes: ['R02', 'R03', 'R05'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'rowEnter',
    intro: false,
    durationMs: 500,
    width: 'leash',
    wobble: 'normal',
    loops: [],
    shape:
      'Schnur durch die Faden-Anker je Kartenreihe, Durchhang clamp(4, 0.03 × Abstand, 14), Serpentine',
    coco: { size: 'm', poses: ['sitzen'] },
    viewTransition: true,
    notes:
      '„Mehr zeigen“ hängt Reihen an; Filterwechsel = Neuaufbau ohne Wiederholung gezeichneter Reihen',
  },
  product: {
    id: 'product',
    routes: ['R04'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'once',
    intro: false,
    durationMs: 600,
    width: 'leash',
    wobble: 'normal',
    loops: ['hook'],
    shape: 'Unterstreichung der H1, senkrecht am Preisschild vorbei, hook am Knopf „In den Korb“',
    coco: { size: 's', poses: ['sitzen'] },
    viewTransition: true,
    notes: 'Kauf-Leiste (KO-09a) ohne Linie und ohne Coco',
  },
  calm: {
    id: 'calm',
    routes: ['R06', 'R07', 'R09', 'R26'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'never',
    intro: false,
    durationMs: null,
    width: 'calm',
    wobble: 'calm',
    loops: [],
    shape:
      'Korb: unter der H1 mit Endschleife neben Coco; Kasse: linke Kante der Abschnitte bzw. unter der H1',
    coco: { size: 's', poses: ['sitzen'] },
    viewTransition: false,
    notes: 'keine View Transition hinein/hinaus',
  },
  stencil: {
    id: 'stencil',
    routes: ['R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'enter',
    intro: false,
    durationMs: 700,
    width: 'leash',
    wobble: 'normal',
    loops: ['contour'],
    shape: 'contour um jede Flash-Karte, dann zur nächsten; ohne Flash wie margin',
    coco: { size: 'm', poses: ['kopfschief'] },
    viewTransition: true,
    notes: 'Linie bleibt --ink; Violett nur als --shadow-stencil an Karten',
  },
  frame: {
    id: 'frame',
    routes: ['R10'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'enter',
    intro: false,
    durationMs: 700,
    width: 'leash',
    wobble: 'normal',
    loops: ['contour'],
    shape: 'contour um das Formular (KONZEPT §3.10)',
    coco: { size: 'm', poses: ['sitzen'] },
    viewTransition: true,
    notes: 'Formular selbst ohne Animation',
  },
  legal: {
    id: 'legal',
    routes: ['R21', 'R22', 'R23', 'R24', 'R25', 'R27'],
    gutter: { mobile: 16, desktop: 24 },
    rail: 'margin',
    draw: 'never',
    intro: false,
    durationMs: null,
    width: 'calm',
    wobble: 'calm',
    loops: [],
    shape: 'ruhige, fast gerade Randlinie links vom Text, keine Schlaufen',
    coco: null,
    viewTransition: true,
    notes: 'ruhige Randlinie, keine Animation (KONZEPT §3.14)',
  },
  margin: {
    id: 'margin',
    routes: ['R20'],
    gutter: { mobile: 16, desktop: 24 },
    rail: 'margin',
    draw: 'scroll',
    intro: false,
    durationMs: null,
    width: 'leash',
    wobble: 'normal',
    loops: [],
    shape: 'leise Randlinie, scrollgekoppelt, ohne Schlaufen',
    coco: null,
    viewTransition: true,
    notes: 'R20 Kontakt und alle sonstigen Inhaltsseiten',
  },
  thanks: {
    id: 'thanks',
    routes: ['R08'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'once',
    intro: false,
    durationMs: 900,
    width: 'leash',
    wobble: 'normal',
    loops: ['heart'],
    shape: 'ruhiger Bogen vom Kopf zu Coco, endet in heart (MI-09)',
    coco: { size: 'xxl', poses: ['sitzen', 'schlafen'] },
    viewTransition: true,
    notes: 'Herz 400 ms nach der Linie',
  },
  lost: {
    id: 'lost',
    routes: ['R28'],
    gutter: { mobile: 0, desktop: 0 },
    rail: 'none',
    draw: 'once',
    intro: false,
    durationMs: 700,
    width: 'leash',
    wobble: 'normal',
    loops: ['coil'],
    shape: 'vom Kopf herab, coil am Boden, Ende = offener Karabiner',
    coco: { size: 'tiny', poses: ['rennen', 'sitzen'] },
    viewTransition: true,
    notes:
      'danach 2 langsame Schwingungen der losen Schlingen (MI-11); Variante „Zuhause“ mit Mini-Preisschild',
  },
}

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
