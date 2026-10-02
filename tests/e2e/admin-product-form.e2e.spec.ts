import path from 'node:path'

import type { Page } from '@playwright/test'
import sharp from 'sharp'

import { CATEGORY_FIELDS, type CategoryField } from '../../src/lib/products/categoryRules'
import type { ProductCategory } from '../../src/lib/enums'

import { adminPath, expect, test, testPayload } from './fixtures'

// P1.31 – Formular „Stück“ in der Verwaltung am Handy (DATENMODELL §6.6.1/§6.6.6, KONZEPT AK-7-04, ARCHITEKTUR T-05).
// Die eigene Handy-Ansicht „Neues Stück“ mit Knopf „Online stellen“ folgt in P5.6; bis dahin prüft der Test die
// Veröffentlichung über denselben Endpunkt `POST /api/products/:id/publish`, den der Knopf später aufruft.

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  keramik: 'Keramik',
  textil: 'Textil',
  cap: 'Caps',
  zeichnung: 'Zeichnungen',
  schmuck: 'Schmuck',
  sonstiges: 'Sonstiges',
}

/** Pflichtangaben je Kategorie laut DATENMODELL §6.6.6 (Tab „Pflichtangaben“). */
const COMMON_REQUIRED = [
  'materials',
  'weightGrams',
  'shippingClass',
  'safetyWarnings',
  'ownDesignConfirmed',
]
const REQUIRED: Record<ProductCategory, string[]> = {
  keramik: ['dimensions', 'foodContact'],
  // R-043 (Fasern, Etikett), R-047 (fremdes Logo), R-048 (Abweichung)
  textil: [
    'sizeLabel',
    'condition',
    'fiberComposition',
    'labelMissing',
    'blankBrandVisible',
    'deviationDecision',
  ],
  cap: [
    'sizeLabel',
    'condition',
    'fiberComposition',
    'labelMissing',
    'blankBrandVisible',
    'deviationDecision',
  ],
  // R-046
  zeichnung: ['dimensions', 'framed'],
  // R-045
  schmuck: [
    'dimensions',
    'metalPartsMaterial',
    'nickelFreeConfirmed',
    'nickelEvidence',
    'leadFreeGlazeConfirmed',
    'smallPartsWarning',
  ],
  sonstiges: ['dimensions'],
}
const BASE_REQUIRED = ['itemNumber', 'title', 'category', 'description', 'priceCents']

const CATEGORIES = Object.keys(REQUIRED) as ProductCategory[]
const CONDITIONAL = Object.keys(CATEGORY_FIELDS) as CategoryField[]

async function openTab(page: Page, label: string): Promise<void> {
  await page.locator('.tabs-field__tab-button', { hasText: label }).click()
}

async function chooseSelect(page: Page, field: string, option: string): Promise<void> {
  await page.locator(`#field-${field} .rs__control`).click()
  await page
    .locator('.rs__option', { hasText: new RegExp(`^${option.replace(/[()]/g, '\\$&')}$`) })
    .click()
}

async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(scroll, `horizontales Scrollen: ${where}`).toBeLessThanOrEqual(client)
}

