import path from 'node:path'

import { expect, test, testPayload } from '../../tests/e2e/fixtures'
import {
  cleanupCheckouts,
  fillShipping,
  hydrated,
  orderButton,
  startCheckoutFor,
} from '../../tests/e2e/checkout/checkoutHelpers'
import { PUBLISHED } from '../../tests/e2e/shop/productPage'
import { createOrder, orderData } from '../../tests/int/helpers/commerce'
import { renderFixture, WITHDRAWAL_RECEIPT_FIXTURE } from '../../tests/helpers/mails'
import { localizedPath } from '../../src/lib/routes/paths'

// Bildschirmfotos der Kanzlei-Mappe, Anlage E (PLAN P6.22, KANZLEI-BRIEFING §18): 390 px, Deutsch, Mock-Treiber,
// Fixture-Stück aus dem Bereich 980–999 und eine Fixture-Bestellung (`seed`-Daten, nie echte Personen).
// E-01 Kassen-Übersicht mit Bestellknopf · E-02 Widerruf Schritt 1 · E-03 Auswahl der Stücke · E-04 Schritt 2 ·
// E-05 Bestätigungsseite · E-06 gerenderte Eingangsbestätigung M08.
// Die Widerrufs-Schritte nutzen die Formularfelder aus `withdrawalInputSchema` (`src/lib/legal/withdrawal.ts`) und die
// Knöpfe laut PLAN P6.8 („Weiter“ in Schritt 1/Auswahl, „Widerruf bestätigen“ in Schritt 2).

const OUT = path.resolve(import.meta.dirname, '../../docs/recht/anlagen')
const shot = (name: string) => path.join(OUT, `${name}.png`)
const R26 = localizedPath('R26', 'de')
const ORDER_NUMBER = 999
const EMAIL = 'erika@example.com'

test.describe.configure({ mode: 'serial' })

test('E-01 Kassen-Übersicht mit Bestellknopf', async ({ page, context, fixtureProducts }) => {
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  try {
    await startCheckoutFor(context, page, [{ id: p.id }])
    await hydrated(page)
    await fillShipping(page, { email: EMAIL })
    const overview = page.locator('#uebersicht')
    await overview.scrollIntoViewIfNeeded()
    await expect(orderButton(page)).toBeVisible()
    await overview.screenshot({ path: shot('E-01'), animations: 'disabled' })
  } finally {
    await cleanupCheckouts([p.id])
  }
})

test('E-02 bis E-05 Widerrufsfunktion', async ({ page, fixtureProducts }) => {
  const payload = await testPayload()
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  const order = await createOrder(
    payload,
    orderData(ORDER_NUMBER, [{ id: p.id, itemNumber: p.itemNumber, priceCents: 4500 }], {
      customer: { name: 'Erika Beispiel', email: EMAIL },
      seed: true,
    }),
  )
  try {
    await page.goto(R26)
    const form = page
      .locator('form')
      .filter({ has: page.locator('[name="contractIdentification"]') })
    await form.locator('[name="name"]').fill('Erika Beispiel')
    await form.locator('[name="contractIdentification"]').fill(String(order.orderNumber))
    await form.locator('[name="email"]').fill(EMAIL)
    await page.screenshot({ path: shot('E-02'), fullPage: true, animations: 'disabled' })
    await form.locator('button[type="submit"]').last().click()

    // Auswahl (Bestellnummer und E-Mail passen): Checkboxen je Stück, keine angehakt
    await expect(page.getByRole('checkbox').first()).toBeVisible()
    await page.screenshot({ path: shot('E-03'), fullPage: true, animations: 'disabled' })
    await page.locator('form button[type="submit"]').last().click()

    const confirm = page.getByRole('button', { name: 'Widerruf bestätigen', exact: true })
    await expect(confirm).toBeVisible()
    await page.screenshot({ path: shot('E-04'), fullPage: true, animations: 'disabled' })
    await confirm.click()

    await expect(page.getByText(/WR-\d{4}-\d{5}/).first()).toBeVisible()
    await page.screenshot({ path: shot('E-05'), fullPage: true, animations: 'disabled' })
  } finally {
    await cleanupCheckouts([p.id])
  }
})

test('E-06 Eingangsbestätigung M08', async ({ page }) => {
  const mail = await renderFixture('withdrawal_receipt', WITHDRAWAL_RECEIPT_FIXTURE, 'de')
  await page.setContent(mail.html, { waitUntil: 'load' })
  await page.screenshot({ path: shot('E-06'), fullPage: true, animations: 'disabled' })
})
