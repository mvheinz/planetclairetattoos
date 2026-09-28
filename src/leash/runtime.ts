import { easeInkOut } from './easing'
import { buildGeometry, mapReadingY, pointAt } from './geometry'
import { measure, type Measurement } from './measure'
import { getMotion, type Motion } from './motion'
import {
  DOWNGRADE,
  PRESET_CONFIG,
  READING_LINE,
  REST_POSE,
  TIER_B_USER_AGENTS,
  isStaticPreset,
} from './presets'
import { fnv1a32 } from './random'
import { PAD, segmentSvg, staticSegmentSvg } from './static'
import type { LeashGeometry, LeashHandle, PresetId, SpritePose } from './types'

// Laufzeit der Tuschelinie (DESIGN §9.2, §9.4, §9.6, §9.10): misst (eine Lesephase), baut die SVG-Segmente (eine
// Schreibphase), koppelt die gezeichnete Länge an die Lesezeile und hält Coco geglättet an der Spitze.
// Framework-frei; in der App dynamisch importiert (nie im Erstlade-Bundle), in der Vorschau statisch gebündelt.

/** A „Tusche“ (Maske), B „Feder“ (Strich), C „Statisch“ (vollständiger Umriss) – §9.4. */
export type Tier = 'A' | 'B' | 'C'

export interface CocoState {
  len: number
  x: number
  y: number
  angle: number
  /** Laufrichtung auf der Linie: 1 vorwärts, −1 zurück (Hochscrollen). */
  direction: 1 | -1
  /** Ziel-Pose (Sprite-ID); die Coco-Steuerung wechselt an der nächsten Frame-Grenze (§10.3). */
  pose: SpritePose
  /** Coco bewegt sich (Scroll-Aktivität, Glättung, Intro) – Boil-Budget §10.3 (a). */
  moving: boolean
  motion: Motion
}

export interface MountOptions {
  preset: PresetId
  /** Routen-Schlüssel ohne Sprache – Seed der Linie (`fnv1a32(`${preset}:${routeKey}`)`). */
  routeKey: string
  /** Anfangszustand; sonst `getMotion()`. Änderungen kommen über `setMotion`. */
  motion?: Motion
  /** Coco-Anbindung (P2.18, `src/leash/coco.ts`): Position der Leinenspitze je Frame. */
  onCoco?: (state: CocoState) => void
}

export interface LeashDebugState {
  preset: PresetId
  geometry: LeashGeometry | null
  drawnLen: number
  cocoLen: number
  tier: Tier
  rebuildCount: number
  /** Aktuelle Coco-Pose (Sprite-ID) bzw. `null` ohne Coco. */
  pose: SpritePose | null
}

/** Messpunkte für den Frame-Logger der Debug-Schnittstelle (KUNST-QA §3.1); ohne Debug-Build nie gesetzt. */
export interface LeashProbe {
  build?(start: number, end: number): void
  frame?(start: number, end: number): void
  pose?(entry: { t: number; from: SpritePose | null; to: SpritePose; bridge: string | null }): void
}

