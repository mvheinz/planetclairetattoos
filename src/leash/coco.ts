import {
  COCO_ANCHORS,
  COCO_FRAMES,
  COCO_SPRITE_HREF,
  COCO_VIEWBOX,
  cocoHref,
  poseSymbol,
  type CocoBridge,
  type CocoSize,
} from './cocoSprite'
import type { Motion } from './motion'
import type { SpritePose } from './types'

// Coco-Steuerung (DESIGN §10.3, §10.4, §9.11): Posen, Brücken, Boil-Budget, Position an der Leinenspitze.
// Framework-frei (ARCHITEKTUR A-11); Budget ≤ 3 KB gz (`check:bundle`).
// - Posenwechsel nur an einer Frame-Grenze; dazwischen die definierte Brücke (je 1 Frame), sonst direkter Schnitt
//   plus 1 Frame Stauchung `scaleY(0.94)`. Keine Überblendung.
// - Boil (CSS, `data-boil`) nur (a) bei Aktivität + 1,5 s, (b) 2 s nach Posenwechsel/Seiteneintritt; nie länger als
//   5 s ohne Nutzeraktion. Aus = Frame A.
// - Reduzierte Bewegung: Frame A der Ruhe-Pose, kein Boil, keine Brücken, keine Stauchung.

/** Frame-Länge je Pose in ms (12 / 10 / 8 fps). */
export const POSE_FRAME_MS: Readonly<Record<SpritePose, number>> = {
  rennen: 1000 / 12,
  springen: 1000 / 12,
  schnueffeln: 100,
  sitzen: 100,
  kopfschief: 100,
  schlafen: 125,
}
export const BRIDGE_MS = 1000 / 12
export const BOIL = { afterActivity: 1500, afterPose: 2000, maxWithoutAction: 5000 } as const

/** Brücken zwischen zwei Posen (§10.3); `null` = direkter Schnitt mit Stauchung. */
export function bridgesFor(from: SpritePose, to: SpritePose): CocoBridge[] | null {
  if (from === to) return []
  if (to === 'springen') return ['abspringen']
  if (from === 'rennen' && (to === 'schnueffeln' || to === 'sitzen' || to === 'kopfschief'))
    return ['bremsen']
  if ((from === 'sitzen' || from === 'schnueffeln') && to === 'rennen') return ['abspringen']
  if (from === 'sitzen' && to === 'schlafen') return ['einrollen-1', 'einrollen-2']
  return null
}

export interface PoseEvent {
  t: number
  from: SpritePose | null
  to: SpritePose
  bridge: string | null
}

export interface CocoOptions {
  pose: SpritePose
  motion?: Motion
  /** Sprite-Datei (`''` = Symbole im selben Dokument, Vorschau). */
  href?: string
  onPose?: (e: PoseEvent) => void
  /** Zeitquelle (Tests); Standard `performance.now()`. */
  now?: () => number
}

