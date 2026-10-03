// Weltraum-Motive (DESIGN §12.5, PLAN P9.12): von Hand gesetzte Kontrollpunkte (keine Formen-Primitive), Tusche-Linie
// wie Coco/Platzhalter (`scripts/art/lib/handline.ts`), höchstens eine Wash-Fläche. `pnpm art:space` schreibt daraus
// `src/art/space/{id}.svg` (je ≤ 1,5 KB, Farbe über `currentColor`). Nur allgemeine Space-Age-Anmutung – keine
// Band-Bezüge, keine Liedtexte, keine Albumgrafik.
import type { Ink } from '../../scripts/art/lib/handline'
import { dot } from './placeholders/_parts'

export interface SpaceMotif {
  viewBox: string
  strokeWidth: number
  ink: Ink
  /** optionale Wash-Fläche (geschlossener Pfad), Farbe als CSS-Variable mit Rückfall */
  wash?: { d: string; color: 'pink' | 'mat' }
}

export const SPACE: Readonly<Record<string, SpaceMotif>> = {
  // Planet mit Ring: Körper wackeliger Kreis, Ring 1,7× Breite, 15° gekippt, hinter dem Körper unterbrochen
  'planet-ring': {
    viewBox: '0 0 120 120',
    strokeWidth: 4.4,
    wash: { d: 'M42 52C44 38 60 32 72 38C82 44 86 58 80 70C74 80 58 84 48 76C42 70 40 62 42 52Z', color: 'pink' },
    ink: {
      strokes: [
        { d: 'M36 58C34 42 46 30 62 30C78 31 90 44 89 60C88 76 75 88 59 88C45 87 35 76 36 62', exact: true },
        'M30 70C18 76 10 80 12 84C16 90 46 84 74 72C98 62 112 50 108 44C106 40 96 41 88 44',
        'M33 52C24 52 18 54 18 56',
        'M68 40C74 42 78 46 80 52',
      ],
    },
  },
  // 4-zackiger Funkel-Stern: eingezogene Seiten, eine Spitze länger
  'star-4': {
    viewBox: '0 0 60 60',
    strokeWidth: 2.8,
    ink: {
      strokes: [
        {
          d: 'M30 4C32 18 36 24 54 28C38 32 33 37 31 56C28 38 24 33 6 31C22 27 27 21 30 4',
          exact: true,
        },
      ],
    },
  },
  // 5-zackiger, schiefer Stern in einem Zug, Ende offen
  'star-5': {
    viewBox: '0 0 60 60',
    strokeWidth: 2.8,
    ink: {
      strokes: [
        {
          d: 'M28 6L35 23L54 22L39 34L45 53L29 42L13 52L19 34L5 23L24 22L27 9',
          exact: true,
        },
      ],
    },
  },
  // Mondsichel: zwei Bögen, unten nicht ganz geschlossen
  moon: {
    viewBox: '0 0 80 80',
    strokeWidth: 3.6,
    ink: {
      strokes: [
        { d: 'M46 8C24 10 10 28 12 46C14 64 32 76 50 72C58 70 64 66 68 60', exact: true },
        'M46 8C36 18 32 32 36 46C40 58 52 64 66 62',
        'M30 40C30 44 32 46 34 46',
      ],
    },
  },
  // gestrichelte Umlaufbahn: Ellipse aus kurzen, ungleichen Strichen, leicht gekippt
  orbit: {
    viewBox: '0 0 160 70',
    strokeWidth: 3,
    ink: {
      strokes: [
        { d: 'M10 38C10 30 16 24 26 20', exact: true },
        { d: 'M38 15C48 12 60 10 72 10', exact: true },
        { d: 'M86 10C98 11 110 13 120 16', exact: true },
        { d: 'M132 21C142 26 150 31 150 37', exact: true },
        { d: 'M146 45C138 52 126 56 112 58', exact: true },
        { d: 'M96 60C84 61 72 61 60 60', exact: true },
        { d: 'M44 57C32 55 20 51 13 45', exact: true },
      ],
    },
  },
  // kleine Retro-Untertasse: Kuppel, Scheibe, drei Lichter
  saucer: {
    viewBox: '0 0 120 70',
    strokeWidth: 3.6,
    wash: { d: 'M42 34C44 22 54 16 62 16C72 17 80 24 80 34C68 37 54 37 42 34Z', color: 'mat' },
    ink: {
      strokes: [
        { d: 'M40 34C40 22 50 14 60 14C72 14 80 22 80 33', exact: true },
        { d: 'M38 34C24 36 10 40 10 46C12 54 40 58 62 57C86 56 110 52 110 45C110 39 96 35 82 33', double: true },
        'M22 50C40 54 82 54 100 48',
      ],
      dots: [dot(34, 46, 5, 4), dot(60, 48, 5, 4), dot(86, 46, 5, 4)],
    },
  },
  // Morse-Leiste „CLAIRE“ (−·−· ·−·· ·− ·· ·−· ·): Striche als kurze Linien, Punkte als kleine Tupfer
  'morse-claire': {
    viewBox: '0 0 420 24',
    strokeWidth: 3,
    ink: {
      strokes: [
        { d: 'M6 12L24 12', exact: true },
        { d: 'M40 12L58 12', exact: true },
        { d: 'M106 12L124 11', exact: true },
        { d: 'M190 12L208 12', exact: true },
        { d: 'M296 12L314 13', exact: true },
      ],
      dots: [
        dot(32, 12, 4.4, 3.8),
        dot(66, 12, 4.4, 3.8),
        // ·−··
        dot(96, 12, 4.4, 3.8),
        dot(132, 12, 4.4, 3.8),
        dot(142, 12, 4.4, 3.8),
        // ·−
        dot(180, 12, 4.4, 3.8),
        // ··
        dot(236, 12, 4.4, 3.8),
        dot(246, 12, 4.4, 3.8),
        // ·−·
        dot(286, 12, 4.4, 3.8),
        dot(322, 12, 4.4, 3.8),
        // ·
        dot(362, 12, 4.4, 3.8),
      ],
    },
  },
}
