import type { Page } from '@playwright/test'
import type { Payload } from 'payload'

import type { ProductCategory } from '../../../src/lib/enums'
import { localizedPath } from '../../../src/lib/routes/paths'
import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'
import {
  completeProduct,
  createProductFixtures,
  type ProductFixtures,
} from '../../int/helpers/products'
import { LIST_FIXTURE_RANGE, expect, test, testPayload } from '../fixtures'
import { freshPage, holdListData, refresh } from './fresh'
import { ANCHORS } from './productPage'

// P3.6 Archiv R05 (KONZEPT §3.5; DESIGN KO-06, KO-08, KO-17, §9.7 `shopString`; AK-3-09).
// Grundlage: Mini-Beispielbestand – S06 (Nr. 906) `sold` mit Archiv; S01 (901) `available`, S27 (927) `reserved`,
// S18/S25 (918/925) `draft`, S09 (909) `archived`. Den echten Anker S08 (`sold`, nicht im Archiv) prüft P8.21; hier ein
// Fixture-Stück analog S08. Eigene Stücke im Bereich 975–999, nur im Projekt `desktop`, exklusiv (`holdFixtureRange`).
// Der Leerzustand braucht ein leeres Archiv und blendet S06 dafür kurz aus (exklusiv); alle Tests, die S06 oder die
// Listen lesen (Shop, Produktseite, Galerie, SEO, Verbotsmuster, Querschnitts-Suiten), halten den Bestand geteilt
// (`holdListData`) und sehen das Fenster nie (P3.16, Wettlauf mit den Produktseiten-Tests behoben).

const archive = localizedPath('R05', 'de')
const archiveEn = localizedPath('R05', 'en')
const HIDDEN_SOLD = LIST_FIXTURE_RANGE.from // analog S08
const TEXTIL_SOLD = LIST_FIXTURE_RANGE.from + 1
const OWN = [HIDDEN_SOLD, TEXTIL_SOLD]
const day = (d: number) => new Date(Date.UTC(2026, 8, d, 10)).toISOString()
/** Seiten, auf denen S06 erscheint (Shop, Kategorie Keramik, Produktseite) – DE und EN. */
const S06_PAGES = [
  localizedPath('R02', 'de'),
  localizedPath('R02', 'en'),
  localizedPath('R03', 'de', { slug: 'keramik' }),
  localizedPath('R03', 'en', { slug: 'ceramics' }),
  ANCHORS.S06.de,
  ANCHORS.S06.en,
]

const cardNumbers = (page: Page) =>
  page
    .locator('[data-product-card]')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-item-number'))))

test.describe('Archiv R05 – lesend (alle Projekte)', () => {
  holdListData(test, 'shared')
  test.beforeEach(async ({ page }) => freshPage(page))

  test('Aufbau DE/EN: H1, Satz, Chip „Alle“ aktiv, S06 mit Preis und Stempel, Titel, Preset shopString', async ({
    page,
  }) => {
    await page.goto(archive)
    await expect(page).toHaveTitle('Archiv · Planet Claire')
    await expect(page.locator('h1')).toHaveText('Archiv')
    await expect(page.locator('header p').first()).toHaveText(
      'Schon ausgezogen – aber schön anzusehen',
    )
    await expect(page.locator('[data-chip="all"]')).toHaveAttribute('aria-current', 'page')
    // Chips nur für Kategorien mit Archiv-Stücken: im Mini-Bestand nur Keramik (S06), als ?category=<DE-Slug>
    await expect(page.locator('[data-chip="keramik"]')).toHaveAttribute(
      'href',
      `${archive}?category=keramik`,
    )
    await expect(page.locator('[data-chip="textil"]')).toHaveCount(0)
    await expect(page.locator('[data-chip="available"]')).toHaveCount(0)
    const s06 = page.locator('[data-product-card][data-item-number="906"]')
    await expect(s06).toBeVisible()
    await expect(s06.locator('[data-price-tag] [data-money]')).toContainText('65 €*')
    await expect(s06.locator('[data-sold-stamp]')).toBeVisible()
    // R-030/R-031: Sternchen am Preis, Auflösung auf derselben Seite
    await expect(page.locator('#price-footnote')).toHaveCount(1)
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'shopString')
    await expect(page.locator('[data-string-coco]')).toHaveCount(1)
    expect(await page.content()).not.toMatch(/inkl\.?\s*MwSt/i)

    await page.goto(archiveEn)
    await expect(page).toHaveTitle('Archive · Planet Claire')
    await expect(page.locator('h1')).toHaveText('Archive')
    await expect(page.locator('header p').first()).toHaveText(
      'Already moved out – but lovely to look at',
    )
    await expect(page.locator('[data-chip="keramik"]')).toHaveAttribute(
      'href',
      `${archiveEn}?category=ceramics`,
    )
  })

  test('AK-3-09 nur sold mit Archiv: kein available, reserved, draft oder archived', async ({
    page,
  }) => {
    await page.goto(archive)
    const numbers = await cardNumbers(page)
    expect(numbers).toContain(906)
    for (const nr of [901, 927, 918, 925, 909]) expect(numbers, `Nr. ${nr}`).not.toContain(nr)
    await expect(page.locator('[data-product-card]:not([data-status="sold"])')).toHaveCount(0)
  })

  test('AK-3-09 unbekannte category wird ignoriert; canonical ohne category', async ({ page }) => {
    await page.goto(archive)
    const full = await cardNumbers(page)
    await page.goto(`${archive}?category=gibt-es-nicht`)
    expect(await cardNumbers(page)).toEqual(full)
    await expect(page.locator('[data-chip="all"]')).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`${archive}$`),
    )
    // Slug der anderen Sprache gilt ebenfalls als unbekannt
    await page.goto(`${archive}?category=ceramics`)
    await expect(page.locator('[data-chip="all"]')).toHaveAttribute('aria-current', 'page')

    await page.goto(`${archive}?category=keramik`)
    await expect(page.locator('[data-chip="keramik"]')).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`${archive}$`),
    )
  })

  test('beim Laden keine laufende Stempel-Animation (kein MI-03)', async ({ page }) => {
    await page.goto(archive)
    await expect(page.locator('[data-sold-stamp]').first()).toBeVisible()
    await expect(page.locator('[data-behavior~="sold-stamp"]')).toHaveCount(0)
    const running = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-sold-stamp]')].flatMap((el) =>
          el.getAnimations({ subtree: true }),
        ).length,
    )
    expect(running).toBe(0)
  })
})

