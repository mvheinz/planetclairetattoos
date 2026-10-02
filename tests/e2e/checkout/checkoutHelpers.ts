import { createHash, randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { expect, type BrowserContext, type Page } from '@playwright/test'

import { encodeCartCookie } from '../../../src/lib/commerce/cartCookie'
import { localizedPath } from '../../../src/lib/routes/paths'
import { serverURL } from '../../helpers/adminEnv'
import { testPayload } from '../fixtures'

// Helfer der Kassen-Tests (P4.9–P4.10b): Kasse über den Korb starten („Zur Kasse“, wie eine Kundin; der Testprozess
// importiert keine Next-Module) und die Kasse aus der Test-DB lesen; Aufräumen der Kassen, Reservierungen und Bestellungen der Fixture-Stücke; eigene Client-IP je Test (Rate-Limit
// `checkout_start` gilt je IP-Hash, ARCHITEKTUR §8.5).

export const R07 = { de: localizedPath('R07', 'de'), en: localizedPath('R07', 'en') } as const
export const R06 = { de: localizedPath('R06', 'de'), en: localizedPath('R06', 'en') } as const

type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }

export async function db(): Promise<Db> {
  const payload = await testPayload()
  return (payload.db as unknown as { drizzle: Db }).drizzle
}

/** Eigene Client-IP für diesen Browser-Kontext (Rate-Limits je IP-Hash). */
export async function ownClientIp(context: BrowserContext): Promise<void> {
  const b = randomUUID().replace(/\D/g, '').padEnd(6, '1')
  await context.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${Number(b.slice(0, 2)) % 250}.${Number(b.slice(2, 4)) % 250}.${Number(b.slice(4, 6)) % 250}`,
  })
}

export interface StartedCheckout {
  token: string
  checkoutId: number
  reservationRef: string
  displayExpiresAt: Date
}

/**
 * Startet die Kasse wie eine Kundin: `pc_cart` setzen, Korb öffnen, „Zur Kasse“ (POST, Server-Action) – eigene Client-IP
 * für das Rate-Limit. Liefert Token (aus dem Cookie) und die Kasse aus der DB.
 */
export async function startCheckoutFor(
  context: BrowserContext,
  page: Page,
  items: { id: number; priceCents?: number }[],
  o: { delivery?: 'shipping' | 'pickup'; locale?: 'de' | 'en' } = {},
): Promise<StartedCheckout> {
  const locale = o.locale ?? 'de'
  await ownClientIp(context)
  await context.addCookies([
    {
      name: 'pc_cart',
      value: encodeCartCookie({
        v: 1,
        items: items.map((i) => ({ id: i.id, p: i.priceCents ?? 0 })),
        delivery: o.delivery ?? 'shipping',
      }),
      url: serverURL,
      sameSite: 'Lax',
    },
  ])
  await page.goto(R06[locale])
  await page.locator('[data-cart-checkout] button[type="submit"]').click()
  await page.waitForURL(new RegExp(`${R07[locale]}(\\?|$)`))
  const token = (await context.cookies(serverURL)).find((c) => c.name === 'pc_checkout')?.value
  if (!token) throw new Error('Kein pc_checkout nach „Zur Kasse“.')
  const row = (
    await (
      await db()
    ).execute(
      sql`SELECT id, reservation_ref, display_expires_at FROM checkouts WHERE token_hash = ${createHash('sha256').update(token).digest('hex')}`,
    )
  ).rows[0]
  if (!row) throw new Error('Kasse zum Token fehlt.')
  return {
    token,
    checkoutId: Number(row.id),
    reservationRef: String(row.reservation_ref),
    displayExpiresAt: new Date(String(row.display_expires_at)),
  }
}

/** Kassen, Reservierungen, Bestellungen und Nachweise der Stücke löschen (vor dem Löschen der Fixture-Stücke). */
export async function cleanupCheckouts(productIds: number[]): Promise<void> {
  if (productIds.length === 0) return
  const d = await db()
  const ids = sql.raw(productIds.map((n) => Number(n)).join(','))
  const checkouts = sql`(SELECT _parent_id FROM checkouts_items WHERE product_id IN (${ids}))`
  const orders = sql`(SELECT _parent_id FROM orders_items WHERE product_id IN (${ids}))`
  await d.execute(sql`UPDATE products SET current_order_id = NULL WHERE id IN (${ids})`)
  await d.execute(
    sql`DELETE FROM consent_log WHERE checkout_id IN ${checkouts} OR product_id IN (${ids})`,
  )
  await d.execute(
    sql`DELETE FROM webhook_events WHERE related_order_id IN ${orders} OR related_checkout_id IN ${checkouts}`,
  )
  await d.execute(sql`ALTER TABLE invoices DISABLE TRIGGER USER`)
  try {
    await d.execute(sql`DELETE FROM invoices WHERE order_id IN ${orders}`)
  } finally {
    await d.execute(sql`ALTER TABLE invoices ENABLE TRIGGER USER`)
  }
  await d.execute(sql`DELETE FROM reservations WHERE product_id IN (${ids})`)
  await d.execute(sql`DELETE FROM checkouts WHERE id IN ${checkouts}`)
  await d.execute(sql`DELETE FROM orders WHERE id IN ${orders}`)
}

/** Status der Kasse aus der DB. */
export async function checkoutStatus(checkoutId: number): Promise<string> {
  const r = await (await db()).execute(sql`SELECT status FROM checkouts WHERE id = ${checkoutId}`)
  return String(r.rows[0]?.status)
}

/** Pflichtfelder für Versand ausfüllen. */
export async function fillShipping(page: Page, o: { email?: string } = {}): Promise<void> {
  await page.locator('#checkout-email').fill(o.email ?? 'erika@planetclaire.local')
  await page.locator('#checkout-name').fill('Erika Beispiel')
  await page.locator('#checkout-shipping-line1').fill('Musterstraße 1')
  await page.locator('#checkout-shipping-postal-code').fill('10115')
  await page.locator('#checkout-shipping-city').fill('Berlin')
}

/** Bestellknopf (exakter zugänglicher Name). */
export const orderButton = (page: Page, locale: 'de' | 'en' = 'de') =>
  page.getByRole('button', {
    name: locale === 'de' ? 'Zahlungspflichtig bestellen' : 'Order with obligation to pay',
    exact: true,
  })

/** Wartet, bis die Kassen-Komponente gebunden ist (JavaScript aktiv). */
export async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('[data-checkout-form][data-hydrated="true"]')).toBeVisible()
}
