import { adminPath, expect, test, testPayload } from '../fixtures'
import { refreshTattoo } from '../tattoo/tattooFixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P7.9 – Reiter „Texte“ (KONZEPT §7.12, §9.6): Preise (`settings.tattoo.*`), Blöcke der Seiten `tattoo` und
// `tattoo_aftercare`, FAQ Tattoo/Aftercare. „Anzahlung verfällt bei Absage“ speichert mit sichtbarer Warnung (V-24);
// „Übersetzen“ (Mock) füllt die EN-Felder mit „[EN] …“. Die Seite `tattoo` gibt es im Test-Bestand nicht – der Test
// legt sie an und entfernt sie danach wieder (P7.4 prüft die Rückfall-Texte).

test.describe.configure({ mode: 'serial' })

async function removeTattooPage(onlyIfNew: number[]) {
  const payload = await testPayload()
  const pages = await payload.find({
    collection: 'pages',
    where: { key: { equals: 'tattoo' } },
    overrideAccess: true,
    depth: 0,
  })
  for (const p of pages.docs) {
    if (!onlyIfNew.includes(p.id as number))
      await payload.delete({ collection: 'pages', id: p.id, overrideAccess: true })
  }
}

let existing: number[] = []

test.beforeAll(async () => {
  const payload = await testPayload()
  existing = (
    await payload.find({
      collection: 'pages',
      where: { key: { equals: 'tattoo' } },
      overrideAccess: true,
      depth: 0,
    })
  ).docs.map((p) => p.id as number)
})

test.afterAll(async ({ request }) => {
  await removeTattooPage(existing)
  await refreshTattoo(request)
})

test('@a11y Texte: Warnung bei „Anzahlung verfällt bei Absage“, Speichern bleibt möglich; Übersetzen füllt EN', async ({
  adminPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/tattoo?reiter=texte'))
  await expect(page.getByTestId('tattoo-texts')).toBeVisible()
  await expect(page.getByTestId('area-form-tattooPrices')).toBeVisible()
  const form = page.getByTestId('page-texts-tattoo')
  const add = form.getByTestId('page-add-priceInfo')
  if (await add.isVisible()) await add.click()
  const block = form.locator('[data-testid="page-block"][data-block-type="priceInfo"]').first()
  const field = (name: string, l: 'de' | 'en') =>
    block.locator(`[data-testid^="tf-blocks."][data-testid$=".fields.${name}.${l}"]`)
  await field('heading', 'de').fill('Preise')
  await field('content', 'de').fill('Kleine Motive ab 80 €.\n\nAnzahlung verfällt bei Absage.')
  // Mit dem Beispielbestand (P8) hat der Block schon englische Texte – leeren, damit „Übersetzen“ sie füllt.
  await field('heading', 'en').fill('')
  await field('content', 'en').fill('')
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')
  await form.getByTestId('page-save-tattoo').click()
  await expect(form.getByTestId('page-saved-tattoo')).toBeVisible()
  await expect(form.getByTestId('tattoo-text-warning')).toContainText('Anzahlung verfällt')

  await form.getByTestId('translate-button').click()
  // Andere Blöcke haben schon Englisch (Beispielbestand) → Rückfrage „Nur leere Felder“.
  const onlyEmpty = page.getByTestId('confirm-dialog-ok')
  await onlyEmpty
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => onlyEmpty.click())
    .catch(() => undefined)
  await expect(field('heading', 'en')).toHaveValue('[EN] Preise')
  await expect(field('content', 'en')).toHaveValue(
    '[EN] Kleine Motive ab 80 €.\n\n[EN] Anzahlung verfällt bei Absage.',
  )

  // gespeichert: DE und EN mit gleicher Struktur
  const payload = await testPayload()
  const saved = await payload.find({
    collection: 'pages',
    where: { key: { equals: 'tattoo' } },
    locale: 'en',
    fallbackLocale: false,
    overrideAccess: true,
  })
  const blocks = saved.docs[0]?.layout ?? []
  const price = blocks.find((b) => b.blockType === 'priceInfo') as { heading?: string } | undefined
  expect(price?.heading).toBe('[EN] Preise')

  // Preise-Formular: Warnung schon beim Tippen
  const prices = page.getByTestId('area-form-tattooPrices')
  await prices.getByTestId('area-field-tattoo.priceNote.de').fill('Anzahlung nicht erstattbar')
  await expect(prices.getByTestId('tattoo-prices-warning')).toBeVisible()
})
