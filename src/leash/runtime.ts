import { easeInkOut } from './easing'
import { buildGeometry, geometrySteps, mapReadingY, pointAt } from './geometry'
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
import type {
  LeashGeometry,
  LeashHandle,
  LeashSegment,
  LeashStroke,
  PresetId,
  SpritePose,
} from './types'

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
  /** Zuletzt erreichte Station (Choreografie §11.4); `inside`: Coco steht noch im Stationsbereich. */
  station: { id: string; pose: SpritePose; len0: number; len1: number; inside: boolean } | null
  /** Intro (MI-10) läuft. */
  intro: boolean
  /** Rinne in Koordinaten der Linien-Ebene `[links, rechts]` (Coco-Box bleibt darin, solange die Spitze darin liegt). */
  gutter: [number, number] | null
}

export interface MountOptions {
  preset: PresetId
  /** Routen-Schlüssel ohne Sprache – Seed der Linie (`fnv1a32(`${preset}:${routeKey}`)`). */
  routeKey: string
  /** Anfangszustand; sonst `getMotion()`. Änderungen kommen über `setMotion`. */
  motion?: Motion
  /** Coco-Anbindung (P2.18, `src/leash/coco.ts`): Position der Leinenspitze je Frame. */
  onCoco?: (state: CocoState) => void
  /** Tatsächlich gezeigte Pose der Coco-Steuerung (mit Brücken); sonst die Ziel-Pose. */
  cocoPose?: () => SpritePose | null
  /** Erster Aufbau in Idle-Teilstücken (Standard `true`); `false` baut beim Einhängen in einem Zug (Tests). */
  stepwise?: boolean
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

/** Posenwechsel für den Frame-Logger der Debug-Schnittstelle (KUNST-QA §3.1); ohne Debug-Build nie gesetzt. */
export interface LeashProbe {
  pose?(entry: { t: number; from: SpritePose | null; to: SpritePose; bridge: string | null }): void
}

/**
 * User-Timing-Messungen der Engine (KUNST-QA PF-03/PF-04, DESIGN §9.10): `leash:build` je Aufbau, `leash:frame` je
 * Frame – immer, auch im Produktions-Build. Sie sind keine Test-Schnittstelle im Sinne von DESIGN §9.13 (kein
 * globales Debug-Objekt, nichts steuerbar, nichts verlässt den Browser), sondern Standard-Messpunkte wie in den
 * DevTools; so misst `@perf` im Job `quality` den ausgelieferten Code. Leser nutzen einen `PerformanceObserver`
 * (`type: 'measure'`): Der Puffer wird nach {@link FRAME_MEASURE_CAP} Frame-Messungen geleert, damit er bei langem
 * Scrollen nicht wächst.
 */
export const LEASH_MEASURES = { build: 'leash:build', frame: 'leash:frame' } as const
export const FRAME_MEASURE_CAP = 600

export interface InspectableLeashHandle extends LeashHandle {
  inspect(): LeashDebugState
  /** Debug: Lesezeile fest setzen (px relativ zur Linien-Ebene, wie `scrollMap.readingY`); `null` = wieder Scroll. */
  setReadingY(y: number | null): void
  setProbe(probe: LeashProbe | null): void
  /** Ruft `cb` auf, sobald der erste Aufbau steht (sofort, wenn er schon steht). */
  whenBuilt(cb: () => void): void
  /** Posenwechsel der Coco-Steuerung an den Frame-Logger melden (mit Brücke). */
  notePose(entry: {
    t: number
    from: SpritePose | null
    to: SpritePose
    bridge: string | null
  }): void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Debounce des Neuaufbaus (§9.10). */
const REBUILD_DEBOUNCE_MS = 150
/** Viewport-Höhenänderungen darunter lösen keinen Neuaufbau aus (mobile Adressleiste, §9.6). */
const MIN_VIEWPORT_DH = 120
/** Eintrittslinie der Kartenreihen (`shopString`): Anteil der Viewport-Höhe von oben (§9.7, IO-Schwelle ≈ 0.3). */
const ROW_ENTER_LINE = 0.95
/** Rechenzeit je Idle-Teilstück des Aufbaus (ms, ungedrosselt; mindestens ein Schritt je Teilstück). */
const STEP_BUDGET_MS = 4
/** Coco springt statt zu rennen, wenn sie weiter zurückliegt (§9.6). */
const COCO_JUMP = 300

type SegState = 'future' | 'active' | 'done'

/** Stufe A: ein Strich-Stück (bzw. Tintenpunkt) mit Dash-Enthüllung. */
interface StrokeView {
  el: SVGPathElement
  L: number
  len0: number
  len1: number
}

interface SegView {
  svg: SVGSVGElement
  /** Erstes Element des Segments (Stufe B/C: der Pfad; Stufe A: erstes Strich-Stück). */
  ink: SVGPathElement
  /** Sichtbarer Strich mit Dash-Enthüllung (B); `null` bei A und C. */
  reveal: SVGPathElement | null
  /** Stufe A: Strich-Stücke und Tintenpunkte, nach Bogenlänge sortiert, mit Zeiger auf das erste nicht fertige. */
  strokes: StrokeView[] | null
  next: number
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
  let frameMeasures = 0

