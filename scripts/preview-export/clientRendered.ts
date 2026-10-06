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

const ATTEMPTS = 3

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
    // Nur die Skripte, die das Server-HTML selbst nennt (Seitenrahmen, RSC-Datenstrom samt Client-Referenzen). Später
    // nachgeladene Chunks – Verhaltensmodule und Linien-Engine, die erst nach `load` binden (P7) – bricht der Export
    // ab: Sonst hinge es vom Zeitpunkt des DOM-Abzugs ab, ob Menü, Korbzahl oder Animationen-Schalter schon gebunden
    // sind, und zwei Läufe wären nicht byte-gleich (AK-A-14-01). Das Ergebnis entspricht dem Server-HTML der übrigen
    // Seiten (Zustand vor den Verhaltensmodulen).
    const allowed = new Set<string>()
    await context.route(
      (url) =>
        own(url) && url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js'),
      (route) =>
        allowed.has(new URL(route.request().url()).pathname) ? route.continue() : route.abort(),
    )
    // Mehrere Versuche mit frischer Seite: Die erste Antwort einer kalten ISR-Route kann unvollständig sein; ein
    // einzelner Fehlschlag (CI: nur die EN-Variante, einmal 30 s Zeitüberschreitung) darf den Export nicht kippen.
    for (const path of paths) {
      const problems: string[] = []
      for (let attempt = 1; attempt <= ATTEMPTS && !pages.has(path); attempt++) {
        const page = await context.newPage()
        const seen: string[] = []
        page.on('pageerror', (err) => seen.push(`pageerror: ${err.message.split('\n')[0]}`))
        page.on('console', (msg) => {
          if (msg.type() === 'error') seen.push(`console: ${msg.text().slice(0, 160)}`)
        })
        page.on('requestfailed', (req) => seen.push(`abgebrochen: ${req.url().slice(0, 120)}`))
        try {
          const shell = await (await context.request.get(path)).text()
          // Pfade stehen im HTML absolut (`/_next/static/…`) oder im RSC-Datenstrom relativ (`static/chunks/…`).
          for (const m of shell.matchAll(/(?:\/_next\/)?(static\/[^"'\s\\)]+?\.js)/g))
            allowed.add(`/_next/${m[1]}`)
          const res = await page.goto(path, { waitUntil: 'load' })
          await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 20_000 })
          const html = await page.evaluate(
            () => `<!DOCTYPE html>${document.documentElement.outerHTML}`,
          )
          pages.set(path, {
            status: res?.status() ?? 200,
            contentType: 'text/html; charset=utf-8',
            body: Buffer.from(html, 'utf8'),
          })
        } catch (e) {
          problems.push(
            `Versuch ${attempt}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}` +
              (seen.length ? ` [${seen.slice(0, 6).join(' | ')}]` : ''),
          )
        } finally {
          await page.close()
        }
      }
      if (!pages.has(path)) warnings.push(`Im Browser gerendert: ${path} – ${problems.join(' ; ')}`)
    }
    await context.close()
  } finally {
    await browser.close()
  }
  return { pages, warnings }
}
