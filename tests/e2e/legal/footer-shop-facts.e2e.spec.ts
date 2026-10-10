import { localizedPath } from '../../../src/lib/routes/paths'
import { expect, test } from '../fixtures'

// P14.9 (U-58 c) – Seitenfuß: kurze Zeile zu Zahlarten, Versand und Abholung mit Link auf „Versand & Zahlung“ (R25),
// auf jeder Seite, DE/EN. Verbotsliste: kein „inkl. MwSt.“ (Kleinunternehmer-Modus), kein Link zur EU-OS-Plattform.

for (const [locale, text, link] of [
  [
    'de',
    'Bezahlen mit Karte, Apple Pay, Google Pay, PayPal oder Vorkasse · Versand innerhalb Deutschlands · Abholung in Berlin nach Absprache · Versand & Zahlung',
    'Versand & Zahlung',
  ],
  [
    'en',
    'Pay by card, Apple Pay, Google Pay, PayPal or bank transfer in advance · Shipping within Germany · Pick-up in Berlin by arrangement · Shipping & payment',
    'Shipping & payment',
  ],
] as const) {
  test(`U-58 c Fußzeile Zahlung · Versand · Abholung (${locale})`, async ({ page }) => {
    for (const path of [localizedPath('R01', locale), localizedPath('R12', locale)]) {
      await page.goto(path)
      const facts = page.locator('[data-site-footer] [data-footer-shop-facts]')
      await expect(facts).toHaveText(text)
      await expect(facts.getByRole('link', { name: link })).toHaveAttribute(
        'href',
        localizedPath('R25', locale),
      )
      const footer = await page.locator('[data-site-footer]').innerText()
      expect(footer).not.toMatch(/inkl\.?\s*MwSt|incl\.?\s*VAT/i)
      await expect(
        page.locator('[data-site-footer] a[href*="ec.europa.eu/consumers/odr"]'),
      ).toHaveCount(0)
    }
  })
}
