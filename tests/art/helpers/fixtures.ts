import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test'

import {
  ART_PROFILES,
  framePath,
  slugLabel,
  videoPath,
  type ArtProfile,
} from '../../../scripts/art/lib/run'
import AxeBuilder from '@axe-core/playwright'
import sharp from 'sharp'

import { labelTime, type Probe } from '../../../scripts/art/lib/probe'
import { isCalmRoute } from '../../../scripts/art/lib/routes'
import { scrollRun, seekAnimations, releaseAnimations, twoFrames, waitForPaint } from './capture'
import { probePage } from './probe'
import { RUN_DIR, flatBandFraction, writeJson, writeWebp } from './run'

// Fixture `art` der Kunst-Abnahme (KUNST-QA §4): eigener Browser-Kontext je Test mit Geräteprofil, Bewegungs-Variante
// und Videoaufnahme in Viewport-Größe; Playwright-Clock vor der ersten Navigation (feste Startzeit, §4.4); alle
// Anfragen an fremde Hosts werden blockiert und lassen den Test scheitern (keine Drittanbieter, CLAUDE.md §6).

/** Feste Startzeit der Browser-Uhr (läuft danach normal weiter, bis eine Sequenz sie anhält). */
export const ART_CLOCK = new Date('2026-10-01T08:00:00.000Z')

export type ArtVariantName = 'motion' | 'reduced' | 'tempo'

export interface ProjectMeta {
  profile: ArtProfile
  variant: ArtVariantName
  video: boolean
  emulated: string | null
}

/** Tags für `test(…, { tag })`: alle Kombinationen aus Profilen und Varianten (KUNST-QA §4.3 Spalte „Profile“). */
export function artTags(
  profiles: readonly ArtProfile[] | 'all',
  variants: readonly ArtVariantName[] = ['motion', 'reduced'],
): string[] {
  const p = profiles === 'all' ? ART_PROFILES : profiles
  return [...p.map((x) => `@${x}`), ...variants.map((v) => `@${v}`)]
}

/** Szenario-ID aus dem Dateinamen `sc-05.art.spec.ts` → `SC-05`. */
export function scenarioOf(file: string): string {
  const m = /sc-(\d{2})\.art\.spec\.ts$/.exec(file)
  if (!m) throw new Error(`Kein Szenario-Dateiname: ${file}`)
  return `SC-${m[1]}`
}

const OWN_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** Szenarien mit Sonde je Standbild (KUNST-QA §5, P9.6); SC-12/13/14 (QA-Seiten) und SC-18 (Tempo) ohne. */
export const PROBE_SCENARIOS = new Set([
  'SC-00',
  'SC-01',
  'SC-02',
  'SC-03',
  'SC-04',
  'SC-05',
  'SC-06',
  'SC-07',
  'SC-08',
  'SC-09',
  'SC-10',
  'SC-11',
  'SC-15',
  'SC-17',
])

export interface FrameOptions {
  /** Nur dieses Element (sonst Sichtbereich). */
  element?: Locator
  fullPage?: boolean
  /** `css`: ein Bildpunkt je CSS-Pixel (Sequenzen, spart Zeit bei DPR 3); Standard `device`. */
  scale?: 'css' | 'device'
  /** Lupe: nur dieser Ausschnitt (CSS-Pixel), auf `width` Bildpunkte vergrößert (Lesbarkeit kleiner Figuren). */
  zoom?: { x: number; y: number; width: number; height: number; to: number }
}

export class ArtSession {
  readonly sc: string
  readonly profile: ArtProfile
  readonly variant: ArtVariantName
  readonly emulated: string | null
  /** Angehaltene Browser-Uhr (Sequenzen). */
  clockPaused = false
  private n = 0
  private readonly frames: string[] = []
  /** Neuaufnahmen wegen nicht gerasterter Kacheln (Protokoll `raw/…/retakes.json`). */
  readonly retakes: { label: string; retry: number }[] = []
  /** Sonden je Standbild (`raw/…/probes.json`, P9.6). */
  readonly probes: Probe[] = []
  /** Zusatzmessungen des Szenarios (`extra` in `probes.json`). */
  readonly extras: Record<string, unknown> = {}
  /** Sonde je Standbild aktiv (Szenario in `PROBE_SCENARIOS`). */
  probing: boolean

