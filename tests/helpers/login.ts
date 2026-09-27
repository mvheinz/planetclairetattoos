import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { adminRoute, serverURL as defaultServerURL } from './adminEnv'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Meldet sich über die Login-Seite der Verwaltung an (Pfad aus ADMIN_ROUTE).
 */
export async function login({
  page,
  serverURL = defaultServerURL,
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}${adminRoute}/login`)

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`${serverURL}${adminRoute}`)

  await expect(page.locator('.dashboard, [class*="dashboard"]').first()).toBeVisible()
}
