import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { freshPage, refresh } from '../shop/fresh'
import { ANCHORS } from '../shop/productPage'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P5.22a – Einstellungen, Teil 3 (KONZEPT §7.14): Shop, Kosten, Vorlagen, Steuer-Bestätigung mit Jahressummen vor dem
// Shop, Datenschutz & Dienste (Statistik), Rechtstexte – alle Bereiche bei 390×844 bedienbar, axe ohne
// serious/critical; Shop aus → Produktseite zeigt `closedMessage` statt „In den Korb“, Shop an → Kaufbereich wieder da
// (DM-41).

const SECTIONS = [
  'Stammdaten & Impressum',
  'Steuer',
  'Zahlung',
  'Shop',
  'Kosten',
  'Vorlagen',
  'Datenschutz & Dienste',
  'Rechtstexte',
  'Benachrichtigungen',
  'Beispieldaten',
  'Konto',
]

test('@a11y Einstellungen Teil 3: alle Bereiche bei 390×844 bedienbar, Prüfungen am Feld', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const before = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/einstellungen'))
    for (const name of SECTIONS) {
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
    }
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // Shop: 11 Stücke abgelehnt (Hinweis am Feld, Fokus)
    const shop = page.getByTestId('area-form-shop')
    const max = shop.getByTestId('area-field-shop.maxItemsPerCheckout')
    await max.fill('11')
    await shop.getByTestId('area-save-shop').click()
    await expect(shop.getByTestId('area-error-shop.maxItemsPerCheckout')).toBeVisible()
    await expect(max).toBeFocused()
    await expect(max).toHaveAttribute('aria-invalid', 'true')
    await max.fill('10')
    await shop.getByTestId('area-save-shop').click()
    await expect(shop).toContainText('Gespeichert.')

    // Statistik: an ohne Datum → abgelehnt (R-132)
    const analytics = page.getByTestId('area-form-analytics')
    await analytics.getByTestId('area-field-analytics.enabled').check()
    await analytics.getByTestId('area-save-analytics').click()
    await expect(analytics.getByTestId('area-errors-analytics')).toContainText('Datum und Notiz')
    await analytics.getByTestId('area-field-analytics.enabled').uncheck()

    // Steuerangaben bestätigt (Dialog) → Datum steht da
    await page.getByTestId('area-save-taxConfirm').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Startklar-Prüfung')
    await expectAccessible(page, 'dialog[open]')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect(page.getByTestId('settings-tax-confirmed')).toContainText('Zuletzt bestätigt am')
    await expect(page.getByTestId('settings-tax-year-totals')).toContainText('Vorjahr auch mit 0 €')

    // Kosten: Monatswert hinzufügen und speichern
    const costs = page.getByTestId('area-form-costs')
    await costs.getByTestId('area-add-costs.monthlyEntries').click()
    const rows = costs.getByTestId('area-rows-costs.monthlyEntries').locator('fieldset')
    const last = rows.last()
    await last.locator('input').nth(0).fill('2026-09')
    await last.locator('input').nth(1).fill('27,40')
    await costs.getByTestId('area-save-costs').click()
    await expect(costs).toContainText('Gespeichert.')

    // Vorlagen und Rechtstexte erreichbar; Hinweis K-13
    await expect(page.getByTestId('area-form-templates')).toContainText('nur für neue Stücke')
    await expect(page.getByTestId('area-form-legal')).toContainText('K-13')
    await expectAccessible(page, '.pc-admin-view')
  } finally {
    await payload.updateGlobal({
      slug: 'settings',
      data: {
        shop: before.shop,
        costs: before.costs,
        tax: before.tax,
        analytics: before.analytics,
      } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
})

test.describe('DM-41 Shop aus/an über die Einstellungen', () => {
  let releaseRange: ReleaseLock | undefined
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'ändert Einstellungen – einmal im Projekt desktop',
    )
    // Andere Shop-Tests sehen den Zwischenstand nicht.
    releaseRange = await holdFixtureRange('exclusive')
    await freshPage(page)
  })
  test.afterEach(async () => {
    await releaseRange?.()
    releaseRange = undefined
  })

  test('Shop aus → Produktseite zeigt closedMessage statt „In den Korb“; Shop an → Kaufbereich wieder da', async ({
    adminPage: page,
    request,
  }) => {
    const payload = await testPayload()
    const before = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
    const message = 'Kleine Pause – ab Montag geht es weiter.'
    const urls = [ANCHORS.S01.de]
    try {
      await page.goto(adminPath('/einstellungen'))
      const shop = page.getByTestId('area-form-shop')
      await shop.getByTestId('area-field-shop.isOpen').uncheck()
      await shop.getByTestId('area-field-shop.closedMessage.de').fill(message)
      await shop.getByTestId('area-save-shop').click()
      await expect(shop).toContainText('Gespeichert.')
      await refresh(request, urls)

      await page.goto(ANCHORS.S01.de)
      await expect(page.locator('[data-buy-area] [data-shop-closed]')).toHaveText(message)
      await expect(page.locator('[data-add-to-cart] button')).toBeDisabled()

      await page.goto(adminPath('/einstellungen'))
      await page.getByTestId('area-field-shop.isOpen').check()
      await page.getByTestId('area-save-shop').click()
      await expect(page.getByTestId('area-form-shop')).toContainText('Gespeichert.')
      await refresh(request, urls)

      await page.goto(ANCHORS.S01.de)
      await expect(page.locator('[data-shop-closed]')).toHaveCount(0)
      await expect(page.locator('[data-add-to-cart] button')).toBeEnabled()
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: before.shop } as never,
        overrideAccess: true,
        locale: 'de',
        context: { seed: true },
      })
      await refresh(request, urls)
    }
  })
})
