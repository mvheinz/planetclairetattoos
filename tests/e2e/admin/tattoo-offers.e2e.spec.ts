import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P7.7 – Reiter „Angebote“ (KONZEPT §7.12, DATENMODELL §6.15): Liste mit Zustand kommt/läuft/abgelaufen (abgelaufen
// grau), „Neues Angebot“ mit Datum und optionalen Uhrzeiten (Europe/Berlin), Ort ohne Adresse (E-50), Speichern.

const TAG = 'E2E-Angebot'
const NEW_TITLE = `${TAG} Flash-Day Dezember`

test.describe.configure({ mode: 'serial' })

async function cleanup() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tattoo-offers',
    where: { title: { like: TAG } },
    overrideAccess: true,
    context: { seed: true },
  })
}

test.beforeEach(async () => {
  await cleanup()
  const payload = await testPayload()
  const make = (title: string, startsAt: string, endsAt: string) =>
    payload.create({
      collection: 'tattoo-offers',
      data: {
        type: 'aktion',
        title,
        description: 'Kleine Motive zum festen Preis, ohne Termin.',
        startsAt,
        endsAt,
        seed: true,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  await make(`${TAG} vorbei`, '2026-01-10T10:00:00.000Z', '2026-01-10T17:00:00.000Z')
  await make(`${TAG} kommt`, '2030-05-04T10:00:00.000Z', '2030-05-04T17:00:00.000Z')
})

test.afterAll(cleanup)

test('@a11y Angebote: Zustand je Angebot, neues Angebot 12.12.2026 12–19 Uhr, Ort ohne Adresse', async ({
  adminPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/tattoo?reiter=angebote'))
  const ended = page.locator('[data-testid="offer-card"]', { hasText: `${TAG} vorbei` })
  await expect(ended).toHaveAttribute('data-state', 'ended')
  await expect(ended).toContainText('abgelaufen')
  await expect(ended).toHaveClass(/pc-tattoo__card--ended/)
  expect(await ended.evaluate((el) => getComputedStyle(el).borderStyle)).toContain('dashed')
  const upcoming = page.locator('[data-testid="offer-card"]', { hasText: `${TAG} kommt` })
  await expect(upcoming).toHaveAttribute('data-state', 'upcoming')
  await expect(upcoming).toContainText('kommt')
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')

  await page.getByTestId('offer-new').click()
  const editor = page.getByTestId('offer-editor')
  await editor.getByTestId('tf-title.de').fill(NEW_TITLE)
  await editor
    .getByTestId('tf-description.de')
    .fill('Alle Motive aus dem Flash-Ordner, einfach vorbeikommen.')
  await editor.getByTestId('tf-startDate').fill('2026-12-12')
  await editor.getByTestId('tf-startTime').fill('12:00')
  await editor.getByTestId('tf-endTime').fill('19:00')
  await editor.getByTestId('tf-locationNote.de').fill('Hauptstraße 5, Hinterhof')
  await editor.getByTestId('tf-priceNote.de').fill('Motive 80–150 € (Gesamtpreise)')
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')
  await editor.getByTestId('offer-save').click()
  await expect(editor.getByTestId('offer-issues')).toContainText('keine Adresse')

  await editor.getByTestId('tf-locationNote.de').fill('Privatstudio in Kreuzberg')
  await editor.getByTestId('offer-save').click()
  await expect(editor.getByTestId('offer-saved')).toBeVisible()
  const payload = await testPayload()
  const saved = await payload.find({
    collection: 'tattoo-offers',
    where: { title: { equals: NEW_TITLE } },
    overrideAccess: true,
  })
  expect(saved.docs[0]).toMatchObject({
    startsAt: '2026-12-12T11:00:00.000Z',
    endsAt: '2026-12-12T18:00:00.000Z',
    locationNote: 'Privatstudio in Kreuzberg',
  })
})
