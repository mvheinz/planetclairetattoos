import { localizedPath } from '../../../src/lib/routes/paths'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { refresh } from '../shop/fresh'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P12.8 – Verwaltung „Termine“ (Reiter in `/tattoo`, KONZEPT §3.1a, §7.12): „Neuer Termin“ bei 390×844 anlegen → erscheint
// auf der Startseite (DE und EN, rechte Spalte, kommende oben); „Absagen“ → durchgestrichen mit Text „abgesagt“;
// „Offline nehmen“ → verschwindet; Adresse des Privatstudios wird abgelehnt (E-50); „Löschen“ mit Rückfrage.
// Die Termine dieses Tests heißen „E2E …“ und tragen `seed = false` (echter Datensatz).

const NAME_DE = 'E2E Hinterhofmarkt'
const NAME_EN = 'E2E Backyard market'

test.describe.configure({ mode: 'serial' })

async function cleanup() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tour-dates',
    where: { name: { like: 'E2E ' } },
    overrideAccess: true,
    context: { seed: true },
  })
}

/** Nur die Startseite (DE/EN) neu erzeugen – dort stehen die Termine. */
const refreshHome = (request: Parameters<typeof refresh>[0]) =>
  refresh(request, [localizedPath('R01', 'de'), localizedPath('R01', 'en')])

test.beforeEach(cleanup)
test.afterAll(cleanup)

const isoDay = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000)
  return d.toISOString().slice(0, 10)
}

test('@a11y Neuer Termin am Handy anlegen → Startseite zeigt ihn (DE/EN); Absagen; Offline; Löschen', async ({
  adminPage: page,
  request,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/tattoo?reiter=termine'))
  await expect(page.getByTestId('tattoo-tour')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByTestId('tour-new').click()
  const editor = page.getByTestId('tour-editor')
  await expect(editor).toBeVisible()
  await editor.getByTestId('tf-name.de').fill(NAME_DE)
  await editor.getByTestId('tf-name.en').fill(NAME_EN)
  await editor.getByTestId('tf-place.de').fill('Berlin-Wedding')
  await editor.getByTestId('tf-place.en').fill('Berlin-Wedding')
  await editor.getByTestId('tf-note.de').fill('Coco ist dabei.')
  await editor.getByTestId('tf-note.en').fill('Coco is coming along.')
  await editor.getByTestId('tf-startDate').fill(isoDay(20))
  await editor.getByTestId('tf-endDate').fill(isoDay(21))
  await editor.getByTestId('tf-timeFrom').fill('10:00')
  await editor.getByTestId('tf-timeTo').fill('18:00')
  await editor.getByTestId('tf-address').fill('Hof der Alten Bäckerei, Beispielweg 3')
  await editor.getByTestId('tf-standNumber').fill('B12')
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')
  await editor.getByTestId('tour-save').click()
  await expect(editor.getByTestId('tour-saved')).toBeVisible()
  await expect(page).toHaveURL(/bearbeiten=\d+/)

  const payload = await testPayload()
  const saved = (
    await payload.find({
      collection: 'tour-dates',
      where: { name: { equals: NAME_DE } },
      locale: 'de',
      overrideAccess: true,
    })
  ).docs[0]!
  expect(saved).toMatchObject({ place: 'Berlin-Wedding', standNumber: 'B12', published: true })
  expect((saved.endsAt ?? '') > saved.startsAt).toBe(true)

  // Liste zeigt ihn unter den kommenden Terminen
  await page.goto(adminPath('/tattoo?reiter=termine'))
  const card = page.locator('[data-testid="tour-card"]', { hasText: NAME_DE })
  await expect(card).toHaveAttribute('data-status', 'planned')
  await expect(card).not.toHaveAttribute('data-over', '')

  // öffentlich: DE und EN in der rechten Spalte der Startseite
  await refreshHome(request)
  const pub = await page.context().newPage()
  for (const [locale, name] of [
    ['de', NAME_DE],
    ['en', NAME_EN],
  ] as const) {
    await pub.goto(localizedPath('R01', locale))
    const item = pub.locator('[data-home-aside] [data-tour-upcoming] li', { hasText: name })
    await expect(item).toHaveCount(1)
    await expect(item).toContainText('B12')
    await expect(item).toContainText(locale === 'de' ? 'Coco ist dabei.' : 'Coco is coming along.')
  }

  // Absagen (mit Rückfrage) → durchgestrichen mit Text
  await card.getByTestId('tour-status').click()
  await page.getByRole('button', { name: 'Ja, absagen' }).click()
  await expect(card).toHaveAttribute('data-status', 'cancelled')
  await refreshHome(request)
  await pub.goto(localizedPath('R01', 'de'))
  const cancelled = pub.locator('[data-tour-date][data-cancelled]', { hasText: NAME_DE })
  await expect(cancelled).toHaveCount(1)
  await expect(cancelled.locator('[data-tour-badge="cancelled"]')).toHaveText('abgesagt')
  await expect(cancelled.getByRole('heading').locator('span').first()).toHaveCSS(
    'text-decoration-line',
    'line-through',
  )

  // Offline nehmen → verschwindet von der Seite
  await card.getByTestId('tour-published').click()
  await expect(card).toContainText('offline')
  await refreshHome(request)
  await pub.goto(localizedPath('R01', 'de'))
  await expect(pub.locator('[data-tour]', { hasText: NAME_DE })).toHaveCount(0)

  // Löschen mit Rückfrage
  await card.getByTestId('tour-edit').click()
  // erst nach der Hydrierung reagiert der Knopf: Klick wiederholen, bis die Rückfrage da ist
  await expect(async () => {
    await page.getByTestId('tour-delete').click()
    await expect(page.getByRole('button', { name: 'Ja, löschen' })).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Ja, löschen' }).click()
  await expect(page).toHaveURL(/reiter=termine$/)
  expect(
    (await payload.count({ collection: 'tour-dates', where: { name: { equals: NAME_DE } } }))
      .totalDocs,
  ).toBe(0)
  await pub.close()
})

test('Termin: falsche Eingaben werden mit deutschen Hinweisen abgelehnt', async ({
  adminPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/tattoo?reiter=termine&bearbeiten=neu'))
  const editor = page.getByTestId('tour-editor')
  await editor.getByTestId('tf-name.de').fill('ab')
  await editor.getByTestId('tf-startDate').fill(isoDay(5))
  await editor.getByTestId('tf-endDate').fill(isoDay(3))
  await editor.getByTestId('tf-link').fill('javascript:alert(1)')
  await editor.getByTestId('tour-save').click()
  await expect(editor.getByTestId('tour-issues')).toBeVisible()
  await expect(editor.getByTestId('tf-error-name.de')).toContainText('3–100')
  await expect(editor.getByTestId('tf-error-place.de')).toContainText('2–80')
  await expect(editor.getByTestId('tf-error-endDate')).toContainText('vor dem Startdatum')
  await expect(editor.getByTestId('tf-error-link')).toContainText('https://www.beispiel.de')
})
