import type { Page } from '@playwright/test'

import type { Probe } from '../../../scripts/art/lib/probe'

// Sonde je Standbild (KUNST-QA §5; PLAN P9.6): misst im Browser, was `pnpm art:check` braucht. Läuft vollständig in
// `page.evaluate` (eine Funktion ohne Abhängigkeiten), auch für die schnelle Teilmenge `tests/e2e/art-gate.e2e.spec.ts`.

export interface ProbeArgs {
  label: string
  frame: string | null
  t: number | null
  scale: number
  /** Ruhe-Route (Preset `calm`/`legal`): Übergänge in `main` zählen (A11Y-06). */
  calm: boolean
}

/** Im Browser: alle Messungen eines Zeitpunkts. */
function measure(args: ProbeArgs): Probe {
  const r1 = (n: number) => Math.round(n * 10) / 10
  const vw = innerWidth
  const vh = innerHeight
  const inView = (r: DOMRect) =>
    r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh
  const push4 = (arr: number[], r: DOMRect) =>
    arr.push(r1(r.left), r1(r.top), r1(r.width), r1(r.height))
  const desc = (el: Element | null) => {
    if (!el) return ''
    const id = el.id ? `#${el.id}` : ''
    const cls =
      typeof el.className === 'string' && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 80)
  }
  const DECO = '[data-leash-layer], .coco, [data-mark]'
  const zone = (el: Element | null): string => {
    if (!el) return ''
    if (el.closest(DECO)) return 'deco'
    if (el.closest('img, picture')) return 'img'
    if (el.closest('footer')) return 'footer'
    if (el.closest('header')) return 'header'
    if (el.closest('main')) return 'main'
    return ''
  }
  type W = Window & {
    __leash?: {
      geometry: {
        lut: ArrayLike<number>
        totalLength: number
        segments: { len0?: number; len1?: number; start?: number; end?: number }[]
        scrollMap: { readingY: number; len: number }[]
        stations: { id: string; y: number; pose: string; loopLen0: number; loopLen1: number }[]
      }
      preset(): string
      tier(): string
      drawnLen(): number
      cocoLen(): number
      pose(): string | null
      rebuildCount(): number
    }
    __qa?: { poseLog: { t: number; from: string | null; to: string; bridge: string | null }[] }
    __artReadingY?: number | null
  }
  const w = window as W

  // ---- Linie ----
  let leash: Probe['leash'] = null
  const layer = document.querySelector('[data-leash-layer]')
  if (w.__leash && layer) {
    const L = w.__leash
    const g = L.geometry
    const box = layer.getBoundingClientRect()
    const READING = 0.72
    const readingY = w.__artReadingY ?? scrollY + READING * vh - (box.top + scrollY)
    let mapped = 0
    const sm = g.scrollMap
    if (sm.length) {
      if (readingY <= sm[0]!.readingY) mapped = sm[0]!.len
      else if (readingY >= sm[sm.length - 1]!.readingY) mapped = sm[sm.length - 1]!.len
      else
        for (let i = 1; i < sm.length; i++)
          if (sm[i]!.readingY >= readingY) {
            const a = sm[i - 1]!
            const b = sm[i]!
            const k = (readingY - a.readingY) / (b.readingY - a.readingY || 1)
            mapped = a.len + (b.len - a.len) * k
            break
          }
    }
    const drawn = L.drawnLen()
    const pts: number[] = []
    for (let i = 0; i + 3 < g.lut.length; i += 4) {
      const len = g.lut[i]!
      if (len > drawn) break
      const x = g.lut[i + 1]! + box.left
      const y = g.lut[i + 2]! + box.top
      if (x > -8 && y > -8 && x < vw + 8 && y < vh + 8) pts.push(r1(len), r1(x), r1(y))
    }
    const seams: number[] = []
    for (const s of g.segments.slice(1)) {
      const v = s.len0 ?? s.start
      if (typeof v === 'number') seams.push(r1(v))
    }
    const path = layer.querySelector('path')
    const cs = path ? getComputedStyle(path) : null
    const lw = parseFloat(getComputedStyle(layer).getPropertyValue('--leash-w')) || 2.2
    leash = {
      preset: L.preset(),
      tier: L.tier(),
      drawnLen: r1(drawn),
      total: r1(g.totalLength),
      cocoLen: r1(L.cocoLen()),
      pose: L.pose(),
      rebuild: L.rebuildCount(),
      readingY: r1(readingY),
      mapped: r1(mapped),
      halfW: lw / 2,
      pts,
      seams,
      stroke: cs ? (cs.fill !== 'none' ? cs.fill : cs.stroke) : '',
      stations: g.stations.map((s) => ({
        id: s.id,
        y: r1(s.y),
        pose: s.pose,
        len0: r1(s.loopLen0),
        len1: r1(s.loopLen1),
      })),
    }
  }

  // ---- Coco (an der Leine) ----
  const cocoEl =
    document.querySelector('[data-leash-layer] .coco, .coco[data-leash-coco]') ??
    document.querySelector('[data-leash-coco]')
  let coco: Probe['coco'] = null
  if (cocoEl) {
    const r = cocoEl.getBoundingClientRect()
    if (r.width > 0)
      coco = {
        x: r1(r.left),
        y: r1(r.top),
        w: r1(r.width),
        h: r1(r.height),
        boil: cocoEl.getAttribute('data-boil') ?? '',
      }
  }

  // ---- Textzeilen und Bedienelemente (LG-01) ----
  const text: number[] = []
  for (const root of Array.from(document.querySelectorAll('main, footer'))) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue
      const el = n.parentElement
      if (!el || el.closest(DECO) || el.closest('[aria-hidden="true"]')) continue
      const st = getComputedStyle(el)
      if (st.visibility === 'hidden' || st.opacity === '0') continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of Array.from(range.getClientRects())) if (inView(r)) push4(text, r)
    }
  }
  const ctrl: number[] = []
  for (const el of Array.from(
    document.querySelectorAll(
      'main input:not([type=hidden]), main select, main textarea, main button, main [role=button], footer a, footer button, header button',
    ),
  )) {
    if (el.closest(DECO)) continue
    const r = el.getBoundingClientRect()
    if (inView(r)) push4(ctrl, r)
  }

  // ---- Animationen ----
  const anims = document.getAnimations().map((a) => {
    const eff = a.effect as KeyframeEffect | null
    const timing = eff?.getTiming()
    const ct = eff?.getComputedTiming()
    let ke: string[] = []
    try {
      ke = [...new Set((eff?.getKeyframes() ?? []).map((k) => String(k.easing ?? 'linear')))]
    } catch {
      ke = []
    }
    const target = (eff?.target ?? null) as Element | null
    const it = Number(timing?.iterations ?? 1)
    return {
      n: String(
        (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id ?? '',
      ),
      k: a.constructor.name,
      s: a.playState,
      d: typeof timing?.duration === 'number' ? r1(timing.duration) : null,
      dl: r1(Number(timing?.delay ?? 0)),
      it: Number.isFinite(it) ? it : -1,
      e: String(timing?.easing ?? 'linear'),
      ke,
      ct: a.currentTime === null ? null : r1(Number(a.currentTime)),
      act: ct?.progress !== null && ct?.progress !== undefined,
      tg: desc(target),
      z: zone(target),
      pe: eff?.pseudoElement ?? null,
    }
  })

  // ---- Deko für Hilfstechnik (A11Y-03) ----
  const decoEls = Array.from(document.querySelectorAll(DECO))
  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  const deco = {
    count: decoEls.length,
    hidden: decoEls.every((el) => !!el.closest('[aria-hidden="true"]')),
    focusable: decoEls.reduce((n, el) => n + el.querySelectorAll(FOCUSABLE).length, 0),
  }

  // ---- Schriften (LG-03) ----
  const mansalva: Probe['mansalva'] = []
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (!el.childNodes.length || el.closest(DECO)) continue
    let own = false
    for (const c of Array.from(el.childNodes))
      if (c.nodeType === 3 && c.textContent?.trim()) own = true
    if (!own) continue
    const st = getComputedStyle(el)
    if (!/mansalva/i.test(st.fontFamily)) continue
    const role = el.closest('button, input, select, textarea, label, table, form')
      ? 'control'
      : el.closest('h1')
        ? 'h1'
        : el.closest('h2')
          ? 'h2'
          : el.closest('[data-price-tag], [data-price], [data-product-price]')
            ? 'price'
            : el.closest('[data-sold-stamp], [data-stamp]')
              ? 'stamp'
              : el.closest('nav')
                ? 'menu'
                : el.closest('[data-badge], time')
                  ? 'badge'
                  : el.closest('p, li')
                    ? 'body'
                    : 'other'
    mansalva.push({ tag: el.tagName.toLowerCase(), size: parseFloat(st.fontSize), role })
  }

  // ---- Speicher (A11Y-02, EK-04) ----
  let storage = 0
  try {
    storage += localStorage.length + sessionStorage.length
  } catch {
    // gesperrt
  }
  storage += document.cookie ? document.cookie.split(';').filter((c) => c.trim()).length : 0

  // ---- Weltraum-Marken (AR-06) ----
  let stars = 0
  const perStation = new Map<Element, number>()
  for (const el of Array.from(document.querySelectorAll('[data-mark]'))) {
    const r = el.getBoundingClientRect()
    if (el.getAttribute('data-mark') === 'star' && inView(r)) stars++
    const st = el.closest('[data-leash-station], section')
    if (st) perStation.set(st, (perStation.get(st) ?? 0) + 1)
  }

  // ---- Übergänge in main (A11Y-06) ----
  let transitions = 0
  const transitionsAt: string[] = []
  const main = document.querySelector('main')
  if (main && args.calm)
    for (const el of [main, ...Array.from(main.querySelectorAll('*'))]) {
      const st = getComputedStyle(el)
      if (st.transitionDuration.split(',').some((x) => parseFloat(x) > 0)) {
        transitions++
        if (transitionsAt.length < 3)
          transitionsAt.push(`${desc(el)} ${st.transitionProperty} ${st.transitionDuration}`)
      }
    }

  // ---- Handel im Tattoo-Bereich (RZ-02) ----
  const addToCart = Array.from(document.querySelectorAll('main button, main a')).filter(
    (el) =>
      el.matches('[data-add-to-cart]') || /in den korb|add to cart/i.test(el.textContent ?? ''),
  ).length
  const price = document.querySelectorAll(
    'main [data-price-tag], main [data-product-price], main [data-price]',
  ).length

  // ---- Fokus (A11Y-07) ----
  let focus: Probe['focus'] = null
  const act = document.activeElement
  if (
    act &&
    act !== document.body &&
    act !== document.documentElement &&
    act.matches(':focus-visible')
  ) {
    const r = act.getBoundingClientRect()
    const st = getComputedStyle(act)
    const ow = parseFloat(st.outlineWidth) || 0
    const off = parseFloat(st.outlineOffset) || 0
    const hasRing = (c: CSSStyleDeclaration) =>
      (c.outlineStyle !== 'none' &&
        (parseFloat(c.outlineWidth) > 0 || c.outlineStyle === 'auto')) ||
      (c.boxShadow !== 'none' && /\d/.test(c.boxShadow))
    const ring =
      hasRing(st) ||
      hasRing(getComputedStyle(act, '::after')) ||
      hasRing(getComputedStyle(act, '::before'))
    const e = off + ow / 2
    const probes = [
      [r.left + r.width / 2, r.top - e],
      [r.right + e, r.top + r.height / 2],
      [r.left + r.width / 2, r.bottom + e],
      [r.left - e, r.top + r.height / 2],
    ]
    const hits = probes.map(([x, y]) => {
      if (x! < 0 || y! < 0 || x! >= vw || y! >= vh) return 'outside'
      const hit = document.elementFromPoint(x!, y!)
      if (!hit) return 'none'
      if (hit === act || act.contains(hit) || hit.contains(act)) return 'self'
      if (hit.closest(DECO)) return 'deco'
      if (hit.closest('[data-buy-bar]')) return 'buybar'
      return 'other'
    })
    focus = { desc: desc(act), ring, hits }
  }

  // ---- SVG-Budget (PF-10) ----
  let svgBytes = 0
  let pathBytes = 0
  for (const s of Array.from(document.querySelectorAll('svg'))) {
    if (s.parentElement?.closest('svg')) continue
    svgBytes += s.outerHTML.length
  }
  for (const p of Array.from(document.querySelectorAll('path')))
    pathBytes += (p.getAttribute('d') ?? '').length

  // ---- Pflichtlink „Vertrag widerrufen“ (LG-02) ----
  let withdraw: Probe['withdraw'] = null
  const wl = document.querySelector(
    'footer a[href$="/vertrag-widerrufen"], footer a[href$="/withdraw-from-contract"]',
  )
  if (wl) {
    const r = wl.getBoundingClientRect()
    if (inView(r) && r.bottom <= vh && r.top >= 0) {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      withdraw = { h: r1(r.height), hit: !!hit && (hit === wl || wl.contains(hit)) }
    }
  }

  // ---- Erzwungene Farben (A11Y-05) ----
  const probeEl = document.createElement('span')
  probeEl.style.color = 'CanvasText'
  document.body.appendChild(probeEl)
  const canvasText = getComputedStyle(probeEl).color
  probeEl.remove()

  // ---- LCP-Bild (IM-05): Beobachter per Init-Skript (`LCP_INIT` in fixtures.ts) ----
  let lcp: Probe['lcp'] = null
  const le = (window as Window & { __artLcpEntry?: { url: string; startTime: number } | null })
    .__artLcpEntry
  if (le) {
    const res = le.url
      ? (performance.getEntriesByName(le.url)[0] as PerformanceResourceTiming | undefined)
      : undefined
    lcp = {
      url: le.url || null,
      bytes: res ? res.encodedBodySize || res.transferSize || null : null,
      time: r1(le.startTime),
    }
  }

  // ---- Messungen der Engine (PF-03/PF-04) ----
  const ms = (name: string) => performance.getEntriesByName(name).map((e) => r1(e.duration))

  // ---- Badges/Stempel (CT-03) ----
  const lum = (c: string) => {
    const m = c.match(/[\d.]+/g)
    if (!m) return null
    const [r, g, b, a] = m.map(Number)
    if (a !== undefined && a < 0.5) return null
    const f = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
  }
  const bgOf = (el: Element | null): string => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor
      const a = c.match(/[\d.]+/g)
      if (a && (a.length < 4 || Number(a[3]) > 0.5)) return c
    }
    return getComputedStyle(document.body).backgroundColor
  }
  const badges: Probe['badges'] = []
  for (const el of Array.from(document.querySelectorAll('[data-badge], [data-sold-stamp]'))) {
    const r = el.getBoundingClientRect()
    if (!inView(r)) continue
    const st = getComputedStyle(el)
    const fg = lum(st.color)
    const bg = lum(bgOf(el))
    if (fg === null || bg === null) continue
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
    badges.push({
      sel: el.hasAttribute('data-sold-stamp') ? 'stamp' : 'badge',
      ratio: Math.round(ratio * 100) / 100,
      size: parseFloat(st.fontSize),
    })
  }

  return {
    label: args.label,
    frame: args.frame,
    t: args.t,
    url: location.pathname + location.search,
    vw,
    vh,
    dpr: devicePixelRatio,
    scale: args.scale,
    scrollY: Math.round(scrollY),
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    leash,
    coco,
    text,
    ctrl,
    anims,
    deco,
    mansalva,
    storage,
    marks: { stars, perStation: Math.max(0, ...perStation.values()) },
    transitions,
    transitionsAt,
    commerce: { price, addToCart },
    focus,
    svg: { bytes: svgBytes, pathBytes },
    withdraw,
    canvasText,
    lcp,
    measures: { build: ms('leash:build'), frame: ms('leash:frame').slice(-200) },
    poseLog: (w.__qa?.poseLog ?? []).slice(-40),
    badges,
  }
}

export function probePage(page: Page, args: ProbeArgs): Promise<Probe> {
  return page.evaluate(measure, args)
}
