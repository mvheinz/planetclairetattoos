import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { APIRequestContext, Page } from '@playwright/test'

import { fillPattern, matchRoute, splitLocale } from '../../../src/lib/routes/paths'
import { decideListVariant } from '../../../src/lib/shop/listParams'
import { serverURL } from '../../helpers/adminEnv'
import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'

// Frischer Stand nach Änderungen per Local API (Fixtures, Einstellungen) – die Tests laufen in einem anderen Prozess
// als der Server, dessen Daten-Cache (`unstable_cache`, ARCHITEKTUR §9.2) sie nicht per Tag erneuern können:
// - `pnpm dev`: Anfragen mit `Cache-Control: no-cache` lesen am Daten-Cache vorbei (Next im Entwicklungsmodus).
// - `pnpm start`: die betroffenen Seiten werden per On-Demand-Revalidierung neu erzeugt (wie `global-setup.ts`, Kopf
//   `x-prerender-revalidate` mit der `previewModeId` des Builds); dabei liest `unstable_cache` frisch aus der DB.

const productionBuild = process.env.E2E_SERVER === 'start'
export const NO_CACHE = { 'cache-control': 'no-cache' } as const

/** Seite (und ihre Unteranfragen) ohne Daten-Cache im Entwicklungsmodus. */
export async function freshPage(page: Page): Promise<void> {
  if (!productionBuild) await page.setExtraHTTPHeaders(NO_CACHE)
}

/** Interner Pfad (Ordner = EN-Pfade, statische Listen-Variante) einer sichtbaren URL. */
export function internalPath(url: string): string {
  const u = new URL(url, 'http://x')
  const variant = decideListVariant(u.pathname, u.search)
  if (variant.kind === 'rewrite') return variant.pathname
  const split = splitLocale(u.pathname)
  const match = split && matchRoute(split.rest, split.locale)
  if (!split || !match?.route.key) return u.pathname
  // R04: der Ordner `[product]` fasst `[nummer]-[slug]` in einem Segment zusammen.
  const params =
    match.route.id === 'R04'
      ? { product: `${match.params.nummer}-${match.params.slug}` }
      : match.params
  const folder = fillPattern(match.route.key, params)
  return folder === '/' ? `/${split.locale}` : `/${split.locale}${folder}`
}

/** Im Produktions-Build: die Seiten neu erzeugen, bevor der Test sie aufruft. */
export async function refresh(request: APIRequestContext, urls: string[]): Promise<void> {
  if (!productionBuild) return
  const file = path.join(process.env.NEXT_DIST_DIR || '.next', 'prerender-manifest.json')
  if (!existsSync(file)) return
  const { preview } = JSON.parse(readFileSync(file, 'utf8')) as {
    preview: { previewModeId: string }
  }
  for (const url of urls) {
    await request.get(new URL(internalPath(url), serverURL).toString(), {
      headers: { 'x-prerender-revalidate': preview.previewModeId },
      maxRedirects: 0,
      failOnStatusCode: false,
    })
  }
}

interface TestHooks {
  beforeEach(fn: () => Promise<void>): void
  afterEach(fn: () => Promise<void>): void
}

/**
 * Listen-Bestand teilen (Advisory-Lock `holdFixtureRange`): Tests, die den Bestand nur lesen und bestimmte Stücke
 * erwarten, halten ihn geteilt; Tests, die Stücke anlegen oder den Beispielbestand kurz ändern (Paginierung,
 * Leerzustand), exklusiv – parallele Projekte sehen so nie einen Zwischenstand.
 */
export function holdListData(t: TestHooks, mode: 'shared' | 'exclusive'): void {
  let release: ReleaseLock | undefined
  t.beforeEach(async () => {
    release = await holdFixtureRange(mode)
  })
  t.afterEach(async () => {
    await release?.()
    release = undefined
  })
}
