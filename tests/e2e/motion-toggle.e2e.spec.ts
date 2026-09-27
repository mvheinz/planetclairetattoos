import { expect, test, type Page } from '@playwright/test'

// P2.10 Schalter „Animationen“ (DESIGN §11.7, R-130 a, ARCHITEKTUR §8.7).

const toggle = (page: Page) => page.locator('[data-site-footer] [data-behavior="motion-toggle"]')

const storage = (page: Page) =>
  page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: sessionStorage.length,
  }))

test.describe('Schalter „Animationen“', () => {
  test('R-130 vor dem Klick leerer Speicher; danach pc-motion und html[data-motion="reduced"], auch nach Neuladen', async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await expect(toggle(page)).toBeVisible()
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle(page)).toHaveText('Animationen: an')
    expect(await storage(page)).toEqual({ local: {}, session: 0 })
    expect(await context.cookies()).toEqual([])
    expect(await page.locator('html').getAttribute('data-motion')).toBeNull()

    await toggle(page).click()
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle(page)).toHaveText('Animationen: aus')
    expect(await storage(page)).toEqual({ local: { 'pc-motion': 'reduced' }, session: 0 })
    expect(await context.cookies()).toEqual([])

    await page.reload()
    // Das Inline-Skript setzt den Wert vor dem ersten Rendern (auch ohne gebundene Module).
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')

    await page.goto('/en/legal-notice')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
    await expect(toggle(page)).toHaveText('Animations: off')
    await toggle(page).click()
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
    expect((await storage(page)).local).toEqual({ 'pc-motion': 'full' })
  })

  test('Systemeinstellung „reduzieren“: „aus (Systemeinstellung)“, Klick schaltet ein', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/de')
    await expect(toggle(page)).toHaveText('Animationen: aus (Systemeinstellung)')
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
    expect(await storage(page)).toEqual({ local: {}, session: 0 })
    await toggle(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
    await expect(toggle(page)).toHaveText('Animationen: an')
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
  })
})