test.describe('Verwaltung: Formular „Stück“ am Handy', () => {
  test('DM-P1-07 bei 375 px zeigt das Formular je Kategorie genau die Pflichtangaben (R-043–R-048)', async ({
    adminPage: page,
  }) => {
    // Sechs Kategorien mit je einem Formular-Abgleich am Server: in WebKit (iphone-15) knapp an der 30-s-Grenze.
    test.slow()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(adminPath('/collections/products/create'))
    await page.waitForLoadState('networkidle')

    for (const id of BASE_REQUIRED) await expect(page.locator(`#field-${id}`)).toBeVisible()

    for (const category of CATEGORIES) {
      await openTab(page, 'Basis')
      await chooseSelect(page, 'category', CATEGORY_LABELS[category])
      await openTab(page, 'Pflichtangaben')
      for (const id of [...COMMON_REQUIRED, ...REQUIRED[category]]) {
        await expect(page.locator(`#field-${id}`), `${category}: ${id}`).toBeVisible()
      }
      // Kategoriefremde Pflichtangaben sind ausgeblendet.
      for (const field of CONDITIONAL) {
        const applies = (CATEGORY_FIELDS[field] as readonly string[]).includes(category)
        if (!applies) {
          await expect(page.locator(`#field-${field}`), `${category}: ${field}`).not.toBeVisible()
        }
      }
      // Abhängige Pflichtangaben erscheinen erst mit ihrer Voraussetzung.
      if (category === 'keramik') {
        await expect(page.locator('#field-conformityDeclarations')).not.toBeVisible()
        await chooseSelect(page, 'foodContact', 'lebensmittelecht (Konformitätserklärung)')
        await expect(page.locator('#field-conformityDeclarations')).toBeVisible()
      }
      if (category === 'textil') {
        await expect(page.locator('#field-fiberFreeText')).not.toBeVisible()
        await page.locator('#field-labelMissing').check()
        await expect(page.locator('#field-fiberFreeText')).toBeVisible()
      }
      if (category === 'zeichnung') {
        await expect(page.locator('#field-frameHasGlass')).not.toBeVisible()
        await page.locator('#field-framed').check()
        await expect(page.locator('#field-frameHasGlass')).toBeVisible()
      }
      await expectNoHorizontalScroll(page, `Pflichtangaben ${category}`)
    }
  })

  test('DM-P1-07 fehlende Pflichtangabe verhindert „Online stellen“ mit deutscher Meldung', async ({
    adminPage: page,
    fixtureProducts,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const { id } = await fixtureProducts.create('keramik', { materials: null })

    const refused = await page.request.post(`/api/products/${id}/publish`)
    expect(refused.status()).toBe(400)
    const body = (await refused.json()) as { errors: { path: string; message: string }[] }
    expect(body.errors).toContainEqual({ path: 'materials', message: 'Material (Deutsch) fehlt.' })

    // Nachtragen im Formular (375 px), speichern, dann klappt „Online stellen“.
    await page.goto(adminPath(`/collections/products/${id}`))
    await page.waitForLoadState('networkidle')
    await openTab(page, 'Pflichtangaben')
    await page.locator('#field-materials').fill('Steinzeug, Unterglasurfarbe')
    await page.locator('#action-save').click()
    const payload = await testPayload()
    await expect
      .poll(async () => {
        const doc = await payload.findByID({ collection: 'products', id, depth: 0 })
        return doc.materials
      })
      .toBe('Steinzeug, Unterglasurfarbe')

    const published = await page.request.post(`/api/products/${id}/publish`)
    expect(published.status(), await published.text()).toBe(200)
    expect(((await published.json()) as { doc: { status: string } }).doc.status).toBe('available')
  })

  test('AK-7-04 Formular bei 390×844 ohne horizontales Scrollen bedienbar', async ({
    adminPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/collections/products'))
    await page.waitForLoadState('networkidle')
    await expectNoHorizontalScroll(page, 'Liste')
    await page.goto(adminPath('/collections/products/create'))
    await page.waitForLoadState('networkidle')
    await chooseSelect(page, 'category', CATEGORY_LABELS.textil)
    for (const tab of ['Basis', 'Pflichtangaben', 'Bilder', 'Verkauf', 'Intern']) {
      await openTab(page, tab)
      await expectNoHorizontalScroll(page, `Tab ${tab}`)
    }
    // Bedienbar: Pflichtfeld im Viewport erreichbar und ausfüllbar, Speichern-Knopf sichtbar.
    await openTab(page, 'Basis')
    await page.locator('#field-title').fill('Handy-Test')
    await expect(page.locator('#field-title')).toHaveValue('Handy-Test')
    await expect(page.locator('#action-save')).toBeVisible()
  })

  test('T-05 R-135 Upload der GPS-Fixture im Formular: ausgelieferte Größen ohne EXIF', async ({
    adminPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/collections/media/create'))
    await page.waitForLoadState('networkidle')
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(path.resolve('tests/fixtures/images/gps-orientation-6.jpg'))
    await page.locator('#field-alt').fill('Rote Markierung auf grauem Grund')
    await page.locator('#action-save').click()
    await page.waitForURL(new RegExp(`${adminPath('/collections/media/')}\\d+`), {
      timeout: 60_000,
    })
    const id = Number(new URL(page.url()).pathname.split('/').pop())

    const res = await page.request.get(`/api/media/${id}?depth=0`)
    expect(res.status()).toBe(200)
    const doc = (await res.json()) as {
      url: string
      sizes: Record<string, { url: string | null }>
    }
    const urls = [doc.url, ...Object.values(doc.sizes).map((s) => s.url)].filter(
      (u): u is string => !!u,
    )
    expect(urls.length).toBeGreaterThanOrEqual(2)
    for (const url of urls) {
      const file = await page.request.get(url)
      expect(file.status(), url).toBe(200)
      const buffer = await file.body()
      const meta = await sharp(buffer).metadata()
      expect(meta.exif, url).toBeUndefined()
      expect(meta.xmp, url).toBeUndefined()
      expect(meta.iptc, url).toBeUndefined()
      expect(meta.orientation ?? 1, url).toBe(1)
    }
  })
})
