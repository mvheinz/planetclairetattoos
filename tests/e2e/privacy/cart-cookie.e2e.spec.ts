import type { Page, Response } from '@playwright/test'

import { decodeCartCookie } from '../../../src/lib/commerce/cartCookie'
import { expect, test } from '../fixtures'
import { ANCHORS, openProduct } from '../shop/productPage'

// P3.11 Korb-Cookie (ARCHITEKTUR §8.7; RECHT R-130; KONZEPT EK-04; §7.4 T-04), in allen drei Projekten: Vor dem ersten
// „In den Korb“ entsteht kein Endgeräte-Speicher – auch nicht durch die Live-Abfrage `product-status`. Danach gibt es
// genau `pc_cart` mit `Path=/; SameSite=Lax` (auf localhost ohne `Secure`), `Max-Age` 7 Tage, nicht HttpOnly, Inhalt nur
// Stück-ID, Preis in Cent und Lieferart. Web-Storage bleibt leer.

async function storage(page: Page) {
  return page.evaluate(() => ({
    cookie: document.cookie,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }))
}

test('R-130 T-04 EK-04: pc_cart erst nach „In den Korb“, genau mit den Attributen aus §8.7; product-status setzt kein Cookie @privacy', async ({
  page,
  request,
  context,
}) => {
  const status: Response[] = []
  page.on('response', (r) => {
    if (r.url().includes('/api/public/product-status')) status.push(r)
  })
  await openProduct(page, request, ANCHORS.S01.de)
  const article = page.locator('[data-product-page]')
  await expect(article).toHaveAttribute('data-status-live', '')

  // Vorher: nichts – weder Cookie noch Web-Storage, auch nicht durch die Live-Abfrage.
  expect(await context.cookies()).toEqual([])
  expect(await storage(page)).toEqual({ cookie: '', local: [], session: [] })
  expect(status.length).toBeGreaterThan(0)
  for (const r of status) {
    expect(r.status()).toBe(200)
    expect(await r.headerValue('set-cookie')).toBeNull()
    expect(await r.headerValue('cache-control')).toBe('no-store')
  }

  const before = Date.now() / 1000
  await page.locator('[data-add-to-cart] button').click()
  await expect(page.locator('[data-buy-area] [data-in-cart]')).toBeVisible()

  const cookies = await context.cookies()
  expect(cookies.map((c) => c.name)).toEqual(['pc_cart'])
  const cart = cookies[0]!
  expect(cart).toMatchObject({ path: '/', sameSite: 'Lax', httpOnly: false, secure: false })
  expect(cart.expires).toBeGreaterThan(before + 604_800 - 120)
  expect(cart.expires).toBeLessThan(before + 604_800 + 120)
  const id = Number(await article.getAttribute('data-product-id'))
  expect(decodeCartCookie(cart.value)).toEqual({
    v: 1,
    items: [{ id, p: 4500 }],
    delivery: 'shipping',
  })
  const after = await storage(page)
  expect(after.local).toEqual([])
  expect(after.session).toEqual([])
})
