// Korb und Kasse für den Vorschau-Export (PLAN P4.25, KONZEPT §12.5 Nr. 7, §12.7 Nr. 7): Ohne Korb-Cookie zeigt R06 nur
// den leeren Korb, und R07 leitet ohne Kasse auf den Korb um. Deshalb legt der Crawler vor der Breitensuche wie eine
// Kundin die Seed-Anker S01 und S11 in den Korb (Produktseite, „In den Korb“), klickt im Korb „Zur Kasse“ und holt dann
// R06 und R07 je Sprache mit denselben Cookies (`pc_cart`, `pc_checkout`). Die Export-Umgebung setzt
// `PREVIEW_EXPORT=true` – das Zahlungsfeld der Kasse ist ein Platzhalter. Alle Anfragen gehen an den Export-Server;
// fremde Hosts werden abgebrochen. Scheitert ein Schritt, bleibt es beim leeren Korb (Warnung im Bericht, kein Abbruch).
import { localizedPath } from '../../src/lib/routes/paths'
import { LOCALES } from '../../src/lib/routes/registry'

import type { FetchResult } from './crawl'

/** Seed-Anker im Korb der Vorschau (SEED-SPEC: S01 Keramik, S11 Textil mit Abweichung). */
export const CART_ANCHORS = [901, 911] as const

export interface CartSession {
  /** Vorab geholte Seiten (Pfad → Antwort), die der Crawl statt eines eigenen Abrufs verwendet. */
  pages: Map<string, FetchResult>
  warnings: string[]
}

/** Pfade, die die Kassen-Sitzung liefert: R06 und R07 je Sprache. */
export function cartSessionPaths(): string[] {
  return LOCALES.flatMap((l) => [localizedPath('R06', l), localizedPath('R07', l)])
}

export async function captureCartSession(origin: string): Promise<CartSession> {
  const { chromium } = await import('@playwright/test')
  const warnings: string[] = []
  const pages = new Map<string, FetchResult>()
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ baseURL: origin })
    // Der Export-Server leitet `127.0.0.1` auf `localhost` um (next-intl) – beide Namen desselben Ports sind „eigen“.
    const port = new URL(origin).port
    const own = (url: URL) =>
      url.port === port && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    await context.route(
      (url) => !own(url),
      (route) => route.abort(),
    )
    const page = await context.newPage()
    for (const nr of CART_ANCHORS) {
      await page.goto(`/nr/${nr}`, { waitUntil: 'load' })
      // Erst klicken, wenn die Module gebunden sind und der Live-Zustand geladen ist (`data-status-live`, wie die
      // Kaufweg-E2E): Ein Klick davor geht unter Last ins Leere bzw. an die Server-Action ohne JavaScript.
      await page.locator('[data-product-page][data-status-live]').waitFor({ state: 'attached' })
      const button = page.locator('[data-add-to-cart] button').first()
      if (!(await button.count())) {
        warnings.push(`Korb der Vorschau: Stück ${nr} ist nicht bestellbar – Korb bleibt leer.`)
        return { pages: new Map(), warnings }
      }
      await button.click()
      await page.locator('[data-buy-area] [data-in-cart]').first().waitFor({ state: 'visible' })
    }
    // Ab hier dieselbe Adresse wie die Cookies (nach der Umleitung).
    const base = new URL(page.url()).origin
    await page.goto(new URL(localizedPath('R06', 'de'), base).href, { waitUntil: 'load' })
    await page.locator('[data-cart-checkout] button[type="submit"]').click()
    await page.waitForURL((url) => url.pathname === localizedPath('R07', 'de'), { timeout: 30_000 })
    for (const path of cartSessionPaths()) {
      const res = await context.request.get(new URL(path, base).href, {
        maxRedirects: 0,
        failOnStatusCode: false,
      })
      if (res.status() !== 200) {
        warnings.push(`Korb der Vorschau: ${path} antwortet mit HTTP ${res.status()}.`)
        continue
      }
      pages.set(path, {
        status: 200,
        contentType: res.headers()['content-type'] ?? '',
        body: await res.body(),
      })
    }
    // Reservierung wieder freigeben (Stücke aus dem Korb nehmen → Kasse `cancelled`, KONZEPT §4.3 S6): Die Produkt-
    // und Listenseiten, die der Crawl danach holt, zeigen S01 und S11 wieder als verfügbar.
    await page.goto(new URL(localizedPath('R06', 'de'), base).href, { waitUntil: 'load' })
    const lines = page.locator('[data-cart-remove]')
    for (let left = await lines.count(); left > 0; left--) {
      await lines.first().click()
      await page.waitForFunction(
        (n) => document.querySelectorAll('[data-cart-remove]').length < n,
        left,
        { timeout: 15_000 },
      )
    }
    await context.close()
  } catch (e) {
    warnings.push(
      `Korb der Vorschau: ${e instanceof Error ? e.message.split('\n')[0] : String(e)} – Korb bleibt leer.`,
    )
    return { pages: new Map(), warnings }
  } finally {
    await browser.close()
  }
  return { pages, warnings }
}
