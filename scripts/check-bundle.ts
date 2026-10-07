import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build } from 'esbuild'

/** Pfad des ausgelieferten Coco-Sprites (aus `src/art/coco/coco-anchors.json`, erzeugt von `pnpm art:sprite`). */
export function cocoSpriteFile(b: { file?: string }): string {
  if (b.file) return b.file
  const { href } = JSON.parse(readFileSync('src/art/coco/coco-anchors.json', 'utf8')) as {
    href: string
  }
  return `public${href}`
}

// `pnpm check:bundle` (ARCHITEKTUR §6.3 Schritt 9, §7.7, PLAN P2.23 / T-09). Alle Grenzen stehen in
// `tests/perf/budgets.json` (1 KB = 1000 B, einschließlich). Geprüft wird:
// 1. JS beim ersten Laden je Seite: Chromium (Playwright) lädt jede `live`-Route der Registry in DE und EN sowie die
//    Fehlerseiten R28/R29 gegen `next start`, liest die Skript-URLs aus `/_next/static`, die vor dem `load`-Ereignis
//    geladen wurden, und gzipt die zugehörigen Dateien aus `<distDir>/static` mit Stufe 9 (Budget je Routen-ID).
//    Dazu je Seite die erzeugten Pfaddaten im DOM (DESIGN §9.10) und auf R01 alle SVG der Startseite zusammen.
// 2. Schriften AK-DS-04 (DESIGN §4.1): genau 4 ausgelieferte `.woff2`, zusammen ≤ 100 KB, kein Google-Fonts-Verweis;
//    keine TTF/OTF (OG-Schriften, P3.14).
// 3. Lazy-Module (DESIGN §9.10): jedes Modul einzeln mit esbuild gebündelt und minifiziert (unabhängig von der
//    Chunk-Aufteilung durch Next), gzip Stufe 9.
// 4. SVG-Dateien: Coco-Sprite, Stationszeichnungen, Icons.
// 5. Bild-Budgets (DESIGN §12.2, ARCHITEKTUR §7.7) – nur Bericht: Median der Größen `thumb`/`card` über den
//    Beispielbestand (aus den `srcset`-Angaben von R02) und das im Profil Pixel 7 geladene LCP-Bild der Produktseite.
// Seiten ab P3.16 zusätzlich mit Varianten und Zuständen (R02 „nur verfügbare“, R05 mit Kategorie, R04 reserviert/sold).
//
// Aufruf: `pnpm check:bundle [--budgets <datei>] [--dist <ordner>] [--base-url <url>] [--port <n>] [--no-pages]`.
// Ohne `--base-url` startet das Skript selbst `next start` (Port `--port`, Standard 3100) und beendet ihn danach. `--no-pages` prüft nur 2–4 (ohne Server/Browser).

export const DEFAULT_BUDGETS_FILE = 'tests/perf/budgets.json'

export interface ModuleBudget {
  name: string
  /** Einstiegsdateien; `*` im Dateinamen erlaubt (z. B. `src/behaviors/*.ts`), dann alle zusammen gebündelt. */
  entries: string[]
  /** Höchstgröße gzip in Bytes. */
  gzipMax: number
}

export interface Budgets {
  firstLoadJs: { gzipMax: Record<string, number>; gzipTarget: Record<string, number> }
  modules: ModuleBudget[]
  fonts: { files: number; maxBytes: number }
  svg: {
    /** `file` fehlt → ausgelieferter Sprite laut `coco-anchors.json` (Version nur in `scripts/art/build-sprite.ts`). */
    cocoSprite: { file?: string; rawMax: number; gzipMax: number }
    /** Nachgeladene Zusatz-Dateien (P12.4 Coco-Zusatz-Posen, P12.5 Fitness-Coco): je Datei roh/gzip. */
    lazy?: { name: string; file: string; rawMax: number; gzipMax: number }[]
    stationRawMax: number
    stationGlob: string
    iconRawMax: number
    iconGlob: string
    homeTotalRawMax: number
    pathDataPerPageMax: number
  }
  pageWeight: Record<string, { max: number; target: number }>
  images: { thumbMedianMax: number; cardMedianMax: number; productLcpMax: number }
  lighthouse: {
    routes: string[]
    runs: number
    lcpMs: { max: number; target: number }
    cls: { max: number; target: number }
    tbtMs: { max: number; target: number }
  }
  interaction: {
    cpuThrottling: number
    inpMs: { max: number; target: number }
    cls: { max: number; target: number }
    frameWorkMs: { max: number }
  }
}

