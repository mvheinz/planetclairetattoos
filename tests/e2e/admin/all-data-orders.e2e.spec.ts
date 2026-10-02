import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, fixtureOrder, removeOrder } from './orderHelpers'

// „Alle Daten: Bestellungen“ (Payload-Standardliste `/collections/orders`, KONZEPT §7.16) mit vorhandenen Bestellungen:
// axe ohne serious/critical (Kontrast, Beschriftungen, Größe der Sortier- und Auswahlknöpfe) – Desktop und 390×844.

for (const size of [null, { width: 390, height: 844 }] as const) {
  const label = size ? '390×844' : 'Desktop'
  test(`@a11y Alle Daten: Bestellungen (${label}) mit Bestellungen ohne serious/critical`, async ({
    adminPage: page,
    fixtureProducts,
  }) => {
    if (size) await page.setViewportSize(size)
    const payload = await testPayload()
    const orders: number[] = []
    try {
      for (let i = 0; i < 2; i++) {
        const piece = await fixtureProducts.create('keramik', {
          status: 'available',
          firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
        })
        orders.push((await fixtureOrder(payload, piece, 90_000 + piece.itemNumber * 10 + 3)).id)
      }
      await page.goto(adminPath('/collections/orders'))
      const table = page.locator('.collection-list table, .table table').first()
      await expect(table).toBeVisible()
      await expect(table.locator('tbody tr')).not.toHaveCount(0)
      await expectAccessible(page, '.collection-list')
    } finally {
      for (const id of orders) await removeOrder(payload, id)
    }
  })
}
