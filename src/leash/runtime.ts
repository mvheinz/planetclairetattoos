import { easeInkOut } from './easing'
import { geometrySteps, mapReadingY, pointAt } from './geometry'
import { measure, type Measurement } from './measure'
import { getMotion, type Motion } from './motion'
import {
  COCO_MAX_SPEED,
  COCO_WALK_SPEED,
  DOWNGRADE,
  PRESET_CONFIG,
  READING_LINE,
  REST_POSE,
  isStaticPreset,
} from './presets'
import { fnv1a32 } from './random'
import { SVG_NS, segmentSvg, staticSegmentSvg } from './static'
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
  gutter: [number, number, number] | null
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

/** Strichlänge und Lücke der Enthüllung in px: größer als jedes Strich-Stück, Versatz `DASH − sichtbare Länge`. */
const DASH = 2000
/** Debounce des Neuaufbaus (§9.10). */
const REBUILD_DEBOUNCE_MS = 150
/** Viewport-Höhenänderungen darunter lösen keinen Neuaufbau aus (mobile Adressleiste, §9.6). */
const MIN_VIEWPORT_DH = 120
/**
 * Rechenzeit je Idle-Teilstück des Aufbaus (ms, ungedrosselt; mindestens ein Schritt je Teilstück, ein weiterer nur, wenn
 * er – geschätzt wie der vorige – noch hineinpasst).
 */
const STEP_BUDGET_MS = 1
/** Coco springt statt zu rennen, wenn sie weiter zurückliegt (§9.6). */
const COCO_JUMP = 300

type SegState = 'future' | 'active' | 'done'

/** Stufe A: ein Strich-Stück (bzw. Tintenpunkt) mit Dash-Enthüllung. */
interface StrokeView {
  el: SVGPathElement
  len0: number
  len1: number
}

/** Vorab erzeugte Ansichten samt Stufe/Farbmodus, für die sie gelten (`work`, `render`). */
interface Prebuilt {
  tier: Tier
  forced: boolean
  views: SegView[]
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
  cancelIdleCallback?: (id?: number) => void
}

