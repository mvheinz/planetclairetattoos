import { expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import { R07, cleanupCheckouts, hydrated, startCheckoutFor } from './checkoutHelpers'

// P4.10 Hinweistext über dem Bestellknopf (KONZEPT §4.5 Nr. 6, R-063): Baustein `checkout.legalNotice` mit AGB,
// Widerrufsbelehrung und Datenschutzerklärung als `<dialog>` mit der aktiven Fassung – kein Seitenwechsel, kein neuer
// Tab; ohne JavaScript normale Links auf die Rechtsseiten. Darunter `withdrawal.returnCostsNote`.

let used: number[] = []
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
})

test('AGB, Widerrufsbelehrung und Datenschutz öffnen als Dialog auf der Seite; Schließen und Escape', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const a = await fixtureProducts.create('keramik', PUBLISHED)
  used.push(a.id)
  await startCheckoutFor(context, page, [a])
  await hydrated(page)
  const notice = page.locator('[data-legal-notice]')
  await expect(notice.locator('[data-snippet="checkout.legalNotice"]')).toContainText(
    'Es gelten unsere AGB.',
  )
  await expect(notice.locator('[data-snippet="withdrawal.returnCostsNote"]')).toBeVisible()
  const pages = context.pages().length
  for (const [type, title, href] of [
    ['agb', 'AGB', '/de/agb'],
    ['widerrufsbelehrung', 'Widerrufsbelehrung', '/de/widerrufsbelehrung'],
    ['datenschutz', 'Datenschutzerklärung', '/de/datenschutz'],
  ] as const) {
    const link = notice.locator(`a[data-legal-dialog="${type}"]`)
    await expect(link).toHaveAttribute('href', href)
    await expect(link).not.toHaveAttribute('target', /.*/)
    await link.click()
    const dialog = page.locator(`#legal-dialog-${type}`)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: title })).toBeVisible()
    await expect(dialog.locator('[data-dialog-close]')).toBeVisible()
    expect(page.url()).toContain(R07.de)
    if (type === 'datenschutz') await page.keyboard.press('Escape')
    else await dialog.locator('[data-dialog-close]').click()
    await expect(dialog).toBeHidden()
  }
  expect(context.pages().length).toBe(pages)
})

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('Rechtstexte sind normale Links auf die Rechtsseiten', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await fixtureProducts.create('keramik', PUBLISHED)
    used.push(a.id)
    await startCheckoutFor(context, page, [a])
    await page.locator('a[data-legal-dialog="agb"]').click()
    await expect(page).toHaveURL(/\/de\/agb$/)
  })
})
