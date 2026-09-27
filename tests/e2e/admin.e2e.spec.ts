import { test, expect, type Page } from '@playwright/test'

import { adminRoute, serverURL } from '../helpers/adminEnv'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

// Admin-Pfad ab P1.12 (ADMIN_ROUTE statt /admin) – bis dahin fixme.
test.describe('Admin Panel', () => {
  test.fixme(true, 'Admin-Pfad ab P1.12')
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto(`${serverURL}${adminRoute}`)
    await expect(page).toHaveURL(`${serverURL}${adminRoute}`)
  })

  test('can navigate to list view', async () => {
    await page.goto(`${serverURL}${adminRoute}/collections/users`)
    await expect(page).toHaveURL(`${serverURL}${adminRoute}/collections/users`)
  })

  test('can navigate to edit view', async () => {
    await page.goto(`${serverURL}${adminRoute}/collections/users/create`)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })
})
