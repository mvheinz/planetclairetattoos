import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { adminRoute, serverURL as defaultServerURL } from './adminEnv'
import { withLoginLock } from './adminSessionLock'

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
 * Die Anmeldung läuft unter `withLoginLock`; wer die Sitzung danach nutzt, hält `holdAdminSessions('shared')`.
 */
export async function login({
  page,
  serverURL = defaultServerURL,
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}${adminRoute}/login`)
  // Erst nach der Hydrierung ausfüllen (Produktions-Build rendert das Formular vorab).
  await page.waitForLoadState('networkidle')

  await withLoginLock(async () => {
    await page.fill('#field-email', user.email)
    await page.fill('#field-password', user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${serverURL}${adminRoute}`)
  })

  await expect(page.locator('.dashboard, [class*="dashboard"]').first()).toBeVisible()
}