export function loadBudgets(file: string = DEFAULT_BUDGETS_FILE): Budgets {
  return JSON.parse(readFileSync(path.resolve(file), 'utf8')) as Budgets
}

function listFiles(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = path.join(dir, name)
    if (statSync(abs).isDirectory()) return listFiles(abs, match)
    return match(name) ? [abs] : []
  })
}

const listJs = (dir: string) => listFiles(dir, (n) => n.endsWith('.js'))

/** Einfache Muster nur im Dateinamen (`ordner/*.ts`); ohne `*` die Datei selbst. Sortiert, relativ zum cwd. */
export function expandGlob(pattern: string): string[] {
  const base = path.basename(pattern)
  if (!base.includes('*')) return [pattern]
  const dir = path.dirname(pattern)
  if (!existsSync(dir)) return []
  const re = new RegExp(
    `^${base
      .split('*')
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*')}$`,
  )
  return readdirSync(dir)
    .filter((n) => re.test(n))
    .sort()
    .map((n) => path.join(dir, n))
}

// ---------------------------------------------------------------------------------------------------------------
// Schriften (AK-DS-04)

/** Budget AK-DS-04: genau so viele Schriftdateien, zusammen höchstens so viele Bytes. */
export const FONT_FILES = 4
export const FONT_BUDGET_BYTES = 100 * 1000
const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/

export interface FontReport {
  files: string[]
  bytes: number
  errors: string[]
}

/** AK-DS-04: ausgelieferte WOFF2 in `.next/static` und Google-Fonts-Verweise in Build-Ausgaben. */
export function checkFonts(
  staticDir: string,
  extraDirs: string[] = [],
  budget: Budgets['fonts'] = { files: FONT_FILES, maxBytes: FONT_BUDGET_BYTES },
): FontReport {
  const fonts = listFiles(staticDir, (n) => n.endsWith('.woff2'))
  const bytes = fonts.reduce((sum, f) => sum + statSync(f).size, 0)
  const errors: string[] = []
  if (fonts.length !== budget.files)
    errors.push(`${fonts.length} .woff2-Dateien ausgeliefert, erwartet genau ${budget.files}.`)
  if (bytes > budget.maxBytes)
    errors.push(`Schriften zusammen ${bytes} B, Budget ${budget.maxBytes} B.`)
  // P3.14: TTF/OTF (OG-Schriften aus `src/og/fonts/`) gehen nie an den Browser.
  for (const f of listFiles(staticDir, (n) => /\.(ttf|otf)$/i.test(n)))
    errors.push(`Server-Schrift ${path.basename(f)} wird ausgeliefert (nur für OG-Bilder).`)
  const scanned = [staticDir, ...extraDirs].flatMap((d) =>
    listFiles(d, (n) => /\.(js|css|html|rsc)$/.test(n)),
  )
  for (const file of scanned) {
    if (GOOGLE_FONTS.test(readFileSync(file, 'utf8')))
      errors.push(`Google-Fonts-Verweis in ${path.relative(process.cwd(), file)}.`)
  }
  return { files: fonts.map((f) => path.basename(f)), bytes, errors }
}

// ---------------------------------------------------------------------------------------------------------------
// Gesamtgröße (Bericht)

export interface BundleReport {
  files: number
  rawBytes: number
  gzipBytes: number
}

export function measureBundle(staticDir: string): BundleReport {
  const report: BundleReport = { files: 0, rawBytes: 0, gzipBytes: 0 }
  for (const file of listJs(staticDir)) {
    const data = readFileSync(file)
    report.files++
    report.rawBytes += data.length
    report.gzipBytes += gzipSync(data, { level: 9 }).length
  }
  return report
}

const kb = (b: number) => `${(b / 1000).toFixed(1)} KB`

export function measureFile(file: string): { rawBytes: number; gzipBytes: number } {
  const data = readFileSync(file)
  return { rawBytes: data.length, gzipBytes: gzipSync(data, { level: 9 }).length }
}

// ---------------------------------------------------------------------------------------------------------------
// Lazy-Module (DESIGN §9.10)

/** Budgets JS (gzip) laut DESIGN §9.10 aus `tests/perf/budgets.json`. */
export const MODULE_BUDGETS: readonly ModuleBudget[] = loadBudgets().modules

