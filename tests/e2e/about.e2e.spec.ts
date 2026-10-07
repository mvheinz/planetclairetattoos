import { expect, test } from './fixtures'
import { type Page } from '@playwright/test'

import { expectNoSeriousViolations } from './axe'
import { testPayload } from './fixtures'

// P8.18 Über mich & Coco (R19, KONZEPT §3.12, SEED-SPEC §13.2, DESIGN §9.7 Preset `about`): Route DE/EN mit Inhalt aus
// `pages:about`, in der Sitemap, canonical + drei hreflang (AK-2-05), keine Abbildung von Jutta ohne Freigabe (R-181),
// Instagram mit `rel="noopener noreferrer"` (R-139), Linie überdeckt keinen Text (DESIGN §9.9), reduzierte Bewegung →
// Linie sofort vollständig und statisch (AK-DS-14), axe ohne serious/critical. Linien-Prüfungen brauchen
// `window.__leash` (Build mit NEXT_PUBLIC_LEASH_DEBUG=1).

const PATHS = { de: '/de/ueber-mich', en: '/en/about' } as const

interface LeashApi {
  geometry: { totalLength: number; lut: Float32Array } | null
  drawnLen(): number
  tier(): string
  preset(): string
}
type LeashWindow = Window & { __leash?: LeashApi }

async function waitForLeash(page: Page) {
  await page.waitForFunction(() => {
    const l = (window as LeashWindow).__leash
    return !!l?.geometry && l.geometry.totalLength > 0
  })
}

for (const locale of ['de', 'en'] as const) {
  test(`AK-2-05 R19 ${PATHS[locale]}: Inhalt, canonical/hreflang, Instagram, Leine-Stationen`, async ({
    page,
  }) => {
    const res = await page.goto(PATHS[locale])
    expect(res?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'about')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('Jutta & Coco')
    const main = page.locator('[data-about-page]')
    await expect(main).toContainText(
      locale === 'de'
        ? 'Das hier ist Planet Claire – mein kleiner Planet in Berlin'
        : 'This is Planet Claire – my small planet in Berlin',
    )
    await expect(main).toContainText(locale === 'de' ? 'Und das ist Coco.' : 'And this is Coco.')
    await expect(main.locator('[data-about-coco] svg')).toHaveCount(1)
    // „Was ich mache“: Shop, Tattoo, Auftragsarbeiten
    const what = main.locator('[data-about-what]')
    await expect(what.locator(`a[href="/${locale}/shop"]`)).toHaveCount(1)
    await expect(what.locator(`a[href="/${locale}/tattoo"]`)).toHaveCount(1)
    await expect(
      what.locator(`a[href="${locale === 'de' ? '/de/auftragsarbeiten' : '/en/commissions'}"]`),
    ).toHaveCount(1)
    // P12.7 (U-15): Das Instagram-Profil ist nur im Fuß verlinkt, nicht im Inhalt der Seite.
    await expect(main.locator('a[href*="instagram.com"], a[href*="ig.me"]')).toHaveCount(0)
    // drei Stationen der Linie: Jutta → Coco → Werkstatt
    expect(
      await page
        .locator('[data-about-page] [data-leash-station]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-leash-station'))),
    ).toEqual(['jutta', 'coco', 'werkstatt'])
    // canonical + hreflang de/en/x-default
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`${PATHS[locale]}$`),
    )
    const hreflang = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((els) =>
        els.map((e) => `${e.getAttribute('hreflang')} ${e.getAttribute('href')}`),
      )
    expect(hreflang).toHaveLength(3)
    expect(hreflang.some((h) => h.startsWith('de ') && h.endsWith(PATHS.de))).toBe(true)
    expect(hreflang.some((h) => h.startsWith('en ') && h.endsWith(PATHS.en))).toBe(true)
    expect(hreflang.some((h) => h.startsWith('x-default '))).toBe(true)
  })
}

test('R19 in sitemap.xml (DE und EN)', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain('/de/ueber-mich</loc>')
  expect(xml).toContain('/en/about')
})

for (const locale of ['de', 'en'] as const) {
  test(`P12.16 Foto Jutta und Coco im Abschnitt „Zu zweit“ (${locale})`, async ({ page }) => {
    await page.goto(PATHS[locale])
    const block = page
      .locator('[data-about-image-text]')
      .filter({ hasText: locale === 'de' ? 'Zu zweit' : 'The two of us' })
    await expect(block).toHaveCount(1)
    const img = block.locator('img').first()
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0))
      .toBe(true)
    expect(((await img.getAttribute('alt')) ?? '').toLowerCase()).toContain(
      locale === 'de' ? 'hund' : 'dog',
    )
  })
}

