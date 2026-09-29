import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { startCheckout } from '../../../src/lib/commerce/checkout'
import { createMockPaymentsAdapter } from '../../../src/lib/payments/mock'
import { serverURL } from '../../helpers/adminEnv'
import { submitForTest } from '../../int/helpers/checkout'
import { ensureLegalTextFixtures } from '../../int/helpers/legal'
import { expect, test, testPayload } from '../fixtures'
import { refresh, NO_CACHE } from '../shop/fresh'
import { pathOf, PUBLISHED } from '../shop/productPage'

// P4.16b / T-21 (ARCHITEKTUR §9.3, KONZEPT §4.10 Nr. 5): Ein Verkauf wird nach dem Commit öffentlich sichtbar. Der
// Testprozess legt Stück, Kasse und Mock-Session in der Test-DB an und schickt das signierte Mock-Ereignis
// `checkout.session.completed` an den laufenden Server (`POST /api/stripe/webhook`, HMAC mit demselben PAYLOAD_SECRET);
// der Server legt die Bestellung an und erneuert die Cache-Tags. Im Produktions-Build (`E2E_SERVER=start`) zeigt die
// Produktseite spätestens 5 s danach „sold“ (Server-HTML, ohne JavaScript).

const PRODUCTION = process.env.E2E_SERVER === 'start'
const LIMIT_MS = PRODUCTION ? 5_000 : 30_000

test.describe.configure({ timeout: 120_000 })

async function cleanup(payload: Payload, productId: number): Promise<void> {
  const db = (payload.db as unknown as { drizzle: { execute(q: unknown): Promise<unknown> } })
    .drizzle
  const orders = sql`(SELECT _parent_id FROM orders_items WHERE product_id = ${productId})`
  await db.execute(sql`UPDATE products SET current_order_id = NULL WHERE id = ${productId}`)
  await db.execute(
    sql`DELETE FROM webhook_events WHERE related_order_id IN ${orders} OR related_checkout_id IN
          (SELECT _parent_id FROM checkouts_items WHERE product_id = ${productId})`,
  )
  await db.execute(sql`ALTER TABLE invoices DISABLE TRIGGER USER`)
  try {
    await db.execute(sql`DELETE FROM invoices WHERE order_id IN ${orders}`)
  } finally {
    await db.execute(sql`ALTER TABLE invoices ENABLE TRIGGER USER`)
  }
  await db.execute(sql`DELETE FROM reservations WHERE product_id = ${productId}`)
  await db.execute(
    sql`DELETE FROM checkouts WHERE id IN (SELECT _parent_id FROM checkouts_items WHERE product_id = ${productId})`,
  )
  await db.execute(sql`DELETE FROM orders WHERE id IN ${orders}`)
}

test('T-21 Mock-Webhook „bezahlt“ → Produktseite zeigt spätestens 5 s danach „sold“ @slow', async ({
  request,
  fixtureProducts,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Server-HTML und Cache – einmal je Lauf')
  const payload = await testPayload()
  const { id, itemNumber: nr } = await fixtureProducts.create('keramik', PUBLISHED)
  const url = await pathOf(nr, 'de')
  const marker = (state: string) => `data-item-number="${nr}" data-status="${state}"`
  const get = async () =>
    (
      await request.get(`${serverURL}${url}`, {
        maxRedirects: 0,
        failOnStatusCode: false,
        headers: PRODUCTION ? {} : NO_CACHE,
      })
    ).text()
  try {
    await refresh(request, [url])
    await expect.poll(get, { timeout: LIMIT_MS }).toContain(marker('available'))

    const now = new Date()
    const mock = createMockPaymentsAdapter({ appEnv: 'test' })
    const started = await startCheckout(
      {
        cart: { v: 1, items: [{ id, p: 0 }], delivery: 'shipping' },
        locale: 'de',
        existingToken: null,
        now,
      },
      { payload, payments: mock },
    )
    if (!started.ok) throw new Error(`Kassenstart abgelehnt: ${JSON.stringify(started)}`)
    const legal = await ensureLegalTextFixtures(payload)
    const checkout = await submitForTest(payload, started.checkoutId, {
      now,
      confirming: true,
      legal,
    })
    const emission = await mock.emit(
      checkout.stripe!.checkoutSessionId!,
      'checkout.session.completed',
    )
    const res = await request.post(`${serverURL}/api/stripe/webhook`, {
      data: emission.rawBody,
      headers: Object.fromEntries(emission.headers.entries()),
    })
    expect(res.status(), await res.text()).toBe(200)
    const sentAt = Date.now()
    await expect
      .poll(get, { timeout: LIMIT_MS, intervals: [100, 250, 500] })
      .toContain(marker('sold'))
    expect(Date.now() - sentAt).toBeLessThanOrEqual(LIMIT_MS)
  } finally {
    await cleanup(payload, id)
  }
})
