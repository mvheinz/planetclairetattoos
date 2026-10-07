import {
  COCO_ANCHORS,
  COCO_FRAMES,
  COCO_SPRITE_HREF,
  COCO_VIEWBOX,
  cocoHref,
  makeGroup,
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
/** Blickrichtung wechselt erst nach so vielen px Bogenlänge in neuer Richtung (DESIGN §11.4). */
export const FACING_PX = 24
/** Scrollstopp ab dieser Dauer außerhalb einer Station: `sitzen` (§11.4). */
export const REST_AFTER_MS = 1200
/** Intro MI-10: Coco rennt in dieser Zeit von links herein. */
export const INTRO_RUN_MS = 600
/** Sprung-Sequenz Schmuck: `springen` A/B/C (3 Frames), davor `abspringen`, danach `bremsen` (§11.4: 415 ms gesamt). */
export const JUMP_MS = 3 * BRIDGE_MS + BRIDGE_MS
/**
 * Verweilen je Station (§11.4): nach `after` ms ohne Scroll wechselt Coco zur `pose`; mit `hold` kehrt sie danach zur
 * Ankunfts-Pose zurück (Kopfschief 3 s, dann wieder Sitzen), sonst bleibt sie.
 */
export const DWELL: Readonly<
  Record<string, { after: number; pose: SpritePose; hold?: number } | undefined>
> = {
  'planet-claire': { after: 1200, pose: 'kopfschief', hold: 3000 },
  textil: { after: 1500, pose: 'kopfschief' },
}
/** Zusatz-Chunk (Warte-Aktionen) lädt erst so lange nach dem Einhängen – nie vor dem ersten Bild (P12.4). */
export const EXTRA_DELAY_MS = 3500
export const BOIL = { afterActivity: 1500, afterPose: 2000, maxWithoutAction: 5000 } as const

/** Brücken zwischen zwei Posen (§10.3); `null` = direkter Schnitt mit Stauchung. */
export function bridgesFor(from: SpritePose, to: SpritePose): CocoBridge[] | null {
  if (from === to) return []
  if (to === 'springen') return ['abspringen']
  if (
    (from === 'rennen' || from === 'springen') &&
    (to === 'schnueffeln' || to === 'sitzen' || to === 'kopfschief')
  )
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

/**
 * `data-leash-armed` an den Stations-Ankern (MI-13 „zieht ein“, Home.module.css): Die Stationszeichnung bleibt bis
 * `data-leash-reached` (setzt die Engine) verborgen – nur solange die Tinte in Bewegung ist.
 */
export function armStations(doc: Document, on: boolean): void {
  for (const el of doc.querySelectorAll('[data-leash-station]'))
    el.toggleAttribute('data-leash-armed', on)
}

/** Zustand der Linie je Frame (Teilmenge von `CocoState` der Laufzeit; die Choreografie liest nur dies). */
export interface CocoFollow {
  len: number
  x: number
  y: number
  angle: number
  direction: 1 | -1
  pose: SpritePose
  moving: boolean
  motion: Motion
  station: { id: string; pose: SpritePose; len0: number; len1: number; inside: boolean } | null
  intro: boolean
  gutter: [number, number, number] | null
}

/**
 * Haken für die nachgeladenen Zusatz-Aktionen (`cocoExtra.ts`, P12.4): Posen-Gruppen, Anzeige, Boil, Ruhe-Meldung.
 * Klein gehalten – die Aktionen selbst liegen im nachgeladenen Chunk, nicht in der Engine (Budget §9.10).
 */
/** Kurznamen (Eigenschaften werden nicht verkürzt, Budget §9.10): g Gruppen · a Anker · s zeigen · b Boil · t Ruhe-Meldung · r reduziert · p Abbruch · o Abbau. */
export interface CocoHooks {
  g: Map<string, Element>
  /** D-Ring der Zusatz-Posen (die Haupt-Anker stehen in `cocoSprite.ts`). */
  a: Record<string, [number, number]>
  s(key: string): void
  /** Boil ohne Budget-Nachlauf ein-/ausschalten (die Aktion bestimmt die Dauer, ≤ 5 s). */
  b(on: boolean): void
  /** Nach jedem abgeschlossenen Posenwechsel; `null` = Bewegung/Abbruch. */
  t: ((pose: SpritePose | null) => void) | null
  /** Reduzierte Bewegung aktiv: keine Aktionen. */
  r: boolean
  /** Bricht eine laufende Aktion ab (Posenwechsel, reduzierte Bewegung, Abbau). */
  p: (() => void) | null
  /** Beim Abbau: Ereignis-Abos der Zusatz-Aktionen lösen. */
  o: (() => void) | null
}

export interface CocoController {
  readonly x: CocoHooks
  readonly el: HTMLElement
  /** Aktuell gezeigte Pose. */
  pose(): SpritePose
  boiling(): boolean
  /** Ziel-Pose; der Wechsel erfolgt an der nächsten Frame-Grenze. */
  setPose(pose: SpritePose): void
  /**
   * D-Ring an (x, y) im Koordinatensystem des Containers; `direction` −1 spiegelt (läuft zurück). `gutter`
   * `[links, rechts]`: liegt die Leinenspitze in der Rinne, rutscht die Box so weit, dass sie nicht in den Text ragt.
   */
  place(x: number, y: number, direction?: 1 | -1, gutter?: [number, number, number] | null): void
  /** Choreografie der Startseite (DESIGN §11.4): Pose, Verweilen, Sprung, Blickrichtung, Intro-Lauf, Position. */
  follow(s: CocoFollow): void
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

function buildGroups(el: HTMLElement, href: string, shown: string): Map<string, Element> {
  const svg = el.querySelector('svg')
  const groups = new Map<string, Element>()
  if (!svg) return groups
  const existing = Array.from(svg.querySelectorAll('use'))
  for (const key of Object.keys(COCO_ANCHORS))
    groups.set(key, makeGroup(svg, groupIds(key), href, key === shown ? existing : []))
  for (const u of existing) if (u.parentNode === svg) u.remove()
  groups.get(shown)?.setAttribute('data-on', '')
  return groups
}

export function mountCoco(el: HTMLElement, options: CocoOptions): CocoController {
  const now = options.now ?? (() => performance.now())
  const href = options.href ?? COCO_SPRITE_HREF
  const groups = buildGroups(el, href, options.pose)
  let on: Element | null = groups.get(options.pose) ?? null
  let curKey: string = options.pose
  let placed: Parameters<CocoController['place']> | null = null
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
  let extraTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false
  // Choreografie (`follow`)
  let restTimer: ReturnType<typeof setTimeout> | null = null
  let dwellTimer: ReturnType<typeof setTimeout> | null = null
  let jumpTimer: ReturnType<typeof setTimeout> | null = null
  let dwelled = false
  let stationId: string | undefined
  let jumping = false
  const jumped = new Set<string>()
  let facing: 1 | -1 = 1
  let run = 0
  let lastLen = 0
  let introAt: number | null = null
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
    el.setAttribute('data-pose', (curKey = pose))
    // Anker der neuen Pose (Zusatz-Posen haben eigene): Leinenspitze bleibt am D-Ring, auch ohne Scroll-Frame
    if (placed) place(...placed)
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

  function finish(from: SpritePose, used: CocoBridge[] | null, planned: SpritePose) {
    bridge = null
    // Das Ziel wechselte während der Brücke: die Brücke passt nicht mehr (MO-09) – von der Ausgangspose neu planen.
    if (target !== planned && target !== from) {
      schedule()
      return
    }
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
    hk.t?.(shown)
  }

  function step(
    from: SpritePose,
    queue: CocoBridge[],
    used: CocoBridge[] | null,
    planned: SpritePose,
  ) {
    stepTimer = null
    const next = queue.shift()
    if (next) {
      bridge = next
      show(`bridge-${next}`)
      stepTimer = setTimeout(() => step(from, queue, used, planned), BRIDGE_MS)
    } else finish(from, used, planned)
  }

  function schedule() {
    stepTimer = clear(stepTimer)
    if (target === shown && !bridge) return
    const from = shown
    const used = bridgesFor(from, target)
    const queue = [...(used ?? [])]
    const planned = target
    const wait = untilBoundary()
    if (wait === 0) step(from, queue, used, planned)
    else stepTimer = setTimeout(() => step(from, queue, used, planned), wait)
  }

  boil(BOIL.afterPose) // Seiteneintritt
  // Warte-Aktionen und neue Posen (U-03/U-04): eigener Chunk + eigene Sprite-Datei, erst im Leerlauf (nicht in der
  // Vorschau-Datei, dort ohne `href`/Server)
  if (!options.href)
    extraTimer = setTimeout(() => {
      if (!destroyed && motion === 'full')
        void import('./cocoExtra').then((m) => !destroyed && m.attachExtra(api))
    }, EXTRA_DELAY_MS)

  /** D-Ring an (x, y); die Box rutscht aus dem Text, wenn die Leinenspitze nahe der Rinne liegt (LG-01). */
  function place(
    x: number,
    y: number,
    direction: 1 | -1 = 1,
    gutter?: [number, number, number] | null,
  ) {
    placed = [x, y, direction, gutter]
    const [ax, ay] = hk.a[curKey] ?? COCO_ANCHORS[curKey] ?? COCO_ANCHORS[shown] ?? [80, 60]
    const s = width / COCO_VIEWBOX.w
    let tx = x
    if (gutter) {
      // Hunde-Kante rechts (Hund füllt 0,13–0,90 der Box); ragt sie über die Rinne, rutscht sie zurück – voll in der Rinne, sanft bis 40 px daneben
      const right = direction === 1 ? x - ax * s + 0.9 * width : x + ax * s - 0.13 * width
      const over = right - (gutter[1] - 2)
      if (over > 0) tx -= over * Math.max(0, Math.min(1, 1 - (x - gutter[1]) / gutter[2]))
    }
    el.style.transform = `translate(${tx.toFixed(1)}px,${y.toFixed(1)}px) scaleX(${direction}) translate(${(-ax * s).toFixed(1)}px,${(-ay * s).toFixed(1)}px)`
  }

  const hk: CocoHooks = {
    g: groups,
    a: {},
    s: show,
    b(v) {
      boilTimer = clear(boilTimer)
      setBoil(v)
    },
    t: null,
    r: motion === 'reduced',
    p: null,
    o: null,
  }

  const api: CocoController = {
    x: hk,
    el,
    pose: () => shown,
    boiling: () => el.getAttribute('data-boil') === 'on',
    setPose(pose) {
      if (destroyed || pose === target) return
      hk.p?.()
      hk.t?.(null)
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
    place,
    follow(s) {
      if (destroyed) return
      const st = s.station
      // Sprung der Linie (> 300 px) zu einer anderen Station: Ankunft neu, auch ohne Bewegungs-Frame dazwischen
      if (st?.id !== stationId || !st?.inside) {
        // eine andere Station löst Verweil-Timer und Sprung-Sperre der alten
        if (st?.id !== stationId) [jumpTimer, jumping] = [clear(jumpTimer), false]
        ;[stationId, dwelled] = [st?.id, false]
        dwellTimer = clear(dwellTimer)
      }
      if (s.motion === 'reduced') api.setPose(s.pose)
      else if (!jumping) {
        if (s.moving) {
          // unterwegs: Lauf; Verweil- und Ruhe-Timer beginnen von vorn (§11.4)
          dwellTimer = clear(dwellTimer)
          restTimer = clear(restTimer)
          dwelled = false
          api.setPose('rennen')
        } else if (!st?.inside) {
          // Zwischenstück: nach 1,2 s ohne Scrollen setzt sie sich
          restTimer ??= setTimeout(() => ((restTimer = null), api.setPose('sitzen')), REST_AFTER_MS)
        } else if (!dwelled) {
          // Ankunft: Station-Pose (Brücke `bremsen` aus dem Lauf), Schmuck wartet sitzend auf den Sprung
          dwelled = true
          restTimer = clear(restTimer)
          const arrive = st.pose === 'springen' ? 'sitzen' : st.pose
          api.setPose(arrive)
          const d = DWELL[st.id]
          if (d)
            dwellTimer = setTimeout(() => {
              api.setPose(d.pose)
              if (d.hold) dwellTimer = setTimeout(() => api.setPose(arrive), d.hold)
            }, d.after)
        }
      }
      // Sprung-Sequenz Schmuck: einmal, wenn die Linie das Ende der Schlaufe erreicht (nur vorwärts)
      if (
        s.motion !== 'reduced' &&
        st?.pose === 'springen' &&
        !jumped.has(st.id) &&
        s.len >= st.len1 - 2 &&
        s.direction === 1
      ) {
        jumped.add(st.id)
        if (s.len - st.len1 < 200) {
          jumping = dwelled = true
          dwellTimer = clear(dwellTimer)
          api.setPose('springen') // Brücke `abspringen`
          jumpTimer = setTimeout(() => {
            api.setPose('sitzen') // Brücke `bremsen`
            jumpTimer = setTimeout(() => (jumping = false), 2 * BRIDGE_MS)
          }, JUMP_MS - BRIDGE_MS)
        }
      }
      // Blickrichtung nach Schwung der Linie; Umschalten erst nach 24 px Bogenlänge in neuer Richtung (§11.4)
      const c = Math.cos(s.angle)
      const want = ((c > 0.15 ? 1 : c < -0.15 ? -1 : facing) * s.direction) as 1 | -1
      if (s.moving) {
        if (want === facing) run = 0
        else if ((run += Math.abs(s.len - lastLen)) >= FACING_PX) [facing, run] = [want, 0]
      }
      lastLen = s.len
      // Intro MI-10: in 600 ms von links hereinrennen (ease-out), danach an der Leinenspitze
      let x = s.x
      // (bei einem Seitenwechsel mit Übergang steht sie schon am Linienanfang: `data-arrived`, P12.12)
      if (s.intro && s.motion !== 'reduced' && !el.dataset.arrived) {
        introAt ??= now()
        x -= Math.max(0, 1 - (now() - introAt) / INTRO_RUN_MS) ** 2 * (x + width + 8)
      }
      place(x, s.y, facing, s.gutter)
    },
    activity() {
      lastAction = now()
      boil(BOIL.afterActivity)
    },
    setMotion(next, restPose) {
      if (destroyed) return
      motion = next
      hk.r = next === 'reduced'
      if (next === 'reduced') {
        hk.p?.()
        stepTimer = clear(stepTimer)
        boilTimer = clear(boilTimer)
        squashTimer = clear(squashTimer)
        restTimer = clear(restTimer)
        dwellTimer = clear(dwellTimer)
        jumpTimer = clear(jumpTimer)
        jumping = false
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
      extraTimer = clear(extraTimer)
      hk.p?.()
      hk.o?.()
      hk.t = null
      restTimer = clear(restTimer)
      dwellTimer = clear(dwellTimer)
      jumpTimer = clear(jumpTimer)
      ro?.disconnect()
      stepTimer = clear(stepTimer)
      boilTimer = clear(boilTimer)
      squashTimer = clear(squashTimer)
      if (hop) hop.style.transform = ''
      setBoil(false)
    },
  }
  return api
}
