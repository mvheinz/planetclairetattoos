import { readFileSync } from 'node:fs'

import { expectNoSeriousViolations } from '../axe'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { formNumber, listedMediaIds, removePieces } from './pieceHelpers'

// P5.6 – „Neues Stück“, Teil 2 (KONZEPT §7.4): EK-08 Keramik-Stück vom leeren Formular bis „online“ mit höchstens 10
// Feld-Eingaben (Ausfüllen, Auswählen, Anhaken; Fotos und Knopf-Klicks zählen nicht), Erfolgsseite mit Links;
// Vorschau innerhalb der Verwaltung ohne Draft-Mode-Cookie; AK-7-03 Nummer danach gesperrt; AK-7-01 über das Formular
// (Keramik „lebensmittelecht“ ohne Erklärung nicht speicherbar, Schmuck/Textil ohne Pflichtangaben nicht online).
// Live-Prüfung der Nummer und Übersetzen → EN (P5.4) im selben Ablauf.

const PHOTO = readFileSync('tests/fixtures/images/gps-orientation-6.jpg')

test.describe.configure({ timeout: 180_000 })

test.describe('Neues Stück (P5.6)', () => {
  const uploaded: number[] = []
  let numbers: number[] = []

  test.afterEach(async () => {
    await removePieces(numbers, uploaded.splice(0))
    numbers = []
  })

  test('EK-08 Keramik von leer bis online mit ≤ 10 Eingaben; Links; Vorschau; AK-7-03', async ({
    adminPage: page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const nr = formNumber(testInfo.project.name)
    numbers = [nr]
    await removePieces(numbers)
    await page.goto(adminPath('/neues-stueck'))
    await expect(page.getByLabel('Objektnummer')).not.toHaveValue('')
    await expectNoSeriousViolations(page, 'Neues Stück 390×844')

    let inputs = 0
    const fill = async (label: string, value: string) => {
      await page.getByLabel(label, { exact: true }).fill(value)
      inputs++
    }
    const check = async (label: string) => {
      await page.getByLabel(label, { exact: true }).check()
      inputs++
    }

    // Fotos (zählen nicht)
    await page
      .getByTestId('photo-gallery')
      .setInputFiles({ name: 'schale.jpg', mimeType: 'image/jpeg', buffer: PHOTO })
    await expect(page.getByTestId('photo-list').locator('li')).toHaveCount(1)
    uploaded.push(...(await listedMediaIds(page)))

    await check('Keramik')
    await fill('Objektnummer', String(nr))
    await expect(page.getByTestId('item-number-status')).toHaveText('✓ frei')
    await fill('Titel', 'Schale mit Hund')
    await fill('Beschreibung', 'Eine handbemalte Schale mit einem schlafenden Hund am Boden.')
    await fill('Preis', '45')
    await fill('Material', 'Steinzeug, Unterglasurfarbe, Transparentglasur')
    await fill('Durchmesser', '14')
    await fill('Gewicht', '420')
    await check(
      'Das Motiv zeigt nur eigene Figuren – keine geschützten fremden Figuren, Marken, Logos oder Schriftzüge Dritter',
    )
    // Vorbelegt aus der Kategorie (keine Eingabe): Versandklasse, Deko, Warnhinweise
    await expect(page.getByLabel('Versandklasse')).toHaveValue('keramik')
    await expect(page.getByLabel('Deko – nicht für Lebensmittel')).toBeChecked()
    await expect(page.getByLabel('Warn- und Sicherheitshinweise', { exact: true })).not.toHaveValue(
      '',
    )

    // Übersetzen → EN (speichert vorher als Entwurf; füllt auch die Bildbeschreibung EN)
    await page.getByTestId('translate-button').click()
    await expect(page.getByText('Englische Texte ergänzt.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('photo-alt-en').first()).toHaveValue(/^\[EN\] Keramik/)

    await page.getByTestId('piece-publish').click()
    await expect(page.getByTestId('piece-published')).toBeVisible({ timeout: 30_000 })
    expect(inputs, 'EK-08 höchstens 10 Feld-Eingaben').toBeLessThanOrEqual(10)
    const padded = String(nr).padStart(3, '0')
    await expect(page.getByTestId('piece-public-url')).toHaveText(
      new RegExp(`/de/shop/${padded}-schale-mit-hund$`),
    )
    await expect(page.getByRole('button', { name: 'Link kopieren', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kurzlink kopieren' })).toBeVisible()
    await expect(page.getByTestId('piece-another')).toHaveAttribute(
      'href',
      adminPath('/neues-stueck'),
    )

    const payload = await testPayload()
    const doc = (
      await payload.find({
        collection: 'products',
        where: { itemNumber: { equals: nr } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!
    expect(doc).toMatchObject({ status: 'available', priceCents: 4500, shippingClass: 'keramik' })

    // Vorschau innerhalb der Verwaltung, ohne Draft-Mode-Cookie
    await page.goto(adminPath(`/stuecke/${doc.id}/vorschau`))
    await expect(page.getByTestId('piece-preview-banner')).toBeVisible()
    await expect(page.locator('h1').first()).toContainText('Schale mit Hund')
    const cookies = await page.context().cookies()
    expect(cookies.map((c) => c.name)).not.toContain('__prerender_bypass')

    // AK-7-03: nach der Veröffentlichung ist die Nummer gesperrt
    await page.goto(adminPath(`/stuecke/${doc.id}`))
    await expect(page.getByLabel('Objektnummer')).toHaveAttribute('readonly', '')
    await expect(page.getByText('Seit der ersten Veröffentlichung fest')).toBeVisible()
  })

  test('AK-7-01 über das Formular: Keramik lebensmittelecht ohne Erklärung, Schmuck und Textil ohne Pflichtangaben', async ({
    adminPage: page,
  }, testInfo) => {
    const nr = formNumber(testInfo.project.name, 1)
    numbers = [nr]
    await removePieces(numbers)
    await page.goto(adminPath('/neues-stueck'))
    await page.getByLabel('Keramik', { exact: true }).check()
    await page.getByLabel('Objektnummer', { exact: true }).fill(String(nr))
    await page.getByLabel('Titel', { exact: true }).fill('Prüfstück')
    await page.getByLabel('Preis', { exact: true }).fill('20')
    await page.getByLabel('lebensmittelecht (Konformitätserklärung)').check()
    await page.getByTestId('piece-save').click()
    const issues = page.getByTestId('piece-issues')
    await expect(issues).toContainText('Bitte prüfen:')
    await expect(issues).toContainText(/Konformitätserklärung/)
    expect(
      (
        await (
          await testPayload()
        ).find({
          collection: 'products',
          where: { itemNumber: { equals: nr } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(0)

    // Schmuck: Entwurf speicherbar, Online stellen scheitert an Nickel-Nachweis und bleifreier Glasur
    await page.getByLabel('Schmuck', { exact: true }).check()
    await page.getByTestId('piece-publish').click()
    await expect(issues).toContainText('Das fehlt noch:')
    await expect(issues).toContainText(/nickel/i)
    await expect(issues).toContainText(/bleifrei/i)
    // Sprunglink führt zum Feld
    await issues
      .getByRole('link')
      .filter({ hasText: /nickelfrei/i })
      .first()
      .click()
    await expect(page.locator('#pf-nickelFreeConfirmed')).toBeFocused()

    // Textil: ohne Faserangabe nicht online
    await page.getByLabel('Textil', { exact: true }).check()
    await page.getByTestId('piece-publish').click()
    await expect(issues).toContainText('Das fehlt noch:')
    await expect(issues).toContainText(/Faser/)
    const doc = (
      await (
        await testPayload()
      ).find({
        collection: 'products',
        where: { itemNumber: { equals: nr } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!
    expect(doc).toMatchObject({ status: 'draft', category: 'textil' })
  })
})
