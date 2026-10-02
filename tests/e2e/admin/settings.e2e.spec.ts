import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P5.21 – Einstellungen, Teil 1 `/einstellungen` (KONZEPT §7.14): alle Bereiche bei 390×844 bedienbar (Stammdaten &
// Impressum, Steuer, Zahlung, Benachrichtigungen, Rechtstexte, Konto), axe ohne `serious`/`critical`; Postfach und
// falsche IBAN mit Hinweis am Feld abgelehnt (R-020), Telefon-Hinweis (R-021), gültige Änderung gespeichert.

test('@a11y Einstellungen Teil 1: alle Bereiche bei 390×844 bedienbar, Prüfungen am Feld', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const before = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/einstellungen'))
    for (const name of [
      'Stammdaten & Impressum',
      'Steuer',
      'Zahlung',
      'Benachrichtigungen',
      'Rechtstexte',
      'Konto',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
    }
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // Stammdaten: Postfach abgelehnt (R-020), Telefon-Hinweis (R-021)
    const business = page.getByTestId('settings-form-business')
    const street = business.getByTestId('settings-field-business.street')
    await street.fill('Postfach 1234')
    await business.getByTestId('settings-save-business').click()
    await expect(business.getByTestId('settings-error-business.street')).toContainText('Postfach')
    await expect(street).toBeFocused()
    await expect(street).toHaveAttribute('aria-invalid', 'true')
    await expect(business).toContainText(
      'Erscheint nur in Impressum, Widerrufsbelehrung und in der Anbieterkennung der Bestellbestätigung',
    )
    const phone = business.getByTestId('settings-field-business.phone')
    await phone.fill('abc')
    await street.fill('Musterstraße 7')
    await business.getByTestId('settings-save-business').click()
    await expect(business.getByTestId('settings-error-business.phone')).toBeVisible()
    await phone.fill('030 1234567')
    await business.getByTestId('settings-save-business').click()
    await expect(business).toContainText('Gespeichert.')
    await expect
      .poll(async () => {
        const s = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
        return [s.business?.street, s.business?.phone]
      })
      .toEqual(['Musterstraße 7', '030 1234567'])

    // Zahlung: falsche Prüfziffer abgelehnt; Anbieter nur Anzeige
    const pay = page.getByTestId('settings-form-payment')
    await expect(page.getByTestId('settings-payments-mode')).not.toBeEmpty()
    await pay.getByTestId('settings-field-payment.iban').fill('DE00 0000 0000 0000 0000 00')
    await pay.getByTestId('settings-save-payment').click()
    await expect(pay.getByTestId('settings-error-payment.iban')).toContainText('Prüfsumme')

    // Steuer, Rechtstexte, Konto erreichbar (ohne zu speichern)
    await expect(page.getByTestId('settings-tax-modes')).toContainText('gilt ab')
    await expect(page.getByTestId('settings-form-tax-mode')).toContainText('Steuerberatung')
    await expect(page.getByTestId('settings-legal')).toContainText('Impressum')
    await page.getByTestId('settings-password-current').fill('irgendwas-langes')
    await page.getByTestId('settings-password-new').fill('kurz')
    await page.getByTestId('settings-save-password').click()
    await expect(page.getByTestId('settings-form-password')).toContainText('Mindestens 12 Zeichen')
    await expect(page.getByTestId('settings-logout')).toBeVisible()
    await expectAccessible(page, '.pc-admin-view')
  } finally {
    await payload.updateGlobal({
      slug: 'settings',
      data: { business: before.business, payment: before.payment } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
})