  function timing(name: string, start: number) {
    try {
      performance.measure(name, { start, end: performance.now() })
    } catch {
      // `performance.measure` mit Optionen fehlt (alte Engines) – dann ohne Messung.
    }
  }

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

  /** Stufe A: Strich-Stück als runder Strich mit Dash-Enthüllung (anfangs verborgen). */
  function strokeView(st: LeashStroke): StrokeView {
    const el = doc.createElementNS(SVG_NS, 'path')
    el.setAttribute('d', st.d)
    el.setAttribute('class', 'ink')
    el.setAttribute('stroke-width', String(st.w))
    // Farbe, Kappen und Füllung stehen einmal am `<svg>` (Vererbung) – kürzeres DOM (PF-10)
    el.setAttribute('stroke-dasharray', String(st.L))
    // verborgen: Dash samt runder Kappe vor dem Pfadanfang
    el.setAttribute('stroke-dashoffset', String(st.L + 0.5))
    return { el, L: st.L, len0: st.len0, len1: st.len1 }
  }

  /** SVG eines Segments in der gewählten Stufe (noch nicht eingehängt). */
  function segmentView(seg: LeashSegment, t: Tier, bw: number, forced: boolean): SegView {
    const base = {
      L: 0,
      len0: seg.len0,
      len1: seg.len1,
      state: null,
      strokes: null,
      next: 0,
    }
    if (t === 'C') {
      // Stufe C über den statischen Renderer (§9.4, §9.11): Umriss ohne Maske, vollständig.
      const { svg, ink } = staticSegmentSvg(doc, seg, forced)
      return { svg, ink, reveal: null, ...base }
    }
    const svg = segmentSvg(doc, seg)
    if (t === 'A' && seg.strokes?.length) {
      // Stufe A „Tusche“: Stücke nahezu gleicher Breite, je ein runder Strich; Enthüllung per Dash (nur Paint).
      const strokes: StrokeView[] = []
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      svg.style.stroke = forced ? 'CanvasText' : 'var(--ink)'
      for (const st of seg.strokes) {
        const v = strokeView(st)
        svg.appendChild(v.el)
        strokes.push(v)
      }
      return { svg, ink: strokes[0]!.el, reveal: null, ...base, strokes }
    }
    const ink = doc.createElementNS(SVG_NS, 'path')
    ink.setAttribute('d', seg.centerD)
    ink.setAttribute('fill', 'none')
    ink.setAttribute('stroke-width', String(bw))
    ink.setAttribute('stroke-linecap', 'round')
    ink.setAttribute('stroke-linejoin', 'round')
    ink.setAttribute('class', 'ink')
    ink.style.stroke = forced ? 'CanvasText' : 'var(--ink)'
    // Länge aus der Geometrie (Polylinie, ohne getTotalLength – kein erzwungenes Layout beim Aufbau, PF-04/PF-05).
    const L = seg.centerL ?? seg.len1 - seg.len0
    ink.style.strokeDasharray = `${L} ${L}`
    ink.style.strokeDashoffset = String(L)
    svg.appendChild(ink)
    return { svg, ink, reveal: ink, ...base, L }
  }

