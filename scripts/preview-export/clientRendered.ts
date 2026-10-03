// Seiten, deren Server-HTML nur die Fehler-Hülle von Next ist (`<html id="__next_error__">`), z. B. die 404-Variante
// „schon ein Zuhause“ einer Produktseite (`notFound()` in der ISR-Route R04, Seed-Anker S08, PLAN P8.21): Der Inhalt
// kommt dort erst im Browser aus dem RSC-Datenstrom. Für die Vorschau-Datei öffnet der Export solche Seiten deshalb in
// Chromium (nur der Export-Server, fremde Hosts werden abgebrochen) und übernimmt das fertige DOM als Antwort mit dem
// Status des Servers. Scheitert ein Schritt, bleibt die Seite beim normalen Abruf (Warnung im Bericht).
import { localizedPath } from '../../src/lib/routes/paths'
import { LOCALES } from '../../src/lib/routes/registry'

import { seedProductSlugs, type FetchResult } from './crawl'

/** Pfade der 404-Variante „schon ein Zuhause“ (S08) je Sprache. */
export function clientRenderedPaths(): string[] {
  const s08 = seedProductSlugs('S08')
  return LOCALES.map((lang) => localizedPath('R04', lang, s08[lang]))
}

export async function captureClientRendered(
  origin: string,
  paths: readonly string[] = clientRenderedPaths(),
): Promise<{ pages: Map<string, FetchResult>; warnings: string[] }> {
  const { chromium } = await import('@playwright/test')
  const pages = new Map<string, FetchResult>()
  const warnings: string[] = []
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ baseURL: origin, reducedMotion: 'reduce' })
    const port = new URL(origin).port
    const own = (url: URL) =>
      url.port === port && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    await context.route(
      (url) => !own(url),
      (route) => route.abort(),
    )
    const page = await context.newPage()
    for (const path of paths) {
      try {
        const res = await page.goto(path, { waitUntil: 'load' })
        await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 30_000 })
        const html = await page.evaluate(
          () => `<!DOCTYPE html>${document.documentElement.outerHTML}`,
        )
        pages.set(path, {
          status: res?.status() ?? 200,
          contentType: 'text/html; charset=utf-8',
          body: Buffer.from(html, 'utf8'),
        })
      } catch (e) {
        warnings.push(
          `Im Browser gerendert: ${path} – ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`,
        )
      }
    }
    await context.close()
  } finally {
    await browser.close()
  }
  return { pages, warnings }
}