  constructor(
    readonly page: Page,
    readonly context: BrowserContext,
    meta: ProjectMeta,
    sc: string,
    private readonly testInfo: TestInfo,
  ) {
    this.sc = sc
    this.profile = meta.profile
    this.variant = meta.variant
    this.emulated = meta.emulated
    this.probing = PROBE_SCENARIOS.has(sc) && meta.variant !== 'tempo'
  }

  get reduced(): boolean {
    return this.variant === 'reduced'
  }

  get isDesktop(): boolean {
    return this.profile === 'art-desktop'
  }

  /** Laden, Schriften und sichtbare Bilder abwarten, dann die Linie (falls die Seite eine hat). */
  async goto(url: string, opts: { waitLeash?: boolean } = {}): Promise<void> {
    if (this.clockPaused) await this.resumeClock()
    await this.page.goto(url, { waitUntil: 'load' })
    await waitForPaint(this.page)
    if (opts.waitLeash !== false) await this.waitLeash()
  }

  /** Engine geladen (Debug-Schnittstelle `__leash`) bzw. Seite ohne Linie – höchstens 8 s. */
  async waitLeash(timeout = 8000): Promise<boolean> {
    return this.page
      .waitForFunction(
        () => {
          const layer = document.querySelector('[data-leash-layer][data-leash-preset]')
          return !layer || !!(window as Window & { __leash?: unknown }).__leash
        },
        undefined,
        { timeout },
      )
      .then(() => true)
      .catch(() => false)
  }

  /** Ein Standbild (PNG → WebP q 90) unter `frames/<SC>/<profil>/<variante>/<nnn>-<label>.webp`. */
  async frame(label: string, opts: FrameOptions = {}): Promise<string> {
    this.n++
    // Jede Beschriftung trägt `t` oder `y` (KUNST-QA §4.4): sonst die aktuelle Scroll-Position anhängen.
    if (!/(^|-)[ty]-?\d+/.test(label))
      label = `${label}-y${String(Math.max(0, Math.round(await this.page.evaluate(() => scrollY)))).padStart(4, '0')}`
    const shot = {
      type: 'png' as const,
      caret: 'hide' as const,
      animations: 'allow' as const,
      scale: opts.scale ?? ('device' as const),
    }
    const take = () =>
      opts.element
        ? opts.element.screenshot(shot)
        : this.page.screenshot({ ...shot, fullPage: opts.fullPage ?? false })
    let png = await take()
    if (opts.zoom) {
      const { to, ...clip } = opts.zoom
      png = await this.page.screenshot({ ...shot, clip })
      png = await sharp(png).resize({ width: to, kernel: 'lanczos3' }).png().toBuffer()
    }
    // Nicht gerasterte Kacheln (leerer Block ≥ 20 % der Höhe nach Scroll-Sprung) → kurz in Echtzeit warten (die
    // Browser-Uhr kann angehalten sein) und neu aufnehmen; höchstens 3×, echte einfarbige Flächen bleiben so erhalten.
    for (
      let retry = 1;
      retry <= 3 && !opts.element && !opts.zoom && (await flatBandFraction(png)) >= 0.2;
      retry++
    ) {
      await new Promise((r) => setTimeout(r, 200 * retry))
      png = await take()
      this.retakes.push({ label, retry })
    }
    const rel = framePath(this.sc, this.profile, this.variant, this.n, label)
    await writeWebp(rel, png)
    this.frames.push(rel)
    if (this.probing)
      await this.probe(
        label,
        opts.element || opts.fullPage || opts.zoom ? null : rel,
        opts.scale === 'css' ? 1 : null,
      )
    return rel
  }

  /** Sonde (KUNST-QA §5) zum aktuellen Zeitpunkt; mit Standbild-Pfad, wenn es den Sichtbereich zeigt. */
  async probe(
    label: string,
    frame: string | null = null,
    scale: number | null = null,
  ): Promise<Probe | null> {
    try {
      const p = await probePage(this.page, {
        label,
        frame,
        t: labelTime(label),
        scale: scale ?? (await this.page.evaluate(() => devicePixelRatio)),
        calm: isCalmRoute(this.page.url()),
      })
      this.probes.push(p)
      return p
    } catch (e) {
      this.probeErrors.push(`${label}: ${String(e).slice(0, 200)}`)
      return null
    }
  }

