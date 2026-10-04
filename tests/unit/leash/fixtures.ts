import type { BuildInput, LeashAnchor } from '@/leash/types'
import { fnv1a32 } from '@/leash/random'

// Test-Eingaben der Tuschelinie: Startseite `journey` mobil (390 × 844) und Desktop (1440 × 900), wie `measure()` sie
// liefern würde (Anker relativ zum Seitencontainer, Rinne 44 / 64, `--leash-w` 2.2 / 2.6).

const station = (
  id: string,
  y: number,
  loop: LeashAnchor['loop'],
  pose: LeashAnchor['pose'],
  rect?: Partial<LeashAnchor>,
): LeashAnchor => ({ id, kind: 'station', x: 60, y, w: 24, h: 24, loop, pose, ...rect })

export function journeyInput(viewport: { w: number; h: number } = { w: 390, h: 844 }): BuildInput {
  const desktop = viewport.w >= 768
  const gutter = desktop ? 64 : 44
  const left = desktop ? Math.max(0, (viewport.w - 1040) / 2) : 0
  const rail = left + gutter / 2
  const gap = desktop ? 820 : 640
  const top = 260
  const anchors: LeashAnchor[] = [
    { id: 'start', kind: 'start', x: rail, y: 0, w: 0, h: 0, loop: 'none' },
    station('planet-claire', 40, 'orbit', 'sitzen', {
      x: left + gutter + 230,
      y: 40,
      w: 40,
      h: 40,
    }),
    station('hallo', top, 'right', 'sitzen'),
    station('keramik', top + gap, 'lasso', 'schnueffeln', {
      x: left + gutter + 24,
      y: top + gap + 60,
      w: 280,
      h: 200,
    }),
    station('textil', top + 2 * gap, 'left', 'schnueffeln'),
    station('zeichnungen', top + 3 * gap, 'spiral', 'sitzen'),
    station('schmuck', top + 4 * gap, 'right', 'sitzen'),
    station('tattoo', top + 5 * gap, 'right', 'kopfschief'),
    station('jutta-coco', top + 6 * gap, 'left', 'sitzen'),
  ]
  return {
    preset: 'journey',
    seed: fnv1a32('journey:'),
    root: { w: viewport.w, h: top + 7 * gap + 200 },
    viewport,
    gutter,
    baseWidth: desktop ? 2.6 : 2.2,
    anchors,
  }
}

/** R19 Über mich & Coco (P8.18): Preset `about`, drei Stationen Jutta → Coco → Werkstatt (Schlaufen right/left/right). */
export function aboutInput(viewport: { w: number; h: number } = { w: 390, h: 844 }): BuildInput {
  const desktop = viewport.w >= 768
  const gutter = desktop ? 64 : 44
  const left = desktop ? Math.max(0, (viewport.w - 1040) / 2) : 0
  const rail = left + gutter / 2
  const gap = desktop ? 700 : 560
  const top = 300
  return {
    preset: 'about',
    seed: fnv1a32('about:'),
    root: { w: viewport.w, h: top + 3 * gap + 200 },
    viewport,
    gutter,
    baseWidth: desktop ? 2.6 : 2.2,
    anchors: [
      { id: 'start', kind: 'start', x: rail, y: 0, w: 0, h: 0, loop: 'none' },
      station('jutta', top, 'right', 'sitzen'),
      station('coco', top + gap, 'left', 'kopfschief'),
      station('werkstatt', top + 2 * gap, 'right', 'schnueffeln'),
    ],
  }
}