export interface ModuleReport extends ModuleBudget {
  files: string[]
  rawBytes: number
  gzipBytes: number
  ok: boolean
}

/** Bündelt jedes Modul (bzw. alle Dateien eines Musters zusammen; ESM, minifiziert, Browser) und misst roh/gzip. */
export async function measureModules(
  budgets: readonly ModuleBudget[] = MODULE_BUDGETS,
): Promise<ModuleReport[]> {
  const out: ModuleReport[] = []
  for (const b of budgets) {
    const files = b.entries.flatMap(expandGlob)
    if (files.length === 0) throw new Error(`check:bundle: ${b.name}: keine Datei zu ${b.entries}`)
    const stdin = {
      contents: files
        .map(
          (f, i) => `export * as m${i} from ${JSON.stringify(`./${f.split(path.sep).join('/')}`)}`,
        )
        .join('\n'),
      resolveDir: process.cwd(),
      loader: 'ts' as const,
    }
    const res = await build({
      ...(files.length === 1 ? { entryPoints: files } : { stdin }),
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
      // Nachgeladene Chunks zählen nicht zum Einstieg (P12.4: `coco.ts` lädt `cocoExtra.ts` nach, P12.12: `cocoExtra.ts` lädt `cocoTravel.ts` nach, wie in Next ein
      // eigener Chunk); sie haben ein eigenes Budget.
      plugins: [
        {
          name: 'lazy-chunks',
          setup: (b) =>
            b.onResolve({ filter: /\/(cocoExtra|cocoTravel)$/ }, (a) => ({
              path: a.path,
              external: true,
            })),
        },
      ],
    })
    const data = res.outputFiles[0]!.contents
    const gzipBytes = gzipSync(data, { level: 9 }).length
    out.push({ ...b, files, rawBytes: data.length, gzipBytes, ok: gzipBytes <= b.gzipMax })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// SVG-Dateien (DESIGN §9.10)

/**
 * Reine Entwicklungswerkzeuge mit Copyleft-Lizenz (ARCHITEKTUR §1.2, PLAN P8.14): `potrace` (GPL) darf in keinem
 * Client-Chunk vorkommen. Liefert die Dateien unter `staticDir`, die einen der Begriffe enthalten.
 */
export function findDevOnlyStrings(
  staticDir: string,
  needles: readonly string[] = ['potrace'],
): string[] {
  const pattern = new RegExp(needles.join('|'), 'i')
  return listFiles(staticDir, (n) => /\.(js|css|html|rsc|map)$/.test(n)).filter((f) =>
    pattern.test(readFileSync(f, 'utf8')),
  )
}

export function checkSvgFiles(svg: Budgets['svg']): { lines: string[]; errors: string[] } {
  const lines: string[] = []
  const errors: string[] = []
  const sprite = measureFile(cocoSpriteFile(svg.cocoSprite))
  const spriteLine = `Coco-Sprite ${sprite.rawBytes} B roh / ${sprite.gzipBytes} B gz, Budget ${svg.cocoSprite.rawMax} / ${svg.cocoSprite.gzipMax} B.`
  if (sprite.rawBytes <= svg.cocoSprite.rawMax && sprite.gzipBytes <= svg.cocoSprite.gzipMax)
    lines.push(spriteLine)
  else errors.push(`${spriteLine} ÜBERSCHRITTEN`)
  for (const l of svg.lazy ?? []) {
    const m = measureFile(l.file)
    const line = `${l.name} ${m.rawBytes} B roh / ${m.gzipBytes} B gz, Budget ${l.rawMax} / ${l.gzipMax} B.`
    if (m.rawBytes <= l.rawMax && m.gzipBytes <= l.gzipMax) lines.push(line)
    else errors.push(`${line} ÜBERSCHRITTEN`)
  }
  const each = (glob: string, max: number, label: string) => {
    const files = expandGlob(glob)
    for (const f of files) {
      const bytes = statSync(f).size
      if (bytes > max) errors.push(`${label} ${f}: ${bytes} B, Budget ${max} B. ÜBERSCHRITTEN`)
    }
    lines.push(`${files.length} ${label}-Dateien, jede ≤ ${max} B.`)
  }
  each(svg.stationGlob, svg.stationRawMax, 'Stationszeichnung')
  each(svg.iconGlob, svg.iconRawMax, 'Icon')
  return { lines, errors }
}

// ---------------------------------------------------------------------------------------------------------------
// Seiten (JS beim ersten Laden, Pfaddaten, SVG der Startseite)

export interface PageTarget {
  routeId: string
  locale: 'de' | 'en'
  path: string
  status: number
  /** Variante oder Zustand neben der Beispiel-Adresse (P3.16), z. B. `sold`. */
  variant?: string
  /**
   * P4.25: in der gemeinsamen Kassen-Sitzung messen – vorher legt Chromium wie eine Kundin S01 + S11 in den Korb und
   * klickt „Zur Kasse“ (gefüllter Korb R06, Kasse R07 mit echter Kasse statt 307 auf den Korb).
   */
  session?: 'checkout'
}

/** Seed-Anker im Korb der Messung (SEED-SPEC: S01 Keramik, S11 Textil). */
export const CHECKOUT_SESSION_ITEMS = [901, 911] as const

/**
 * Korb und Kasse gefüllt (T-09, PLAN P4.25): R06/R07 ≤ 220 KB gz ohne Stripe.js (mit `PAYMENTS_DRIVER=mock` lädt die
 * Kasse ohnehin kein Stripe.js). Die Messung legt eine echte Kasse an (Reservierung 30 min in der Datenbank des Servers).
 */
export const P4_SESSION_TARGETS: readonly PageTarget[] = (['de', 'en'] as const).flatMap(
  (locale) => [
    {
      routeId: 'R06',
      locale,
      path: locale === 'de' ? '/de/warenkorb' : '/en/cart',
      status: 200,
      variant: 'gefüllt',
      session: 'checkout' as const,
    },
    {
      routeId: 'R07',
      locale,
      path: locale === 'de' ? '/de/kasse' : '/en/checkout',
      status: 200,
      variant: 'mit Kasse',
      session: 'checkout' as const,
    },
  ],
)

/**
 * Varianten und Zustände der P3-Routen (Seed-Anker des Mini-Beispielbestands, SEED-SPEC): gleiche Budgets wie die Route.
 */
export const P3_VARIANT_TARGETS: readonly PageTarget[] = [
  {
    routeId: 'R02',
    locale: 'de',
    path: '/de/shop?available=1',
    status: 200,
    variant: 'nur verfügbare',
  },
  {
    routeId: 'R05',
    locale: 'en',
    path: '/en/archive?category=ceramics',
    status: 200,
    variant: 'Kategorie',
  },
  {
    routeId: 'R04',
    locale: 'de',
    path: '/de/shop/927-anhaenger-coco-mit-planetenring',
    status: 200,
    variant: 'reserviert',
  },
  {
    routeId: 'R04',
    locale: 'de',
    path: '/de/shop/906-fliese-auftritt',
    status: 200,
    variant: 'sold',
  },
  {
    routeId: 'R04',
    locale: 'en',
    path: '/en/shop/906-tile-on-stage',
    status: 200,
    variant: 'sold',
  },
]

export interface PageMeasurement extends PageTarget {
  scripts: { url: string; gzipBytes: number }[]
  jsGzipBytes: number
  /** Summe der `d`-Attribute aller `<path>` im DOM (Zeichen = Bytes, ASCII). */
  pathDataBytes: number
  /** Inline-`<svg>`-Markup außerhalb der Linien-Ebene + eigene `.svg`-Dateien außer dem Coco-Sprite (roh). */
  svgRawBytes: number
}

/** Budget für JS beim ersten Laden einer Route (gzip, Bytes). */
export function firstLoadBudget(routeId: string, budgets: Budgets): number {
  const map = budgets.firstLoadJs.gzipMax
  return map[routeId] ?? map.default!
}

/** Seiten für `check:bundle`: jede `live`-Seite der Registry je Sprache, dazu R28 (404) und R29 (500). */
export async function pageTargets(): Promise<PageTarget[]> {
  const { ROUTES, LOCALES } = await import('../src/lib/routes/registry')
  const { ROUTE_SAMPLE_PARAMS, samplePath } = await import('../src/lib/routes/paths')
  const out: PageTarget[] = []
  for (const r of ROUTES) {
    if (r.status !== 'live' || r.kind !== 'page') continue
    // Dynamische Muster (z. B. `[token]`) brauchen Daten: nur mit Beispiel-Parametern aus dem Grund-Seed (`R03`).
    const dynamic = r.paths && Object.values(r.paths).some((p) => p.includes('['))
    if (dynamic && !ROUTE_SAMPLE_PARAMS[r.id]) continue
    for (const locale of LOCALES)
      out.push({ routeId: r.id, locale, path: samplePath(r.id, locale), status: 200 })
  }
  for (const locale of LOCALES) {
    out.push({ routeId: 'R28', locale, path: `/${locale}/gibt-es-nicht-bundle`, status: 404 })
    out.push({ routeId: 'R29', locale, path: `/${locale}/__fehler-test`, status: 500 })
  }
  out.push(...P3_VARIANT_TARGETS, ...P4_SESSION_TARGETS)
  return out
}

export interface PageCheck {
  lines: string[]
  errors: string[]
}

/** Vergleicht Seitenmessungen mit den Budgets (rein, ohne Browser – Test mit Fixture-Budget, T-09). */
export function evaluatePages(measurements: PageMeasurement[], budgets: Budgets): PageCheck {
  const lines: string[] = []
  const errors: string[] = []
  for (const m of measurements) {
    const label = `${m.routeId}${m.variant ? ` ${m.variant}` : ''} ${m.locale} (${m.path})`
    const max = firstLoadBudget(m.routeId, budgets)
    const target = budgets.firstLoadJs.gzipTarget[m.routeId]
    const js = `${label}: JS beim ersten Laden ${kb(m.jsGzipBytes)} gz in ${m.scripts.length} Dateien, Budget ${kb(max)}${target ? `, Ziel ${kb(target)}` : ''}.`
    if (m.jsGzipBytes > max) errors.push(`${js} ÜBERSCHRITTEN`)
    else lines.push(target && m.jsGzipBytes > target ? `${js} (Ziel verfehlt – nur Bericht)` : js)
    if (m.pathDataBytes > budgets.svg.pathDataPerPageMax)
      errors.push(
        `${label}: Pfaddaten im DOM ${m.pathDataBytes} B, Budget ${budgets.svg.pathDataPerPageMax} B. ÜBERSCHRITTEN`,
      )
    if (m.routeId === 'R01') {
      const svgLine = `${label}: SVG der Startseite zusammen ${m.svgRawBytes} B roh, Budget ${budgets.svg.homeTotalRawMax} B.`
      if (m.svgRawBytes > budgets.svg.homeTotalRawMax) errors.push(`${svgLine} ÜBERSCHRITTEN`)
      else lines.push(svgLine)
    }
  }
  return { lines, errors }
}

/** `/_next/static/…` (ohne Query) → Datei in `<distDir>/static`. */
export function staticFileFor(url: string, distDir: string): string | null {
  const { pathname } = new URL(url)
  const prefix = '/_next/static/'
  if (!pathname.startsWith(prefix)) return null
  return path.join(distDir, 'static', decodeURIComponent(pathname.slice(prefix.length)))
}

interface BrowserSample {
  scripts: string[]
  status: number
  pathDataBytes: number
  inlineSvgBytes: number
  svgUrls: string[]
}

/** Lädt jede Seite in einem frischen Kontext (Chromium, 390 × 844) und misst. */
export async function measurePages(
  baseURL: string,
  distDir: string,
  targets: PageTarget[],
  spriteFile: string,
): Promise<{ measurements: PageMeasurement[]; errors: string[] }> {
  const { chromium } = await import('@playwright/test')
  const origin = new URL(baseURL).origin
  const browser = await chromium.launch()
  const measurements: PageMeasurement[] = []
  const errors: string[] = []
  const gzCache = new Map<string, number>()
  const newContext = async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    // Keine Fremd-Requests (R-131): alles außer dem eigenen Origin wird abgebrochen.
    await context.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    )
    return context
  }
  let session: Awaited<ReturnType<typeof newContext>> | null = null
  try {
    for (const t of targets) {
      let context: Awaited<ReturnType<typeof newContext>>
      if (t.session) {
        if (!session) {
          session = await newContext()
          await prepareCheckoutSession(session, baseURL)
        }
        context = session
      } else context = await newContext()
      const page = await context.newPage()
      try {
        const res = await page.goto(new URL(t.path, baseURL).href, { waitUntil: 'load' })
        // Linie und Zeichnungen bauen nach dem LCP im Leerlauf auf – für die Pfaddaten kurz warten.
        await page.waitForLoadState('networkidle').catch(() => undefined)
        await page.waitForTimeout(300)
        const sample: BrowserSample = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0] as
            PerformanceNavigationTiming | undefined
          const loadAt = nav?.loadEventStart || Number.POSITIVE_INFINITY
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
          const scripts = resources
            .filter(
              (r) =>
                r.startTime <= loadAt &&
                new URL(r.name).pathname.startsWith('/_next/static/') &&
                new URL(r.name).pathname.endsWith('.js'),
            )
            .map((r) => r.name)
          const svgUrls = resources
            .filter((r) => new URL(r.name).pathname.endsWith('.svg'))
            .map((r) => r.name)
          let pathDataBytes = 0
          for (const p of Array.from(document.querySelectorAll('path')))
            pathDataBytes += p.getAttribute('d')?.length ?? 0
          let inlineSvgBytes = 0
          for (const s of Array.from(document.querySelectorAll('svg'))) {
            if (s.parentElement?.closest('svg')) continue
            if (s.closest('[data-leash-layer]')) continue
            inlineSvgBytes += new TextEncoder().encode(s.outerHTML).length
          }
          return { scripts, status: 0, pathDataBytes, inlineSvgBytes, svgUrls }
        })
        const status = res?.status() ?? 0
        if (status !== t.status)
          errors.push(`${t.routeId} ${t.locale} (${t.path}): HTTP ${status}, erwartet ${t.status}.`)
        const scripts: PageMeasurement['scripts'] = []
        for (const url of [...new Set(sample.scripts)]) {
          const file = staticFileFor(url, distDir)
          if (!file || !existsSync(file)) {
            errors.push(
              `${t.routeId} ${t.locale}: Skript ${url} nicht in ${distDir}/static gefunden.`,
            )
            continue
          }
          let gz = gzCache.get(file)
          if (gz === undefined) {
            gz = measureFile(file).gzipBytes
            gzCache.set(file, gz)
          }
          scripts.push({ url, gzipBytes: gz })
        }
        let svgRawBytes = sample.inlineSvgBytes
        for (const url of [...new Set(sample.svgUrls)]) {
          const pathname = new URL(url).pathname
          const file = path.join('public', decodeURIComponent(pathname))
          if (path.resolve(file) === path.resolve(spriteFile)) continue
          if (existsSync(file)) svgRawBytes += statSync(file).size
        }
        measurements.push({
          ...t,
          scripts,
          jsGzipBytes: scripts.reduce((s, x) => s + x.gzipBytes, 0),
          pathDataBytes: sample.pathDataBytes,
          svgRawBytes,
        })
      } finally {
        if (context === session) await page.close()
        else await context.close()
      }
    }
  } finally {
    await session?.close()
    await browser.close()
  }
  return { measurements, errors }
}

