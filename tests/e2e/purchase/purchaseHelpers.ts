import { createHash, randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { CHECKOUT_COOKIE } from '../../../src/lib/commerce/checkout'
import { serverURL } from '../../helpers/adminEnv'
import { readOutbox } from '../../helpers/outbox'
import { adminLogin } from '../adminApi'
import { R06, R07, db, hydrated, orderButton, ownClientIp } from '../checkout/checkoutHelpers'
import { testPayload } from '../fixtures'
import { openProduct, pathOf } from '../shop/productPage'

// Helfer des Kaufpfads Ende-zu-Ende (PLAN P4.24, EK-02/EK-03): wie eine Kundin von der Produktseite über den Korb in
// die Kasse bis zur Danke-Seite; Kassen, Bestellungen und Mails (Datei-Treiber, `readOutbox`) aus der Test-DB bzw.
// dem Postausgang. Jede Käuferin bekommt eine eigene Client-IP (Rate-Limits je IP-Hash) und eine eigene Mail-Adresse.

export { R06, R07, hydrated, orderButton }

export interface Buyer {
  email: string
  /** Pfade der Hauptdokumente in Aufruf-Reihenfolge (EK-02: höchstens 4 Seiten). */
  pages: string[]
  /** Konsolenfehler und Seitenfehler (Suiten ohne Konsolenfehler, ARCHITEKTUR §7.2). */
  errors: string[]
}

/** Käuferin vorbereiten: eigene IP, eigene Adresse, Seiten- und Fehlerprotokoll. */
export async function buyer(context: BrowserContext, page: Page): Promise<Buyer> {
  await ownClientIp(context)
  const b: Buyer = {
    email: `kauf-${randomUUID().slice(0, 8)}@planetclaire.local`,
    pages: [],
    errors: [],
  }
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const p = new URL(frame.url()).pathname
    if (b.pages[b.pages.length - 1] !== p) b.pages.push(p)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') b.errors.push(msg.text())
  })
  page.on('pageerror', (err) => b.errors.push(String(err)))
  return b
}

/** Unterschiedliche Seiten (Pfad ohne Anker/Suche) des Kaufwegs. */
export const distinctPages = (b: Buyer): string[] => [...new Set(b.pages)]

/** Produktseite öffnen, „In den Korb“, dann „Zum Korb“ (R04 → R06). */
export async function addToCartFromProduct(
  page: Page,
  request: APIRequestContext,
  itemNumber: number,
  locale: 'de' | 'en' = 'de',
): Promise<void> {
  await openProduct(page, request, await pathOf(itemNumber, locale))
  await expect(page.locator('[data-product-page]')).toHaveAttribute('data-status-live', '')
  await page.locator('[data-add-to-cart] button').click()
  const inCart = page.locator('[data-buy-area] [data-in-cart]')
  await expect(inCart).toBeVisible()
  await inCart.getByRole('link', { name: locale === 'de' ? 'Zum Korb' : 'Go to basket' }).click()
  await page.waitForURL(new RegExp(`${R06[locale]}$`))
  await expect(page.locator('[data-cart-line]').first()).toBeVisible()
}

/** „Zur Kasse“ im Korb (R06 → R07); liefert den Kassen-Token aus dem Cookie. */
export async function goToCheckout(
  context: BrowserContext,
  page: Page,
  locale: 'de' | 'en' = 'de',
): Promise<string> {
  await page.locator('[data-cart-checkout] button[type="submit"]').click()
  await page.waitForURL(new RegExp(`${R07[locale]}(\\?|$)`))
  await hydrated(page)
  return checkoutToken(context)
}

export async function checkoutToken(context: BrowserContext): Promise<string> {
  const token = (await context.cookies(serverURL)).find((c) => c.name === CHECKOUT_COOKIE)?.value
  if (!token) throw new Error('Kein pc_checkout.')
  return token
}

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex')

export interface CheckoutRow {
  id: number
  status: string
  session: string | null
}

export async function checkoutOf(token: string): Promise<CheckoutRow> {
  const row = (
    await (
      await db()
    ).execute(
      sql`SELECT id, status, stripe_checkout_session_id FROM checkouts WHERE token_hash = ${hashOf(token)}`,
    )
  ).rows[0]
  if (!row) throw new Error('Kasse zum Token fehlt.')
  return {
    id: Number(row.id),
    status: String(row.status),
    session: row.stripe_checkout_session_id ? String(row.stripe_checkout_session_id) : null,
  }
}

/** Alle Kassen-Status der Stücke (Reihenfolge der Anlage). */
export async function checkoutStatuses(productIds: number[]): Promise<string[]> {
  const ids = sql.raw(productIds.map(Number).join(','))
  const r = await (
    await db()
  ).execute(
    sql`SELECT DISTINCT c.id, c.status FROM checkouts c JOIN checkouts_items i ON i._parent_id = c.id WHERE i.product_id IN (${ids}) ORDER BY c.id`,
  )
  return r.rows.map((x) => String(x.status))
}

export interface OrderRow {
  id: number
  orderNumber: string
  status: string
  paymentMethod: string
  paymentMethodType: string | null
  fulfillmentMethod: string
}

