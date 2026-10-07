import { expect, test } from '@playwright/test'

import { diag, dynamicMasks, linuxOnly, prepare, settle } from './helpers'

// T-12 Seitenrahmen (ARCHITEKTUR §7.6, PLAN P2.24): Kopf (KO-02), offenes Menü (KO-03) und Fuß (KO-04) auf R01 DE,
// je Projekt `desktop` und `mobile`, reduzierte Bewegung.

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
})

test.describe('Seitenrahmen', () => {
  test('Kopf', async ({ page }) => {
    await page.goto('/de')
    await settle(page)
    await expect(page.locator('[data-site-header]')).toHaveScreenshot('kopf.png')
  })

  test('offenes Menü', async ({ page }) => {
    await page.goto('/de')
    await settle(page)
    const trigger = page.locator('[data-site-header] [data-menu-trigger]')
    await expect(trigger).toHaveAttribute('role', 'button')
    await trigger.click()
    const dialog = page.locator('dialog#menu')
    await expect(dialog).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('menue-offen.png')
  })

  test('Fuß', async ({ page }) => {
    await page.goto('/de')
    await settle(page)
    // Die klebende Kopfleiste (KO-02) liegt je nach Scrollposition über dem Fuß – für diese Aufnahme ausblenden.
    await page.addStyleTag({ content: '[data-site-header]{visibility:hidden !important}' })
    const footer = page.locator('[data-site-footer]')
    await footer.scrollIntoViewIfNeeded()
    await settle(page)
    await diag(page, 'fuss')
    await expect(footer).toHaveScreenshot('fuss.png', { mask: dynamicMasks(page) })
  })
})