/** Korb mit S01 + S11 füllen (Produktseite, „In den Korb“) und „Zur Kasse“ klicken – wie eine Kundin. */
async function prepareCheckoutSession(
  context: import('@playwright/test').BrowserContext,
  baseURL: string,
): Promise<void> {
  const page = await context.newPage()
  try {
    for (const nr of CHECKOUT_SESSION_ITEMS) {
      await page.goto(new URL(`/nr/${nr}`, baseURL).href, { waitUntil: 'load' })
      // Verhaltensmodule binden erst nach `load` (src/behaviors/index.ts) – vorher wäre es das Formular ohne JS.
      await page.locator('html[data-behaviors-ready]').waitFor({ state: 'attached' })
      await page.locator('[data-add-to-cart] button').first().click()
      await page.locator('[data-buy-area] [data-in-cart]').first().waitFor({ state: 'visible' })
    }
    await page.goto(new URL('/de/warenkorb', baseURL).href, { waitUntil: 'load' })
    await page.locator('[data-cart-checkout] button[type="submit"]').click()
    await page.waitForURL((u) => u.pathname === '/de/kasse', { timeout: 30_000 })
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Server

async function waitForServer(url: string, timeoutMs: number, child?: ChildProcess): Promise<void> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (child && child.exitCode !== null)
      throw new Error(`next start beendet (Code ${child.exitCode}).`)
    try {
      const res = await fetch(url, { redirect: 'manual' })
      await res.arrayBuffer()
      if (res.status < 500) return
    } catch {
      // Server noch nicht bereit.
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server unter ${url} nicht bereit nach ${timeoutMs} ms.`)
}

async function startServer(port: number): Promise<{ baseURL: string; stop: () => void }> {
  const bin = path.resolve('node_modules/.bin/next')
  const child = spawn(bin, ['start', '-p', String(port)], {
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: true,
    env: {
      ...process.env,
      NODE_OPTIONS: '--no-deprecation',
      // R29 (`__fehler-test`) wirft nur bei APP_ENV=test (P2.19) – wie der E2E-Server.
      APP_ENV: process.env.APP_ENV === 'production' ? 'production' : 'test',
    },
  })
  const baseURL = `http://localhost:${port}`
  const stop = () => {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM')
    } catch {
      // bereits beendet
    }
  }
  try {
    await waitForServer(`${baseURL}/de`, 120_000, child)
  } catch (e) {
    stop()
    throw e
  }
  return { baseURL, stop }
}

// ---------------------------------------------------------------------------------------------------------------
// Bild-Budgets (nur Bericht)

export interface ImageSample {
  /** Dateigrößen (Bytes) der Größe `thumb` bzw. `card` je Bild des Beispielbestands. */
  thumbBytes: number[]
  cardBytes: number[]
  /** LCP-Bild der Produktseite im Profil Pixel 7: URL und Bytes (`null`, wenn das LCP kein Bild ist). */
  productLcp: { url: string; bytes: number } | null
}

const medianOf = (values: number[]): number | null => {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor((s.length - 1) / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid]! + s[mid + 1]!) / 2
}