  const forcedColors = () => !!win.matchMedia?.('(forced-colors: active)').matches

  /** Schreibphase: alle Segmente auf einmal einhängen. */
  function render() {
    if (!geometry || !m) return
    const bw = m.input.baseWidth
    const forced = forcedColors()
    views = geometry.segments.map((seg) => segmentView(seg, tier, bw, forced))
    const frag = doc.createDocumentFragment()
    for (const v of views) frag.appendChild(v.svg)
    root.replaceChildren(frag)
    armStations()
  }

  /**
   * `data-leash-armed` an den Stations-Ankern, solange ihr Effekt (MI-13 „zieht ein“) noch aussteht: Die Zeichnung ist
   * bis zur Ankunft der Linie verborgen. Nur mit Tinte in Bewegung (Stufe A/B); Stufe C und reduzierte Bewegung
   * zeigen alles sofort.
   */
  function armStations() {
    const scope = root.parentElement ?? doc
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>('[data-leash-station]'))) {
      if (tier !== 'C' && !reached.has(el.dataset.leashStation ?? ''))
        el.setAttribute('data-leash-armed', '')
      else el.removeAttribute('data-leash-armed')
    }
  }

  /**
   * `data-leash-drawn` an der Linien-Ebene, sobald die Linie vollständig steht (Ende der einmaligen Zeichnung bzw.
   * Stufe C) – Signal für Folgebewegungen wie das Schwingen der losen Leine (MI-11, Modul `lost`).
   */
  let drawnFlag = false
  function flagDrawn() {
    const full = !!geometry && drawnLen >= geometry.totalLength - 0.5
    if (full === drawnFlag) return
    drawnFlag = full
    if (full) root.setAttribute('data-leash-drawn', '')
    else root.removeAttribute('data-leash-drawn')
  }

  /**
   * `data-leash-reached` an jedem Stations-Anker, den die gezeichnete Linie erreicht hat (einmalig, nie zurückgesetzt
   * beim Hochscrollen) – Auslöser für Stations-Effekte wie die Stationsmarke „pop“ (MI-12).
   */
  const reached = new Set<string>()
  function flagStations() {
    if (!geometry || reached.size >= geometry.stations.length) return
    for (const st of geometry.stations) {
      // Planet-Marke der Kopf-Station „pop“ beim Schließen des Orbits (§11.4), sonst bei Ankunft am Stationsanfang
      if (reached.has(st.id) || drawnLen < (st.id === 'planet-claire' ? st.loopLen1 : st.loopLen0))
        continue
      reached.add(st.id)
      const scope = root.parentElement ?? doc
      for (const el of Array.from(scope.querySelectorAll<HTMLElement>('[data-leash-station]'))) {
        if (el.dataset.leashStation !== st.id) continue
        el.setAttribute('data-leash-reached', '')
        el.removeAttribute('data-leash-armed')
      }
    }
  }

  /** Stufe A: Stücke bis `drawnLen` sichtbar, das Stück an der Feder anteilig (nur `stroke-dashoffset`). */
  function applyStrokes(v: SegView) {
    const strokes = v.strokes!
    while (v.next < strokes.length && strokes[v.next]!.len1 <= drawnLen) {
      strokes[v.next]!.el.style.strokeDashoffset = '0'
      v.next++
    }
    const st = strokes[v.next]
    if (st && drawnLen > st.len0)
      st.el.style.strokeDashoffset = String(st.L * (1 - (drawnLen - st.len0) / (st.len1 - st.len0)))
  }

