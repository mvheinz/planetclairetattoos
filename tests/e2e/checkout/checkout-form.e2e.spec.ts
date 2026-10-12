import { sql } from '@payloadcms/db-postgres'

import { expectNoSeriousViolations } from '../axe'
import { expectCalm } from '../calm'
import { expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import {
  R06,
  R07,
  cleanupCheckouts,
  db,
  fillShipping,
  hydrated,
  orderButton,
  startCheckoutFor,
} from './checkoutHelpers'

// P4.9 Kasse R07 (KONZEPT §4.4/§4.6, DESIGN KO-12/KO-14/KO-15): Pflichtfelder je Lieferart mit Fehlerzusammenfassung,
// Lieferartwechsel ohne Datenverlust, Instagram-Hinweis (KA-25), Countdown mit `page.clock`, S13 ohne Zahlungs-Session,
// Rückweg ohne Kasse (307), R-062 (mit Mock kein Stripe), Ruhe-Modus (AK-DS-11) und Barrierefreiheit (@a11y).

let used: number[] = []
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
})

async function keramik(
  fixtureProducts: {
    create: (c: 'keramik', o?: Record<string, unknown>) => Promise<{ id: number }>
  },
  o: Record<string, unknown> = {},
) {
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, ...o })
  used.push(p.id)
  return p
}