  readonly probeErrors: string[] = []

  /** Zusatzmessung unter `extra[key]` in `probes.json`. */
  extra(key: string, value: unknown): void {
    this.extras[key] = value
  }

  /** axe-Prüfung (A11Y-04, CT-02) → `raw/<SC>/<profil>/<variante>/axe-<label>.json`. */
  async axe(label: string): Promise<void> {
    try {
      const res = await new AxeBuilder({ page: this.page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      this.json(`axe-${label}`, {
        url: this.page.url(),
        violations: res.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
        })),
      })
    } catch (e) {
      this.json(`axe-${label}`, { url: this.page.url(), error: String(e).slice(0, 300) })
    }
  }

  /** Zwei Frames, Bilder im Sichtbereich, zwei Frames → Standbild. */
  async settledFrame(label: string, opts: FrameOptions = {}): Promise<string> {
    await twoFrames(this.page, this.clockPaused)
    await waitForPaint(this.page, 2000)
    await twoFrames(this.page, this.clockPaused)
    return this.frame(label, opts)
  }

  /** Schrittweite einer Sequenz: in `reduced` grob (dort steht alles still, KUNST-QA §5.7), sonst wie verlangt. */
  step(motionMs: number, untilMs: number): number {
    return this.reduced ? Math.max(motionMs, Math.round(untilMs / 3)) : motionMs
  }

  /** Scrollgekoppelt (§4.4): `scrollTo(0, y)` → zwei Frames → Standbild mit Label `y…`. */
  async scrollFrame(y: number, label?: string): Promise<string> {
    const actual = await this.page.evaluate((y) => {
      scrollTo(0, y)
      return Math.round(scrollY)
    }, y)
    return this.settledFrame(label ?? `y${String(actual).padStart(4, '0')}`)
  }

  /** Echtzeit-Scrollen für das Video. */
  scrollRun(to: number, pxPerSec: number): Promise<void> {
    return scrollRun(this.page, to, pxPerSec)
  }

  /** Browser-Uhr anhalten (ab jetzt nur noch `runFor`). */
  async pauseClock(): Promise<void> {
    if (this.clockPaused) return
    const now = await this.page.evaluate(() => Date.now())
    // WebKit meldet nach einer Navigation gelegentlich eine Seitenzeit knapp hinter der Playwright-Uhr.
    await this.page.clock.pauseAt(now + 1).catch(() => this.page.clock.pauseAt(now + 1000))
    this.clockPaused = true
  }

  async resumeClock(): Promise<void> {
    if (!this.clockPaused) return
    await releaseAnimations(this.page)
    await this.page.clock.resume()
    this.clockPaused = false
  }

  /**
   * Zeitbasierte Sequenz (§4.4): Uhr anhalten, `start()` auslösen, dann alle `stepMs` bis `untilMs` die Uhr
   * vorspulen (Timer, rAF) und alle Animationen auf dieselbe Zeit setzen → Standbild `t…`. Gibt die Pfade zurück.
   */
  async sequence(opts: {
    stepMs: number
    untilMs: number
    start?: () => Promise<void>
    element?: Locator
    prefix?: string
    /** Zeit, die vor dem Sequenz-Start schon vergangen ist (Beschriftung `t` = Zeit seit Navigation, SC-01-Intro). */
    offsetMs?: number
  }): Promise<string[]> {
    await this.pauseClock()
    await opts.start?.()
    const out: string[] = []
    for (let t = 0; t <= opts.untilMs + 0.5; t += opts.stepMs) {
      if (t > 0) await this.page.clock.runFor(opts.stepMs)
      await seekAnimations(this.page, t)
      const label = `${opts.prefix ? `${opts.prefix}-` : ''}t${String(Math.round(t + (opts.offsetMs ?? 0))).padStart(4, '0')}`
      // Bewegungssequenzen in CSS-Pixeln (Zeitbudget ≤ 25 min, KUNST-QA §9); Standbilder bleiben in Geräteauflösung.
      out.push(
        await this.frame(label, {
          ...(opts.element ? { element: opts.element } : {}),
          scale: 'css',
        }),
      )
    }
    await this.resumeClock()
    return out
  }

  /** Rohdaten (JSON) unter `raw/<SC>/<profil>/<variante>/<name>.json`. */
  json(name: string, data: unknown): string {
    return writeJson(
      path.posix.join('raw', this.sc, this.profile, this.variant, `${slugLabel(name)}.json`),
      data,
    )
  }

  /** Weiterer Kontext mit demselben Profil (z. B. 3× für SC-13), ohne Video. */
  async extraContext(over: BrowserContextOptions): Promise<BrowserContext> {
    const ctx = await this.context
      .browser()!
      .newContext({ ...contextOptions(this.testInfo), ...over })
    await guardHosts(ctx, () => undefined)
    return ctx
  }

  get frameCount(): number {
    return this.frames.length
  }
}

