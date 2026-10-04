import { ownClientIp } from '../e2e/checkout/checkoutHelpers'
import { pathOf } from '../e2e/shop/productPage'
import { seedPiece } from './helpers/commerce'
import { artTags, test } from './helpers/fixtures'

// SC-05 (KUNST-QA §4.3): R04 Produktseite eines verfügbaren Stücks – laden (Linie 0/150/300/450/600 ms), Galerie
// wischen, Zoom öffnen/schließen, „In den Korb“ (Hüpfer MI-01 alle 40 ms), Kauf-Leiste (mobil). „In den Korb“ setzt
// nur das Korb-Cookie dieses Kontexts (keine Reservierung, Beispielbestand bleibt unverändert).

test('SC-05 Produktseite', { tag: artTags('all') }, async ({ art }) => {
  const { page, context } = art
  await ownClientIp(context)
  const nr = await seedPiece('available')
  if (nr === null) throw new Error('Kein verfügbares Stück im Beispielbestand.')
  const url = await pathOf(nr, 'de')

  // Linie beim Laden
  await art.pauseClock()
  await page.goto(url, { waitUntil: 'load' })
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(() => !!(window as Window & { __leash?: unknown }).__leash)) break
    await page.clock.runFor(50)
  }
  await art.sequence({ stepMs: art.step(150, 600), untilMs: 600, prefix: 'line' })
  await page.waitForFunction(
    () => document.documentElement.hasAttribute('data-behaviors-ready'),
    undefined,
    {
      timeout: 15_000,
    },
  )

  // Galerie wischen: nächstes Bild (Knopf bzw. Wisch per Scroll der Spur)
  const next = page.locator('[data-gallery-next]')
  if (art.isDesktop && (await next.count()) > 0 && (await next.first().isVisible()))
    await next.first().click()
  else
    await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>('[data-gallery-track]')
      track?.scrollBy({ left: track.clientWidth, behavior: 'instant' as ScrollBehavior })
    })
  await page.waitForTimeout(400)
  await art.settledFrame('gallery-next')

  // Zoom öffnen und schließen
  const zoom = page.locator('[data-zoom-src]').first()
  if ((await zoom.count()) > 0) {
    await zoom.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(500)
    await art.settledFrame('zoom-open')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await art.settledFrame('zoom-closed')
  }

  // „In den Korb“: Hüpfer alle 40 ms
  const add = page.locator('[data-add-to-cart] button')
  await add.scrollIntoViewIfNeeded()
  await art.sequence({
    stepMs: art.step(40, 640),
    untilMs: 640,
    prefix: 'hop',
    start: async () => {
      await add.evaluate((b) => (b as HTMLButtonElement).click())
      // Die Uhr ist angehalten: Antwort der Server-Action und der React-Übergang hängen in WebKit (iPhone) an Timern.
      // Darum die Uhr in kleinen Schritten mitlaufen lassen, bis der Zustand steht (statt 10 s blind zu warten);
      // die Bildfolge beginnt danach bei t = 0 (seekAnimations setzt die Animationen zurück).
      const sel = '[data-buy-area] [data-in-cart]:not([hidden])'
      for (let i = 0; i < 200; i++) {
        if (await page.locator(sel).count()) break
        await page.waitForTimeout(25)
        await page.clock.runFor(25)
      }
      await page.waitForSelector(sel, { timeout: 5_000 })
    },
  })
  await art.settledFrame('in-cart')
  await art.axe('r04')

  // Kauf-Leiste (mobil): Kaufbereich nach oben aus dem Bild scrollen
  if (!art.isDesktop) {
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForFunction(
      () => document.documentElement.hasAttribute('data-behaviors-ready'),
      undefined,
      {
        timeout: 15_000,
      },
    )
    await page.evaluate(() => {
      const el = document.getElementById('add-to-cart')
      if (el) scrollTo(0, el.getBoundingClientRect().bottom + scrollY + 200)
    })
    await page.waitForTimeout(500)
    await art.settledFrame('buy-bar')
  }
})
