import type { PresetId, SpritePose } from './types'

// Dokumentation der Preset-Tabelle (DESIGN §9.7): Routen (KONZEPT §2.2), Linienform und Notizen. Bewusst getrennt von
// `presets.ts`, damit diese Texte nicht in die Engine gebündelt werden (Budget §9.10); gelesen nur von Tests.

export interface PresetDoc {
  /** Routen laut KONZEPT §2.2. */
  routes: readonly string[]
  /** Kurzbeschreibung der Linienform (§9.7 Spalte „Linienform“). */
  shape: string
  notes: string
}

export const PRESET_DOCS: Readonly<Record<PresetId, PresetDoc>> = {
  journey: {
    routes: ['R01'],
    shape: 'Rinnen-Serpentine, Schlaufen je Station (§11.4), ab 1200 zusätzlich lasso',
    notes: 'Orbit um die Planet-Marke der Kopf-Station',
  },
  about: {
    routes: ['R19'],
    shape: 'wie journey, 3 Stationen (Jutta, Coco, Werkstatt), Schlaufen right/left',
    notes: 'Coco läuft ein kurzes Stück mit (KONZEPT §3.12)',
  },
  shopString: {
    routes: ['R02', 'R03', 'R05'],
    shape:
      'Schnur durch die Faden-Anker je Kartenreihe, Durchhang clamp(4, 0.03 × Abstand, 14), Serpentine',
    notes:
      '„Mehr zeigen“ hängt Reihen an; Filterwechsel = Neuaufbau ohne Wiederholung gezeichneter Reihen',
  },
  product: {
    routes: ['R04'],
    shape: 'Unterstreichung der H1, senkrecht am Preisschild vorbei, hook am Knopf „In den Korb“',
    notes: 'Kauf-Leiste (KO-09a) ohne Linie und ohne Coco',
  },
  calm: {
    routes: ['R06', 'R07', 'R09', 'R26'],
    shape:
      'Korb: unter der H1 mit Endschleife neben Coco; Kasse: linke Kante der Abschnitte bzw. unter der H1',
    notes: 'keine View Transition hinein/hinaus',
  },
  stencil: {
    routes: ['R11', 'R12', 'R14', 'R15', 'R16', 'R17', 'R18'],
    shape: 'contour um jede Flash-Karte, dann zur nächsten; ohne Flash wie margin',
    notes: 'Linie bleibt --ink; Violett nur als --shadow-stencil an Karten',
  },
  frame: {
    routes: ['R10'],
    shape: 'contour um das Formular (KONZEPT §3.10)',
    notes: 'Formular selbst ohne Animation',
  },
  legal: {
    routes: ['R21', 'R22', 'R23', 'R24', 'R25', 'R27'],
    shape: 'ruhige, fast gerade Randlinie links vom Text, keine Schlaufen',
    notes: 'ruhige Randlinie, keine Animation (KONZEPT §3.14)',
  },
  margin: {
    routes: ['R20'],
    shape: 'leise Randlinie, scrollgekoppelt, ohne Schlaufen',
    notes: 'R20 Kontakt und alle sonstigen Inhaltsseiten',
  },
  thanks: {
    routes: ['R08'],
    shape: 'ruhiger Bogen vom Kopf zu Coco, endet in heart (MI-09)',
    notes: 'Herz 400 ms nach der Linie',
  },
  lost: {
    routes: ['R28'],
    shape: 'vom Kopf herab, coil am Boden, Ende = offener Karabiner',
    notes:
      'danach 2 langsame Schwingungen der losen Schlingen (MI-11); Variante „Zuhause“ mit Mini-Preisschild',
  },
}

/** Erlaubte Coco-Posen je Preset (DESIGN §10.5) – nur Doku/Tests; die Laufzeit liest sie aus `RUHEPOSE`/Coco-Steuerung. */
export const PRESET_COCO_POSES: Readonly<Partial<Record<PresetId, readonly SpritePose[]>>> = {
  journey: ['rennen', 'sitzen', 'schnueffeln', 'kopfschief', 'springen', 'schlafen'],
  about: ['sitzen', 'kopfschief', 'schnueffeln'],
  shopString: ['sitzen'],
  product: ['sitzen'],
  calm: ['sitzen'],
  stencil: ['kopfschief'],
  frame: ['sitzen'],
  thanks: ['sitzen', 'schlafen'],
  lost: ['rennen', 'sitzen'],
}
