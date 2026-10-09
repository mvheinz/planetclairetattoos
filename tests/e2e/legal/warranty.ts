import { expect, type Page } from '@playwright/test'

import type { Locale } from '../../../src/lib/enums'

/**
 * R-049: harmonisierte Mitteilung sichtbar – Grafik vom eigenen Origin mit Alt-Text, Textlink auf die EU-Infoseite;
 * U-45 (P13.6): Wortlaut der Mitteilung nie leer, als Platzhalter-Fassung gekennzeichnet.
 */
export async function expectWarrantyNotice(page: Page, locale: Locale): Promise<void> {
  const notice = page.locator('main [data-warranty-notice]')
  await expect(notice).toHaveCount(1)
  await expect(notice).toBeVisible()
  const img = notice.locator('img')
  await expect(img).toHaveAttribute('src', new RegExp(`^/legal/warranty-notice-${locale}\\.svg$`))
  expect((await img.getAttribute('alt'))?.trim().length ?? 0).toBeGreaterThan(10)
  await expect(notice.locator('[data-warranty-lead]')).toContainText(
    locale === 'de' ? 'Mindestens zwei Jahre' : 'At least two years',
  )
  // U-59 (P14.10): Wortlaut in Bausteinen, Grafik-Platz mit Platzhalter-Kennzeichen.
  expect(await notice.locator('[data-warranty-block]').count()).toBeGreaterThanOrEqual(3)
  await expect(img).toHaveAttribute('data-warranty-graphic', /^(placeholder|official)$/)
  await expect(notice.locator('[data-warranty-placeholder]')).toBeVisible()
  await expect(notice.locator('a')).toHaveAttribute(
    'href',
    new RegExp(`^https://europa\\.eu/youreurope/.*_${locale}\\.htm$`),
  )
}
