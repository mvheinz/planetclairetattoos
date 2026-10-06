// Typen der Tuschelinie-Engine – wörtlich aus DESIGN §9.1. Framework-frei (ARCHITEKTUR A-11).
// `PresetId` entspricht `PRESETS` in `src/lib/routes/registry.ts` (Test `tests/unit/leash/geometry.unit.spec.ts`).

export type PresetId =
  | 'journey' | 'about' | 'shopString' | 'product' | 'calm'
  | 'stencil' | 'frame' | 'legal' | 'margin' | 'thanks' | 'lost';
// Sprite-IDs der Zeichnungen (§10.3); CMS-Werte (`CocoPose` aus DATENMODELL §4) übersetzt `COCO_POSE_TO_SPRITE` (poses.ts)
export type SpritePose = 'rennen' | 'schnueffeln' | 'sitzen' | 'schlafen' | 'springen' | 'kopfschief';
export type LoopKind =
  | 'none' | 'left' | 'right' | 'spiral' | 'lasso' | 'orbit'
  | 'hook' | 'contour' | 'heart' | 'coil';
export interface LeashAnchor {
  id: string;
  kind: 'start' | 'station' | 'tag' | 'target' | 'end';
  x: number; y: number; w: number; h: number;   // relativ zum Seitencontainer, CSS-px
  loop: LoopKind;
  pose?: SpritePose;
}
export interface BuildInput {
  preset: PresetId;
  seed: number;                 // fnv1a32(`${preset}:${routeKeyOhneLocale}`)
  root: { w: number; h: number };
  viewport: { w: number; h: number };
  gutter: number;               // §5.3
  baseWidth: number;            // --leash-w in px
  anchors: LeashAnchor[];
}
export interface LeashSegment {
  id: string;
  bbox: { x: number; y: number; w: number; h: number };
  centerD: string;              // Mittellinie (für Enthüllung/Stufe B)
  outlineD: string;             // gefüllter Umriss mit variabler Breite (Stufe A/C)
  len0: number; len1: number;   // Bogenlängen-Bereich im Gesamtpfad
  centerL?: number;             // Länge der Polylinie `centerD` (Dash-Enthüllung ohne getTotalLength)
  strokes?: LeashStroke[];      // Stufe A: Mittellinie in Stücken nahezu gleicher Breite (Dash-Enthüllung ohne Maske)
}
export interface LeashStroke {
  d: string;                    // Polylinie der Mittellinie (gewackelt)
  w: number;                    // Strichbreite in px (Mittel der Breiten im Stück)
  L: number;                    // Länge der Polylinie `d`
  len0: number; len1: number;   // Bogenlängen-Bereich im Gesamtpfad (Tintenpunkt: len0 = len1)
}
export interface LeashGeometry {
  segments: LeashSegment[];
  totalLength: number;
  lut: Float32Array;            // je 4 px Bogenlänge: [len, x, y, angleRad]
  stations: { id: string; pose: SpritePose; loopLen0: number; loopLen1: number; y: number }[];
  scrollMap: { readingY: number; len: number }[]; // beide Spalten monoton steigend
}
export interface LeashHandle { destroy(): void; rebuild(): void; setMotion(m: 'full' | 'reduced'): void; }
