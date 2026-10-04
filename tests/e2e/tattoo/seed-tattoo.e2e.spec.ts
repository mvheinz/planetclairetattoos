import { expect, test } from '../fixtures'
import { refreshTattoo } from './tattooFixtures'

// P8.6 – Tattoo-Bestand des Beispielbestands (SEED-SPEC §12, §17): Mail-Betreff von F-907 (AK-9-02), F-901 mit echtem
// Instagram-Bild, Angebote TO1/TO2 sichtbar und TO3 nicht (AK-9-03, AK-SEED-10, relativ zu N = Zeitpunkt des Seeds),
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

test('AK-9-03 Seed: TO1 und TO2 auf R13, TO2 als laufendes Angebot auf R11 und der Startseite; TO3 nirgends', async ({
  page,
}) => {
  const to1 = 'Flash-Day: kleine Motive ab 80 €'
  const to2 = 'Spontane Lücken: winzige Planeten'
  const to3 = 'Flash-Day im Spätsommer'
  await page.goto('/de/tattoo/angebote')
  await expect(page.locator('main')).toContainText(to1)
  await expect(page.locator('main')).toContainText(to2)
  await expect(page.locator('main')).not.toContainText(to3)
  await page.goto('/de/tattoo')
  await expect(page.locator('[data-tattoo-offer-teaser]')).toContainText(to2)
  await expect(page.locator('main')).not.toContainText(to3)
  await page.goto('/de')
  await expect(page.locator('[data-home-station="tattoo"]')).toContainText(to2)
  await page.goto('/en/tattoo/offers')
  await expect(page.locator('main')).toContainText('Last-minute gaps: tiny planets')
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
