import { expect, type Page } from '@playwright/test'

import type { Locale } from '../../../src/lib/enums'

/** R-049: harmonisierte Mitteilung sichtbar – Grafik vom eigenen Origin mit Alt-Text, Textlink auf die EU-Infoseite. */
export async function expectWarrantyNotice(page: Page, locale: Locale): Promise<void> {
  const notice = page.locator('main [data-warranty-notice]')
  await expect(notice).toHaveCount(1)
  await expect(notice).toBeVisible()
  const img = notice.locator('img')
  await expect(img).toHaveAttribute('src', new RegExp(`^/legal/warranty-notice-${locale}\\.svg$`))
  expect((await img.getAttribute('alt'))?.trim().length ?? 0).toBeGreaterThan(10)
  await expect(notice.locator('a')).toHaveAttribute(
    'href',
    new RegExp(`^https://europa\\.eu/youreurope/.*_${locale}\\.htm$`),
  )
}
