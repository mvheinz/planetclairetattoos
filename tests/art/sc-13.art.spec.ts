import type { Page } from '@playwright/test'

import { artTags, test, type ArtSession } from './helpers/fixtures'

// SC-13 (KUNST-QA §4.3): `/de/qa/art` – Stationszeichnungen neben ihrer Quelle, Platzhalter, Weltraum-Motive, Wortmarke,
// Favicon, OG-Bilder als Standbilder in 1× (Profil `art-desktop`) und 3× (zusätzlicher Kontext mit DPR 3).

const SECTIONS = ['stations', 'placeholders', 'space', 'wordmark', 'favicon', 'og'] as const

test('SC-13 Zeichnungen und Motive', { tag: artTags(['art-desktop']) }, async ({ art }) => {
  await art.goto('/de/qa/art', { waitLeash: false })
  for (const s of SECTIONS) {
    const el = art.page.locator(`[data-qa-section="${s}"]`)
    await el.scrollIntoViewIfNeeded()
    await art.frame(`${s}-1x`, { element: el })
  }
  const ctx = await art.extraContext({ deviceScaleFactor: 3 })
  try {
    const page = await ctx.newPage()
    await page.goto('/de/qa/art', { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    for (const s of ['stations', 'space', 'wordmark', 'favicon'] as const) {
      const el = page.locator(`[data-qa-section="${s}"]`)
      await el.scrollIntoViewIfNeeded()
      await art.frame(`${s}-3x`, { element: el })
    }
  } finally {
    await ctx.close()
  }

  // Linsen-Material R1 (R1-02-05…07): Tuschelinie der Startseite 4× vergrößert – Segmentnähte (LQ-06), Schlaufenstarts
  // mit Tintenpunkt (LQ-07) – und dieselben Stellen in Stufe B nach künstlicher Last (`?qa-jank=30`, LQ-09).
  await art.goto('/de')
  await leashLoupes(art, 'linie')
  await art.goto('/de?qa-jank=30')
  await art.scrollRun(2400, 700)
  await art.scrollRun(0, 2400)
  const tier = await art.page.evaluate(
    () => (window as Window & { __leash?: { tier(): string } }).__leash?.tier() ?? null,
  )
  art.json('stufe-b', { tier })
  await leashLoupes(art, `stufe-${(tier ?? 'x').toLowerCase()}`)
})

type LoupeWin = Window & {
  __leash?: {
    geometry: {
      segments: { len0: number }[]
      lut: ArrayLike<number>
      stations: { id: string; loopLen0: number; loop: string }[]
    } | null
    setReadingY(y: number | null): void
  }
}

/** Seitenkoordinaten (CSS-px) der Linie bei Bogenlänge `len` (LUT je 4 px, relativ zur Linien-Ebene). */
function linePoint(page: Page, len: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate((len) => {
    const g = (window as LoupeWin).__leash?.geometry
    const layer = document.querySelector('[data-leash-layer]')
    if (!g || !layer) return null
    const k = Math.min(g.lut.length / 4 - 1, Math.max(0, Math.round(len / 4)))
    const r = layer.getBoundingClientRect()
    return { x: r.left + scrollX + g.lut[k * 4 + 1]!, y: r.top + scrollY + g.lut[k * 4 + 2]! }
  }, len)
}

/** 4×-Lupen (96 × 96 CSS-px) an den ersten drei Segmentnähten und an jedem Schlaufenstart; Linie ganz gezeichnet. */
async function leashLoupes(art: ArtSession, prefix: string): Promise<void> {
  const { page } = art
  const spots = await page.evaluate(() => {
    const w = window as LoupeWin
    const g = w.__leash?.geometry
    if (!g) return []
    w.__leash!.setReadingY(1e7)
    return [
      ...g.segments.slice(1, 4).map((s, i) => ({ tag: `naht-${i + 1}`, len: s.len0 })),
      // nur Stationen mit Schlaufe haben einen Schlaufenstart (und Tintenpunkt); `none` = gerades Stück (R1-04-03)
      ...g.stations
        .filter((s) => s.loop !== 'none')
        .map((s) => ({ tag: `schlaufenstart-${s.id}`, len: s.loopLen0 })),
    ]
  })
  // Je Stelle abwarten, bis die Linie dort gezeichnet ist (drawnLen > Position): unter Rechnerlast zeichnet sie langsamer, ein
  // einmaliges Warten mit kurzer Frist ließ bei 5 von 8 Schlaufenstarts die Lupe auf noch leerem Papier stehen (R1-06-02)
  const drawnTo = (len: number) =>
    page
      .waitForFunction(
        (len) => {
          const l = (window as unknown as { __leash?: { drawnLen(): number } }).__leash
          return !!l && l.drawnLen() >= len
        },
        len,
        { timeout: 60_000 },
      )
      .catch(() => undefined)
  // erst die ganze Linie (wie im Einzeltest, der alle Punkte zeigt), dann je Stelle prüfen: `drawnLen` ist die Zielgröße, die Striche
  // der weiter unten liegenden Schlaufen stehen erst kurz danach (R1-07-03: 6 von 8 Lupen ohne Punkt)
  const total = await page.evaluate(
    () =>
      (window as LoupeWin & { __leash?: { geometry: { totalLength: number } | null } }).__leash
        ?.geometry?.totalLength ?? 0,
  )
  await drawnTo(total - 1)
  await page.waitForTimeout(1500)
  const vh = page.viewportSize()!.height
  const vw = page.viewportSize()!.width
  // Die Geometrie wird neu gebaut, wenn nachladende Bilder das Layout verschieben (Scrollen lädt weiter unten liegende Bilder):
  // Stelle je Versuch frisch aus der aktuellen Geometrie lesen, hinscrollen, setzen lassen und erst bei ruhiger Lage aufnehmen.
  const resolve = (tag: string) =>
    page.evaluate((tag) => {
      const g = (window as LoupeWin).__leash?.geometry
      if (!g) return null
      const m = /^naht-(\d)$/.exec(tag)
      if (m) return g.segments[Number(m[1])]?.len0 ?? null
      return g.stations.find((s) => `schlaufenstart-${s.id}` === tag)?.loopLen0 ?? null
    }, tag)
  for (const spot of spots) {
    let len = spot.len
    let p = await linePoint(page, len)
    for (let attempt = 0; attempt < 5 && p; attempt++) {
      await page.evaluate((y) => scrollTo(0, Math.max(0, y)), p.y - vh / 2)
      await page.waitForTimeout(800)
      len = (await resolve(spot.tag)) ?? len
      await drawnTo(len + 12)
      const q = await linePoint(page, len)
      if (!q) break
      const settled = Math.abs(q.y - p.y) < 1.5 && Math.abs(q.x - p.x) < 1.5
      p = q
      if (settled) break
    }
    if (!p) continue
    await page.evaluate((y) => scrollTo(0, Math.max(0, y)), p.y - vh / 2)
    const sy = await page.evaluate(() => scrollY)
    const size = 96
    const x = Math.min(vw - size, Math.max(0, p.x - size / 2))
    const y = Math.min(vh - size, Math.max(0, p.y - sy - size / 2))
    // R1-03-05: liegt der Punkt unter der festen Kopfleiste (Kopf-Station, Seitenanfang), Leiste für die Lupe ausblenden
    const underHeader = p.y - sy < 130
    if (underHeader)
      await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>(
          '[data-site-header], [data-preview-banner]',
        ))
          el.style.visibility = 'hidden'
      })
    await art.settledFrame(`${prefix}-${spot.tag}-4x-y${Math.round(p.y)}`, {
      zoom: { x, y, width: size, height: size, to: size * 4 },
    })
    if (underHeader)
      await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>(
          '[data-site-header], [data-preview-banner]',
        ))
          el.style.visibility = ''
      })
  }
  await page.evaluate(() => (window as LoupeWin).__leash?.setReadingY(null))
}