/** Berichtszeilen der Bild-Budgets (DESIGN §12.2) – blockieren nie, Überschreitung als Hinweis. */
export function evaluateImages(sample: ImageSample, budgets: Budgets): string[] {
  const b = budgets.images
  const line = (name: string, value: number | null, max: number, extra = '') =>
    value === null
      ? `Bild-Budget ${name}: keine Datei gefunden${extra} – nur Bericht.`
      : `Bild-Budget ${name}: ${kb(value)}${extra}, Budget ${kb(max)}${value > max ? ' (über Budget – nur Bericht)' : ''}.`
  return [
    line(
      'thumb (Median)',
      medianOf(sample.thumbBytes),
      b.thumbMedianMax,
      ` aus ${sample.thumbBytes.length} Bildern`,
    ),
    line(
      'card (Median)',
      medianOf(sample.cardBytes),
      b.cardMedianMax,
      ` aus ${sample.cardBytes.length} Bildern`,
    ),
    line(
      'LCP-Bild der Produktseite (Pixel 7)',
      sample.productLcp?.bytes ?? null,
      b.productLcpMax,
      sample.productLcp ? ` (${new URL(sample.productLcp.url).pathname})` : '',
    ),
  ]
}

/** URLs aller Bildgrößen `-<größe>-<B>x<H>.<ext>` aus `srcset`/`src` eines HTML-Texts. */
export function sizedImageUrls(html: string, size: string): string[] {
  const out = new Set<string>()
  const re = new RegExp(`(/[^\\s"',]*-${size}-\\d+x\\d+\\.[a-z0-9]+)`, 'gi')
  for (const m of html.replaceAll('&amp;', '&').matchAll(re)) out.add(m[1]!)
  return [...out]
}

