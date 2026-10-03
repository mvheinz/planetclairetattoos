// Sonden der Kunst-Aufnahme (KUNST-QA §5, PLAN P9.6): Zu jedem Standbild der Szenarien misst die Aufnahme im Browser,
// was `pnpm art:check` braucht – Linienpunkte, Coco-Box, Textzeilen und Bedienelemente (LG-01), laufende Animationen
// mit Dauer und Easing (MO-01/02/04/13/14, A11Y-01/06, RZ-01), Schriften (LG-03), Deko-Zugänglichkeit (A11Y-03), Fokus
// (A11Y-07) u. a. Abgelegt als `raw/<SC>/<profil>/<variante>/probes.json`. Hier nur Typen und reine Helfer; die
// Messung im Browser steht in `tests/art/helpers/probe.ts`.

export interface ProbeAnim {
  /** animationName / transitionProperty / id */
  n: string
  /** CSSAnimation | CSSTransition | Animation */
  k: string
  /** playState */
  s: string
  /** Dauer (ms) */
  d: number | null
  /** Verzögerung (ms) */
  dl: number
  /** Wiederholungen (`Infinity` als -1) */
  it: number
  /** Easing des Effekts */
  e: string
  /** Easings der Keyframes (eindeutig) */
  ke: string[]
  /** currentTime (ms) */
  ct: number | null
  /** in der aktiven Phase (berechneter Fortschritt ≠ null) */
  act: boolean
  /** Ziel (tag#id.klassen, gekürzt) */
  tg: string
  /** Bereich des Ziels: img | footer | header | main | deco | '' */
  z: string
  /** Pseudo-Element (View Transitions) */
  pe: string | null
}

export interface ProbeLeash {
  preset: string
  tier: string
  drawnLen: number
  total: number
  cocoLen: number
  pose: string | null
  rebuild: number
  /** Lesezeile relativ zur Linien-Ebene und `map(readingY)` aus der `scrollMap`. */
  readingY: number
  mapped: number
  /** halbe Linienbreite (CSS-px) */
  halfW: number
  /** gezeichnete, sichtbare Mittellinie: Tripel [len, x, y] in Viewport-CSS-px */
  pts: number[]
  /** Segmentgrenzen (Bogenlänge) */
  seams: number[]
  /** berechnete Strichfarbe der Linie */
  stroke: string
  /** Stationen mit erwarteter Pose (Geometrie) */
  stations: { id: string; y: number; pose: string; len0: number; len1: number }[]
}

export interface Probe {
  label: string
  /** Pfad des Standbilds im Lauf (`frames/…`) oder null */
  frame: string | null
  /** Sequenzzeit (ms) aus dem Label `t…`, sonst null */
  t: number | null
  url: string
  vw: number
  vh: number
  dpr: number
  /** Bildpunkte je CSS-Pixel im Standbild */
  scale: number
  scrollY: number
  /** Unterkante eines festen/klebenden Kopfbereichs (verdeckt alles darüber), sonst 0 */
  occTop?: number
  scrollW: number
  clientW: number
  leash: ProbeLeash | null
  coco: { x: number; y: number; w: number; h: number; boil: string } | null
  /** Textzeilen in main/footer: Quadrupel x,y,w,h (Viewport-CSS-px) */
  text: number[]
  /** Formularfelder, Knöpfe, Icon-Knöpfe, Fußbereich-Links: Quadrupel */
  ctrl: number[]
  anims: ProbeAnim[]
  deco: { hidden: boolean; focusable: number; count: number }
  /** Elemente in Mansalva mit Schriftgröße und Rolle */
  mansalva: { tag: string; size: number; role: string }[]
  /** Einträge in localStorage + sessionStorage + Cookies */
  storage: number
  /** Weltraum-Marken: Sterne im Bild, max. Marken je Station */
  marks: { stars: number; perStation: number }
  /** Elemente in `main` mit transition-duration > 0 (nur Ruhe-Routen) */
  transitions: number
  /** die ersten dieser Elemente */
  transitionsAt?: string[]
  /** Preis-Elemente und „In den Korb“ */
  commerce: { price: number; addToCart: number }
  focus: { desc: string; ring: boolean; hits: string[] } | null
  svg: { bytes: number; pathBytes: number }
  withdraw: { h: number; hit: boolean } | null
  canvasText: string
  lcp: { url: string | null; bytes: number | null; time: number | null } | null
  measures: { build: number[]; frame: number[] }
  poseLog: { t: number; from: string | null; to: string; bridge: string | null }[]
  /** Badges/Stempel: Kontrast Text zu Hintergrund */
  badges: { sel: string; ratio: number; size: number }[]
}

export interface ProbeFile {
  sc: string
  profile: string
  variant: string
  probes: Probe[]
  errors?: string[]
  /** Zusatzmessungen eines Szenarios (z. B. MO-07 Folgen, A11Y-03 Tab-Reihenfolge, PF-11/12). */
  extra?: Record<string, unknown>
}

/** Quadrupel-Liste → Rechtecke. */
export function rects(flat: readonly number[]): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = []
  for (let i = 0; i + 3 < flat.length; i += 4)
    out.push({ x: flat[i]!, y: flat[i + 1]!, w: flat[i + 2]!, h: flat[i + 3]! })
  return out
}

/** Tripel-Liste → Linienpunkte. */
export function linePoints(flat: readonly number[]): { len: number; x: number; y: number }[] {
  const out: { len: number; x: number; y: number }[] = []
  for (let i = 0; i + 2 < flat.length; i += 3)
    out.push({ len: flat[i]!, x: flat[i + 1]!, y: flat[i + 2]! })
  return out
}

/** Sequenzzeit aus einem Label (`paid-t0300` → 300). */
export function labelTime(label: string): number | null {
  const m = /(?:^|-)t(\d+)(?:$|-)/.exec(label)
  return m ? Number(m[1]) : null
}
