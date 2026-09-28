import { V13_UNPROVEN_CLAIMS, lintText } from '../../../src/lib/legal/forbidden'
import { expect, test, testPayload } from '../fixtures'
import {
  ANCHORS,
  PUBLISHED,
  buyTarget,
  createDeclaration,
  isBefore,
  openProduct,
  pathOf,
  removeProduct,
} from '../shop/productPage'

// P3.8 Pflichtangaben der Produktseite je Kategorie (RECHT ANFORDERUNGEN R-043 bis R-046, R-048 Nr. 1; KONZEPT §3.4
// Nr. 5; AK-3-05, AK-3-07): alles steht als Text vor dem Kaufknopf, nichts in `<details>`, Tabs oder hinter einem Klick.

test.describe('Pflichtangaben je Kategorie', () => {
  test('R-043 Textil: Fasern (amtlich, auf /en mit Übersetzung), Größe und Zustand vor „In den Korb“', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    await openProduct(page, request, ANCHORS.S11.en)
    await expect(page.locator('[data-legal-row="fibers"] dd')).toHaveText(
      '60 % Baumwolle (cotton), 40 % Polyester (polyester)',
    )
    await expect(page.locator('[data-legal-row="size"] dd')).toHaveText('L')
    await expect(page.locator('[data-legal-row="condition"] dd')).toHaveText(
      'good – light pilling under the arms',
    )

    const { itemNumber } = await fixtureProducts.create('textil', PUBLISHED)
    await openProduct(page, request, await pathOf(itemNumber, 'en'))
    const fibers = page.locator('[data-legal-row="fibers"] dd')
    await expect(fibers).toHaveText('100 % Baumwolle (cotton)')
    await expect(fibers).toBeVisible()
    expect(await isBefore(fibers, buyTarget(page))).toBe(true)
    expect(await isBefore(page.locator('[data-legal-row="size"]'), buyTarget(page))).toBe(true)
  })

  test('R-044 Keramik Deko: Badge und Baustein, kein Wort aus V-13; Lebensmittel-Badge verlinkt nur mit gültiger Erklärung', async ({
    page,
    request,
    fixtureProducts,
  }, testInfo) => {
    await openProduct(page, request, ANCHORS.S01.de)
    const legal = page.locator('[data-product-legal]')
    await expect(legal.locator('[data-badge="decorative"]')).toHaveText(
      'Deko – nicht für Lebensmittel',
    )
    await expect(legal.locator('[data-legal-note="ceramicsDecorative"]')).toHaveText(
      'Dekorationsobjekt – nicht für Lebensmittel geeignet.',
    )
    const text = await page.locator('[data-product-page]').innerText()
    expect(lintText(text, V13_UNPROVEN_CLAIMS)).toEqual([])
    await expect(page.locator('[data-product-page] [data-badge="foodSafe"]')).toHaveCount(0)
    await expect(
      page.locator('[data-product-page] a[href*="konformitaetserklaerungen"]'),
    ).toHaveCount(0)
    expect(await isBefore(legal, buyTarget(page))).toBe(true)

    if (testInfo.project.name !== 'desktop') return
    // Gültige Erklärung → Badge mit Link; nach dem Widerruf des Nachweises wäre das Stück offline (P1, R-044).
    const payload = await testPayload()
    const declaration = await createDeclaration(payload)
    let nr: number | undefined
    try {
      ;({ itemNumber: nr } = await fixtureProducts.create('keramik', {
        ...PUBLISHED,
        foodContact: 'lebensmittelecht',
        conformityDeclarations: [declaration.id],
      }))
      await openProduct(page, request, await pathOf(nr, 'en'))
      const badge = page.locator('[data-product-legal] [data-badge="foodSafe"]')
      await expect(badge).toHaveText('Food-safe – view declaration')
      await expect(badge).toHaveAttribute(
        'href',
        `/en/declarations-of-conformity#glaze-${declaration.id}`,
      )
    } finally {
      if (nr) await removeProduct(payload, nr)
      await declaration.cleanup()
    }
  })

  test('R-045 Schmuck: Metallteile, Baustein Nickel und voller Kleinteile-Warntext vor „In den Korb“', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S26.de)
    const buy = buyTarget(page)
    const metal = page.locator('[data-legal-row="metalParts"] dd')
    const nickel = page.locator('[data-legal-note="jewelryNickel"]')
    const smallParts = page.locator('[data-legal-note="jewelrySmallParts"]')
    await expect(metal).toHaveText('Öse: Edelstahl 316L')
    await expect(nickel).toHaveText(
      'Metallteile: Öse: Edelstahl 316L, nickelfrei (Lieferantennachweis liegt vor).',
    )
    await expect(smallParts).toHaveText(
      'Achtung: Kein Spielzeug. Nicht für Kinder unter 3 Jahren geeignet – enthält verschluckbare Kleinteile.',
    )
    await expect(page.locator('[data-product-legal] [data-badge="smallParts"]')).toBeVisible()
    for (const el of [metal, nickel, smallParts]) {
      await expect(el).toBeVisible()
      expect(await isBefore(el, buy)).toBe(true)
    }
  })

  test('R-046 Zeichnung: Technik/Material und Maße; Glasrahmen-Hinweis nur bei framed + frameHasGlass', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    await openProduct(page, request, ANCHORS.S20.de)
    await expect(page.locator('[data-legal-row="technique"] dd')).toHaveText('Tusche auf Papier')
    await expect(page.locator('[data-legal-row="dimensions"] dd')).toHaveText('B 21 cm, H 29,7 cm')
    await expect(page.locator('[data-legal-note="glassFrame"]')).toHaveCount(0)

    const { itemNumber } = await fixtureProducts.create('zeichnung', {
      ...PUBLISHED,
      framed: true,
      frameHasGlass: true,
    })
    await openProduct(page, request, await pathOf(itemNumber, 'de'))
    const glass = page.locator('[data-legal-note="glassFrame"]')
    await expect(glass).toHaveText('Rahmen mit Glas – zerbrechlich, vorsichtig auspacken.')
    expect(await isBefore(glass, buyTarget(page))).toBe(true)
  })

  test('R-048 Abweichung: Kasten „Bitte beachten: …“ nahe dem Preis, vor dem Kaufknopf (S11)', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S11.de)
    const box = page.locator('[data-deviation] [data-callout="deviation"]')
    await expect(box).toBeVisible()
    await expect(box).toContainText('Bitte beachten:')
    await expect(box).toContainText(
      'Kleines Loch an der linken Seitennaht, von mir sichtbar gestopft (ca. 1 cm).',
    )
    expect(await isBefore(page.locator('[data-product-price]'), box)).toBe(true)
    expect(await isBefore(box, buyTarget(page))).toBe(true)
    // S01 ohne Abweichung: kein Kasten
    await openProduct(page, request, ANCHORS.S01.de)
    await expect(page.locator('[data-deviation]')).toHaveCount(0)
  })

  test('AK-3-07 kein Pflichttext in <details>, Tabs oder hinter einem Klick', async ({
    page,
    request,
  }) => {
    for (const url of [ANCHORS.S01.de, ANCHORS.S11.de, ANCHORS.S26.de, ANCHORS.S20.de]) {
      await openProduct(page, request, url)
      const main = page.locator('[data-product-page]')
      await expect(
        main.locator('details, [role="tab"], [role="tabpanel"], [hidden] [data-legal-note]'),
      ).toHaveCount(0)
      for (const el of await main
        .locator('[data-legal-note], [data-legal-row], [data-deviation], [data-price-note]')
        .all())
        await expect(el, url).toBeVisible()
    }
  })
})