test('R-181 keine Abbildung von Jutta ohne Freigabe; nur öffentlich sichtbare Bilder', async ({
  page,
}) => {
  const payload = await testPayload()
  const jutta = await payload.find({
    collection: 'media',
    where: { showsPerson: { equals: 'jutta' } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const namesOf = (docs: typeof jutta.docs) =>
    docs.flatMap((m) => [m.filename, ...Object.values(m.sizes ?? {}).map((s) => s?.filename)])
  // Freigegebene Fotos (P12.16: „Zu zweit“) dürfen erscheinen, alle anderen nie.
  const names = namesOf(jutta.docs.filter((m) => m.ownerApproved !== true))
  const approved = namesOf(jutta.docs.filter((m) => m.ownerApproved === true))
  await page.goto(PATHS.de)
  const srcs = await page
    .locator('[data-about-page] img')
    .evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('src')} ${e.getAttribute('srcset') ?? ''}`),
    )
  for (const n of names.filter(Boolean)) for (const s of srcs) expect(s).not.toContain(n as string)
  expect(approved.length).toBeGreaterThan(0)
  expect(srcs.some((s) => approved.some((n) => n && s.includes(n)))).toBe(true)
  for (const img of await page.locator('[data-about-page] img').all())
    expect((await img.getAttribute('alt'))?.trim().length ?? 0).toBeGreaterThan(0)
})

test.describe('R19 Tuschelinie', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name === 'iphone-15',
      'Engine-Prüfungen in Chromium (DESIGN §9.13)',
    )
  })

  test('DESIGN §9.9 Linie überdeckt keinen Text (Preset about)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(PATHS.de)
    await waitForLeash(page)
    expect(await page.evaluate(() => (window as LeashWindow).__leash!.preset())).toBe('about')
    const hits = await page.evaluate(() => {
      // Punkte entlang der gezeichneten Linie in Bildschirmkoordinaten (Mittellinien bzw. Umrisse der Segmente).
      const points: { x: number; y: number }[] = []
      for (const path of Array.from(
        document.querySelectorAll<SVGPathElement>('[data-leash-layer] path'),
      )) {
        const ctm = path.getScreenCTM()
        if (!ctm) continue
        const len = path.getTotalLength()
        for (let d = 0; d <= len; d += 4) {
          const p = path.getPointAtLength(d).matrixTransform(ctm)
          points.push({ x: p.x, y: p.y })
        }
      }
      const rects: DOMRect[] = []
      const walker = document.createTreeWalker(
        document.querySelector('[data-about-page]')!,
        NodeFilter.SHOW_TEXT,
      )
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const r of Array.from(range.getClientRects())) if (r.width > 0) rects.push(r)
      }
      const out: string[] = []
      for (const { x, y } of points)
        for (const r of rects)
          if (x > r.left + 1 && x < r.right - 1 && y > r.top + 1 && y < r.bottom - 1)
            out.push(`${Math.round(x)},${Math.round(y)}`)
      return { count: points.length, hits: out.slice(0, 5) }
    })
    expect(hits.count).toBeGreaterThan(50)
    expect(hits.hits).toEqual([])
  })

  test('AK-DS-14 R19 mit reducedMotion reduce: Linie sofort vollständig, statisch', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(PATHS.de)
    await page.waitForLoadState('load')
    await page.waitForTimeout(1500)
    await waitForLeash(page)
    const s = await page.evaluate(() => {
      const l = (window as LeashWindow).__leash!
      return { tier: l.tier(), full: l.drawnLen() === l.geometry!.totalLength }
    })
    expect(s).toEqual({ tier: 'C', full: true })
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => a.timeline?.constructor?.name !== 'ScrollTimeline')
          .filter((a) => a.playState === 'running').length,
    )
    expect(running).toBe(0)
  })
})

for (const locale of ['de', 'en'] as const)
  test(`axe R19 ${locale} @a11y`, async ({ page }) => {
    await page.goto(PATHS[locale])
    await page.waitForLoadState('networkidle')
    await expectNoSeriousViolations(page, `R19 ${locale}`)
  })
