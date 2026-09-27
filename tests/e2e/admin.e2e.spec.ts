import { test, expect, type Page } from '@playwright/test'

import { adminRoute, serverURL } from '../helpers/adminEnv'
import { login } from '../helpers/login'
import { createResetToken, seedTestUser, testUser } from '../helpers/seedUser'

// Verwaltung unter ADMIN_ROUTE (ARCHITEKTUR §8.4, Spike B-01): Login, Liste, Bearbeiten, Passwort-Reset-Link.
test.describe('Admin Panel', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await page?.context().close()
  })

  test('can navigate to dashboard', async () => {
    await page.goto(`${serverURL}${adminRoute}`)
    await expect(page).toHaveURL(`${serverURL}${adminRoute}`)
    await expect(page.locator('.dashboard, [class*="dashboard"]').first()).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto(`${serverURL}${adminRoute}/collections/users`)
    await expect(page).toHaveURL(`${serverURL}${adminRoute}/collections/users`)
    await expect(page.getByText(testUser.email).first()).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto(`${serverURL}${adminRoute}/collections/users`)
    await page.getByText(testUser.email).first().click()
    await expect(page).toHaveURL(new RegExp(`${adminRoute}/collections/users/\\d+`))
    await expect(page.locator('input[name="email"]')).toHaveValue(testUser.email)
    await expect(page.locator('input[name="name"]')).toBeVisible()
  })

  test('password reset link works under ADMIN_ROUTE', async ({ browser }) => {
    const token = await createResetToken()
    const context = await browser.newContext()
    const anon = await context.newPage()
    await anon.goto(`${serverURL}${adminRoute}/reset/${token}`)
    await expect(anon.locator('input[name="password"]')).toBeVisible()
    // Erst nach der Hydrierung ausfüllen (Produktions-Build rendert das Formular vorab).
    await anon.waitForLoadState('networkidle')
    await anon.fill('input[name="password"]', testUser.password)
    await anon.fill('input[name="confirm-password"]', testUser.password)
    await anon.click('button[type="submit"]')
    await expect(anon).not.toHaveURL(/\/reset\//, { timeout: 15_000 })
    expect(new URL(anon.url()).pathname.startsWith(adminRoute)).toBe(true)
    await context.close()
  })
})
