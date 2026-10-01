// Crawl des Vorschau-Exports (ARCHITEKTUR §14.4, KONZEPT §12.3 Nr. 4). Erfasst wird der Körper der Antwort
// (serverseitiges HTML), nicht der DOM nach Skripten; dazu alle Stylesheets, Schriften, Bilder und SVG-Sprites, die der
// laufende Server ausliefert. Angefragt wird ausschließlich der Export-Server (nur Pfade, nie absolute URLs) – keine
// Anfrage an fremde Hosts. Die Filter und die Start-Menge sind rein und in Unit-Tests geprüft.
import * as cheerio from 'cheerio'

import { localizedPath } from '../../src/lib/routes/paths'
import { seedToken } from '../../src/lib/seed/tokens'
import { LOCALES, ROUTES, type Locale, type RouteEntry } from '../../src/lib/routes/registry'

import { ExportError } from './errors'

/** Query-Parameter, die beim Crawl erhalten bleiben (alle anderen werden entfernt). */
export const KEPT_QUERY = ['available', 'category', 'kind', 'page'] as const
export const MAX_PAGES = 500
export const CONCURRENCY = 4
/** Gespeicherter Pfad der 404-Seite je Sprache. */
export const NOT_FOUND_PATHS: Record<Locale, string> = { de: '/de/__404', en: '/en/__404' }

// ---------- Filter ----------

/** Ausgelassen: `/api/*`, `ADMIN_ROUTE`, `/_next/*`, Pfade mit Dateiendung (PDFs usw. → „nicht enthalten“). */
export function isExcludedPath(pathname: string, adminRoute: string): boolean {
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  if (under('/api') || under('/_next') || under(adminRoute)) return true
  const last = pathname.split('/').pop() ?? ''
  return /\.[a-z0-9]{1,5}$/i.test(last)
}

/** Pfad plus erlaubte, sortierte Query-Parameter (deterministisch). */
export function canonicalPath(url: URL): string {
  const params = [...url.searchParams.entries()]
    .filter(([k]) => (KEPT_QUERY as readonly string[]).includes(k))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
  const qs = new URLSearchParams(params).toString()
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
  return qs ? `${path}?${qs}` : path
}

const BASE = 'http://export.invalid'

/**
 * Interner Link (`a[href^="/"]`) → kanonischer Pfad zum Crawlen, sonst `null` (extern, `mailto:`, Protokoll-relativ,
 * reiner Anker, ausgelassene Pfade).
 */