test.describe('Archiv R05 – mit eigenen Stücken (nur desktop)', () => {
  test.describe.configure({ mode: 'serial' })
  let payload: Payload
  let fixtures: ProductFixtures | undefined
  let releaseRange: ReleaseLock | undefined

  async function removeOwn() {
    await payload.delete({
      collection: 'products',
      where: { itemNumber: { in: OWN } },
      overrideAccess: true,
      context: { seed: true },
    })
  }

  async function createSold(nr: number, category: ProductCategory, archiveAfterSale: boolean) {
    const fx = (fixtures ??= await createProductFixtures(payload))
    await payload.create({
      collection: 'products',
      data: {
        ...completeProduct(category, nr, fx),
        seed: true,
        status: 'sold',
        firstPublishedAt: day(1),
        soldAt: day(27),
        soldChannel: 'offline',
        offlineSaleNote: 'Flohmarkt',
        showInArchiveAfterSale: archiveAfterSale,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  }

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    releaseRange = await holdFixtureRange('exclusive')
    payload = await testPayload()
    await removeOwn()
    await freshPage(page)
  })

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    try {
      await removeOwn()
    } finally {
      await releaseRange?.()
    }
  })

  test('AK-3-09 Fixture analog S08 (sold, showInArchiveAfterSale = false) nicht sichtbar; Filter nach Kategorie, neueste zuerst', async ({
    page,
    request,
  }) => {
    await createSold(HIDDEN_SOLD, 'keramik', false)
    await createSold(TEXTIL_SOLD, 'textil', true)
    const urls = [
      archive,
      `${archive}?category=keramik`,
      `${archive}?category=textil`,
      `${archiveEn}?category=textiles`,
    ]
    await refresh(request, urls)

    await page.goto(archive)
    const numbers = await cardNumbers(page)
    expect(numbers).not.toContain(HIDDEN_SOLD)
    // nach soldAt absteigend: das eben verkaufte Textil-Stück vor S06 (verkauft vor 32 Tagen)
    expect(numbers.indexOf(TEXTIL_SOLD)).toBeGreaterThanOrEqual(0)
    expect(numbers.indexOf(TEXTIL_SOLD)).toBeLessThan(numbers.indexOf(906))
    await expect(page.locator('[data-chip="textil"]')).toHaveAttribute(
      'href',
      `${archive}?category=textil`,
    )

    await page.locator('[data-chip="textil"]').click()
    await expect(page).toHaveURL(new RegExp(`${archive}\\?category=textil$`))
    await expect(page.locator('[data-chip="textil"]')).toHaveAttribute('aria-current', 'page')
    expect(await cardNumbers(page)).toEqual([TEXTIL_SOLD])

    await page.goto(`${archive}?category=keramik`)
    expect(await cardNumbers(page)).toEqual([906])

    await page.goto(`${archiveEn}?category=textiles`)
    expect(await cardNumbers(page)).toEqual([TEXTIL_SOLD])
  })

  test('Leerzustand KO-17: „Noch ist nichts verkauft.“ mit Link zum Shop', async ({
    page,
    request,
  }) => {
    const s06 = await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: 906 } },
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })
    const id = s06.docs[0]!.id
    const hide = (show: boolean) =>
      payload.update({
        collection: 'products',
        id,
        data: { showInArchiveAfterSale: show } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    try {
      await hide(false)
      await refresh(request, [archive, archiveEn])
      await page.goto(archive)
      const empty = page.locator('[data-empty-state]')
      await expect(empty.locator('h2')).toHaveText('Noch ist nichts verkauft.')
      await expect(empty.getByRole('link', { name: 'Zum Shop' })).toHaveAttribute(
        'href',
        localizedPath('R02', 'de'),
      )
      await expect(page.locator('[data-product-card]')).toHaveCount(0)
      await expect(page.locator('[data-chip]')).toHaveCount(1)
      await page.goto(archiveEn)
      await expect(page.locator('[data-empty-state] h2')).toHaveText('Nothing sold yet.')
    } finally {
      await hide(true)
      // Alles, was S06 zeigt, frisch erzeugen – falls eine dieser Seiten im Fenster (z. B. nach einer Cache-Erneuerung
      // durch einen anderen Test) ohne S06 neu entstanden ist. Leser von S06 halten den Bestand geteilt und warten.
      await refresh(request, [archive, archiveEn, ...S06_PAGES])
    }
  })
})
