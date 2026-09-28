import { toSpritePose } from './poses'
import { PRESET_CONFIG, gutterFor, railOffset } from './presets'
import type { BuildInput, LeashAnchor, LoopKind, PresetId } from './types'

// Messung der Tuschelinie (DESIGN §9.2): alle Anker, Viewport und CSS-Variablen in EINER Lesephase – keine
// Schreibzugriffe. Koordinaten relativ zur Linien-Ebene (liegt mit `inset: 0` im Seitencontainer).

const LOOPS: readonly LoopKind[] = [
  'none',
  'left',
  'right',
  'spiral',
  'lasso',
  'orbit',
  'hook',
  'contour',
  'heart',
  'coil',
]
const KINDS: readonly LeashAnchor['kind'][] = ['start', 'station', 'tag', 'target', 'end']

export interface Measurement {
  input: Omit<BuildInput, 'preset' | 'seed'>
  /** Oberkante der Linien-Ebene in Dokument-Koordinaten. */
  rootTop: number
  scrollY: number
  innerWidth: number
  innerHeight: number
  /** Größte mögliche Scroll-Position. */
  maxScroll: number
}

function cssPx(style: CSSStyleDeclaration, name: string): number | null {
  const v = parseFloat(style.getPropertyValue(name))
  return Number.isFinite(v) ? v : null
}

const asLoop = (v: string | null): LoopKind =>
  v && (LOOPS as readonly string[]).includes(v) ? (v as LoopKind) : 'none'

export function measure(root: HTMLElement, preset: PresetId): Measurement {
  const doc = root.ownerDocument
  const win = doc.defaultView ?? window
  const scope: ParentNode = root.parentElement ?? doc
  const rootRect = root.getBoundingClientRect()
  const scrollY = win.scrollY
  const innerWidth = win.innerWidth
  const innerHeight = win.innerHeight
  const scrollHeight = doc.documentElement.scrollHeight
  const style = win.getComputedStyle(root)
  const cfg = PRESET_CONFIG[preset]

  const gutter = cssPx(style, '--leash-gutter') ?? gutterFor(preset, innerWidth)
  const baseWidth =
    cssPx(style, cfg.width === 'calm' ? '--leash-w-calm' : '--leash-w') ??
    (cfg.width === 'calm' ? 1.25 : innerWidth >= 768 ? 2.6 : 2.2)
  const pagePad = cssPx(style, '--page-pad') ?? 16

  const rel = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { x: r.left - rootRect.left, y: r.top - rootRect.top, w: r.width, h: r.height }
  }

  // Rinne: linke Kante des Inhalts-Containers (`.u-container` bzw. `[data-leash-rail]`).
  const railEl =
    scope.querySelector('[data-leash-rail]') ?? scope.querySelector('main .u-container')
  const railLeft = railEl ? rel(railEl).x : 0
  const startX = cfg.rail === 'none' ? pagePad + 8 : railLeft + railOffset(preset, gutter)

  const anchors: LeashAnchor[] = [
    { id: 'start', kind: 'start', x: startX, y: 0, w: 0, h: 0, loop: 'none' },
  ]
  scope.querySelectorAll<HTMLElement>('[data-leash-station]').forEach((el, i) => {
    const pose = toSpritePose(el.dataset.leashPose)
    anchors.push({
      id: el.dataset.leashStation || `station-${i}`,
      kind: 'station',
      ...rel(el),
      loop: asLoop(el.dataset.leashLoop ?? null),
      ...(pose ? { pose } : {}),
    })
  })
  scope.querySelectorAll<HTMLElement>('[data-leash-anchor]').forEach((el, i) => {
    const kind = el.dataset.leashAnchor as LeashAnchor['kind']
    if (!(KINDS as readonly string[]).includes(kind) || kind === 'station') return
    anchors.push({
      id: el.id || `${kind}-${i}`,
      kind,
      ...rel(el),
      loop: asLoop(el.dataset.leashLoop ?? null),
    })
  })
  if (anchors.filter((a) => a.kind === 'start').length > 1) anchors.shift()

  return {
    input: {
      root: { w: rootRect.width, h: rootRect.height },
      viewport: { w: innerWidth, h: innerHeight },
      gutter,
      baseWidth,
      anchors,
    },
    rootTop: rootRect.top + scrollY,
    scrollY,
    innerWidth,
    innerHeight,
    maxScroll: Math.max(0, scrollHeight - innerHeight),
  }
}
