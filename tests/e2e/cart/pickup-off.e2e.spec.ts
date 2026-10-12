import type { Payload } from 'payload'

import type { ProductCategory } from '../../../src/lib/enums'
import { localizedPath } from '../../../src/lib/routes/paths'
import {
  holdFixtureRange,
  holdShippingRates,
  type ReleaseLock,
} from '../../helpers/adminSessionLock'
import { completeProduct, createProductFixtures } from '../../int/helpers/products'
import { cleanupCheckouts, R07, startCheckoutFor } from '../checkout/checkoutHelpers'
import { expect, test, testPayload } from '../fixtures'
import { NO_CACHE, refresh } from '../shop/fresh'
import { PUBLISHED, openProduct, pathOf } from '../shop/productPage'
import { R06, setCart } from './cartHelpers'

// P18.5 – Schalter „Abholung möglich“ aus (KONZEPT §4.3 Regel 7, RECHT R-036): Korb und Kasse ohne Abhol-Radio, eine
// gemerkte Abholung wird Versand, `nur_abholung`-Stücke sind gesperrt („Gerade nicht bestellbar – Abholung ist im Moment
// nicht möglich“: Korbzeile, Hinweis vor „Zur Kasse“, Knopf auf der Produktseite aus), die Zahlarten-Zeile vor „Zur Kasse“
// kommt ohne Abhol-Satz aus den Einstellungen; eine offene Kasse mit Abholung schickt zurück in den Korb, „Zur Kasse“
// ersetzt sie durch eine mit Versand. Der Seitenaufruf setzt weiter kein Cookie.
// Globale Einstellung: nur im Projekt desktop; Stück-Bestand (`holdFixtureRange`) und Versand-Einstellungen
// (`holdShippingRates`) exklusiv – in dieser Reihenfolge wie alle anderen Tests –, damit kein paralleler Test, der
// Abholung erwartet, den Zwischenstand sieht. Die Stücke 998/999 legt der Test selbst an (nicht `fixtureProducts`, das
// den Bestand nur geteilt hält). Umgestellt wird per Local API ohne Revalidierung, zurück im `finally`.

const OWN = [998, 999]

async function removeOwn(payload: Payload) {
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { in: OWN } },
    overrideAccess: true,
    context: { seed: true },
  })
}

