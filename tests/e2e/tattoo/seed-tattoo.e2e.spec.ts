import { expect, test } from '../fixtures'
import { refreshTattoo } from './tattooFixtures'

// P8.6 – Tattoo-Bestand des Beispielbestands (SEED-SPEC §12, §17): Mail-Betreff von F-907 (AK-9-02), F-901 mit echtem
// Instagram-Bild, keine Angebote mehr (AK-9-03, P12.7),
// Galerie G1/G2 im Vorschau-Modus mit Etikett (AK-9-04). Voraussetzung: `db:reset --test --seed=all`.

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  await refreshTattoo(request)
})

test('AK-9-02 Seed: Mail-Knopf F-907 mit exaktem Betreff (DE/EN); F-901 zeigt das Instagram-Bild', async ({
  page,
}) => {
  await page.goto('/de/tattoo/flash#f-907')
  const mail = page.locator('#f-907 [data-flash-mail]')
  expect(await mail.getAttribute('href')).toContain(
    '?subject=Flash-Anfrage%20F-907%20%E2%80%93%20Winziger%20Planet&',
  )
  await expect(page.locator('#f-901 img').first()).toHaveAttribute('src', /ig-DbJ1QRrjCcb/i)
  for (const n of ['903', '905']) {
    await expect(page.locator(`#f-${n}`)).toHaveAttribute('data-flash-status', 'claimed')
  }
  await page.goto('/en/tattoo/flash#f-907')
  expect(await page.locator('#f-907 [data-flash-mail]').getAttribute('href')).toContain(
    '?subject=Flash%20request%20F-907%20%E2%80%93%20Tiny%20planet&',
  )
})

test('AK-9-03 AK-SEED-10 R-171 (P12.7, U-14) Keine „Angebote“ mehr: R13 gibt es nicht, Tattoo-Übersicht und Startseite zeigen keine Aktionskarte', async ({
  page,
}) => {
  for (const path of ['/de/tattoo/angebote', '/en/tattoo/offers']) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(404)
  }
  await page.goto('/de/tattoo')
  await expect(page.locator('[data-tattoo-offer-teaser], [data-offer-card]')).toHaveCount(0)
  await expect(page.locator('a[href*="angebote"]')).toHaveCount(0)
  await page.goto('/de')
  await expect(page.locator('[data-offer-card]')).toHaveCount(0)
})

test('AK-9-04 Seed: G1/G2 nur im Vorschau-Modus mit Etikett „intern – Einwilligung fehlt“; G3–G6 ohne Etikett', async ({
  page,
}) => {
  await page.goto('/de/tattoo/galerie')
  const g1 = page
    .locator('figure')
    .filter({ hasText: 'Fine Line am Unterarm, ein paar Jahre später' })
  await expect(g1.locator('[data-gallery-internal-label]')).toBeVisible()
  await expect(g1.locator('[data-gallery-status]')).toHaveText('3,5 Jahre verheilt')
  const g3 = page.locator('figure').filter({ hasText: 'Hasen-Trio, frisch gestochen' })
  await expect(g3).toBeVisible()
  await expect(g3.locator('[data-gallery-internal-label]')).toHaveCount(0)
  await expect(page.locator('main [data-price-tag], main form')).toHaveCount(0)
})
