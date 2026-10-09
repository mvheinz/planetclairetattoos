import { localizedPath } from '../../../src/lib/routes/paths'
import { expect, test } from '../fixtures'
import { freshPage } from './fresh'
import { ANCHORS } from './productPage'

// P14.12 (U-61) – Teilen an Stück und Flash-Motiv: Ohne Teilen-Menü (Desktop-Chromium) erscheint nach dem Laden
// „Link kopieren“ und kopiert die absolute URL („Link kopiert“); mit Teilen-Menü (hier per Init-Skript nachgebildet)
// erscheint „Teilen“ und übergibt URL und Titel, der Rückfall ist ausgeblendet. Ohne JavaScript beides verborgen. Keine
// Fremd-Anfragen (Fixture `foreignRequests`), keine Cookies.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Zwischenablage-Rechte nur in Chromium-Desktop')
})

test('U-61 Rückfall „Link kopieren“ (Produktseite und Flash-Karte), keine Cookies', async ({
  page,
  context,
  foreignRequests,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await freshPage(page)
  await page.goto(ANCHORS.S11.de)
  await page.locator('html[data-behaviors-ready]').waitFor({ state: 'attached' })
  const share = page.locator('[data-product-page] [data-share]')
  await expect(share.locator('[data-behavior="share-button"]')).toBeHidden()
  const copy = share.locator('[data-share-fallback]')
  await expect(copy).toBeVisible()
  await expect(copy).toHaveText('Link kopieren')
  await copy.click()
  await expect(share.locator('[role="status"]')).toHaveText('Link kopiert')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${SITE}${ANCHORS.S11.de}`)

  await page.goto(localizedPath('R12', 'en'))
  await page.locator('html[data-behaviors-ready]').waitFor({ state: 'attached' })
  const card = page.locator('[data-flash-card]').first()
  const anchor = await card.getAttribute('id')
  const fallback = card.locator('[data-share-fallback]')
  await expect(fallback).toHaveText('Copy link')
  await fallback.click()
  await expect(card.locator('[data-share] [role="status"]')).toHaveText('Link copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${SITE}${localizedPath('R12', 'en')}#${anchor}`,
  )
  expect(await context.cookies()).toEqual([])
  expect(foreignRequests).toEqual([])
})

test('U-61 mit Teilen-Menü: „Teilen“ übergibt URL und Titel, Rückfall verborgen; ohne JS beides verborgen', async ({
  page,
  browser,
}) => {
  // Teilen-Menü nachbilden (als Text, damit nichts Übersetztes im Browser läuft)
  await page.addInitScript({
    content:
      'window.__shared = [];' +
      "Object.defineProperty(navigator, 'share', { configurable: true, value: function (d) { window.__shared.push(d); return Promise.resolve() } });" +
      "Object.defineProperty(navigator, 'canShare', { configurable: true, value: function () { return true } });",
  })
  await freshPage(page)
  await page.goto(ANCHORS.S11.de)
  await page.locator('html[data-behaviors-ready]').waitFor({ state: 'attached' })
  const share = page.locator('[data-product-page] [data-share]')
  const button = share.locator('[data-behavior="share-button"]')
  await expect(button).toBeVisible()
  await expect(button).toHaveText('Teilen')
  await expect(share.locator('[data-share-fallback]')).toBeHidden()
  await button.click()
  const shared = await page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared)
  expect(shared).toEqual([
    expect.objectContaining({
      url: `${SITE}${ANCHORS.S11.de}`,
      title: 'T-Shirt „Coco fliegt zum Mond“',
    }),
  ])

  const noJs = await browser.newContext({ javaScriptEnabled: false })
  try {
    const p = await noJs.newPage()
    await p.goto(ANCHORS.S11.de)
    await expect(p.locator('[data-share] button')).toHaveCount(2)
    for (const b of await p.locator('[data-share] button').all()) await expect(b).toBeHidden()
  } finally {
    await noJs.close()
  }
})
