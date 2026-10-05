import { sql } from '@payloadcms/db-postgres'
import type { Locator, Page } from '@playwright/test'

import { localizedPath } from '../../../src/lib/routes/paths'
import { dbOf } from '../../int/helpers/commerce'
import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { expect, test, testPayload } from '../fixtures'
import { buyer, distinctPages, ordersOf } from '../purchase/purchaseHelpers'
import { PUBLISHED, openProduct, pathOf } from '../shop/productPage'

// P10.3 R-191, EK-07: Kauf und Widerruf komplett per Tastatur – ohne Mausklick, jeder Halt zeigt :focus-visible.
// Der Tastatur-Durchlauf von Menü, Galerie/Zoom, Auftragsformular und Verwaltung steht in `keyboard.e2e.spec.ts`,
// `shop/gallery.e2e.spec.ts`, `commission/form.e2e.spec.ts` und `admin/shell.e2e.spec.ts`; hier der Kaufweg Ende zu Ende
// (Produktseite → Korb → Kasse → Danke) und der Widerruf vom Fußbereich aus.

const tabKey = (page: Page) =>
  page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab'

/** Tab, bis `target` den Fokus hat (höchstens `max` Schritte); jeder Halt muss `:focus-visible` tragen. */
async function tabTo(page: Page, target: Locator, max = 150): Promise<void> {
  await expect(target).toBeVisible()
  for (let i = 0; i < max; i++) {
    const state = await target.evaluate((el) => ({
      focused: el === document.activeElement,
      visible: el.matches(':focus-visible'),
    }))
    if (state.focused) {
      expect(state.visible, 'Fokus sichtbar (:focus-visible)').toBe(true)
      return
    }
    await page.keyboard.press(tabKey(page))
  }
  throw new Error(`Per Tab nicht erreichbar: ${target}`)
}

/** Feld per Tab ansteuern und per Tastatur ausfüllen. */
async function typeInto(page: Page, field: Locator, text: string): Promise<void> {
  await tabTo(page, field)
  await page.keyboard.type(text)
}

let used: number[] = []
let release: ReleaseLock | undefined
const emails: string[] = []
test.beforeEach(async () => {
  release = await holdShippingRates('shared')
})
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
  await release?.()
  release = undefined
  const db = dbOf(await testPayload())
  for (const email of emails.splice(0)) {
    const ids = sql`(SELECT id FROM withdrawals WHERE email = ${email})`
    await db.execute(sql`DELETE FROM email_log WHERE withdrawal_id IN ${ids}`)
    await db.execute(sql`DELETE FROM withdrawals WHERE email = ${email}`)
  }
})

test.describe('R-191 Kauf und Widerruf nur mit der Tastatur @a11y', () => {
  for (const locale of ['de', 'en'] as const) {
    test(`R-191 EK-07 Kauf (${locale}): Produktseite → Korb → Kasse → Danke-Seite, nur Tab/Enter/Pfeiltasten @a11y`, async ({
      page,
      context,
      request,
      fixtureProducts,
    }) => {
      test.slow()
      const de = locale === 'de'
      const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
      used.push(p.id)
      const b = await buyer(context, page)
      await openProduct(page, request, await pathOf(p.itemNumber, locale))
      await expect(page.locator('[data-product-page]')).toHaveAttribute('data-status-live', '')

      // Produktseite: „In den Korb“ per Enter, dann „Zum Korb“
      await tabTo(page, page.locator('[data-add-to-cart] button'))
      await page.keyboard.press('Enter')
      const toCart = page
        .locator('[data-buy-area] [data-in-cart]')
        .getByRole('link', { name: de ? 'Zum Korb' : 'Go to basket' })
      await expect(toCart).toBeVisible()
      await tabTo(page, toCart)
      await page.keyboard.press('Enter')
      await page.waitForURL(new RegExp(`${localizedPath('R06', locale)}$`))

      // Korb: „Zur Kasse“
      const checkout = page.locator('[data-cart-checkout] button[type="submit"]')
      await tabTo(page, checkout)
      await page.keyboard.press('Enter')
      await page.waitForURL(new RegExp(`${localizedPath('R07', locale)}(\\?|$)`))
      await expect(page.locator('[data-checkout-form][data-hydrated="true"]')).toBeVisible()

      // Kasse: Pflichtfelder tippen, Zahlart mit Pfeiltasten, bestellen mit Enter
      await typeInto(page, page.locator('#checkout-email'), b.email)
      await typeInto(page, page.locator('#checkout-name'), 'Erika Tastatur')
      await typeInto(page, page.locator('#checkout-shipping-line1'), 'Musterstraße 1')
      await typeInto(page, page.locator('#checkout-shipping-postal-code'), '10115')
      await typeInto(page, page.locator('#checkout-shipping-city'), 'Berlin')
      // Die Radiogruppe nimmt den Fokus am vorgewählten Knopf an; weiter mit den Pfeiltasten
      await tabTo(page, page.locator('input[name="paymentChoice"]:checked'))
      for (let i = 0; i < 4; i++) {
        if (await page.locator('input[name="paymentChoice"][value="prepayment"]').isChecked()) break
        await page.keyboard.press('ArrowDown')
      }
      await expect(page.locator('input[name="paymentChoice"][value="prepayment"]')).toBeChecked()
      const order = page.getByRole('button', {
        name: de ? 'Zahlungspflichtig bestellen' : 'Order with obligation to pay',
        exact: true,
      })
      await tabTo(page, order)
      await page.keyboard.press('Enter')
      await page.waitForURL(new RegExp(`/${locale}/(danke|thank-you)/`))
      await expect(page.locator('[data-thanks-page]')).toHaveAttribute(
        'data-thanks-state',
        'prepayment',
      )
      expect(await ordersOf([p.id])).toHaveLength(1)
      expect(distinctPages(b).length).toBeLessThanOrEqual(4)
    })

    test(`R-191 EK-07 Widerruf (${locale}): vom Fußbereich zu „Vertrag widerrufen“, beide Schritte, Bestätigung @a11y`, async ({
      page,
    }) => {
      const de = locale === 'de'
      const email = `e2e-kbd-widerruf-${locale}-${Date.now()}@example.com`
      emails.push(email)
      await page.goto(localizedPath('R01', locale))
      await page.waitForLoadState('networkidle')
      const link = page
        .locator('footer')
        .getByRole('link', {
          name: de ? 'Vertrag widerrufen' : 'Withdraw from contract here',
          exact: false,
        })
        .first()
      await tabTo(page, link)
      await page.keyboard.press('Enter')
      await page.waitForURL(new RegExp(`${localizedPath('R26', locale)}$`))

      await typeInto(page, page.locator('[name="name"]'), 'Erika Tastatur')
      await typeInto(page, page.locator('[name="contractIdentification"]'), 'Bestellung vom 1.10.')
      await typeInto(page, page.locator('[name="email"]'), email)
      // Honeypot ist nie per Tab erreichbar
      await expect(page.locator('[name="website"]')).not.toBeFocused()
      // Schritt 1 und Schritt 2 teilen sich den Knopf `intent=next` („Weiter“ bzw. „Widerruf bestätigen“)
      const forward = page.locator('button[name="intent"][value="next"]')
      await tabTo(page, forward)
      expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).name)).toBe(
        'intent',
      )
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-withdraw-summary]')).toBeVisible()
      await tabTo(page, forward)
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-withdraw-reference]')).toBeVisible()
    })
  }
})