test.describe('Kasse R07 – Formular', () => {
  test('ohne gültiges pc_checkout → 307 auf den Korb mit Hinweis', async ({ request, page }) => {
    const res = await request.get(R07.de, { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    expect(res.headers().location).toContain(`${R06.de}?hinweis=no_checkout`)
    await page.goto(R07.de)
    await expect(page).toHaveURL(new RegExp(`${R06.de}\\?hinweis=no_checkout`))
    await expect(page.locator('[data-cart-notice="no_checkout"]')).toBeVisible()
  })

  test('Pflichtfelder Versand: Fehlerzusammenfassung oben (role=alert, Fokus, Sprunglinks), Fehler am Feld', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    await page.goto(R07.de)
    await hydrated(page)
    await orderButton(page).click()
    const summary = page.locator('[data-error-summary]')
    await expect(summary).toBeFocused()
    await expect(summary).toHaveAttribute('role', 'alert')
    for (const key of ['email', 'name', 'shippingLine1', 'shippingPostalCode', 'shippingCity']) {
      await expect(summary.locator(`[data-error-link="${key}"]`)).toBeVisible()
    }
    await expect(summary.locator('[data-error-link^="billing"]')).toHaveCount(0)
    await expect(page.locator('#checkout-email')).toHaveAttribute('aria-invalid', 'true')
    await summary.locator('[data-error-link="shippingPostalCode"]').click()
    await expect(page).toHaveURL(/#checkout-shipping-postal-code$/)
    // Falsche PLZ → eigener Fehler
    await fillShipping(page)
    await page.locator('#checkout-shipping-postal-code').fill('1011')
    await orderButton(page).click()
    await expect(summary.locator('[data-error-link="shippingPostalCode"]')).toContainText(
      'genau 5 Ziffern',
    )
    await expect(summary.locator('[data-error-link="email"]')).toHaveCount(0)
  })

  test('Lieferartwechsel Versand ↔ Abholung behält alle Eingaben; Abholung verlangt die Rechnungsadresse; Summen neu', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    await page.goto(R07.de)
    await hydrated(page)
    await fillShipping(page)
    await page.locator('#checkout-shipping-line2').fill('Hinterhaus')
    const total = page.locator('[data-overview-total] [data-money]')
    const shippingTotal = await total.innerText()

    await page.locator('#checkout-delivery-pickup').check()
    await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
    await expect(total).not.toHaveText(shippingTotal)
    await expect(page.locator('[data-pickup-hint]')).toContainText('Privatstudio in Berlin-')
    await expect(page.locator('#checkout-shipping-line1')).toBeHidden()
    await expect(page.locator('#checkout-carrier-consent')).toBeHidden()
    await expect(page.locator('#checkout-billing-line1')).toBeVisible()
    await orderButton(page).click()
    const summary = page.locator('[data-error-summary]')
    await expect(summary).toBeFocused()
    for (const key of ['billingLine1', 'billingPostalCode', 'billingCity']) {
      await expect(summary.locator(`[data-error-link="${key}"]`)).toBeVisible()
    }
    await expect(summary.locator('[data-error-link="shippingLine1"]')).toHaveCount(0)

    await page.locator('#checkout-delivery-shipping').check()
    await expect(page.locator('[data-overview-shipping="shipping"]')).toBeVisible()
    await expect(total).toHaveText(shippingTotal)
    await expect(page.locator('#checkout-email')).toHaveValue('erika@planetclaire.local')
    await expect(page.locator('#checkout-name')).toHaveValue('Erika Beispiel')
    await expect(page.locator('#checkout-shipping-line1')).toHaveValue('Musterstraße 1')
    await expect(page.locator('#checkout-shipping-line2')).toHaveValue('Hinterhaus')
    await expect(page.locator('#checkout-shipping-postal-code')).toHaveValue('10115')
  })

  test('V-17 Abholung mit Rechnungsadresse in Österreich: Land wählbar (Standard Deutschland, EU/EWR ohne CH/GB), PLZ mit 4 Ziffern, Übersicht nennt das Land; gespeichert mit AT', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    const started = await startCheckoutFor(context, page, [a], { delivery: 'pickup' })
    await page.goto(R07.de)
    await hydrated(page)
    const country = page.locator('#checkout-billing-country')
    await expect(country).toBeVisible()
    await expect(country).toHaveValue('DE')
    const values = await country
      .locator('option')
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))
    expect(values[0]).toBe('DE')
    expect(values).toEqual(expect.arrayContaining(['AT', 'FR', 'IS', 'LI', 'NO']))
    expect(values).not.toContain('CH')
    expect(values).not.toContain('GB')
    expect(values).toHaveLength(30)
    await expect(page.locator('[data-billing-fields]')).toContainText(
      'Liefern kann ich nur innerhalb Deutschlands.',
    )

    await page.locator('#checkout-email').fill('anna.alpen@planetclaire.local')
    await page.locator('#checkout-name').fill('Anna Alpen')
    await page.locator('#checkout-billing-line1').fill('Ringstraße 1')
    await country.selectOption('AT')
    await expect(page.locator('#checkout-billing-postal-code')).toHaveAttribute('maxlength', '10')
    await page.locator('#checkout-billing-postal-code').fill('1010')
    await page.locator('#checkout-billing-city').fill('Wien')
    await expect(
      page.locator('[data-overview-block="rechnung"] [data-overview-value]'),
    ).toContainText('Österreich')
    await orderButton(page).click()
    await page.waitForURL(/\/de\/danke\//)
    const row = (
      await (
        await db()
      ).execute(
        sql`SELECT billing_address_country, billing_address_postal_code, fulfillment_method FROM checkouts WHERE id = ${started.checkoutId}`,
      )
    ).rows[0]
    expect(row).toMatchObject({
      billing_address_country: 'AT',
      billing_address_postal_code: '1010',
      fulfillment_method: 'pickup',
    })
  })

  test('V-17 Rechnungsland Deutschland verlangt weiter 5 Ziffern; Versand bleibt fest Deutschland', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    await page.goto(R07.de)
    await hydrated(page)
    await expect(page.locator('[data-shipping-fields] [data-country]')).toContainText('Deutschland')
    await expect(page.locator('select[name="shippingAddress.country"]')).toHaveCount(0)
    await fillShipping(page)
    await page.locator('#checkout-billing-differs').check()
    await page.locator('#checkout-billing-name').fill('Rita Rechnung')
    await page.locator('#checkout-billing-line1').fill('Weg 2')
    await page.locator('#checkout-billing-postal-code').fill('1010')
    await page.locator('#checkout-billing-city').fill('Hamburg')
    await orderButton(page).click()
    const summary = page.locator('[data-error-summary]')
    await expect(summary.locator('[data-error-link="billingPostalCode"]')).toContainText(
      'genau 5 Ziffern',
    )
    await page.locator('#checkout-billing-country').selectOption('NO')
    await orderButton(page).click()
    await page.waitForURL(/\/de\/danke\//)
  })

  test('V-18 b Geschenk: Hinweis bei Versand, Häkchen nicht vorangekreuzt, Gruß erscheint erst mit Häkchen, Übersicht „Geschenk“, gespeichert an der Kasse', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    const started = await startCheckoutFor(context, page, [a])
    await page.goto(R07.de)
    await hydrated(page)
    await expect(page.locator('[data-gift-hint]')).toHaveText(
      'Ein Geschenk? Gib einfach die Adresse der beschenkten Person als Lieferadresse an – auf dem Packzettel steht kein Preis, die Rechnung kommt nur per E-Mail an dich.',
    )
    const gift = page.locator('#checkout-gift')
    await expect(gift).not.toBeChecked()
    await expect(page.locator('#checkout-gift-message')).toBeHidden()
    await expect(page.locator('[data-overview-block="geschenk"]')).toHaveCount(0)
    await fillShipping(page)
    await page.locator('label[for="checkout-gift"]').click()
    await expect(gift).toBeChecked()
    const message = page.locator('#checkout-gift-message')
    await expect(message).toBeVisible()
    await expect(message).toHaveAttribute('maxlength', '300')
    await expect(page.locator('[data-gift-billing-hint]')).toContainText(
      'Rechnungsadresse weicht ab',
    )
    const overview = page.locator('[data-overview-block="geschenk"] [data-overview-value]')
    await expect(overview).toHaveText('ja – mit handgeschriebener Karte')
    await message.fill('Alles Liebe zum Geburtstag!\nDeine Erika')
    await expect(overview).toHaveText('ja – Karte mit deinem Gruß')
    // Abholung: kein Liefer-Hinweis, das Häkchen bleibt möglich
    await page.locator('#checkout-delivery-pickup').check()
    await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
    await expect(page.locator('[data-gift-hint]')).toBeHidden()
    await expect(gift).toBeVisible()
    await page.locator('#checkout-delivery-shipping').check()
    await expect(page.locator('[data-overview-shipping="shipping"]')).toBeVisible()
    await orderButton(page).click()
    await page.waitForURL(/\/de\/danke\//)
    const row = (
      await (
        await db()
      ).execute(
        sql`SELECT gift_is_gift, gift_message FROM checkouts WHERE id = ${started.checkoutId}`,
      )
    ).rows[0]
    expect(row).toMatchObject({
      gift_is_gift: true,
      gift_message: 'Alles Liebe zum Geburtstag!\nDeine Erika',
    })
  })

  test('V-16 nur Abholung im Korb: die Kasse wählt Abholung und sagt warum', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const p = await keramik(fixtureProducts, { shippingClass: 'nur_abholung' })
    await startCheckoutFor(context, page, [p])
    await page.goto(R07.de)
    await expect(page.locator('#checkout-delivery-pickup')).toBeChecked()
    await expect(page.locator('#checkout-delivery-shipping')).toBeDisabled()
    await expect(page.locator('[data-checkout-delivery]')).toContainText(
      'gibt es nur zur Abholung.',
    )
  })

  test('KA-25 ohne Instagram-User-Agent kein Hinweis', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    await expect(page.locator('[data-payment-choice]')).toBeVisible()
    await expect(page.locator('[data-instagram-hint]')).toHaveCount(0)
  })

  test('Countdown KO-15 mit page.clock: Schwellen, Ansagen, Ablauf mit „Nochmal reservieren“, Bestellknopf gesperrt; nur Textwechsel (AK-DS-11)', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await page.clock.install({ time: new Date() })
    const started = await startCheckoutFor(context, page, [a])
    await page.goto(R07.de)
    await hydrated(page)
    const box = page.locator('[data-countdown="full"]')
    const timer = box.getByRole('timer')
    await expect(timer).toHaveAttribute('aria-live', 'off')
    await expect(timer).toHaveText(/^(30:00|29:5\d)$/)
    await expect(box).toHaveAttribute('data-level', 'normal')
    await expect(page.locator('[data-countdown="compact"]').getByRole('timer')).toHaveText(
      /^Noch (30:00|29:5\d) reserviert$/,
    )
    const remaining = started.displayExpiresAt.getTime() - Date.now()

    await page.clock.fastForward(Math.max(0, remaining - 10 * 60_000 + 2000))
    await expect(box.locator('[data-countdown-announce]')).toHaveText('Noch 10 Minuten reserviert.')
    await page.clock.fastForward(5 * 60_000)
    await expect(box).toHaveAttribute('data-level', 'warn')
    await expect(box.locator('[data-countdown-text]')).toHaveText('Noch 5 Minuten reserviert')
    await page.clock.fastForward(4 * 60_000)
    await expect(box).toHaveAttribute('data-level', 'last')
    await expect(box.locator('[data-countdown-text]')).toHaveText('Nur noch 1 Minute')
    await expect(orderButton(page)).toBeEnabled()
    await page.clock.fastForward(60_000)
    await expect(box).toHaveAttribute('data-level', 'expired')
    await expect(box.locator('[data-countdown-expired]')).toContainText(
      'Deine Reservierung ist abgelaufen.',
    )
    await expect(box.getByRole('button', { name: 'Nochmal reservieren' })).toBeVisible()
    await expect(box.getByRole('link', { name: 'Zum Korb' })).toHaveAttribute('href', R06.de)
    await expect(box.locator('[data-countdown-announce]')).toHaveText(
      'Deine Reservierung ist abgelaufen.',
    )
    await expect(orderButton(page)).toBeDisabled()
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.timeline?.constructor?.name !== 'ScrollTimeline')
            .length,
      ),
    ).toBe(0)
  })

  test('S13 ohne Zahlungs-Session: nur Vorkasse mit „Kartenzahlung ist gerade nicht erreichbar“', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    const started = await startCheckoutFor(context, page, [a])
    // Anbieter beim Start nicht erreichbar: Kasse ohne Session (wie nach einem Fehler in `startCheckout`).
    await (
      await db()
    ).execute(
      sql`UPDATE checkouts SET stripe_checkout_session_id = NULL, stripe_session_expires_at = NULL WHERE id = ${started.checkoutId}`,
    )
    await page.goto(R07.de)
    await expect(page.locator('[data-stripe-unavailable]')).toContainText(
      'Kartenzahlung ist gerade nicht erreichbar',
    )
    await expect(page.locator('input[name="paymentChoice"]')).toHaveCount(1)
    await expect(page.locator('input[name="paymentChoice"]')).toHaveValue('prepayment')
    await expect(page.locator('[data-payment-field]')).toHaveCount(0)
    await expect(page.locator('[data-paypal-note]')).toHaveCount(0)
  })

  test('R-062 mit Mock: Testfeld statt Stripe, keine Anfrage an Stripe-Hosts, kein Stripe-Host in der CSP', async ({
    page,
    context,
    fixtureProducts,
    foreignRequests,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    const stripe: string[] = []
    page.on('request', (r) => {
      if (/stripe\.(com|network)/.test(new URL(r.url()).host)) stripe.push(r.url())
    })
    const res = await page.goto(R07.de)
    expect(res?.status()).toBe(200)
    expect(res?.headers()['cache-control']).toMatch(/private, no-store|no-(store|cache)/)
    expect(res?.headers()['content-security-policy'] ?? '').not.toContain('stripe')
    await hydrated(page)
    await expect(page.locator('[data-payment-field="mock"]')).toContainText(
      'Testmodus – keine echte Zahlung',
    )
    for (const label of ['Erfolg', 'Abgelehnt', 'Abbruch (wie PayPal zurück)', 'Verzögert']) {
      await expect(page.getByLabel(label, { exact: true })).toBeAttached()
    }
    for (const label of ['Karte', 'Apple Pay', 'Google Pay', 'PayPal']) {
      await expect(page.getByLabel(label, { exact: true })).toBeAttached()
    }
    await expect(page.locator('script[src*="js.stripe.com"]')).toHaveCount(0)
    await expect(page.locator('[data-paypal-note]')).toHaveText(
      'Bei PayPal wirst du kurz zu PayPal weitergeleitet.',
    )
    expect(stripe).toEqual([])
    expect(foreignRequests).toEqual([])
    await expectCalm(page, 'R07')
  })
})

test.describe('Instagram-In-App-Browser (KA-25)', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
  })

  test('KA-25 User-Agent mit „Instagram“: Hinweis über der Zahlart', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    await expect(page.locator('[data-instagram-hint]')).toContainText('Apple Pay oder Google Pay')
  })
})

test.describe('Barrierefreiheit', () => {
  test('T-11 R07 leer, mit Fehlern und mit Abholung (DE/EN) axe @a11y', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await keramik(fixtureProducts)
    await startCheckoutFor(context, page, [a])
    await page.goto(R07.de)
    await hydrated(page)
    await expectNoSeriousViolations(page, 'R07 leer')
    await orderButton(page).click()
    await expect(page.locator('[data-error-summary]')).toBeFocused()
    await expectNoSeriousViolations(page, 'R07 mit Fehlern')
    await page.locator('#checkout-delivery-pickup').check()
    await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
    await expectNoSeriousViolations(page, 'R07 Abholung')
    await page.goto(R07.en)
    await hydrated(page)
    await expect(orderButton(page, 'en')).toBeVisible()
    await expectNoSeriousViolations(page, 'R07 EN')
  })
})
