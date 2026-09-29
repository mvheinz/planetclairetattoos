import { expect, test } from '@playwright/test'
import type { Payload } from 'payload'

import { localizedPath } from '../../src/lib/routes/paths'
import { productPath } from '../../src/lib/shop/format'
import { testPayload } from '../e2e/fixtures'
import { refresh } from '../e2e/shop/fresh'
import { ANCHORS } from '../e2e/shop/productPage'
import { completeProduct, createProductFixtures } from '../int/helpers/products'
import { dynamicMasks, linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Shop-Seiten (ARCHITEKTUR §7.6, PLAN P3.16): Shop R02, Produktseite R04 (S01, zwei Fotos), Archiv R05 und die
// 404-Variante „Schon ein Zuhause“ (KO-18) – ganzseitig, DE, je Projekt `desktop` (1440 × 900) und `mobile` (390 × 844),
// reduzierte Bewegung. Grundlage ist der Mini-Beispielbestand; die 404-Variante braucht ein verkauftes Stück, das nicht
// im Archiv steht (analog S08) – eine Fixture je Projekt (Nummern 975/976 aus dem Listen-Bereich, danach entfernt).

const PAGES = [
  { name: 'r02-shop', path: localizedPath('R02', 'de') },
  { name: 'r04-produkt-s01', path: ANCHORS.S01.de },
  { name: 'r05-archiv', path: localizedPath('R05', 'de') },
] as const

const HOME_VARIANT_NUMBER: Record<string, number> = { desktop: 975, mobile: 976 }

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
})

for (const p of PAGES) {
  test(`${p.name} (${p.path})`, async ({ page }) => {
    const res = await page.goto(p.path)
    expect(res?.status()).toBe(200)
    // Die mobile Kauf-Leiste (KO-09a) ist `position: fixed`; in der ganzseitigen Aufnahme läge sie mitten im Inhalt –
    // ausblenden (eigene Tests in `tests/e2e/shop/gallery.e2e.spec.ts`).
    await page.addStyleTag({ content: '[data-buy-bar]{visibility:hidden !important}' })
    await loadAllImages(page)
    await settle(page)
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: true,
      mask: dynamicMasks(page),
    })
  })
}

test.describe('404-Variante „Schon ein Zuhause“', () => {
  let payload: Payload
  let itemNumber = 0
  const remove = () =>
    payload.delete({
      collection: 'products',
      where: { itemNumber: { equals: itemNumber } },
      overrideAccess: true,
      context: { seed: true },
    })

  test.beforeEach(async ({}, testInfo) => {
    payload = await testPayload()
    itemNumber = HOME_VARIANT_NUMBER[testInfo.project.name] ?? 977
    await remove()
  })

  test.afterEach(async () => {
    await remove()
  })

  test('r04-404-zuhause', async ({ page, request }) => {
    const doc = await payload.create({
      collection: 'products',
      data: {
        ...completeProduct('keramik', itemNumber, await createProductFixtures(payload)),
        seed: true,
        status: 'sold',
        firstPublishedAt: '2026-09-01T10:00:00.000Z',
        soldAt: '2026-09-20T10:00:00.000Z',
        soldChannel: 'offline',
        offlineSaleNote: 'Flohmarkt',
        showInArchiveAfterSale: false,
      } as never,
      overrideAccess: true,
      locale: 'de',
      context: { seed: true },
    })
    const url = productPath({ itemNumber, slug: doc.slug }, 'de')
    await refresh(request, [url])
    const res = await page.goto(url)
    expect(res?.status()).toBe(404)
    await expect(page.locator('[data-not-found]')).toHaveAttribute('data-variant', 'home')
    await settle(page)
    await expect(page).toHaveScreenshot('r04-404-zuhause.png', {
      fullPage: true,
      mask: dynamicMasks(page),
    })
  })
})