/** Misst die Bild-Budgets gegen den laufenden Server (Chromium, Profil Pixel 7 für das LCP-Bild). */
export async function measureImages(baseURL: string): Promise<ImageSample> {
  const { chromium, devices } = await import('@playwright/test')
  const bytesOf = async (url: string) => {
    const res = await fetch(new URL(url, baseURL))
    return res.ok ? (await res.arrayBuffer()).byteLength : null
  }
  const listing = await fetch(new URL('/de/shop', baseURL)).then((r) => r.text())
  const sizes = async (size: string) =>
    (await Promise.all(sizedImageUrls(listing, size).map(bytesOf))).filter(
      (b): b is number => b !== null,
    )
  const [thumbBytes, cardBytes] = [await sizes('thumb'), await sizes('card')]

  const origin = new URL(baseURL).origin
  const browser = await chromium.launch()
  let productLcp: ImageSample['productLcp'] = null
  try {
    const { defaultBrowserType: _ignored, ...pixel7 } = devices['Pixel 7']
    const context = await browser.newContext(pixel7)
    await context.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    )
    const page = await context.newPage()
    const { samplePath } = await import('../src/lib/routes/paths')
    await page.goto(new URL(samplePath('R04', 'de'), baseURL).href, { waitUntil: 'load' })
    const url = await page.evaluate(
      () =>
        new Promise<string | null>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries() as (PerformanceEntry & { url?: string })[]
            resolve(entries.at(-1)?.url || null)
          }).observe({ type: 'largest-contentful-paint', buffered: true })
          setTimeout(() => resolve(null), 3000)
        }),
    )
    if (url) {
      const bytes = await bytesOf(url)
      if (bytes !== null) productLcp = { url, bytes }
    }
    await context.close()
  } finally {
    await browser.close()
  }
  return { thumbBytes, cardBytes, productLcp }
}

