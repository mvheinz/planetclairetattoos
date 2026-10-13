import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible } from './orderHelpers'

// P20.4 (U-93) – Stück-Formular im Browser (Projekte desktop und pixel-7):
// V-22 a „Ein Wort von mir“: Claudes Vorschlag steht unter dem Feld, erscheint nie von selbst; „Vorschlag übernehmen“
//        holt DE und EN ins Feld, gespeichert wird erst mit „Speichern“.
// V-23  Pflegezeile auch bei Keramik und Schmuck (Feld sichtbar), V-43 Häkchen „Motiv und Schriftzug sind von mir“.

test.describe.configure({ timeout: 120_000 })

const SUGGESTION = {
  de: 'Den mag ich besonders, er schaut so ernst.',
  en: 'I’m fond of this one, he looks so serious.',
}

test('V-22 a „Vorschlag übernehmen“ im Formular; V-23 Pflegezeile bei Keramik; V-43 Häkchen-Text', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    title: 'Vorschlags-Schale',
    juttaSays: null,
    juttaSaysSuggestion: SUGGESTION.de,
  })
  await payload.update({
    collection: 'products',
    id: piece.id,
    locale: 'en',
    data: { juttaSaysSuggestion: SUGGESTION.en } as never,
    overrideAccess: true,
    context: { seed: true },
  })

  await page.goto(adminPath(`/stuecke/${piece.id}`))
  const box = page.getByTestId('piece-juttasays-suggestion')
  await expect(box).toContainText(SUGGESTION.de)
  await expect(page.locator('#pf-juttaSays')).toHaveValue('')
  // V-23: Pflegezeile auch bei Keramik
  await expect(page.locator('#pf-careInstructions')).toBeVisible()
  // V-43: Häkchen mit Schriftzug und fremden Textzeilen
  await expect(page.getByLabel(/Motiv und Schriftzug sind von mir/)).toBeVisible()
  await expectAccessible(page, '.pc-admin-view')

  await page.getByTestId('piece-juttasays-adopt').click()
  await expect(page.locator('#pf-juttaSays')).toHaveValue(SUGGESTION.de)
  await expect(page.getByTestId('piece-juttasays-adopt')).toHaveCount(0)
  // noch nicht gespeichert: in der Datenbank weiter leer (E-62)
  const before = await payload.findByID({
    collection: 'products',
    id: piece.id,
    depth: 0,
    overrideAccess: true,
  })
  expect(before.juttaSays ?? null).toBeNull()

  await page.getByTestId('piece-save').click()
  await expect(page.getByTestId('piece-result')).toContainText('Gespeichert.')
  const de = await payload.findByID({
    collection: 'products',
    id: piece.id,
    locale: 'de',
    depth: 0,
    overrideAccess: true,
  })
  const en = await payload.findByID({
    collection: 'products',
    id: piece.id,
    locale: 'en',
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
  })
  expect(de.juttaSays).toBe(SUGGESTION.de)
  expect(en.juttaSays).toBe(SUGGESTION.en)
  // der Vorschlag selbst bleibt unverändert (nur intern)
  expect(de.juttaSaysSuggestion).toBe(SUGGESTION.de)
})