/** Bestellungen der Stücke (keine vor der bestätigten Zahlung bzw. vor dem Klick bei Vorkasse). */
export async function ordersOf(productIds: number[]): Promise<OrderRow[]> {
  const ids = sql.raw(productIds.map(Number).join(','))
  const r = await (
    await db()
  ).execute(
    sql`SELECT DISTINCT o.id, o.order_number, o.status, o.payment_method, o.stripe_payment_method_type, o.fulfillment_method
          FROM orders o JOIN orders_items i ON i._parent_id = o.id WHERE i.product_id IN (${ids}) ORDER BY o.id`,
  )
  return r.rows.map((x) => ({
    id: Number(x.id),
    orderNumber: String(x.order_number),
    status: String(x.status),
    paymentMethod: String(x.payment_method),
    paymentMethodType: x.stripe_payment_method_type ? String(x.stripe_payment_method_type) : null,
    fulfillmentMethod: String(x.fulfillment_method),
  }))
}

/** Mail-Typen an die Käuferin (Datei-Treiber), sortiert. */
export async function mailTypes(email: string): Promise<string[]> {
  return (await readOutbox({ to: email })).map((r) => r.type).sort()
}

/** Wartet, bis die Käuferin genau diese Mail-Typen bekommen hat (Versand läuft nach dem Seitenwechsel weiter). */
export async function expectMails(email: string, types: string[]): Promise<void> {
  await expect
    .poll(() => mailTypes(email), { timeout: 15_000, intervals: [250, 500, 1000] })
    .toEqual([...types].sort())
}

/** Pflichtfelder Versand (Adresse in Berlin). */
export async function fillShipping(page: Page, email: string): Promise<void> {
  await page.locator('#checkout-email').fill(email)
  await page.locator('#checkout-name').fill('Erika Beispiel')
  await page.locator('#checkout-shipping-line1').fill('Musterstraße 1')
  await page.locator('#checkout-shipping-postal-code').fill('10115')
  await page.locator('#checkout-shipping-city').fill('Berlin')
}

/** Abholung wählen und die Pflicht-Rechnungsadresse ausfüllen (KONZEPT §4.4, K-07). */
export async function choosePickup(page: Page, email: string): Promise<void> {
  await page.locator('#checkout-delivery-pickup').check()
  await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
  await page.locator('#checkout-email').fill(email)
  await page.locator('#checkout-name').fill('Erika Beispiel')
  await page.locator('#checkout-billing-line1').fill('Musterstraße 1')
  await page.locator('#checkout-billing-postal-code').fill('10115')
  await page.locator('#checkout-billing-city').fill('Berlin')
}

/** Zahlart wählen (Karte/PayPal über das Zahlungsfeld oder Vorkasse). */
export async function choosePayment(page: Page, choice: 'stripe' | 'prepayment'): Promise<void> {
  await page.locator(`input[name="paymentChoice"][value="${choice}"]`).check()
}

/** Test-Ergebnis und Test-Zahlart im Mock-Zahlungsfeld. */
export async function chooseMock(
  page: Page,
  outcome: 'success' | 'declined' | 'cancelled' | 'delayed',
  method: 'card' | 'apple_pay' | 'google_pay' | 'paypal' = 'card',
): Promise<void> {
  await page.locator(`#mock-outcome-${outcome}`).check()
  await page.locator(`#mock-method-${method}`).check()
}

/** „Zahlungspflichtig bestellen“ und auf die Danke-Seite dieser Kasse warten. */
export async function orderAndThank(page: Page, token: string, locale: 'de' | 'en' = 'de') {
  const nav = page.waitForURL(new RegExp(`/${locale}/(danke|thank-you)/${token}$`))
  await orderButton(page, locale).click()
  await nav
  return page.locator('[data-thanks-page]')
}

/**
 * Countdown der Kasse serverseitig beenden (wie nach 30 Minuten): `display_expires_at` in die Vergangenheit – die
 * Reservierung selbst hält noch (Stripe-Session-Puffer); „Nochmal reservieren“ ersetzt sie (KO-15, S14).
 */
export async function endCountdown(checkoutId: number): Promise<void> {
  await (
    await db()
  ).execute(
    sql`UPDATE checkouts SET display_expires_at = now() - interval '1 minute' WHERE id = ${checkoutId}`,
  )
}

/** Reservierung serverseitig ablaufen lassen (Kasse, Reservierung, Stück – wie nach Ablauf der Session). */
export async function expireReservation(checkoutId: number): Promise<void> {
  const d = await db()
  const past = sql`now() - interval '1 minute'`
  await d.execute(
    sql`UPDATE checkouts SET display_expires_at = ${past}, expires_at = ${past}, stripe_session_expires_at = ${past} WHERE id = ${checkoutId}`,
  )
  await d.execute(
    sql`UPDATE reservations SET expires_at = ${past} WHERE ref = (SELECT reservation_ref FROM checkouts WHERE id = ${checkoutId})`,
  )
  await d.execute(
    sql`UPDATE products SET reserved_until = ${past} WHERE reservation_ref = (SELECT reservation_ref FROM checkouts WHERE id = ${checkoutId})`,
  )
}

/** Zweite Seite in eigenem Kontext, angemeldet in der Verwaltung (Local-API-Login, kein Formular – Rate-Limit). */
export async function adminPageIn(
  browser: Browser,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const admin = await adminLogin()
  const context = await browser.newContext()
  const payload = await testPayload()
  await context.addCookies([
    {
      name: `${payload.config.cookiePrefix}-token`,
      value: admin.token,
      url: serverURL,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ])
  const page = await context.newPage()
  return {
    page,
    close: async () => {
      await context.close()
      await admin.release()
    },
  }
}
