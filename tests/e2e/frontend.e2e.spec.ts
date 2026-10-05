import { expect, test } from './fixtures'

test.describe('Frontend', () => {
  test('Startseite /de und /en laden mit <html lang>', async ({ page }) => {
    await page.goto('http://localhost:3000/de')
    await expect(page).toHaveTitle(/Planet Claire/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.locator('h1').first()).toHaveText('Planet Claire')

    await page.goto('http://localhost:3000/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('Gerüstseiten sind unter den lokalisierten Pfaden erreichbar', async ({ page }) => {
    await page.goto('http://localhost:3000/de/impressum')
    await expect(page.locator('h1')).toHaveText('Impressum')
    await page.goto('http://localhost:3000/en/withdraw-from-contract')
    await expect(page.locator('h1')).toHaveText('Withdraw from contract here')
  })
})