export function crawlTarget(href: string | undefined, adminRoute: string): string | null {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null
  let url: URL
  try {
    url = new URL(href, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  if (isExcludedPath(url.pathname, adminRoute)) return null
  return canonicalPath(url)
}

/** Sprache eines Pfads (`/de/…`, `/en/…`); sonst `null`. */
export function pathLocale(path: string): Locale | null {
  const seg = path.split(/[/?#]/)[1]
  return (LOCALES as readonly string[]).includes(seg ?? '') ? (seg as Locale) : null
}

// ---------- Start-Menge ----------

export interface StartEntry {
  path: string
  lang: Locale
  /** Registry-Route, sonst `null` (404-Seiten). */
  routeId: string | null
  /** `404` = die Antwort 404 ist erwartet (Seite `/de/__404`). */
  expect: 200 | 404
}

/**
 * Parameter-Belegungen je Registry-Route mit Parametern (z. B. Seed-Token der Danke- und Statusseiten, SEED-SPEC §17).
 * Routen ohne Eintrag werden über die Breitensuche gefunden (Stücke, Kategorien).
 */
export type ParamProvider = (
  route: RouteEntry,
) => { lang: Locale; params: Record<string, string> }[]

/**
 * Seed-Anker der Danke- und Statusseiten (SEED-SPEC §17): Danke O14 (bezahlt, EN) und O13 (Vorkasse, DE), Status O10
 * (versendet), O13 (Vorkasse offen), O01 (erstattet) je Sprache. Token deterministisch aus dem `seedKey` (§2.5), nur
 * für `seed: true`.
 */
export const seedParamProvider: ParamProvider = (route) => {
  if (route.pageType === 'thankYou') {
    return [
      { lang: 'de', params: { token: seedToken('checkouts:O13', 'checkout') } },
      { lang: 'en', params: { token: seedToken('checkouts:O14', 'checkout') } },
    ]
  }
  if (route.pageType === 'orderStatus') {
    return ['O10', 'O13', 'O01'].flatMap((key) =>
      LOCALES.map((lang) => ({ lang, params: { token: seedToken(`orders:${key}`, 'status') } })),
    )
  }
  return []
}

export function startSet(
  routes: readonly RouteEntry[] = ROUTES,
  provider: ParamProvider = () => [],
): StartEntry[] {
  const out: StartEntry[] = []
  for (const r of routes) {
    if (r.kind !== 'page' || !r.paths || r.status === 'planned') continue
    const hasParams = LOCALES.some((l) => r.paths![l].includes('['))
    if (!hasParams) {
      for (const lang of LOCALES)
        out.push({ path: localizedPath(r.id, lang), lang, routeId: r.id, expect: 200 })
    } else {
      for (const { lang, params } of provider(r))
        out.push({ path: localizedPath(r.id, lang, params), lang, routeId: r.id, expect: 200 })
    }
  }
  for (const lang of LOCALES)
    out.push({ path: NOT_FOUND_PATHS[lang], lang, routeId: null, expect: 404 })
  return out
}

// ---------- Abruf ----------

export interface FetchResult {
  status: number
  contentType: string
  body: Buffer
  location?: string
}

/** Holt einen Pfad **vom Export-Server** (nie eine absolute URL) ohne Weiterleitungen zu folgen. */
export type Fetcher = (path: string) => Promise<FetchResult>

export interface CrawledPage {
  path: string
  lang: Locale
  routeId: string | null
  status: number
  html: string
}

export interface NotBuiltRoute {
  routeId: string
  path: string
  lang: Locale
}

export interface CrawledAsset {
  path: string
  contentType: string
  body: Buffer
}

export interface CrawlResult {
  pages: CrawledPage[]
  notBuilt: NotBuiltRoute[]
  /** Interne Weiterleitungen (Quelle → Ziel), z. B. Kurz-URLs. */
  redirects: Record<string, string>
  /** Gefundene Links auf Seiten, die nicht exportiert werden (404, ausgelassen). */
  missing: string[]
  assets: Map<string, CrawledAsset>
  warnings: string[]
}

export interface CrawlOptions {
  adminRoute: string
  start: StartEntry[]
  /**
   * Vorab geholte Seiten (Pfad → Antwort) statt eines eigenen Abrufs – Korb und Kasse mit den Cookies der
   * Kassen-Sitzung (`cartSession.ts`, PLAN P4.25).
   */
  pinned?: ReadonlyMap<string, FetchResult>
  maxPages?: number
  concurrency?: number
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++]!
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
}

/** Breitensuche über interne Links (höchstens `maxPages` Seiten), danach Dateien. 5xx → ExportError Exit 1. */
export async function crawl(fetcher: Fetcher, options: CrawlOptions): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? MAX_PAGES
  const concurrency = options.concurrency ?? CONCURRENCY
  const seen = new Set<string>()
  const pages = new Map<string, CrawledPage>()
  const notBuilt: NotBuiltRoute[] = []
  const redirects: Record<string, string> = {}
  const missing = new Set<string>()
  const warnings: string[] = []
  let level: StartEntry[] = []
  for (const s of options.start) {
    if (seen.has(s.path)) continue
    seen.add(s.path)
    level.push(s)
  }

  const visit = async (entry: StartEntry, next: StartEntry[]) => {
    const res = options.pinned?.get(entry.path) ?? (await fetcher(entry.path))
    if (res.status >= 500) {
      throw new ExportError(1, `Crawl: ${entry.path} antwortet mit HTTP ${res.status}.`)
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      const loc = new URL(res.location, new URL(entry.path, BASE))
      const target =
        loc.origin === BASE ? crawlTarget(loc.pathname + loc.search, options.adminRoute) : null
      if (target) {
        redirects[entry.path] = target
        next.push({ ...entry, path: target, expect: 200 })
      } else missing.add(entry.path)
      return
    }
    if (res.status === 404 && entry.expect !== 404) {
      if (entry.routeId)
        notBuilt.push({ routeId: entry.routeId, path: entry.path, lang: entry.lang })
      else missing.add(entry.path)
      return
    }
    if (res.status !== 200 && !(res.status === 404 && entry.expect === 404)) {
      warnings.push(`Crawl: ${entry.path} antwortet mit HTTP ${res.status} – ausgelassen.`)
      missing.add(entry.path)
      return
    }
    if (!res.contentType.includes('text/html')) {
      missing.add(entry.path)
      return
    }
    const html = res.body.toString('utf8')
    pages.set(entry.path, {
      path: entry.path,
      lang: entry.lang,
      routeId: entry.routeId,
      status: res.status,
      html,
    })
    const $ = cheerio.load(html)
    $('a[href^="/"]').each((_, el) => {
      const target = crawlTarget($(el).attr('href'), options.adminRoute)
      if (!target) return
      const lang = pathLocale(target)
      if (!lang) {
        // Pfad ohne Sprache (Kurz-URL): wird über die Weiterleitung aufgelöst.
        next.push({ path: target, lang: entry.lang, routeId: null, expect: 200 })
        return
      }
      next.push({ path: target, lang, routeId: null, expect: 200 })
    })
  }

  while (level.length > 0) {
    const next: StartEntry[] = []
    await pool(level, concurrency, (e) => visit(e, next))
    level = []
    for (const e of next.sort((a, b) => a.path.localeCompare(b.path))) {
      if (seen.has(e.path)) continue
      if (seen.size >= maxPages) {
        warnings.push(`Crawl: Obergrenze ${maxPages} Seiten erreicht – ${e.path} ausgelassen.`)
        missing.add(e.path)
        seen.add(e.path)
        continue
      }
      seen.add(e.path)
      level.push(e)
    }
  }

  const sortedPages = [...pages.values()].sort((a, b) => a.path.localeCompare(b.path))
  const assets = await collectAssets(fetcher, sortedPages, warnings)
  return {
    pages: sortedPages,
    notBuilt: notBuilt.sort((a, b) => a.path.localeCompare(b.path)),
    redirects,
    missing: [...missing].sort(),
    assets,
    warnings,
  }
}

// ---------- Dateien ----------

/** Verweise auf Dateien im HTML: Stylesheets, Bilder, `srcset`, `<use href="/…svg#id">`, Inline-`url()`. */
export function assetRefs(html: string): string[] {
  const $ = cheerio.load(html)
  const refs = new Set<string>()
  const add = (v: string | undefined) => {
    if (v && v.trim()) refs.add(v.trim())
  }
  $('link[rel~="stylesheet"][href]').each((_, el) => add($(el).attr('href')))
  $('img[src]').each((_, el) => add($(el).attr('src')))
  $('img[srcset], source[srcset]').each((_, el) => {
    for (const part of ($(el).attr('srcset') ?? '').split(',')) add(part.trim().split(/\s+/)[0])
  })
  $('video[poster]').each((_, el) => add($(el).attr('poster')))
  $('use').each((_, el) => {
    const href = $(el).attr('href') ?? $(el).attr('xlink:href')
    if (href && !href.startsWith('#')) add(href.split('#')[0])
  })
  $('[style*="url("]').each((_, el) => {
    for (const u of cssUrls($(el).attr('style') ?? '')) add(u)
  })
  return [...refs].filter((r) => !r.startsWith('data:')).sort()
}

/**
 * `url(…)`-Verweise in CSS (ohne `data:` und ohne Fragment-Verweise). `url(%23id)` steht in SVG-Daten-URIs (z. B. die
 * Schraffur des Verkauft-Stempels) und meint ein Element im selben SVG, keine Datei.
 */
export function cssUrls(css: string): string[] {
  const out: string[] = []
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const u = m[2]!.trim()
    if (!u.startsWith('data:') && !u.startsWith('#') && !/^%23/i.test(u)) out.push(u)
  }
  return out
}

/** Absoluter Pfad eines Verweises relativ zu `from`; fremder Host → `null`. */
export function resolveAssetPath(ref: string, from: string): string | null {
  const url = new URL(ref, new URL(from, BASE))
  if (url.origin !== BASE) return null
  return url.pathname + url.search
}

async function collectAssets(
  fetcher: Fetcher,
  pages: CrawledPage[],
  warnings: string[],
): Promise<Map<string, CrawledAsset>> {
  const assets = new Map<string, CrawledAsset>()
  const queue: { ref: string; from: string }[] = []
  for (const p of pages) for (const ref of assetRefs(p.html)) queue.push({ ref, from: p.path })
  const fetchOne = async ({ ref, from }: { ref: string; from: string }, next: typeof queue) => {
    const path = resolveAssetPath(ref, from)
    if (!path) {
      warnings.push(`Fremde Datei ${ref} auf ${from} – nicht geladen.`)
      return
    }
    if (assets.has(path)) return
    assets.set(path, { path, contentType: '', body: Buffer.alloc(0) })
    const res = await fetcher(path)
    if (res.status !== 200) {
      assets.delete(path)
      if (res.status >= 500)
        throw new ExportError(1, `Datei ${path} antwortet mit HTTP ${res.status}.`)
      warnings.push(`Datei ${path} antwortet mit HTTP ${res.status} – ausgelassen.`)
      return
    }
    assets.set(path, { path, contentType: res.contentType, body: res.body })
    if (res.contentType.includes('text/css')) {
      for (const u of cssUrls(res.body.toString('utf8'))) next.push({ ref: u, from: path })
    }
  }
  let level = queue
  while (level.length > 0) {
    const next: typeof queue = []
    await pool(level, CONCURRENCY, (item) => fetchOne(item, next))
    level = next
  }
  return new Map([...assets.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/** Fetcher über Playwrights `APIRequestContext` gegen den Export-Server (keine Weiterleitungen, keine Fremd-Hosts). */
export async function createServerFetcher(
  origin: string,
): Promise<{ fetch: Fetcher; close: () => Promise<void> }> {
  const { request } = await import('@playwright/test')
  const ctx = await request.newContext({ baseURL: origin })
  return {
    fetch: async (path) => {
      if (!path.startsWith('/') || path.startsWith('//')) {
        throw new ExportError(1, `Crawl: nur Pfade des Export-Servers erlaubt (${path}).`)
      }
      const res = await ctx.get(path, { maxRedirects: 0, failOnStatusCode: false, timeout: 60_000 })
      const headers = res.headers()
      return {
        status: res.status(),
        contentType: headers['content-type'] ?? '',
        body: await res.body(),
        // Absolute Weiterleitung auf den Export-Server → Pfad; fremde Ziele bleiben absolut (werden nicht verfolgt).
        location: headers.location?.startsWith(origin)
          ? headers.location.slice(origin.length) || '/'
          : headers.location,
      }
    },
    close: () => ctx.dispose(),
  }
}
