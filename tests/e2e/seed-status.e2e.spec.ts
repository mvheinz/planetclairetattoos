import { expect, test } from './fixtures'

import { seedToken } from '../../src/lib/seed/tokens'

// P8.4 · AK-SEED-20 (SEED-SPEC §17): Status-URLs aus `seedToken('orders:<Key>', 'status')` für O01, O10, O13 und
// Danke-URLs aus `seedToken('checkouts:<Key>', 'checkout')` für O13, O14 öffnen die Seiten mit „Beispiel“; ein anderer
// Token → 404. Voraussetzung: Beispielbestand (`db:reset --test --seed=all`, wie `pnpm test:e2e`).

const status = (key: string) => seedToken(`orders:${key}`, 'status')
const thanks = (key: string) => seedToken(`checkouts:${key}`, 'checkout')

test.describe('AK-SEED-20 Seed-Anker für Danke- und Statusseiten', () => {
  for (const [key, state] of [
    ['O01', 'refunded'],
    ['O10', 'shipped'],
    ['O13', 'awaiting_prepayment'],
  ] as const) {
    test(`Statusseite ${key} (${state}) über seedToken zeigt „Beispiel“`, async ({ page }) => {
      const res = await page.goto(`/de/bestellung/${status(key)}`)
      expect(res?.status()).toBe(200)
      await expect(page.locator('[data-example-note]')).toContainText('Beispiel')
      await expect(page.getByText(`PC-2026-900${key.slice(1)}`).first()).toBeVisible()
    })
  }

  test('Statusseite O10 verlinkt die DHL-Sendungsverfolgung', async ({ page }) => {
    await page.goto(`/de/bestellung/${status('O10')}`)
    await expect(page.locator('a[href*="SEEDDHL9000000000010"]').first()).toBeVisible()
  })

  test('Danke-Seite O13 (Vorkasse) zeigt Beispiel-IBAN und „Beispiel“', async ({ page }) => {
    const res = await page.goto(`/de/danke/${thanks('O13')}`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('[data-thanks-page]')).toHaveAttribute(
      'data-thanks-state',
      'prepayment',
    )
    await expect(page.locator('[data-example-note]')).toContainText('Beispiel')
    await expect(page.getByText('DE36 0000 0000 0000 0000 00').first()).toBeVisible()
  })

  test('Danke-Seite O14 (bezahlt, en) zeigt „Example“', async ({ page }) => {
    const res = await page.goto(`/en/thank-you/${thanks('O14')}`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('[data-thanks-page]')).toHaveAttribute('data-thanks-state', 'paid')
    await expect(page.locator('[data-example-note]')).toContainText('Example')
  })

  test('ein anderer Token liefert 404 (Status und Danke)', async ({ page }) => {
    // Der Kassen-Token ist für die Statusseite ein fremder Token
    expect((await page.goto(`/de/bestellung/${thanks('O13')}`))?.status()).toBe(404)
    expect((await page.goto(`/de/danke/${'D'.repeat(43)}`))?.status()).toBe(404)
    expect((await page.goto(`/de/bestellung/${'C'.repeat(43)}`))?.status()).toBe(404)
  })
})
