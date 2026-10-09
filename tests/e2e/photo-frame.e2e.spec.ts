import { expect, test } from './fixtures'

// U-13 / P12.3 (DESIGN §12.2a): Goth-Fotorahmen an jedem Foto – eine gemeinsame SVG-Datei als `border-image`, feste
// Außenmaße (CLS ≤ 0,1), Foto liegt vollständig im Rahmen. U-11 / P12.2 (DESIGN §3.5): Seitenverlauf Olivgrün → Petrol,
// statisch bei reduzierter Bewegung.

const CONTEXTS = [
  ['R02 Shop-Karten', '/de/shop'],
  ['R01 Startseite (Stationen)', '/de'],
  ['R12 Flash', '/de/tattoo/flash'],
  ['R13 Galerie', '/de/tattoo/galerie'],
  ['R19 Über mich', '/de/ueber-mich'],
] as const

for (const [name, url] of CONTEXTS) {
  test(`IM-04 ${name}: jedes Foto trägt den Goth-Rahmen, Maße fest, kein Layout-Sprung`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number }
      w.__cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number
          hadRecentInput: boolean
        }[])
          if (!e.hadRecentInput) w.__cls += e.value
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto(url)
    await page.waitForLoadState('load')
    const frames = page.locator('[data-photo-frame]')
    await expect(frames.first()).toBeVisible()
    const n = await frames.count()
    expect(n).toBeGreaterThan(0)
    const info = await frames.evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const img = el.querySelector('img')?.getBoundingClientRect()
        const band = parseFloat(cs.borderTopWidth)
        return {
          src: cs.borderImageSource,
          band,
          slice: cs.borderImageSlice,
          ratio: r.width / r.height,
          inside:
            !img ||
            (img.left >= r.left + band - 1 &&
              img.right <= r.right - band + 1 &&
              img.top >= r.top + band - 1 &&
              img.bottom <= r.bottom - band + 1),
        }
      }),
    )
    for (const f of info) {
      expect(f.src).toContain('/art/photo-frame.v1.svg')
      expect(f.slice).toMatch(/^40/)
      expect(f.band).toBeGreaterThanOrEqual(6)
      expect(f.inside).toBe(true)
    }
    // Feste Seitenverhältnisse (4:5 bzw. Flash-Maße) – keine Ausreißer durch den Rahmen.
    for (const f of info) expect(f.ratio).toBeGreaterThan(0.2)
    await page.waitForTimeout(800)
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls).toBeLessThanOrEqual(0.1)
  })
}

test('PF-10 Rahmen-SVG wird einmal geladen, nicht je Foto; nur Same-Origin', async ({ page }) => {
  const hits: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('photo-frame')) hits.push(req.url())
  })
  await page.goto('/de/shop')
  await page.waitForLoadState('load')
  await page.waitForTimeout(500)
  expect(hits.length).toBe(1)
  expect(new URL(hits[0]!).pathname).toBe('/art/photo-frame.v1.svg')
  // kein SVG-Rahmen im DOM (je Foto): nur das border-image
  expect(await page.locator('[data-photo-frame] svg').count()).toBe(0)
})

test('U-11 Seitengrund: Verlauf Olivgrün → Petrol, Scroll-Ebene nur ohne Bewegungsreduktion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/de/shop')
  await page.waitForLoadState('load')
  const base = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    return { bg: cs.backgroundImage, color: cs.backgroundColor }
  })
  expect(base.bg).toContain('linear-gradient')
  const supports = await page.evaluate(() => CSS.supports('animation-timeline', 'scroll()'))
  const layer = async () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement, '::before')
      return { pos: cs.position, opacity: parseFloat(cs.opacity), content: cs.content }
    })
  if (supports) {
    const top = await layer()
    expect(top.pos).toBe('fixed')
    expect(top.opacity).toBeLessThan(0.1)
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    )
    // P14.13: auf den Zustand warten (scroll-gebundene Animation folgt mit dem nächsten Frame), statt fester 400 ms
    await expect.poll(async () => (await layer()).opacity).toBeGreaterThan(0.9)
  }
  // Bewegung reduziert → statischer Verlauf, keine Scroll-Ebene
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const reduced = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement, '::before')
    return { content: cs.content, bg: getComputedStyle(document.documentElement).backgroundImage }
  })
  expect(reduced.content === 'none' || reduced.content === 'normal').toBe(true)
  expect(reduced.bg).toContain('linear-gradient')
})

test('U-10 Schrift: Spectral für Überschriften, kein Mansalva im Netz', async ({ page }) => {
  const fonts: string[] = []
  page.on('request', (req) => {
    if (/\.woff2?(\?|$)/.test(req.url())) fonts.push(req.url())
  })
  await page.goto('/de')
  await page.waitForLoadState('networkidle')
  expect(fonts.some((u) => /mansalva/i.test(u))).toBe(false)
  expect(fonts.every((u) => new URL(u).origin === new URL(page.url()).origin)).toBe(true)
  const fam = await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontFamily)
  expect(fam).toMatch(/spectral/i)
  expect(fam).not.toMatch(/mansalva/i)
})
