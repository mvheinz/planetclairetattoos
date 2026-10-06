import { fnv1a32, valueNoise1D } from './random'
import type { InspectableLeashHandle } from './runtime'
import type { LeashGeometry, LeashSegment, PresetId } from './types'

// Statischer Renderer, Stufe C „Statisch“ (DESIGN §9.4, §9.10, §9.11): vollständig sichtbarer Umriss ohne Maske,
// ohne rAF, ohne Scroll-Kopplung. Zwei Aufgaben:
// 1. `staticSegmentSvg` – das Segment-`<svg>` für Stufe C, genutzt von der Laufzeit bei reduzierter Bewegung.
// 2. `mountStaticLeash` – eigene, kleine Linie für die Ruhe-Presets `legal` (ruhige Randlinie links vom Text) und
//    `calm` (Unterstreichung der H1); lädt weder Geometrie noch Laufzeit (Budget ≤ 4 KB gz, `check:bundle`).
// Framework-frei (ARCHITEKTUR A-11), keine Zeit-/Zufallsquellen außer dem Seed der Route.

export const SVG_NS = 'http://www.w3.org/2000/svg'
/** Rand der SVG-Box um die Segment-Bbox (§9.4). */
export const PAD = 8
const STEP = 4
/** Höchstzahl der Stützpunkte je Linie: sehr lange Textseiten (Datenschutz) halten so das Pfaddaten-Budget (P12.11). */
const MAX_POINTS = 1400
const REBUILD_DEBOUNCE_MS = 150
/** Ruhiger Wackel (§9.3 Nr. 6, Profil `calm`): Amplituden in px, Wellenlängen in px Bogenlänge. */
const WOBBLE = { a1: 0.5, a2: 0.12, l1: 90, l2: 13 }
const TAPER = 18

const r1 = (n: number) => String(Math.round(n * 10) / 10)

function forcedColors(win: Window): boolean {
  return !!win.matchMedia?.('(forced-colors: active)').matches
}

/** Leeres Segment-`<svg>` an der Segment-Bbox (+ `PAD`); die Ebene darüber ist `aria-hidden`. */
export function segmentSvg(doc: Document, seg: LeashSegment): SVGSVGElement {
  const x = seg.bbox.x - PAD
  const y = seg.bbox.y - PAD
  const w = seg.bbox.w + 2 * PAD
  const h = seg.bbox.h + 2 * PAD
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
  svg.setAttribute('data-leash-seg', seg.id)
  // Lage; `position: absolute` und `overflow: visible` stehen in global.css (`[data-leash-seg]`), `aria-hidden` an der
  // Linien-Ebene (PF-10: 13 Segmente × Attribute).
  svg.style.left = `${x}px`
  svg.style.top = `${y}px`
  return svg
}

/** Stufe C: Umriss `outlineD` gefüllt, ohne Maske; erzwungene Farben → `CanvasText` (§9.9 Nr. 7). */
export function staticSegmentSvg(
  doc: Document,
  seg: LeashSegment,
  forced: boolean,
): { svg: SVGSVGElement; ink: SVGPathElement } {
  const svg = segmentSvg(doc, seg)
  const ink = doc.createElementNS(SVG_NS, 'path')
  ink.setAttribute('d', seg.outlineD)
  ink.setAttribute('class', 'ink')
  ink.style.fill = forced ? 'CanvasText' : 'var(--ink)'
  svg.appendChild(ink)
  return { svg, ink }
}

interface Pt {
  x: number
  y: number
}

/**
 * Ruhige Linie von `a` nach `b` (fast gerade, Wackel quer zur Richtung) als Geometrie mit einem Segment: Umriss mit
 * leicht schwankender Breite, zu den Enden verjüngt und rund abgeschlossen.
 */
export function quietLine(a: Pt, b: Pt, baseWidth: number, seed: number): LeashGeometry {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  const n = Math.max(1, Math.min(MAX_POINTS, Math.ceil(length / STEP)))
  const ux = length > 0 ? dx / length : 0
  const uy = length > 0 ? dy / length : 1
  const nx = -uy
  const ny = ux
  const n1 = valueNoise1D(seed)
  const n2 = valueNoise1D(seed ^ 0x9e3779b9)
  const nw = valueNoise1D(seed ^ 0x5bd1e995)
  const left: Pt[] = []
  const right: Pt[] = []
  const lut = new Float32Array((n + 1) * 4)
  const angle = Math.atan2(uy, ux)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * length
    const off = WOBBLE.a1 * n1(s / WOBBLE.l1) + WOBBLE.a2 * n2(s / WOBBLE.l2)
    const cx = a.x + ux * s + nx * off
    const cy = a.y + uy * s + ny * off
    const taper = Math.min(1, s / TAPER, (length - s) / TAPER)
    const w = baseWidth * (0.8 + 0.2 * Math.max(0, taper)) * (1 + 0.08 * nw(s / 40))
    const hw = Math.min(1.35 * baseWidth, Math.max(0.8 * baseWidth, w)) / 2
    left.push({ x: cx + nx * hw, y: cy + ny * hw })
    right.push({ x: cx - nx * hw, y: cy - ny * hw })
    lut.set([s, cx, cy, angle], i * 4)
    minX = Math.min(minX, cx - hw)
    maxX = Math.max(maxX, cx + hw)
    minY = Math.min(minY, cy - hw)
    maxY = Math.max(maxY, cy + hw)
  }
  const hwEnd = (0.8 * baseWidth) / 2
  const pts = (list: Pt[]) => list.map((p) => `L${r1(p.x)} ${r1(p.y)}`).join('')
  const arc = (p: Pt) => `A${r1(hwEnd)} ${r1(hwEnd)} 0 0 1 ${r1(p.x)} ${r1(p.y)}`
  const l0 = left[0]!
  const outlineD = `M${r1(l0.x)} ${r1(l0.y)}${pts(left.slice(1))}${arc(right[n]!)}${pts(right.slice(0, n).reverse())}${arc(l0)}Z`
  const seg: LeashSegment = {
    id: 'seg-0',
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    centerD: `M${r1(a.x)} ${r1(a.y)}L${r1(b.x)} ${r1(b.y)}`,
    outlineD,
    len0: 0,
    len1: length,
  }
  return { segments: [seg], totalLength: length, lut, stations: [], scrollMap: [] }
}