function contextOptions(testInfo: TestInfo): BrowserContextOptions {
  const u = testInfo.project.use
  return {
    baseURL: u.baseURL,
    viewport: u.viewport ?? { width: 1280, height: 720 },
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
    userAgent: u.userAgent,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
    reducedMotion: u.contextOptions?.reducedMotion ?? 'no-preference',
    serviceWorkers: 'block',
  }
}

/**
 * Mit dem tsx-Loader (Kassen-Szenarien laden die Payload-Konfiguration) erhalten Funktionen in `page.evaluate` ein
 * `__name(…)` (esbuild `keepNames`); im Browser fehlt der Helfer → hier als Identität bereitstellen.
 */
const NAME_SHIM = 'globalThis.__name = globalThis.__name || ((f) => f);'

/** Letztes LCP-Element je Seite für die Sonde (IM-05); WebKit ohne LCP bleibt `null`. */
const LCP_INIT = `try { performance.setResourceTimingBufferSize(5000) } catch (e) {} try { new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__artLcpEntry = { url: e.url || '', startTime: e.startTime } }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch (e) {}`

async function guardHosts(ctx: BrowserContext, onBlocked: (url: string) => void): Promise<void> {
  await ctx.addInitScript(NAME_SHIM)
  await ctx.addInitScript(LCP_INIT)
  await ctx.route(
    (url) =>
      (url.protocol === 'http:' || url.protocol === 'https:') && !OWN_HOSTS.has(url.hostname),
    (route) => {
      onBlocked(route.request().url())
      return route.abort('blockedbyclient')
    },
  )
}

async function openSession(
  browser: Browser,
  testInfo: TestInfo,
): Promise<{ session: ArtSession; external: string[] }> {
  const meta = testInfo.project.metadata as ProjectMeta
  const sc = scenarioOf(testInfo.file)
  const opts = contextOptions(testInfo)
  const context = await browser.newContext({
    ...opts,
    ...(meta.video
      ? {
          recordVideo: {
            dir: mkdtempSync(path.join(os.tmpdir(), 'art-video-')),
            size: opts.viewport!,
          },
        }
      : {}),
  })
  const external: string[] = []
  await guardHosts(context, (u) => external.push(u))
  const page = await context.newPage()
  // Tempo-Läufe (SC-18) messen echte Frames: dort keine Playwright-Clock (sie ersetzt rAF und performance.now).
  if (meta.variant !== 'tempo') await page.clock.install({ time: ART_CLOCK })
  return { session: new ArtSession(page, context, meta, sc, testInfo), external }
}

export const test = base.extend<{ art: ArtSession }>({
  art: async ({ browser }, provide, testInfo) => {
    const { session, external } = await openSession(browser, testInfo)
    await provide(session)
    if (session.retakes.length > 0) session.json('retakes', session.retakes)
    if (session.probing || Object.keys(session.extras).length > 0)
      session.json('probes', {
        sc: session.sc,
        profile: session.profile,
        variant: session.variant,
        probes: session.probes,
        extra: session.extras,
        errors: session.probeErrors,
      })
    const video = session.page.video()
    const saved = video
      ? video.saveAs(
          path.join(
            RUN_DIR,
            videoPath(session.sc, session.profile, session.variant, testInfo.title),
          ),
        )
      : null
    await session.context.close()
    await saved
    // Keine Anfrage an Fremd-Hosts (KUNST-QA §4.3 „ohne Netz“, CLAUDE.md §6).
    expect(external, 'Anfragen an fremde Hosts').toEqual([])
  },
})

export { expect }