export function mountLeash(root: HTMLElement, options: MountOptions): InspectableLeashHandle {
  const doc = root.ownerDocument
  const win = (doc.defaultView ?? window) as IdleWin
  const cfg = PRESET_CONFIG[options.preset]
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
  let lastSY = -1
  let lastScrollAt = -Infinity
  let intro: { from: number; to: number; start: number | null; dur: number } | null = null
  /** U-68: bis hierhin läuft Coco nach dem Intro allein und ohne Sprung (Rest einer beim Laden begonnenen Schlaufe). */
  let walkTo = 0
  let debounce: ReturnType<typeof setTimeout> | null = null
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
    if (forcedColors()) return 'C'
    if (downgraded) return 'B'
    const nav = win.navigator as Navigator & { deviceMemory?: number }
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return 'B'
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return 'B'
    return 'A'
  }

  // ---------- SVG-Aufbau: eine Schreibphase ----------

  /**
   * Stufe A: Strich-Stück als runder Strich. Dash-Muster und „verborgen“ stehen einmal am `<svg>` (`stroke-dasharray`
   * `2000 2000` in px, `stroke-dashoffset` 2000 – vererbt; kein `pathLength` je Stück): kürzeres DOM (PF-10), und im Scroll-Pfad ändert sich nur
   * `stroke-dashoffset` (kein Layout, PF-05; Einhängen oder Entfernen von Dash-Attributen würde eines auslösen).
   */
  function strokeView(st: LeashStroke): StrokeView {
    const el = doc.createElementNS(SVG_NS, 'path')
    el.setAttribute('d', st.d)
    el.setAttribute('stroke-width', String(st.w))
    return { el, len0: st.len0, len1: st.len1 }
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
      // Füllung, runde Enden/Ecken, Farbe und Dash-Muster (`DASH`) stehen in global.css (`[data-leash-seg].lx`, PF-10:
      // 13 Segmente × Attribute); erzwungene Farben dort per Media-Query.
      svg.setAttribute('class', 'lx')
      svg.setAttribute('stroke-dashoffset', String(DASH))
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

  /** Schreibphase: alle Segmente auf einmal einhängen (die Ansichten entstehen vorab in Teilstücken, `work`). */
  function render(pre?: Prebuilt) {
    if (!geometry || !m) return
    const forced = forcedColors()
    views =
      pre && pre.tier === tier && pre.forced === forced
        ? pre.views
        : geometry.segments.map((seg) => segmentView(seg, tier, m!.input.baseWidth, forced))
    const frag = doc.createDocumentFragment()
    for (const v of views) frag.appendChild(v.svg)
    root.replaceChildren(frag)
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
      }
    }
  }

  /**
   * Stufe A: Stücke bis `drawnLen` fertig (Versatz 0), das Stück an der Feder anteilig (nur `stroke-dashoffset`); beim
   * Zurückwickeln (U-74) werden Stücke hinter der Feder wieder verborgen.
   */
  function applyStrokes(v: SegView) {
    const strokes = v.strokes!
    while (v.next < strokes.length && strokes[v.next]!.len1 <= drawnLen)
      strokes[v.next++]!.el.setAttribute('stroke-dashoffset', '0')
    const was = v.next
    while (v.next > 0 && strokes[v.next - 1]!.len1 > drawnLen)
      strokes[--v.next]!.el.setAttribute('stroke-dashoffset', String(DASH))
    if (v.next < was) strokes[was]?.el.setAttribute('stroke-dashoffset', String(DASH))
    const st = strokes[v.next]
    if (st)
      st.el.setAttribute(
        'stroke-dashoffset',
        String(Math.round((DASH - Math.max(0, drawnLen - st.len0)) * 10) / 10),
      )
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
        // U-74: zurückgewickelt – fertiges Segment wieder enthüllbar, verborgenes Segment von vorn
        if (v.state === 'done') {
          if (v.reveal) v.reveal.style.strokeDasharray = `${v.L} ${v.L}`
          if (v.strokes) {
            v.svg.setAttribute('stroke-dashoffset', String(DASH))
            v.next = 0
          }
        } else if (state === 'future' && v.strokes) {
          for (const x of v.strokes.slice(0, v.next + 1))
            x.el.setAttribute('stroke-dashoffset', String(DASH))
          v.next = 0
        }
        if (state === 'done' && v.reveal) {
          v.reveal.style.strokeDasharray = ''
          v.reveal.style.strokeDashoffset = ''
        }
        if (state === 'done' && v.strokes) {
          // ganzes Segment fertig: Versatz 0 am `<svg>`, Stücke erben ihn (kürzeres DOM, PF-10)
          v.svg.setAttribute('stroke-dashoffset', '0')
          for (const x of v.strokes) x.el.removeAttribute('stroke-dashoffset')
        }
        v.state = state
      }
      // nur das Segment an der Feder: fertige erben den Versatz 0 vom `<svg>` (ohne eigene Werte, U-74 Zurückwickeln)
      if (v.strokes && state === 'active') applyStrokes(v)
      else if (state === 'active' && v.reveal)
        v.reveal.style.strokeDashoffset = String(v.L * (1 - p))
    }
  }

  // ---------- Scroll-Kopplung (§9.6) ----------

  function readingY(scrollY = win.scrollY): number {
    if (readingOverride !== null) return readingOverride
    if (!m) return 0
    return scrollY + READING_LINE * m.innerHeight - m.rootTop
  }

  /**
   * Ziel-Länge zur Scroll-Position. `scrollY` liest im Frame (vor allen Schreibzugriffen) `window.scrollY`; die
   * Schreibphase des Aufbaus übergibt die gemessene Position, denn `scrollY` nach dem Einhängen der Segmente erzwingt
   * ein Layout der ganzen Seite (KUNST-QA PF-04/PF-05).
   */
  function scrollTarget(scrollY = win.scrollY): number {
    if (!geometry || !m) return 0
    if (cfg.draw !== 'scroll') return geometry.totalLength
    if (readingOverride === null && m.maxScroll > 0 && scrollY >= m.maxScroll - 2)
      return geometry.totalLength
    return mapReadingY(geometry.scrollMap, readingY(scrollY))
  }

  /**
   * Ruheplatz bei reduzierter Bewegung: erste Station (`journey`/`about`, §9.11), sonst Linienanfang. Coco sitzt 48 px
   * hinter dem Ende der Schlaufe (`loopLen1`), nicht am Beginn und nicht am Ring der Planeten-Marke (R3-06-01, R3-07-01).
   */
  function restLen(): number {
    const s = geometry?.stations[0]
    return s ? s.loopLen1 + 48 : 0
  }

  /**
   * U-68: das Intro zeichnet höchstens bis zum Anfang der Schlaufe, in der `len` liegt, und nie über eine schon beim Laden
   * begonnene Umrundung hinaus (auch nicht, wenn man währenddessen scrollt oder der Bildschirm sehr hoch ist) – den Rest
   * läuft Coco allein. Umrundungen weiter unten hängen am Scrollen und bremsen das Intro nicht.
   * Einmalige Zeichnungen (404, Danke) zeichnen weiter in einem Zug.
   */
  function introEnd(len: number): number {
    if (cfg.draw === 'scroll')
      for (const s of geometry?.stations ?? [])
        if (s.loopLen0 < len && (len <= s.loopLen1 || (s.loop === 'contour' && s.y < readingY(0))))
          return s.loopLen0
    return len
  }

  /** Ziel-Pose (§10.3, §10.6): reduziert → Ruhe-Pose; in Bewegung `rennen`; an einer Station deren Pose. */
  function targetPose(moving: boolean): SpritePose | null {
    if (!restPose) return null
    if (motion === 'reduced' || !geometry) return restPose
    if (moving) return 'rennen'
    const st = stationState()
    return (st?.inside && st.pose) || restPose
  }

  /** Letzte Station, deren Anfang Coco erreicht hat (Choreografie §11.4: Verweil-Timer, Sprung ab `loopLen1`). */
  function stationState(): CocoState['station'] {
    if (!geometry) return null
    let st: LeashGeometry['stations'][number] | undefined
    for (const x of geometry.stations) if (cocoLen >= x.loopLen0 - 2) st = x
    // Linienende = Station „Ende“ (DESIGN §11.4: `sitzen`) – auch ohne Station dort (Startseite seit U-50)
    const end = geometry.totalLength
    if (cocoLen >= end - 2 && !(st && cocoLen <= st.loopLen1 + 2))
      return { id: 'ende', pose: 'sitzen', len0: end, len1: end, inside: true }
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

  /**
   * Rinne `[links, rechts, Auslauf]` (Linien-Ebene) um die Rinnenmitte (§5.3; Shop-Listen beginnen neben der Rinne). Beim Orbit der Kopf-Station
   * endet sie am Planeten (die Marke steht vor der H1), Coco bleibt dort voll darin.
   */
  function gutterBounds(): [number, number, number] | null {
    if (!m || cfg.rail !== 'center') return null
    const x = m.input.railX ?? 0
    const g = m.input.gutter
    const st = stationState()
    const hero =
      st?.inside && st.id === 'planet-claire' && m.input.anchors.find((a) => a.id === st.id)
    return [x - g / 2, hero ? hero.x + hero.w : x + g / 2, hero ? 200 : 40]
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
      // Ebene aus dem Bild (z. B. Seitenende, nur der Fuß sichtbar): Coco kommt sofort an, statt unsichtbar
      // im Lauf stehenzubleiben – dann greift Ankunft/Ruhe wie gewohnt (MO-08, P14.14)
      const c = motion === 'reduced' ? restLen() : scrollTarget()
      if (!intro && Math.abs(c - cocoLen) >= 0.1) {
        cocoLen = c
        if (tier !== 'C') drawnLen = cfg.coco ? cocoLen : Math.max(drawnLen, c)
        applyDrawn()
        emitCoco(1, false)
      }
      return
    }
    if (continuous) watchFrameTimes(now, dt)
    const t0 = performance.now()
    let again = false
    const target = scrollTarget()
    // WebKit liefert Scroll-Ereignisse beim Wischen gedrosselt (≈ alle 150 ms): solange sich die Position ändert, im Takt weiterlaufen
    if (win.scrollY !== lastSY) {
      lastSY = win.scrollY
      again = true
    }
    if (intro) {
      if (intro.start === null) intro.start = now
      if (cfg.draw === 'scroll') intro.to = Math.max(intro.to, introEnd(target))
      const t = Math.min(1, (now - intro.start) / intro.dur)
      drawnLen = Math.max(drawnLen, intro.from + (intro.to - intro.from) * easeInkOut(t))
      if (t >= 1) intro = null
      else if (cfg.coco && target < drawnLen) {
        // U-74: im Intro hinter die schon gezeichnete Spitze hochgescrollt – Intro endet, die Leine wickelt sich auf
        intro = null
        drawnLen = Math.max(cocoLen, target)
      } else again = true
    }

    // Coco folgt der Lesezeile, geglättet: 1 − (1 − 0.35)^(dt/16.7); im Intro auf der schon gezeichneten Linie.
    // Bei reduzierter Bewegung bleibt sie an ihrem Ruheplatz (§9.11).
    const cocoTarget =
      motion === 'reduced' ? restLen() : intro ? Math.min(target, drawnLen) : target
    const diff = cocoTarget - cocoLen
    let moving = !!intro
    const walk = !intro && cocoLen < walkTo
    if (!intro && !walk) walkTo = 0 // angekommen: der Alleingang ist vorbei
    if ((Math.abs(diff) > COCO_JUMP && !walk) || Math.abs(diff) < 0.1) cocoLen = cocoTarget
    else {
      // U-55: geglättet, höchstens COCO_MAX_SPEED px/ms – Umrundungen werden nicht hektisch; U-68: allein im Schritttempo
      const max = (walk && now - lastScrollAt > 200 ? COCO_WALK_SPEED : COCO_MAX_SPEED) * dt
      cocoLen += Math.max(-max, Math.min(max, diff * (1 - Math.pow(0.65, dt / 16.7))))
      again = moving = true
    }
    // Coco läuft vorn und zieht die Tusche hinter sich her (U-44): die Linie wächst bis zu ihr, nie über sie hinaus; läuft
    // sie zurück (Hochscrollen), wickelt sich die Leine mit ihr auf (U-74).
    if (!intro && tier !== 'C')
      drawnLen = cfg.coco && diff < 0 ? cocoLen : Math.max(drawnLen, cfg.coco ? cocoLen : target)
    applyDrawn()
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
  /** Zeitpunkt der letzten Lesephase (für den Abgleich nach einem Aufbau in Teilstücken). */
  let measuredAt = 0
  /** Laufender Aufbau in Teilstücken (abbrechbar). */
  let stepped: { cancel(): void } | null = null

  /** Schreibphase nach Messung und Geometrie: Stufe, SVG, gezeichnete Länge, Coco, Intro. */
  function finishBuild(
    first: boolean,
    mm: Measurement,
    geo: LeashGeometry,
    pre: Prebuilt,
    t0: number,
  ) {
    const prevStations = geometry?.stations ?? []
    const prevTotal = geometry?.totalLength ?? 0
    const prevDrawn = drawnLen
    m = mm
    geometry = geo
    delete root.dataset.stale
    tier = chooseTier()
    render(pre)
    const total = geometry.totalLength
    // Gemessene Position statt `window.scrollY` (kein erzwungenes Layout); der nächste Frame gleicht nach.
    const target = scrollTarget(mm.scrollY)
    const running = intro
    const walking = cocoLen < walkTo
    const prevWalk = walkTo
    intro = null
    walkTo = 0
    if (tier === 'C') drawnLen = total
    else if (!first && (running || walking)) {
      // Neuaufbau mitten im Intro (z. B. späte Schrift) oder im Alleingang (U-68): weiterzeichnen statt zum Ziel zu
      // springen (R2-05)
      if (running) {
        running.to = introEnd(target)
        intro = running
      }
      // nur den Rest der begonnenen Schlaufe allein laufen – nicht bis zur inzwischen weiter gescrollten Lesezeile
      walkTo = Math.min(target, prevWalk)
      drawnLen = Math.min(total, prevDrawn)
    } else if (first) {
      if (cfg.draw === 'scroll' && !(cfg.intro && m.scrollY < 8)) drawnLen = target
      else {
        // Intro (journey, MI-10) bzw. einmaliges Zeichnen; Einstieg mitten in der Seite ohne Animation.
        drawnLen = 0
        intro = { from: 0, to: introEnd(target), start: null, dur: cfg.durationMs ?? 1800 }
        walkTo = target
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
      // mit Coco endet die Leine bei ihr (U-74), ohne Coco bleibt der Fortschritt je Station
      drawnLen = Math.min(total, cfg.coco ? target : Math.max(target, keep))
    }
    cocoLen = motion === 'reduced' ? restLen() : intro ? 0 : Math.min(target, drawnLen)
    applyDrawn()
    emitCoco(1, !!intro)
    timing(LEASH_MEASURES.build, t0)
    // Während eines Aufbaus in Teilstücken gescrollt: der nächste Frame gleicht die Länge an die aktuelle Position an.
    if (intro || lastScrollAt >= measuredAt) requestFrame()
    if (!built) {
      built = true
      for (const cb of builtCallbacks.splice(0)) cb()
    }
  }

  /**
   * Der Aufbau als Ablauf (DESIGN §9.10, KUNST-QA PF-04): Lesephase als eigenes Teilstück, dann die Geometrie Schritt
   * für Schritt und je Segment ein abgehängtes SVG (Stufe/Farben wie jetzt; die Schreibphase prüft, ob sie noch passen).
   */
  function* work(): Generator<boolean | void, [Measurement, LeashGeometry, Prebuilt], void> {
    measuredAt = performance.now()
    const mm = measure(root, options.preset)
    yield true
    const geo = (yield* geometrySteps({ preset: options.preset, seed, ...mm.input })).geometry
    // Ansichten (SVG-Knoten) je Segment in eigenen Teilstücken vorab; die Schreibphase hängt sie nur noch ein.
    const t = chooseTier()
    const forced = forcedColors()
    const vs: SegView[] = []
    for (const seg of geo.segments) {
      vs.push(segmentView(seg, t, mm.input.baseWidth, forced))
      yield
    }
    return [mm, geo, { tier: t, forced, views: vs }]
  }

  /**
   * Aufbau in einem Zug (Tests, `rebuild()`, Bewegungswechsel, Browser ohne `requestIdleCallback`) oder – `stepwise` –
   * in Idle-Teilstücken: die Lesephase erst im Idle-Callback (nach dem Rendern des Frames ist das Layout aktuell und das
   * Lesen billig), dann höchstens {@link STEP_BUDGET_MS} je Teilstück, zuletzt die Schreibphase (nur Einhängen). Jedes
   * Teilstück ist eine eigene `leash:build`-Messung: am Desktop ≤ 8 ms, bei 4× Drosselung jedes unter 50 ms.
   */
  function build(first: boolean, stepwise = false) {
    stepped?.cancel()
    stepped = null
    const t0 = performance.now()
    const steps = work()
    const ric = stepwise ? win.requestIdleCallback : undefined
    if (!ric) {
      let r = steps.next()
      while (!r.done) r = steps.next()
      return finishBuild(first, ...r.value, t0)
    }
    let cancelled = false
    let handle: number | undefined
    let frame: number | undefined
    const job = (stepped = {
      cancel() {
        cancelled = true
        win.cancelIdleCallback?.(handle)
        win.cancelAnimationFrame?.(frame!)
      },
    })
    const next = (fn: () => void) => {
      handle = ric.call(win, () => cancelled || destroyed || fn(), { timeout: 300 })
    }
    let primed = !win.requestAnimationFrame
    const run = () => {
      // Das erste Idle-Callback läuft oft direkt nach anderem Idle-Code, der den Stil unsauber hinterlassen hat (≈ 5 ms
      // Neuberechnung in der Lesephase, PF-04): erst einen Frame malen lassen, dann lesen.
      if (!primed) {
        primed = true
        frame = win.requestAnimationFrame(() => next(run))
        return
      }
      const t1 = performance.now()
      let r: ReturnType<typeof steps.next>
      let ts: number
      // Nächsten Schritt nur, wenn er (geschätzt wie der letzte) noch ins Budget passt – kein Überziehen.
      // (verstrichen + Dauer des letzten Schritts = 2·jetzt − Schrittbeginn − Teilstückbeginn)
      do {
        ts = performance.now()
        r = steps.next()
      } while (!r.done && !r.value && 2 * performance.now() - ts - t1 <= STEP_BUDGET_MS)
      timing(LEASH_MEASURES.build, t1)
      if (!r.done) return next(run)
      const v = r.value
      next(() => {
        if (stepped === job) stepped = null
        finishBuild(first, ...v, performance.now())
      })
    }
    next(run)
  }

  function scheduleRebuild() {
    if (destroyed) return
    root.dataset.stale = ''
    if (debounce !== null) clearTimeout(debounce)
    // Der Aufbau in Teilstücken wartet selbst auf den Idle-Callback (Lesephase nach dem Frame).
    debounce = setTimeout(() => {
      debounce = null
      rebuild(true)
    }, REBUILD_DEBOUNCE_MS)
  }

  function rebuild(stepwise = false) {
    if (destroyed) return
    rebuildCount++
    // Ersetzt der Neuaufbau einen noch nicht fertigen ersten Aufbau (z. B. `load` oder späte Bilder während der
    // Idle-Teilstücke), gilt er als erster – sonst fiele das Intro samt Alleingang der Coco (U-68) aus.
    build(!built, stepwise && options.stepwise !== false)
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

  build(true, options.stepwise !== false)
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
      rafId = debounce = null
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