export interface CocoController {
  readonly el: HTMLElement
  /** Aktuell gezeigte Pose. */
  pose(): SpritePose
  boiling(): boolean
  /** Ziel-Pose; der Wechsel erfolgt an der nächsten Frame-Grenze. */
  setPose(pose: SpritePose): void
  /** D-Ring an (x, y) im Koordinatensystem des Containers; `direction` −1 spiegelt (läuft zurück). */
  place(x: number, y: number, direction?: 1 | -1): void
  /** Nutzeraktion (Scrollen) – Boil läuft mit 1,5 s Nachlauf. */
  activity(): void
  setMotion(motion: Motion, restPose?: SpritePose): void
  destroy(): void
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** DOM wie `src/components/Coco.tsx` (§10.4) – für Stellen ohne React (Vorschau, Engine). */
export function createCocoElement(
  doc: Document,
  size: CocoSize,
  pose: SpritePose,
  href: string = COCO_SPRITE_HREF,
): HTMLElement {
  const el = doc.createElement('div')
  el.className = 'coco'
  el.setAttribute('data-size', size)
  el.setAttribute('data-pose', pose)
  el.setAttribute('data-boil', 'off')
  el.setAttribute('aria-hidden', 'true')
  const hop = doc.createElement('div')
  hop.className = 'coco__hop'
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${COCO_VIEWBOX.w} ${COCO_VIEWBOX.h}`)
  svg.setAttribute('focusable', 'false')
  for (const f of COCO_FRAMES) {
    const use = doc.createElementNS(SVG_NS, 'use')
    use.setAttribute('class', `f f-${f}`)
    use.setAttribute('href', cocoHref(poseSymbol(pose, f), href))
    svg.appendChild(use)
  }
  hop.appendChild(svg)
  el.appendChild(hop)
  return el
}

/** Symbole einer Pose bzw. Brücke (Schlüssel wie in `COCO_ANCHORS`: Pose oder `bridge-…`). */
const groupIds = (key: string): string[] =>
  key.startsWith('bridge-')
    ? COCO_FRAMES.map(() => `coco-${key}`)
    : COCO_FRAMES.map((f) => poseSymbol(key as SpritePose, f))

/**
 * Alle Posen und Brücken als vorab angelegte Gruppen (`<g class="cg">` mit drei `<use>`); sichtbar ist nur die Gruppe
 * mit `data-on`. Ein Posenwechsel schaltet nur dieses Attribut um – ein neues `href` würde den Schatten-Baum des
 * `<use>` neu aufbauen und je Wechsel ein Layout auslösen (KUNST-QA PF-05).
 */
function buildGroups(el: HTMLElement, href: string, shown: string): Map<string, Element> {
  const svg = el.querySelector('svg')
  const groups = new Map<string, Element>()
  if (!svg) return groups
  const doc = el.ownerDocument
  const existing = Array.from(svg.querySelectorAll('use'))
  for (const key of Object.keys(COCO_ANCHORS)) {
    const g = doc.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', 'cg')
    const ids = groupIds(key)
    COCO_FRAMES.forEach((f, i) => {
      const use = key === shown && existing[i] ? existing[i] : doc.createElementNS(SVG_NS, 'use')
      use.setAttribute('class', `f f-${f}`)
      use.setAttribute('href', cocoHref(ids[i]!, href))
      use.removeAttribute('data-href')
      g.appendChild(use)
    })
    groups.set(key, g)
    svg.appendChild(g)
  }
  for (const u of existing) if (u.parentNode === svg) u.remove()
  groups.get(shown)?.setAttribute('data-on', '')
  return groups
}

export function mountCoco(el: HTMLElement, options: CocoOptions): CocoController {
  const now = options.now ?? (() => performance.now())
  const href = options.href ?? COCO_SPRITE_HREF
  const groups = buildGroups(el, href, options.pose)
  let on: Element | null = groups.get(options.pose) ?? null
  const hop = el.querySelector<HTMLElement>('.coco__hop')
  let motion: Motion = options.motion ?? 'full'
  let shown: SpritePose = options.pose
  let target: SpritePose = shown
  let bridge: CocoBridge | null = null
  let origin = now()
  let boilUntil = 0
  let lastAction = origin
  let stepTimer: ReturnType<typeof setTimeout> | null = null
  let boilTimer: ReturnType<typeof setTimeout> | null = null
  let squashTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false
  // Breite einmal lesen, danach nur über den ResizeObserver (kein Layout-Lesen im Scroll-Pfad, §9.10).
  let width = el.getBoundingClientRect().width || 0
  const ro =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => {
          width = entries[entries.length - 1]?.contentRect.width ?? width
        })
      : null
  ro?.observe(el)

  const frameMs = () => (bridge ? BRIDGE_MS : POSE_FRAME_MS[shown])
  const clear = (t: ReturnType<typeof setTimeout> | null) => {
    if (t !== null) clearTimeout(t)
    return null
  }

  function show(pose: string) {
    const next = groups.get(pose) ?? null
    if (next !== on) {
      on?.removeAttribute('data-on')
      next?.setAttribute('data-on', '')
      on = next
    }
    el.setAttribute('data-pose', pose)
  }

  function setBoil(on: boolean) {
    const was = el.getAttribute('data-boil') === 'on'
    if (on && !was) origin = now() // CSS-Animation startet neu → neues Frame-Raster
    el.setAttribute('data-boil', on ? 'on' : 'off')
  }

  /** Boil für `ms` einschalten, höchstens bis 5 s nach der letzten Nutzeraktion. */
  function boil(ms: number) {
    if (destroyed || motion === 'reduced') return
    const t = now()
    boilUntil = Math.max(boilUntil, Math.min(t + ms, lastAction + BOIL.maxWithoutAction))
    if (boilUntil <= t) return
    setBoil(true)
    boilTimer = clear(boilTimer)
    boilTimer = setTimeout(() => {
      boilTimer = null
      setBoil(false)
    }, boilUntil - t)
  }

  /** Wartezeit bis zur nächsten Frame-Grenze (0, wenn gerade eine ist). */
  function untilBoundary(): number {
    const f = frameMs()
    const since = now() - origin
    const rest = f - (since % f)
    return rest >= f - 0.5 ? 0 : rest
  }

  function finish(from: SpritePose, used: CocoBridge[] | null) {
    bridge = null
    shown = target
    show(shown)
    if (used === null && hop && motion === 'full') {
      hop.style.transform = 'scaleY(0.94)'
      squashTimer = setTimeout(() => {
        squashTimer = null
        hop.style.transform = ''
      }, POSE_FRAME_MS[shown])
    }
    options.onPose?.({ t: now(), from, to: shown, bridge: used?.join('+') || null })
    boil(BOIL.afterPose)
  }

  function step(from: SpritePose, queue: CocoBridge[], used: CocoBridge[] | null) {
    stepTimer = null
    const next = queue.shift()
    if (next) {
      bridge = next
      show(`bridge-${next}`)
      stepTimer = setTimeout(() => step(from, queue, used), BRIDGE_MS)
    } else finish(from, used)
  }

  function schedule() {
    stepTimer = clear(stepTimer)
    if (target === shown && !bridge) return
    const from = shown
    const used = bridgesFor(from, target)
    const queue = [...(used ?? [])]
    const wait = untilBoundary()
    if (wait === 0) step(from, queue, used)
    else stepTimer = setTimeout(() => step(from, queue, used), wait)
  }

  boil(BOIL.afterPose) // Seiteneintritt

  return {
    el,
    pose: () => shown,
    boiling: () => el.getAttribute('data-boil') === 'on',
    setPose(pose) {
      if (destroyed || pose === target) return
      target = pose
      if (motion === 'reduced') {
        const from = shown
        shown = pose
        show(pose)
        options.onPose?.({ t: now(), from, to: pose, bridge: null })
        return
      }
      if (!bridge) schedule()
    },
    place(x, y, direction = 1) {
      const key = bridge ? `bridge-${bridge}` : shown
      const [ax, ay] = COCO_ANCHORS[key] ?? COCO_ANCHORS[shown] ?? [80, 60]
      const s = width / COCO_VIEWBOX.w
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scaleX(${direction}) translate(${(-ax * s).toFixed(1)}px,${(-ay * s).toFixed(1)}px)`
    },
    activity() {
      lastAction = now()
      boil(BOIL.afterActivity)
    },
    setMotion(next, restPose) {
      if (destroyed) return
      motion = next
      if (next === 'reduced') {
        stepTimer = clear(stepTimer)
        boilTimer = clear(boilTimer)
        squashTimer = clear(squashTimer)
        if (hop) hop.style.transform = ''
        bridge = null
        boilUntil = 0
        setBoil(false)
        target = shown = restPose ?? shown
        show(shown)
      } else boil(BOIL.afterPose)
    },
    destroy() {
      destroyed = true
      ro?.disconnect()
      stepTimer = clear(stepTimer)
      boilTimer = clear(boilTimer)
      squashTimer = clear(squashTimer)
      if (hop) hop.style.transform = ''
      setBoil(false)
    },
  }
}