  /**
   * Segment-Zustände: fertig, aktiv (Dash aktualisiert), zukünftig (unsichtbar). Im Scroll-Pfad ändern sich nur
   * `stroke-dashoffset` und `visibility` – beides ohne Layout (KUNST-QA PF-05).
   */
  function applyDrawn() {
    flagDrawn()
    flagStations()
    for (const v of views) {
      const span = v.len1 - v.len0
      const p = tier === 'C' ? 1 : span > 0 ? (drawnLen - v.len0) / span : 1
      const state: SegState = p >= 1 - 1e-6 ? 'done' : p <= 0 ? 'future' : 'active'
      if (state !== v.state) {
        v.svg.style.visibility = state === 'future' ? 'hidden' : ''
        if (state === 'done' && v.reveal) {
          v.reveal.style.strokeDasharray = ''
          v.reveal.style.strokeDashoffset = ''
        }
        v.state = state
      }
      if (v.strokes && state !== 'future') applyStrokes(v)
      else if (state === 'active' && v.reveal)
        v.reveal.style.strokeDashoffset = String(v.L * (1 - p))
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
    const rows = cfg.draw === 'rowEnter'
    if (cfg.draw !== 'scroll' && !rows) return geometry.totalLength
    if (readingOverride === null && m.maxScroll > 0 && win.scrollY >= m.maxScroll - 2)
      return geometry.totalLength
    // Kartenreihen (§9.7): Reihe gilt als eingetreten, wenn ihre Schnur die Eintrittslinie erreicht.
    return mapReadingY(
      geometry.scrollMap,
      rows
        ? (readingOverride ?? win.scrollY + ROW_ENTER_LINE * m.innerHeight - m.rootTop)
        : readingY(),
    )
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

  /** Letzte Station, deren Anfang Coco erreicht hat (Choreografie §11.4: Verweil-Timer, Sprung ab `loopLen1`). */
  function stationState(): CocoState['station'] {
    if (!geometry) return null
    let st: LeashGeometry['stations'][number] | undefined
    for (const x of geometry.stations) if (cocoLen >= x.loopLen0 - 2) st = x
    return st
      ? {
          id: st.id,
          pose: st.pose,
          len0: st.loopLen0,
          len1: st.loopLen1,
          inside: cocoLen <= st.loopLen1 + 2,
        }
      : null
  }

  /** Rinne `[links, rechts]` (Linien-Ebene) – Mitte der Rinne = Anfang der Linie (§5.3). */
  function gutterBounds(): [number, number] | null {
    const start = m?.input.anchors.find((a) => a.kind === 'start')
    if (!m || !start || cfg.rail !== 'center') return null
    return [start.x - m.input.gutter / 2, start.x + m.input.gutter / 2]
  }

  function emitCoco(direction: 1 | -1, moving: boolean) {
    const next = targetPose(moving)
    if (next !== pose && next) {
      if (!options.cocoPose)
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
      station: stationState(),
      intro: !!intro,
      gutter: gutterBounds(),
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
      if (cfg.draw === 'scroll' || cfg.draw === 'rowEnter') intro.to = Math.max(intro.to, target)
      const t = Math.min(1, (now - intro.start) / intro.dur)
      drawnLen = Math.max(drawnLen, intro.from + (intro.to - intro.from) * easeInkOut(t))
      if (t >= 1) intro = null
      else again = true
    } else if (tier !== 'C') {
      if (cfg.draw === 'rowEnter' && target > drawnLen + 0.5) {
        // Neue Reihe im Sichtbereich: ihre Schnur zeichnet sich in `durationMs` (500 ms, `--ease-ink-out`).
        intro = { from: drawnLen, to: target, start: now, dur: 500 }
        again = true
      } else drawnLen = Math.max(drawnLen, target)
    }
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
    timing(LEASH_MEASURES.frame, t0)
    if (++frameMeasures >= FRAME_MEASURE_CAP) {
      frameMeasures = 0
      performance.clearMeasures?.(LEASH_MEASURES.frame)
    }
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
      applyDrawn()
    }
  }

  // ---------- Aufbau und Neuaufbau ----------

  const builtCallbacks: (() => void)[] = []
  let built = false
  /** Laufender Aufbau in Teilstücken (abbrechbar). */
  let stepped: { cancel(): void } | null = null

  /** Schreibphase nach Messung und Geometrie: Stufe, SVG, gezeichnete Länge, Coco, Intro. */
  function finishBuild(first: boolean, mm: Measurement, geo: LeashGeometry, t0: number) {
    const prevStations = geometry?.stations ?? []
    const prevTotal = geometry?.totalLength ?? 0
    const prevDrawn = drawnLen
    m = mm
    geometry = geo
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
    timing(LEASH_MEASURES.build, t0)
    if (intro) requestFrame()
    if (!built) {
      built = true
      for (const cb of builtCallbacks.splice(0)) cb()
    }
  }

  /** Aufbau in einem Zug (Tests, `rebuild()`, Bewegungswechsel, Browser ohne `requestIdleCallback`). */
  function build(first: boolean) {
    stepped?.cancel()
    stepped = null
    const t0 = performance.now()
    const mm = measure(root, options.preset)
    finishBuild(first, mm, buildGeometry({ preset: options.preset, seed, ...mm.input }), t0)
  }

  /**
   * Aufbau in Idle-Teilstücken (DESIGN §9.10, KUNST-QA PF-04): Lesephase, dann die Geometrie Schritt für Schritt
   * (höchstens {@link STEP_BUDGET_MS} je Teilstück, mindestens ein Schritt), zuletzt die Schreibphase. Jedes Teilstück
   * ist eine eigene `leash:build`-Messung; so bleibt bei 4× Drosselung jedes unter 50 ms.
   */
  function buildStepped(first: boolean) {
    const ric = win.requestIdleCallback
    if (!ric) return build(first)
    stepped?.cancel()
    let cancelled = false
    let handle: number | null = null
    const next = (fn: () => void) => {
      handle = ric.call(
        win,
        () => {
          handle = null
          if (!cancelled && !destroyed) fn()
        },
        { timeout: 300 },
      )
    }
    stepped = {
      cancel() {
        cancelled = true
        if (handle !== null) win.cancelIdleCallback?.(handle)
      },
    }
    const job = stepped
    const t0 = performance.now()
    const mm = measure(root, options.preset)
    timing(LEASH_MEASURES.build, t0)
    const steps = geometrySteps({ preset: options.preset, seed, ...mm.input })
    const run = () => {
      const t1 = performance.now()
      let r = steps.next()
      while (!r.done && performance.now() - t1 < STEP_BUDGET_MS) r = steps.next()
      timing(LEASH_MEASURES.build, t1)
      if (!r.done) return next(run)
      const geo = r.value.geometry
      next(() => {
        if (stepped === job) stepped = null
        finishBuild(first, mm, geo, performance.now())
      })
    }
    next(run)
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
            rebuild(true)
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

  function rebuild(stepwise = false) {
    if (destroyed) return
    rebuildCount++
    if (stepwise && options.stepwise !== false) buildStepped(false)
    else build(false)
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

  if (options.stepwise === false) build(true)
  else buildStepped(true)
  win.addEventListener('scroll', onScroll, { passive: true })
  win.addEventListener('resize', onResize, { passive: true })
  if (doc.readyState !== 'complete') win.addEventListener('load', onLoad, { once: true })
  resizeObserver?.observe(container)
  intersectionObserver?.observe(root)
  if (doc.fonts && doc.fonts.status === 'loading')
    void doc.fonts.ready.then(() => {
      if (!destroyed) scheduleRebuild()
    })
  // Schriften kommen erst nach dem ersten Bild (Schriften-Tor, DESIGN §4.1) – jeder spätere Tausch misst neu.
  doc.fonts?.addEventListener?.('loadingdone', onLoad)

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      stepped?.cancel()
      stepped = null
      if (rafId !== null) win.cancelAnimationFrame(rafId)
      if (debounce !== null) clearTimeout(debounce)
      if (idleTimer !== null) clearTimeout(idleTimer)
      if (idleId !== null) win.cancelIdleCallback?.(idleId)
      rafId = debounce = idleTimer = idleId = null
      win.removeEventListener('scroll', onScroll)
      win.removeEventListener('resize', onResize)
      win.removeEventListener('load', onLoad)
      doc.fonts?.removeEventListener?.('loadingdone', onLoad)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      root.replaceChildren()
      root.removeAttribute('data-leash-drawn')
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
      pose: options.cocoPose?.() ?? pose,
    }),
    setReadingY(y: number | null) {
      readingOverride = y
      requestFrame()
    },
    setProbe(next: LeashProbe | null) {
      probe = next
    },
    notePose(entry) {
      probe?.pose?.(entry)
    },
    whenBuilt(cb) {
      if (built) cb()
      else builtCallbacks.push(cb)
    },
  }
}