// CLI

export interface CliOptions {
  budgetsFile: string
  distDir: string
  baseURL: string | null
  port: number
  pages: boolean
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    budgetsFile: DEFAULT_BUDGETS_FILE,
    distDir: process.env.NEXT_DIST_DIR || '.next',
    baseURL: null,
    port: 3100,
    pages: true,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = () => {
      const v = argv[++i]
      if (!v) throw new Error(`check:bundle: ${a} braucht einen Wert.`)
      return v
    }
    if (a === '--budgets') opts.budgetsFile = value()
    else if (a === '--dist') opts.distDir = value()
    else if (a === '--base-url') opts.baseURL = value()
    else if (a === '--port') opts.port = Number(value())
    else if (a === '--no-pages') opts.pages = false
    else if (a !== '--') throw new Error(`check:bundle: unbekannte Option ${a}`)
  }
  return opts
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  const budgets = loadBudgets(opts.budgetsFile)
  const distDir = path.resolve(opts.distDir)
  const staticDir = path.join(distDir, 'static')
  if (!existsSync(staticDir)) {
    console.error(`check:bundle: ${staticDir} fehlt – zuerst \`pnpm build\` ausführen.`)
    process.exit(1)
  }
  let failed = false
  const report = (ok: string[], bad: string[]) => {
    for (const l of ok) console.log(`check:bundle: ${l}`)
    for (const e of bad) console.error(`check:bundle: ${e}`)
    if (bad.length) failed = true
  }

  const r = measureBundle(staticDir)
  console.log(
    `check:bundle: ${r.files} JS-Dateien in ${path.relative(process.cwd(), staticDir)}, zusammen ${kb(r.rawBytes)} (gzip ${kb(r.gzipBytes)}) – nur Bericht.`,
  )

  const serverApp = path.join(distDir, 'server/app')
  const fonts = checkFonts(staticDir, existsSync(serverApp) ? [serverApp] : [], budgets.fonts)
  report(
    [
      `${fonts.files.length} Schriftdateien, zusammen ${kb(fonts.bytes)} (AK-DS-04, Budget ${kb(budgets.fonts.maxBytes)}).`,
    ],
    fonts.errors,
  )

  for (const m of await measureModules(budgets.modules)) {
    const line = `${m.name} (${m.entries.join(', ')}) gzip ${m.gzipBytes} B, Budget ${m.gzipMax} B.`
    report(m.ok ? [line] : [], m.ok ? [] : [`${line} ÜBERSCHRITTEN`])
  }

  const svg = checkSvgFiles(budgets.svg)
  report(svg.lines, svg.errors)

  const devOnly = findDevOnlyStrings(staticDir)
  report(
    devOnly.length ? [] : ['potrace (GPL, nur devDependency) in keinem Client-Chunk (P8.14).'],
    devOnly.map(
      (f) =>
        `potrace im Client-Chunk ${path.relative(process.cwd(), f)} – nur als Werkzeug erlaubt.`,
    ),
  )

  if (opts.pages) {
    let server: { baseURL: string; stop: () => void } | null = null
    try {
      const baseURL = opts.baseURL ?? (server = await startServer(opts.port)).baseURL
      const targets = await pageTargets()
      const { measurements, errors } = await measurePages(
        baseURL,
        distDir,
        targets,
        cocoSpriteFile(budgets.svg.cocoSprite),
      )
      const pages = evaluatePages(measurements, budgets)
      report(pages.lines, [...errors, ...pages.errors])
      report(evaluateImages(await measureImages(baseURL), budgets), [])
    } finally {
      server?.stop()
    }
  } else {
    console.log('check:bundle: --no-pages – JS je Seite nicht gemessen.')
  }

  if (failed) {
    console.error('check:bundle: Budget überschritten (tests/perf/budgets.json).')
    process.exit(1)
  }
  console.log('check:bundle: alle Budgets eingehalten.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => {
    console.error(`check:bundle: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
