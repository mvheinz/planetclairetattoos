import { spawn, type ChildProcess } from 'node:child_process'

import { expect, test, type Page } from '@playwright/test'

// P9.1 QA-Modus (KUNST-QA §3.1/§3.2, ARCHITEKTUR §5.2 `ART_QA`): ohne Schalter sind die QA-Seiten 404 und nirgends
// verlinkt (Sitemap, robots), Query-Schalter wirken nicht. Mit `ART_QA=1` (zweiter Server aus demselben Build bzw.
// eigener Dev-Server) antworten die QA-Seiten, `?leash=off` lädt keinen Engine-Chunk (Request-Protokoll) und
// `?freeze=1` setzt alle zeitbasierten Abläufe auf ihren Endzustand.

const QA_PAGES = ['coco', 'art', 'motion?mi=MI-03', 'leash?preset=journey&stations=3']

test.describe('P9.1 ohne ART_QA', () => {
  test('P9.1 QA-Seiten sind 404', async ({ request }) => {
    for (const locale of ['de', 'en'])
      for (const p of [...QA_PAGES, 'error']) {
        const res = await request.get(`/${locale}/qa/${p}`)
        expect(res.status(), `/${locale}/qa/${p}`).toBe(404)
      }
  })

  test('P9.1 QA-Seiten stehen weder in sitemap.xml noch in robots.txt', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain('<urlset')
    expect(sitemap).not.toMatch(/\/qa(\/|<|")/)
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).not.toMatch(/\/qa\b/)
  })

  test('P9.1 Query-Schalter wirken ohne ART_QA nicht', async ({ page }) => {
    await page.goto('/de?freeze=1&leash=off&qa-jank=30')
    await expect(page.locator('meta[name="pc-art-qa"]')).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveAttribute('data-qa-freeze', /.*/)
    // Die Linie lädt trotz `?leash=off`.
    await expect(page.locator('[data-leash-layer] svg path').first()).toBeAttached({
      timeout: 15_000,
    })
  })
})

// ---------- mit ART_QA ----------

let server: ChildProcess | null = null
let qaBase = ''

async function waitUp(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const ok = await fetch(url)
      .then((r) => r.status < 500)
      .catch(() => false)
    if (ok) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`QA-Server unter ${url} nicht erreichbar`)
}

/** JavaScript-Anfragen einer Seite bis zur Ruhe (Linie gezeichnet bzw. 4 s nach `load`). */
async function scriptRequests(page: Page, url: string, waitLeash: boolean): Promise<Set<string>> {
  const seen = new Set<string>()
  const onRequest = (r: { url(): string; resourceType(): string }) => {
    if (r.resourceType() === 'script') seen.add(new URL(r.url()).pathname)
  }
  page.on('request', onRequest)
  await page.goto(url, { waitUntil: 'load' })
  if (waitLeash)
    await expect(page.locator('[data-leash-layer] svg path').first()).toBeAttached({
      timeout: 15_000,
    })
  else await page.waitForTimeout(4000)
  page.off('request', onRequest)
  return seen
}

test.describe('P9.1 mit ART_QA', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(300_000)
    const port = 3290 + testInfo.workerIndex
    qaBase = `http://localhost:${port}`
    const prod = process.env.E2E_SERVER === 'start'
    const env = {
      ...process.env,
      ART_QA: '1',
      APP_ENV: 'test',
      PORT: String(port),
      NODE_OPTIONS: '--no-deprecation',
      PAYLOAD_DB_PUSH: 'false',
      // Dev-Modus: eigenes Build-Verzeichnis, damit der Haupt-Dev-Server unberührt bleibt.
      ...(prod ? {} : { NEXT_DIST_DIR: '.next-qa-e2e' }),
    }
    const cmd = prod ? `pnpm exec next start -p ${port}` : `pnpm exec next dev -p ${port}`
    server = spawn(cmd, { shell: true, env, stdio: 'ignore', detached: true })
    await waitUp(`${qaBase}/de/qa/coco`, prod ? 60_000 : 240_000)
  })

  test.afterAll(() => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM')
      } catch {
        // schon beendet
      }
    }
    server = null
  })

  test('P9.1 QA-Seiten antworten 200 (de/en), /qa/error löst die 500-Seite aus', async ({
    request,
  }) => {
    for (const locale of ['de', 'en'])
      for (const p of QA_PAGES) {
        const res = await request.get(`${qaBase}/${locale}/qa/${p}`)
        expect(res.status(), `/${locale}/qa/${p}`).toBe(200)
        expect(res.headers()['x-robots-tag'] ?? (await res.text())).toMatch(/noindex/)
      }
    expect((await request.get(`${qaBase}/de/qa/error`)).status()).toBe(500)
    // Sitemap und robots bleiben auch im QA-Modus ohne QA-Seiten.
    expect(await (await request.get(`${qaBase}/sitemap.xml`)).text()).not.toMatch(/\/qa(\/|<|")/)
  })

  test('P9.1 /qa/coco zeigt alle 22 Symbole in 7 Größen', async ({ page }) => {
    await page.goto(`${qaBase}/de/qa/coco`)
    await expect(page.locator('tr[data-qa-row]')).toHaveCount(10)
    await expect(page.locator('[data-qa-symbol]')).toHaveCount(70)
    const ids = await page
      .locator('[data-qa-symbol]')
      .evaluateAll((els) => [
        ...new Set(els.flatMap((e) => e.getAttribute('data-qa-symbol')!.split(' '))),
      ])
    expect(ids).toHaveLength(22)
    await page.goto(`${qaBase}/de/qa/coco?parts=1&frame=b`)
    await expect(page.locator('[data-qa-symbol] [data-part="ear-l"]').first()).toBeAttached()
    await expect(page.locator('[data-qa-symbol] use')).toHaveCount(0)
  })

  test('P9.1 ?leash=off lädt keinen Engine-Chunk', async ({ page }) => {
    const url = `${qaBase}/de/qa/leash?preset=journey&stations=3`
    const withEngine = await scriptRequests(page, url, true)
    const without = await scriptRequests(page, `${url}&leash=off`, false)
    const engineChunks = [...withEngine].filter((p) => !without.has(p))
    expect(engineChunks.length, 'Engine-Chunks nur mit Linie').toBeGreaterThan(0)
    await expect(page.locator('[data-leash-layer] svg')).toHaveCount(0)
  })

  test('P9.1 ?freeze=1: Endzustand ohne laufende Animationen', async ({ page }) => {
    await page.goto(`${qaBase}/de/qa/coco?freeze=1`)
    await expect(page.locator('html')).toHaveAttribute('data-qa-freeze', '')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
    await expect
      .poll(() =>
        page.evaluate(
          () => document.getAnimations().filter((a) => a.playState === 'running').length,
        ),
      )
      .toBe(0)
    await page.goto(`${qaBase}/de/qa/leash?preset=journey&stations=3&freeze=1`)
    await expect(page.locator('[data-leash-layer] svg path').first()).toBeAttached({
      timeout: 15_000,
    })
    await expect
      .poll(() =>
        page.evaluate(
          () => document.getAnimations().filter((a) => a.playState === 'running').length,
        ),
      )
      .toBe(0)
  })
})
