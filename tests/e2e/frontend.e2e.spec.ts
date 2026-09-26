import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('Startseite (P0-Platzhalter) lädt', async ({ page }) => {
    await page.goto('http://localhost:3000')

    await expect(page).toHaveTitle(/Planet Claire/)
    await expect(page.locator('h1').first()).toHaveText('Planet Claire')
  })
})
