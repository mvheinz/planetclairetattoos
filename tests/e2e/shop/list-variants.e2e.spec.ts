import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '../fixtures'
import { request as playwrightRequest, type APIResponse } from '@playwright/test'

import { serverURL } from '../../helpers/adminEnv'
import { holdListData } from './fresh'

// P3.2 Spike B-05 (ARCHITEKTUR §9.1, Anhang B; AK-A-9-03): Der Proxy schreibt bekannte Listen-Parameter auf eine
// statische Variante um. Im Produktions-Build (`E2E_SERVER=start`) kommt die Antwort aus dem Cache
// (`x-nextjs-cache: HIT`) bzw. steht im Prerender-Manifest; unbekannte und ungültige Parameter ändern nichts; die
// sichtbare und kanonische URL bleibt die Query-Form; der interne Pfad ist nicht direkt erreichbar. V-12 (P20.3): Im Shop
// gibt es keinen Schalter „nur verfügbare“ mehr – `?available=1` ist dort ein unbekannter Parameter (Grundform); als
// statische Variante dient die Archiv-Kategorie (`?category=keramik`, Beispielstück S06).

const productionBuild = process.env.E2E_SERVER === 'start'

function prerenderManifest(): {
  routes: Record<string, unknown>
  dynamicRoutes: Record<string, unknown>
} {
  const file = path.join(process.env.NEXT_DIST_DIR || '.next', 'prerender-manifest.json')
  expect(existsSync(file), `${file} fehlt – erst pnpm build`).toBe(true)
  return JSON.parse(readFileSync(file, 'utf8')) as {
    routes: Record<string, unknown>
    dynamicRoutes: Record<string, unknown>
  }
}

const cacheOf = (res: APIResponse) => res.headers()['x-nextjs-cache']
const canonicalOf = (html: string) => /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] ?? null

test.describe('Listen-Varianten statisch (Spike B-05) @smoke', () => {
  // Andere Tests ändern den Bestand (exklusiv); jede Änderung erneuert die Tags – der erste Aufruf danach rendert neu
  // (MISS). Deshalb geteilter Lock und ein Aufwärm-Aufruf vor der Cache-Prüfung.
  holdListData(test, 'shared')
  test.beforeEach(({ browserName }, testInfo) => {
    // Reine HTTP-Prüfung: einmal im Desktop-Projekt genügt.
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'nur Desktop/Chromium',
    )
  })

  test('AK-A-9-03 ?category=keramik (Archiv) kommt aus dem Cache, gleiche HTML mit unbekannten/ungültigen Parametern @smoke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: serverURL })
    try {
      await ctx.get('/de/archiv?category=keramik')
      const first = await ctx.get('/de/archiv?category=keramik')
      expect(first.status()).toBe(200)
      expect(first.headers()['set-cookie']).toBeUndefined()
      const html = await first.text()
      expect(html).toContain('data-list-variant="category-keramik"')
      expect(html).toContain('data-preset="shopString"')
      // canonical ohne `category` (KONZEPT §2.3)
      expect(new URL(canonicalOf(html)!).pathname + new URL(canonicalOf(html)!).search).toBe(
        '/de/archiv',
      )

      const same = await ctx.get('/de/archiv?foo=bar&page=0&category=keramik')
      expect(same.status()).toBe(200)
      if (productionBuild) {
        expect(['HIT', 'STALE']).toContain(cacheOf(first))
        expect(['HIT', 'STALE']).toContain(cacheOf(same))
        // Dieselbe Cache-Datei; nach Ablauf (STALE) kann die zweite Antwort schon die erneuerte sein.
        if (cacheOf(first) === 'HIT' && cacheOf(same) === 'HIT')
          expect(await same.text()).toBe(html)
        else expect(await same.text()).toContain('data-list-variant="category-keramik"')
        const manifest = prerenderManifest()
        expect(Object.keys(manifest.routes)).toEqual(
          expect.arrayContaining([
            '/de/archive/variant/category-keramik',
            '/en/archive/variant/category-ceramics',
          ]),
        )
        expect(Object.keys(manifest.dynamicRoutes)).toContain('/[locale]/archive/variant/[variant]')
        // V-12: keine Shop-Variante „nur verfügbare“ mehr
        expect(Object.keys(manifest.routes)).not.toContain('/de/shop/variant/available-1')
      } else {
        expect(await same.text()).toContain('data-list-variant="category-keramik"')
      }
    } finally {
      await ctx.dispose()
    }
  })

  test('V-12 ?available=1 im Shop wird ignoriert: Grundform, kanonisch ohne Parameter @smoke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: serverURL })
    try {
      const res = await ctx.get('/de/shop?available=1')
      expect(res.status()).toBe(200)
      const html = await res.text()
      expect(html).toContain('data-list-variant=""')
      expect(html).not.toContain('data-chip="available"')
      expect(new URL(canonicalOf(html)!).pathname + new URL(canonicalOf(html)!).search).toBe(
        '/de/shop',
      )
    } finally {
      await ctx.dispose()
    }
  })

  test('AK-A-9-03 ?page=2: Variante beim ersten Aufruf erzeugt, danach aus dem Cache @smoke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: serverURL })
    try {
      const first = await ctx.get('/de/shop?page=2')
      // Ohne zweite Seite im Bestand antwortet die Variante mit 404 – auch das kommt statisch aus dem Cache.
      expect([200, 404]).toContain(first.status())
      const again = await ctx.get('/de/shop?page=2&utm_source=instagram&available=1')
      expect(again.status()).toBe(first.status())
      if (productionBuild) {
        expect(['HIT', 'STALE']).toContain(cacheOf(again))
        if (cacheOf(first) === 'HIT' && cacheOf(again) === 'HIT')
          expect(await again.text()).toBe(await first.text())
      }
      if (first.status() === 200) {
        const html = await again.text()
        expect(html).toContain('data-list-variant="page-2"')
        expect(new URL(canonicalOf(html)!).search).toBe('?page=2')
      }
    } finally {
      await ctx.dispose()
    }
  })

  test('interner Varianten-Pfad direkt → 404, ohne Weiterleitung @smoke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: serverURL })
    try {
      for (const p of [
        '/de/shop/variant/available-1',
        '/en/shop/variant/available-1.page-2',
        '/de/archive/variant/page-2',
      ]) {
        const res = await ctx.get(p, { maxRedirects: 0 })
        expect(res.status(), p).toBe(404)
        expect(res.headers()['set-cookie'], p).toBeUndefined()
      }
    } finally {
      await ctx.dispose()
    }
  })
})