async function createOwn(
  payload: Payload,
  nr: number,
  category: ProductCategory,
  extra: Record<string, unknown> = {},
): Promise<{ id: number; itemNumber: number }> {
  const fx = await createProductFixtures(payload)
  const doc = await payload.create({
    collection: 'products',
    data: { ...completeProduct(category, nr, fx), seed: true, ...PUBLISHED, ...extra } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  return { id: doc.id as number, itemNumber: nr }
}

/** `settings.shipping.pickupEnabled` setzen (Local API, ohne Revalidierung); liefert die Rücknahme. */
async function setPickup(payload: Payload, enabled: boolean): Promise<() => Promise<void>> {
  const before = (await payload.findGlobal({
    slug: 'settings',
    overrideAccess: true,
    depth: 0,
  })) as unknown as { shipping?: Record<string, unknown> }
  const write = (shipping: Record<string, unknown>) =>
    payload.updateGlobal({
      slug: 'settings',
      data: { shipping } as never,
      overrideAccess: true,
      locale: 'de',
      context: { seed: true },
    })
  await write({ ...before.shipping, pickupEnabled: enabled })
  return async () => {
    await write({ ...before.shipping })
  }
}

test.describe('Abholung ausgeschaltet (exklusiv, nur desktop)', () => {
  let payload: Payload
  let releaseRange: ReleaseLock | undefined
  let releaseRates: ReleaseLock | undefined
  let restore: (() => Promise<void>) | undefined
  let used: number[] = []

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'globale Einstellung – einmal je Lauf')
    releaseRange = await holdFixtureRange('exclusive')
    releaseRates = await holdShippingRates('exclusive')
    payload = await testPayload()
    await removeOwn(payload)
  })

  test.afterEach(async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    try {
      await restore?.()
      restore = undefined
      await cleanupCheckouts(used)
      used = []
      await removeOwn(payload)
      // Daten-Cache mit dem zurückgesetzten Schalter füllen (Fußzeile, Listen), bevor andere Tests weiterlaufen.
      const pages = [
        localizedPath('R01', 'de'),
        localizedPath('R01', 'en'),
        localizedPath('R02', 'de'),
      ]
      await refresh(request, pages)
      if (process.env.E2E_SERVER !== 'start') {
        for (const url of pages) await request.get(url, { headers: NO_CACHE })
      }
    } finally {
      await releaseRates?.()
      await releaseRange?.()
      releaseRates = undefined
      releaseRange = undefined
    }
  })

  test('Korb: keine Lieferart-Wahl (V-16), gemerkte Abholung wird Versand, nur_abholung gesperrt, Zahlarten ohne Abhol-Satz; Seitenaufruf setzt kein Cookie', async ({
    page,
    context,
  }) => {
    const a = await createOwn(payload, 998, 'keramik', { priceCents: 4500 })
    const p = await createOwn(payload, 999, 'sonstiges', {
      priceCents: 3000,
      shippingClass: 'nur_abholung',
    })
    used = [a.id, p.id]
    restore = await setPickup(payload, false)

    await setCart(context, [{ id: a.id, p: 4500 }], 'pickup')
    for (const locale of ['de', 'en'] as const) {
      const res = await page.goto(R06[locale])
      expect(res?.status()).toBe(200)
      expect(await res?.headerValue('set-cookie')).toBeNull()
      // V-16: keine Lieferart-Wahl im Korb; ohne Abholung auch kein „Abholung wählst du in der Kasse“
      await expect(page.locator('[data-delivery-option], input[name="method"]')).toHaveCount(0)
      await expect(page.locator('[data-cart-shipping="shipping"]')).toBeVisible()
      await expect(page.locator('[data-cart-delivery-note]')).toHaveCount(0)
      await expect(
        page.locator('[data-cart-summary] [data-delivery-time="shipping"]'),
      ).toBeVisible()
      const info = page.locator('[data-cart-payment-info]')
      await expect(info.locator('[data-snippet="cart.paymentAndDeliveryInfo"]')).toHaveCount(0)
      await expect(info.locator('[data-cart-info-variant="settings"]')).toHaveText(
        locale === 'de'
          ? 'Wir liefern nur innerhalb Deutschlands. Zahlarten: Kredit-/Debitkarte, Apple Pay, Google Pay, PayPal, Vorkasse per Überweisung.'
          : 'We only deliver within Germany. Payment methods: credit/debit card, Apple Pay, Google Pay, PayPal, payment in advance by bank transfer.',
      )
      expect(await info.innerText()).not.toMatch(/Abholung|Collection|pickup/i)
      await expect(page.locator('[data-cart-checkout] button[type="submit"]')).not.toHaveAttribute(
        'aria-disabled',
        'true',
      )
    }

    // nur_abholung im Korb: Zeile gedämpft mit Hinweis, eigener Blocker, „Zur Kasse“ gesperrt.
    await setCart(context, [
      { id: a.id, p: 4500 },
      { id: p.id, p: 3000 },
    ])
    await page.goto(R06.de)
    const line = page.locator(`[data-cart-line="${p.id}"]`)
    await expect(line).toHaveAttribute('data-purchasable', 'false')
    await expect(line.locator('[data-cart-line-note="pickup-blocked"]')).toHaveText(
      'Gerade nicht bestellbar – Abholung ist im Moment nicht möglich',
    )
    await expect(page.locator('[data-cart-shipping="shipping"]')).toBeVisible()
    await expect(page.locator('[data-blocker="pickup_disabled"]')).toHaveText(
      `Nr. ${p.itemNumber} gibt es nur zur Abholung, und Abholung ist im Moment nicht möglich. Nimm das Stück bitte aus dem Korb.`,
    )
    await expect(page.locator('[data-blocker="unavailable"]')).toHaveCount(0)
    await expect(page.locator('[data-cart-checkout] button[type="submit"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  test('Produktseite: nur_abholung nicht bestellbar – Knopf aus mit Hinweis, keine Kauf-Leiste, kein Cookie; Versandzeile ohne Abholung (V-10)', async ({
    page,
    request,
  }) => {
    const p = await createOwn(payload, 999, 'sonstiges', { shippingClass: 'nur_abholung' })
    const a = await createOwn(payload, 998, 'keramik')
    used = [p.id, a.id]
    restore = await setPickup(payload, false)
    const url = await pathOf(p.itemNumber, 'de')
    const urlA = await pathOf(a.itemNumber, 'de')
    try {
      // V-10: Versand am Preis, aber kein „Abholung … kostenlos“, solange Abholung aus ist
      await openProduct(page, request, urlA)
      await expect(page.locator('[data-shipping-at-price]')).toHaveText('+ 8,90 € Versand')
      await expect(page.locator('[data-shipping-at-price-pickup]')).toHaveCount(0)
      await expect(page.locator('[data-shipping-once]')).toHaveText(
        'Mehrere Stücke? Versand zahlst du nur einmal.',
      )
      await openProduct(page, request, url)
      await expect(page.locator('[data-shipping-at-price]')).toHaveCount(0)
      await expect(page.locator('[data-shipping-once]')).toHaveCount(0)
      await expect(page.locator('[data-buy-area]')).toHaveAttribute('data-buy-state', 'closed')
      await expect(page.locator('[data-pickup-blocked]')).toContainText(
        'Gerade nicht bestellbar – Abholung ist im Moment nicht möglich.',
      )
      await expect(page.locator('[data-add-to-cart] button')).toBeDisabled()
      await expect(page.locator('[data-buy-bar]')).toHaveCount(0)
      expect((await page.context().cookies()).map((c) => c.name)).not.toContain('pc_cart')
    } finally {
      // Die Seite des Stücks mit dem zurückgesetzten Schalter neu erzeugen (Produktions-Build).
      await restore?.()
      restore = undefined
      await refresh(request, [url, urlA])
    }
  })

  test('Kasse: offene Kasse mit Abholung → zurück in den Korb; „Zur Kasse“ startet mit Versand, ohne Abhol-Radio', async ({
    page,
    context,
  }) => {
    const a = await createOwn(payload, 998, 'keramik', { priceCents: 4500 })
    used = [a.id]
    const started = await startCheckoutFor(context, page, [{ id: a.id, priceCents: 4500 }], {
      delivery: 'pickup',
    })
    await expect(page.locator('#checkout-delivery-pickup')).toBeChecked()
    restore = await setPickup(payload, false)

    await page.goto(R07.de)
    await page.waitForURL(new RegExp(`${R06.de}\\?`))
    await expect(page.locator('[data-cart-notice="pickup_disabled"]')).toContainText(
      'Abholung ist im Moment nicht möglich – ich schicke dir deine Stücke gern zu.',
    )
    await expect(page.locator('[data-cart-shipping="shipping"]')).toBeVisible()

    await page.locator('[data-cart-checkout] button[type="submit"]').click()
    await page.waitForURL(new RegExp(`${R07.de}(\\?|$)`))
    await expect(page.locator('#checkout-delivery-pickup')).toHaveCount(0)
    await expect(page.locator('#checkout-delivery-shipping')).toBeChecked()
    await expect(page.locator('[data-overview-shipping="shipping"]')).toBeVisible()
    const token = (await context.cookies()).find((c) => c.name === 'pc_checkout')?.value
    expect(token).toBeTruthy()
    expect(token).not.toBe(started.token)
  })
})