export interface StaticMountOptions {
  preset: PresetId
  routeKey: string
}

function cssPx(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const v = parseFloat(style.getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

/** Linie des Ruhe-Presets aus dem DOM (eine Lesephase); `null`, wenn es nichts zu zeichnen gibt. */
function measureStatic(root: HTMLElement, preset: PresetId, seed: number): LeashGeometry | null {
  const doc = root.ownerDocument
  const win = doc.defaultView ?? window
  const scope: ParentNode = root.parentElement ?? doc
  const rootRect = root.getBoundingClientRect()
  const style = win.getComputedStyle(root)
  const bw = cssPx(style, '--leash-w-calm', 1.25)
  if (preset === 'legal') {
    // Randlinie in der Rinne (x = Rinnenmitte − 1, §5.3) von der Kopfleiste bis zum Ende des Inhalts.
    const rail =
      scope.querySelector('[data-leash-rail]') ?? scope.querySelector('main .u-container')
    const box = (rail ?? scope.querySelector('main'))?.getBoundingClientRect()
    if (!box || box.height <= 0) return null
    const gutter = cssPx(style, '--leash-gutter', 16)
    const x = box.left - rootRect.left + gutter / 2 - 1
    const bottom = box.bottom - rootRect.top
    return quietLine({ x, y: 0 }, { x, y: Math.max(24, bottom) }, bw, seed)
  }
  // `calm`: Unterstreichung der H1 (Titelbreite + 12 px, §9.7).
  const h1 = scope.querySelector('main h1')
  if (!h1) return null
  const range = doc.createRange()
  range.selectNodeContents(h1)
  const text =
    typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null
  const box = text && text.width > 0 ? text : h1.getBoundingClientRect()
  if (box.width <= 0) return null
  const y = box.bottom - rootRect.top + 6
  const x = box.left - rootRect.left
  return quietLine({ x, y }, { x: x + box.width + 12, y }, bw, seed)
}

/** Ruhe-Presets (`legal`, `calm`): Linie einmal vollständig zeichnen; Neuaufbau nur bei Größenänderung. */
export function mountStaticLeash(
  root: HTMLElement,
  options: StaticMountOptions,
): InspectableLeashHandle {
  const doc = root.ownerDocument
  const win = doc.defaultView ?? window
  const seed = fnv1a32(`${options.preset}:${options.routeKey}`)
  let geometry: LeashGeometry | null = null
  let rebuildCount = 0
  let destroyed = false
  let debounce: ReturnType<typeof setTimeout> | null = null
  let lastSize: { w: number; h: number } | null = null

  function build() {
    geometry = measureStatic(root, options.preset, seed)
    const forced = forcedColors(win)
    root.replaceChildren(
      ...(geometry?.segments ?? []).map((s) => staticSegmentSvg(doc, s, forced).svg),
    )
  }
  const schedule = () => {
    if (destroyed) return
    if (debounce !== null) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      rebuild()
    }, REBUILD_DEBOUNCE_MS)
  }
  function rebuild() {
    if (destroyed) return
    rebuildCount++
    build()
  }
  const observer =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => {
          const r = entries[entries.length - 1]?.contentRect
          if (!r) return
          const prev = lastSize
          lastSize = { w: r.width, h: r.height }
          if (prev && (Math.abs(r.width - prev.w) >= 1 || Math.abs(r.height - prev.h) >= 24))
            schedule()
        })
      : null

  build()
  observer?.observe(root.parentElement ?? root)
  if (doc.readyState !== 'complete') win.addEventListener('load', schedule, { once: true })
  if (doc.fonts && doc.fonts.status === 'loading') void doc.fonts.ready.then(schedule)
  // Schriften kommen erst nach dem ersten Bild (Schriften-Tor, DESIGN §4.1) – jeder spätere Tausch misst neu.
  doc.fonts?.addEventListener?.('loadingdone', schedule)

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      if (debounce !== null) clearTimeout(debounce)
      debounce = null
      win.removeEventListener('load', schedule)
      doc.fonts?.removeEventListener?.('loadingdone', schedule)
      observer?.disconnect()
      root.replaceChildren()
      geometry = null
    },
    rebuild() {
      if (debounce !== null) clearTimeout(debounce)
      debounce = null
      rebuild()
    },
    // Ruhe-Presets sind immer statisch – Bewegungswechsel ändern nichts.
    setMotion() {},
    setReadingY() {},
    whenBuilt(cb: () => void) {
      cb()
    },
    inspect: () => ({
      preset: options.preset,
      geometry,
      drawnLen: geometry?.totalLength ?? 0,
      cocoLen: 0,
      tier: 'C',
      rebuildCount,
      pose: null,
    }),
    setProbe() {},
    notePose() {},
  }
}