export interface InspectableLeashHandle extends LeashHandle {
  inspect(): LeashDebugState
  /** Debug: Lesezeile fest setzen (px relativ zur Linien-Ebene, wie `scrollMap.readingY`); `null` = wieder Scroll. */
  setReadingY(y: number | null): void
  setProbe(probe: LeashProbe | null): void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Debounce des Neuaufbaus (§9.10). */
const REBUILD_DEBOUNCE_MS = 150
/** Viewport-Höhenänderungen darunter lösen keinen Neuaufbau aus (mobile Adressleiste, §9.6). */
const MIN_VIEWPORT_DH = 120
/** Coco springt statt zu rennen, wenn sie weiter zurückliegt (§9.6). */
const COCO_JUMP = 300

type SegState = 'future' | 'active' | 'done'

interface SegView {
  svg: SVGSVGElement
  ink: SVGPathElement
  /** Maskenlinie (A) bzw. sichtbarer Strich (B); `null` bei C. */
  reveal: SVGPathElement | null
  maskRef: string | null
  L: number
  len0: number
  len1: number
  state: SegState | null
}

type IdleWin = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

let instanceCount = 0

export function mountLeash(root: HTMLElement, options: MountOptions): InspectableLeashHandle {
  const doc = root.ownerDocument
  const win = (doc.defaultView ?? window) as IdleWin
  const cfg = PRESET_CONFIG[options.preset]
  const uid = ++instanceCount
  const seed = fnv1a32(`${options.preset}:${options.routeKey}`)

  let motion: Motion = options.motion ?? getMotion(doc)
  let tier: Tier = 'C'
  let downgraded = false
  let geometry: LeashGeometry | null = null
  let m: Measurement | null = null
  let views: SegView[] = []
  let drawnLen = 0
  let cocoLen = 0
  let rebuildCount = 0
  let destroyed = false
  let visible = true
  let rafId: number | null = null
  let lastFrame = 0
  let lastScrollAt = -Infinity
  let intro: { from: number; to: number; start: number | null; dur: number } | null = null
  let debounce: ReturnType<typeof setTimeout> | null = null
  let idleId: number | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const monitor = { active: 0, frames: 0, slow: 0, done: false }
  const restPose = cfg.coco ? REST_POSE[options.preset] : null
  let pose: SpritePose | null = null
  let readingOverride: number | null = null
  let probe: LeashProbe | null = null

  // ---------- Stufenwahl (§9.4) ----------

  function chooseTier(): Tier {
    if (motion === 'reduced' || isStaticPreset(options.preset)) return 'C'
    if (win.matchMedia?.('(forced-colors: active)').matches) return 'C'
    if (downgraded) return 'B'
    const nav = win.navigator as Navigator & { deviceMemory?: number }
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return 'B'
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return 'B'
    if (TIER_B_USER_AGENTS.some((re) => re.test(nav.userAgent))) return 'B'
    return 'A'
  }

  // ---------- SVG-Aufbau: eine Schreibphase ----------

  function render() {
    if (!geometry || !m) return
    const bw = m.input.baseWidth
    const forced = !!win.matchMedia?.('(forced-colors: active)').matches
    const frag = doc.createDocumentFragment()
    views = geometry.segments.map((seg, k) => {
      const base = { L: 0, len0: seg.len0, len1: seg.len1, state: null }
      if (tier === 'C') {
        // Stufe C über den statischen Renderer (§9.4, §9.11): Umriss ohne Maske, vollständig.
        const { svg, ink } = staticSegmentSvg(doc, seg, forced)
        frag.appendChild(svg)
        return { svg, ink, reveal: null, maskRef: null, ...base }
      }
      const x = seg.bbox.x - PAD
      const y = seg.bbox.y - PAD
      const w = seg.bbox.w + 2 * PAD
      const h = seg.bbox.h + 2 * PAD
      const svg = segmentSvg(doc, seg)
      const ink = doc.createElementNS(SVG_NS, 'path')
      let reveal: SVGPathElement | null = null
      let maskRef: string | null = null
      if (tier === 'B') {
        ink.setAttribute('d', seg.centerD)
        ink.setAttribute('fill', 'none')
        ink.setAttribute('stroke-width', String(bw))
        ink.setAttribute('stroke-linecap', 'round')
        ink.setAttribute('stroke-linejoin', 'round')
        ink.style.stroke = forced ? 'CanvasText' : 'var(--ink)'
        reveal = ink
      } else {
        ink.setAttribute('d', seg.outlineD)
        ink.style.fill = forced ? 'CanvasText' : 'var(--ink)'
        {
          const id = `pc-leash-m-${uid}-${k}`
          const defs = doc.createElementNS(SVG_NS, 'defs')
          const mask = doc.createElementNS(SVG_NS, 'mask')
          mask.setAttribute('id', id)
          mask.setAttribute('maskUnits', 'userSpaceOnUse')
          mask.setAttribute('x', String(x))
          mask.setAttribute('y', String(y))
          mask.setAttribute('width', String(w))
          mask.setAttribute('height', String(h))
          reveal = doc.createElementNS(SVG_NS, 'path')
          reveal.setAttribute('d', seg.centerD)
          reveal.setAttribute('fill', 'none')
          reveal.setAttribute('stroke', '#fff')
          reveal.setAttribute('stroke-width', String(1.35 * bw + 4))
          reveal.setAttribute('stroke-linecap', 'round')
          reveal.setAttribute('stroke-linejoin', 'round')
          mask.appendChild(reveal)
          defs.appendChild(mask)
          svg.appendChild(defs)
          maskRef = `url(#${id})`
          ink.setAttribute('mask', maskRef)
        }
      }
      ink.setAttribute('class', 'ink')
      svg.appendChild(ink)
      frag.appendChild(svg)
      return { svg, ink, reveal, maskRef, ...base }
    })
    root.replaceChildren(frag)
    // Länge der Enthüllungslinie einmal beim Aufbau (§9.4); ohne SVG-Geometrie (jsdom) die Bogenlänge.
    for (const v of views) {
      if (!v.reveal) continue
      const measured =
        typeof v.reveal.getTotalLength === 'function' ? v.reveal.getTotalLength() : NaN
      v.L = Number.isFinite(measured) && measured > 0 ? measured : v.len1 - v.len0
      v.reveal.style.strokeDasharray = `${v.L} ${v.L}`
      v.reveal.style.strokeDashoffset = String(v.L)
    }
  }

  /** Segment-Zustände: fertig (ohne Maske), aktiv (Maske/Strich aktualisiert), zukünftig (unsichtbar). */
  function applyDrawn() {
    for (const v of views) {
      const span = v.len1 - v.len0
      const p = tier === 'C' ? 1 : span > 0 ? (drawnLen - v.len0) / span : 1
      const state: SegState = p >= 1 - 1e-6 ? 'done' : p <= 0 ? 'future' : 'active'
      if (state !== v.state) {
        v.svg.style.visibility = state === 'future' ? 'hidden' : ''
        if (state === 'done') {
          v.ink.removeAttribute('mask')
          if (v.reveal) {
            v.reveal.style.strokeDasharray = ''
            v.reveal.style.strokeDashoffset = ''
          }
        } else if (v.maskRef && !v.ink.hasAttribute('mask')) v.ink.setAttribute('mask', v.maskRef)
        v.state = state
      }
      if (state === 'active' && v.reveal) v.reveal.style.strokeDashoffset = String(v.L * (1 - p))
    }
  }

  // ---------- Scroll-Kopplung (§9.6) ----------

  function readingY(): number {
    if (readingOverride !== null) return readingOverride
    if (!m) return 0
    return win.scrollY + READING_LINE * m.innerHeight - m.rootTop
  }

  function scrollTarget(): number {
    if (!geometry || !m) return 0
    if (cfg.draw !== 'scroll') return geometry.totalLength
    if (readingOverride === null && m.maxScroll > 0 && win.scrollY >= m.maxScroll - 2)
      return geometry.totalLength
    return mapReadingY(geometry.scrollMap, readingY())
  }

  /** Ruheplatz bei reduzierter Bewegung: erste Station (`journey`/`about`, §9.11), sonst Linienanfang. */
  function restLen(): number {
    return geometry?.stations[0]?.loopLen0 ?? 0
  }

  /** Ziel-Pose (§10.3, §10.6): reduziert → Ruhe-Pose; in Bewegung `rennen`; an einer Station deren Pose. */
  function targetPose(moving: boolean): SpritePose | null {
    if (!restPose) return null
    if (motion === 'reduced' || !geometry) return restPose
    if (moving) return 'rennen'
    const st = geometry.stations.find((s) => cocoLen >= s.loopLen0 - 2 && cocoLen <= s.loopLen1 + 2)
    return st?.pose ?? restPose
  }

  function emitCoco(direction: 1 | -1, moving: boolean) {
    const next = targetPose(moving)
    if (next !== pose && next) {
      probe?.pose?.({ t: performance.now(), from: pose, to: next, bridge: null })
      pose = next
    }
    if (!options.onCoco || !geometry || !pose) return
    const p = pointAt(geometry.lut, cocoLen)
    options.onCoco({
      len: cocoLen,
      x: p.x,
      y: p.y,
      angle: p.angle,
      direction,
      pose,
      moving,
      motion,
    })
  }

  function requestFrame() {
    if (rafId === null && !destroyed) rafId = win.requestAnimationFrame(frame)
  }

  function frame(now: number) {
    rafId = null
    if (destroyed || !geometry) return
    const continuous = lastFrame !== 0
    const dt = continuous ? now - lastFrame : 16.7
    lastFrame = now
    if (!visible) {
      lastFrame = 0
      return
    }
    if (continuous) watchFrameTimes(now, dt)
    const t0 = performance.now()
    let again = false
    const target = scrollTarget()
    if (intro) {
      if (intro.start === null) intro.start = now
      if (cfg.draw === 'scroll') intro.to = Math.max(intro.to, target)
      const t = Math.min(1, (now - intro.start) / intro.dur)
      drawnLen = Math.max(drawnLen, intro.from + (intro.to - intro.from) * easeInkOut(t))
      if (t >= 1) intro = null
      else again = true
    } else if (tier !== 'C') drawnLen = Math.max(drawnLen, target)
    applyDrawn()

    // Coco folgt der Lesezeile auf der gezeichneten Linie, geglättet: 1 − (1 − 0.35)^(dt/16.7).
    // Bei reduzierter Bewegung bleibt sie an ihrem Ruheplatz (§9.11).
    const cocoTarget = motion === 'reduced' ? restLen() : Math.min(target, drawnLen)
    const diff = cocoTarget - cocoLen
    let moving = !!intro
    if (Math.abs(diff) > COCO_JUMP || Math.abs(diff) < 0.1) cocoLen = cocoTarget
    else {
      cocoLen += diff * (1 - Math.pow(0.65, dt / 16.7))
      again = moving = true
    }
    emitCoco(diff < 0 ? -1 : 1, moving)
    probe?.frame?.(t0, performance.now())
    if (again) requestFrame()
    else lastFrame = 0
  }

  /** Laufzeit-Abstufung A → B (§9.4): > 25 % der Frames > 20 ms in den ersten 2 s Scroll-Aktivität. */
  function watchFrameTimes(now: number, dt: number) {
    if (tier !== 'A' || monitor.done || now - lastScrollAt > 100) return
    monitor.active += dt
    monitor.frames++
    if (dt > DOWNGRADE.slowFrameMs) monitor.slow++
    if (monitor.active < DOWNGRADE.windowMs) return
    monitor.done = true
    if (
      monitor.frames >= DOWNGRADE.minFrames &&
      monitor.slow / monitor.frames > DOWNGRADE.maxSlowShare
    ) {
      downgraded = true // nur im Speicher, kein Storage (E-43)
      tier = 'B'
      render()
    }
  }

  // ---------- Aufbau und Neuaufbau ----------

  function build(first: boolean) {
    const t0 = performance.now()
    const prevStations = geometry?.stations ?? []
    const prevTotal = geometry?.totalLength ?? 0
    const prevDrawn = drawnLen
    m = measure(root, options.preset)
    geometry = buildGeometry({ preset: options.preset, seed, ...m.input })
    tier = chooseTier()
    render()
    const total = geometry.totalLength
    const target = scrollTarget()
    intro = null
    if (tier === 'C') drawnLen = total
    else if (first) {
      if (cfg.draw === 'scroll' && !(cfg.intro && m.scrollY < 8)) drawnLen = target
      else {
        // Intro (journey, MI-10) bzw. einmaliges Zeichnen; Einstieg mitten in der Seite ohne Animation.
        drawnLen = 0
        intro = { from: 0, to: target, start: null, dur: cfg.durationMs ?? 900 }
      }
    } else {
      // Gezeichneter Fortschritt bleibt je Station erhalten.
      let keep = 0
      if (prevTotal > 0 && prevDrawn >= prevTotal - 0.5) keep = total
      else {
        const done = prevStations.filter((s) => s.loopLen1 <= prevDrawn).length
        if (done > 0)
          keep = geometry.stations[Math.min(done, geometry.stations.length) - 1]?.loopLen1 ?? 0
      }
      drawnLen = Math.min(total, Math.max(target, keep))
    }
    cocoLen = motion === 'reduced' ? restLen() : intro ? 0 : Math.min(target, drawnLen)
    applyDrawn()
    emitCoco(1, !!intro)
    probe?.build?.(t0, performance.now())
    if (intro) requestFrame()
  }

  function scheduleRebuild() {
    if (destroyed) return
    if (debounce !== null) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      if (win.requestIdleCallback) {
        idleId = win.requestIdleCallback(
          () => {
            idleId = null
            rebuild()
          },
          { timeout: 300 },
        )
      } else
        idleTimer = setTimeout(() => {
          idleTimer = null
          rebuild()
        }, 1)
    }, REBUILD_DEBOUNCE_MS)
  }

  function rebuild() {
    if (destroyed) return
    rebuildCount++
    build(false)
  }

  // ---------- Ereignisse ----------

  const onScroll = () => {
    lastScrollAt = performance.now()
    requestFrame()
  }
  const onResize = () => {
    if (!m) return
    if (
      win.innerWidth !== m.innerWidth ||
      Math.abs(win.innerHeight - m.innerHeight) >= MIN_VIEWPORT_DH
    )
      scheduleRebuild()
  }
  const onLoad = () => scheduleRebuild()

  const container = root.parentElement ?? root
  let lastSize: { w: number; h: number } | null = null
  const resizeObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => {
          const r = entries[entries.length - 1]?.contentRect
          if (!r) return
          const prev = lastSize
          lastSize = { w: r.width, h: r.height }
          if (prev && (Math.abs(r.width - prev.w) >= 1 || Math.abs(r.height - prev.h) >= 24))
            scheduleRebuild()
        })
      : null
  const intersectionObserver =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          const e = entries[entries.length - 1]
          if (!e) return
          visible = e.isIntersecting
          if (visible) requestFrame()
        })
      : null

  build(true)
  win.addEventListener('scroll', onScroll, { passive: true })
  win.addEventListener('resize', onResize, { passive: true })
  if (doc.readyState !== 'complete') win.addEventListener('load', onLoad, { once: true })
  resizeObserver?.observe(container)
  intersectionObserver?.observe(root)
  if (doc.fonts && doc.fonts.status === 'loading')
    void doc.fonts.ready.then(() => {
      if (!destroyed) scheduleRebuild()
    })

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      if (rafId !== null) win.cancelAnimationFrame(rafId)
      if (debounce !== null) clearTimeout(debounce)
      if (idleTimer !== null) clearTimeout(idleTimer)
      if (idleId !== null) win.cancelIdleCallback?.(idleId)
      rafId = debounce = idleTimer = idleId = null
      win.removeEventListener('scroll', onScroll)
      win.removeEventListener('resize', onResize)
      win.removeEventListener('load', onLoad)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      root.replaceChildren()
      views = []
      geometry = null
      m = null
    },
    rebuild() {
      if (debounce !== null) clearTimeout(debounce)
      debounce = null
      rebuild()
    },
    setMotion(next: Motion) {
      if (destroyed || next === motion) return
      motion = next
      rebuild()
    },
    inspect: () => ({
      preset: options.preset,
      geometry,
      drawnLen,
      cocoLen,
      tier,
      rebuildCount,
      pose,
    }),
    setReadingY(y: number | null) {
      readingOverride = y
      requestFrame()
    },
    setProbe(next: LeashProbe | null) {
      probe = next
    },
  }
}
