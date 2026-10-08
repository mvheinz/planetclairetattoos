import type { Payload } from 'payload'

import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'
import { expect, test, testPayload } from '../fixtures'
import { freshPage, holdListData, refresh } from './fresh'
import {
  ANCHORS,
  PUBLISHED,
  buyTarget,
  createDeclaration,
  isBefore,
  openProduct,
  pathOf,
  removeProduct,
} from './productPage'

// P3.8 Produktseite: Kopf, Preis, Pflichtangaben und Kaufbereich (KONZEPT §3.4 Blöcke 2–6; DESIGN KO-05, KO-10,
// KO-11; RECHT R-030, R-031, R-035, R-036, R-043–R-046, R-048). Seed-Anker S01 (Keramik), S11 (Textil, Abweichung,
// Mischgewebe), S26 (Schmuck), S27 (reserviert), S06 (sold); Fixtures analog S14 (Etikett fehlt), S30 (`sonstiges`, nur
// Abholung), S29 (Schmuck, EN-Rückfall) und „Keramik lebensmittelecht“ mit eigener Erklärung (Nummern 980–999). Die
// echten Anker S14, S19, S29, S30 prüft P8.21.

const FORBIDDEN_LABELS = /^(jetzt kaufen|kaufen|bestellen|weiter zur zahlung|buy now|buy|order)$/i

test.describe('Produktseite – Aufbau und Reihenfolge', () => {
  // Liest Seed-Anker (S06 sold, Kaufbereich): nicht gleichzeitig mit Tests, die den Bestand kurz ändern (Archiv-
  // Leerzustand blendet S06 aus, „Shop pausiert“ schließt den Shop) – die halten den Listen-Bestand exklusiv.
  holdListData(test, 'shared')
  test('Blöcke 2–6 in DOM-Reihenfolge: H1 → Kurzdaten → Preisschild/Hinweise → Pflichtangaben → Kaufknopf (S01)', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    const h1 = page.locator('h1')
    const facts = page.locator('[data-product-facts]')
    const tag = page.locator('[data-price-tag="pinned"]')
    const legal = page.locator('[data-product-legal]')
    const buy = page.locator('[data-add-to-cart]')
    await expect(h1).toHaveText('Schale „Langohr & Wuschel“')
    await expect(page.locator('h1')).toHaveCount(1)
    for (const [a, b] of [
      [h1, facts],
      [facts, tag],
      [tag, legal],
      [legal, buy],
    ] as const)
      expect(await isBefore(a, b)).toBe(true)

    // Kurzdaten: Nr. 901 · Unikat · Kategorie · Maße
    await expect(facts.locator('li')).toHaveText([
      'Nr. 901',
      'Unikat',
      'Keramik',
      'Ø 11 cm, H 5 cm',
    ])
    // Preisschild `pinned` mit Sternchen und Auflösung direkt darunter (R-030), Versand-Link R25 (R-031), Lieferzeit (R-035)
    await expect(tag.locator('[data-money]')).toContainText('45 €*')
    await expect(page.locator('#price-footnote')).toHaveCount(1)
    await expect(page.locator('[data-product-price] [data-price-note]')).toContainText(
      'gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    )
    await expect(page.locator('[data-product-price] [data-shipping-note]')).toHaveAttribute(
      'href',
      '/de/versand-und-zahlung',
    )
    await expect(page.locator('[data-product-price] [data-delivery-time]')).toHaveText(
      'Lieferzeit: 2–5 Werktage (bei Vorkasse ab Zahlungseingang)',
    )
    expect(await page.content()).not.toMatch(/inkl\.?\s*MwSt/i)
    // Liefergebiet direkt am Kaufbereich (R-036)
    await expect(page.locator('[data-buy-area] [data-delivery-area]')).toHaveText(
      'Lieferung nur innerhalb Deutschlands, Abholung in Berlin nach Absprache',
    )
    // Tuschelinie `product` (U-44): Spur in der Rinne, Coco an der Leine, Kringel an Titel und Preis
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'product')
    await expect(page.locator('.coco[data-leash-coco]')).toHaveCount(1)
    await expect(page.locator('[data-leash-station="title"]')).toHaveAttribute(
      'data-leash-loop',
      'right',
    )
    await expect(page.locator('[data-product-price]')).toHaveAttribute('data-leash-loop', 'left')
  })

  test('KO-11 Knopftexte: „In den Korb“ / „Add to basket“, keine Kauf-Beschriftung aus R-064', async ({
    page,
    request,
  }) => {
    for (const [url, label] of [
      [ANCHORS.S01.de, 'In den Korb'],
      [ANCHORS.S01.en, 'Add to basket'],
    ] as const) {
      await openProduct(page, request, url)
      const button = page.locator('[data-add-to-cart] button')
      await expect(button).toHaveText(label)
      await expect(button).toBeEnabled()
      await expect(button).not.toHaveAttribute('aria-disabled', 'true')
      const labels = await page
        .locator('[data-product-page]')
        .getByRole('button')
        .evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
      for (const l of labels) expect(l, url).not.toMatch(FORBIDDEN_LABELS)
    }
  })

  test('reserviert (S27): Knopf aria-disabled mit „Gerade reserviert – schau in 30 Minuten nochmal“', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S27.de)
    await expect(page.locator('[data-buy-area]')).toHaveAttribute('data-buy-state', 'reserved')
    const button = page.locator('[data-add-to-cart] button')
    await expect(button).toHaveText('Gerade reserviert – schau in 30 Minuten nochmal')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).toBeDisabled()
    await openProduct(page, request, ANCHORS.S27.en)
    await expect(page.locator('[data-add-to-cart] button')).toHaveText(
      'Reserved right now – check back in 30 minutes',
    )
  })

  test('sold (S06): Stempel, „Schon verkauft“, Links „Ähnliche Stücke“ (Kategorie) und Archiv, kein Kaufknopf', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S06.de)
    await expect(page.locator('[data-price-tag="pinned"] [data-sold-stamp]')).toBeVisible()
    await expect(page.locator('[data-sold-text]')).toHaveText('Schon verkauft')
    await expect(page.locator('[data-add-to-cart]')).toHaveCount(0)
    const area = page.locator('[data-buy-area]')
    await expect(area.getByRole('link', { name: 'Verwandte Stücke' })).toHaveAttribute(
      'href',
      '/de/shop/kategorie/keramik',
    )
    await expect(area.getByRole('link', { name: 'Archiv' })).toHaveAttribute('href', '/de/archiv')
  })

  test('AK-3-05 Textil (S11): Material, Größe, Zustand, Second-Hand und Abweichungs-Kasten vor „In den Korb“', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S11.de)
    const buy = buyTarget(page)
    const fibers = page.locator('[data-legal-row="fibers"] dd')
    const size = page.locator('[data-legal-row="size"] dd')
    const condition = page.locator('[data-legal-row="condition"] dd')
    const secondHand = page.locator('[data-legal-note="textileSecondHand"]')
    const deviation = page.locator('[data-deviation]')
    await expect(fibers).toHaveText('60 % Baumwolle, 40 % Polyester')
    await expect(size).toHaveText('L')
    await expect(condition).toHaveText('gut – leichte Knötchen unter den Armen')
    await expect(page.locator('[data-product-legal] [data-badge="secondHand"]')).toBeVisible()
    await expect(secondHand).toHaveText(
      'Second-Hand/Vintage: gebrauchtes Stück, von Hand bemalt. Zustand: gut.',
    )
    await expect(deviation).toContainText('Besonderheit dieses Stücks:')
    await expect(deviation).toContainText('Kleines Loch an der linken Seitennaht')
    for (const el of [fibers, size, condition, secondHand, deviation])
      expect(await isBefore(el, buy)).toBe(true)
  })

  test('Fixture analog S14: Etikett fehlt – Material nach bestem Wissen, Baustein textileLabelMissing', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('textil', {
      ...PUBLISHED,
      labelMissing: true,
      fiberFreeText: 'vermutlich Baumwolle',
    })
    await openProduct(page, request, await pathOf(itemNumber, 'de'))
    const fibers = page.locator('[data-legal-row="fibers"] dd')
    await expect(fibers).toContainText('100 % Baumwolle')
    await expect(fibers.locator('[data-label-missing]')).toHaveText(
      'Etikett fehlt – Material nach bestem Wissen: vermutlich Baumwolle',
    )
    await expect(page.locator('[data-legal-note="textileLabelMissing"]')).toHaveText(
      'Das Originaletikett fehlt – Materialangabe nach bestem Wissen.',
    )
    expect(
      await isBefore(page.locator('[data-legal-note="textileLabelMissing"]'), buyTarget(page)),
    ).toBe(true)
  })

  test('Fixture analog S30: sonstiges, nur Abholung – Lieferzeit als Abhol-Baustein, keine Kategorie-Pflichtangaben', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('sonstiges', {
      ...PUBLISHED,
      shippingClass: 'nur_abholung',
    })
    await openProduct(page, request, await pathOf(itemNumber, 'de'))
    await expect(page.locator('[data-product-price] [data-delivery-time]')).toHaveAttribute(
      'data-delivery-time',
      'pickup',
    )
    await expect(page.locator('[data-product-price] [data-delivery-time]')).toHaveText(
      'Abholbereit innerhalb von 2–5 Werktage nach Zahlungseingang, Termin nach Absprache per E-Mail',
    )
    await expect(page.locator('[data-product-legal] [data-legal-note]')).toHaveCount(0)
    await expect(page.locator('[data-add-to-cart] button')).toHaveText('In den Korb')
  })

  test('Fixture analog S29: fehlen EN-Texte, steht der DE-Text mit lang="de" (Schmuck)', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('schmuck', {
      ...PUBLISHED,
      smallPartsWarning: true,
    })
    await openProduct(page, request, await pathOf(itemNumber, 'en'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const h1 = page.locator('h1')
    await expect(h1).toHaveText(`Teststück ${itemNumber}`)
    await expect(h1).toHaveAttribute('lang', 'de')
    const metal = page.locator('[data-legal-row="metalParts"] dd')
    await expect(metal).toHaveText('Edelstahl 316L')
    await expect(metal).toHaveAttribute('lang', 'de')
    // Bausteine und Oberflächentexte bleiben englisch
    await expect(page.locator('[data-add-to-cart] button')).toHaveText('Add to basket')
    await expect(page.locator('[data-legal-note="jewelrySmallParts"]')).not.toHaveAttribute('lang')

    // S26 hat EN-Texte: kein lang="de"
    await openProduct(page, request, ANCHORS.S26.en)
    await expect(page.locator('h1')).not.toHaveAttribute('lang')
    await expect(page.locator('[data-legal-row="metalParts"] dd')).toHaveText(
      'Loop: stainless steel 316L',
    )
  })

  test('Test-Fixture „Keramik lebensmittelecht“ mit eigener Konformitätserklärung: Badge verlinkt R27 #glaze-<id>', async ({
    page,
    request,
    fixtureProducts,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'legt eine Erklärung an – einmal im Projekt desktop',
    )
    const payload = await testPayload()
    const declaration = await createDeclaration(payload)
    let itemNumber: number | undefined
    try {
      ;({ itemNumber } = await fixtureProducts.create('keramik', {
        ...PUBLISHED,
        foodContact: 'lebensmittelecht',
        conformityDeclarations: [declaration.id],
      }))
      await openProduct(page, request, await pathOf(itemNumber, 'de'))
      const badge = page.locator('[data-product-legal] [data-badge="foodSafe"]')
      await expect(badge).toHaveText('Lebensmittelecht – Konformitätserklärung ansehen')
      await expect(badge).toHaveAttribute(
        'href',
        `/de/konformitaetserklaerungen#glaze-${declaration.id}`,
      )
      await expect(page.locator('[data-legal-note="ceramicsFoodSafe"]')).toBeVisible()
      await expect(page.locator('[data-badge="decorative"]')).toHaveCount(0)
    } finally {
      if (itemNumber) await removeProduct(payload, itemNumber)
      await declaration.cleanup()
    }
  })
})

test.describe('Produktseite – Shop pausiert (nur desktop)', () => {
  test.describe.configure({ mode: 'serial' })
  let payload: Payload
  let releaseRange: ReleaseLock | undefined
  const urls = [ANCHORS.S01.de, ANCHORS.S27.de, ANCHORS.S06.de, ANCHORS.S01.en]

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'ändert Einstellungen – einmal im Projekt desktop',
    )
    // Andere Shop-Tests sehen den Zwischenstand nicht (Listen halten den Bereich geteilt).
    releaseRange = await holdFixtureRange('exclusive')
    payload = await testPayload()
    await freshPage(page)
  })

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    await releaseRange?.()
  })

  test('isOpen = false: „In den Korb“ auf keiner Produktseite bedienbar, closedMessage darüber; sold bleibt „Schon verkauft“', async ({
    page,
    request,
  }) => {
    const before = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })
    const message = 'Ich bin im Urlaub – ab dem 15. geht es weiter.'
    try {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: { ...before.shop, isOpen: false, closedMessage: message } } as never,
        overrideAccess: true,
        locale: 'de',
        context: { seed: true },
      })
      await refresh(request, urls)
      for (const url of [ANCHORS.S01.de, ANCHORS.S27.de]) {
        await page.goto(url)
        const notice = page.locator('[data-buy-area] [data-shop-closed]')
        await expect(notice, url).toHaveText(message)
        const button = page.locator('[data-add-to-cart] button')
        await expect(button, url).toHaveAttribute('aria-disabled', 'true')
        await expect(button, url).toBeDisabled()
        expect(await isBefore(notice, button)).toBe(true)
      }
      await page.goto(ANCHORS.S06.de)
      await expect(page.locator('[data-sold-text]')).toHaveText('Schon verkauft')
      await expect(page.locator('[data-shop-closed]')).toHaveCount(0)
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: before.shop } as never,
        overrideAccess: true,
        locale: 'de',
        context: { seed: true },
      })
      await refresh(request, urls)
    }
    await page.goto(ANCHORS.S01.de)
    await expect(page.locator('[data-add-to-cart] button')).toBeEnabled()
  })
})

// P3.9 Blöcke 7–11 (KONZEPT §3.4; DESIGN KO-09b; RECHT R-031, R-049, V-08, V-19): Beschreibung, Details-Tabelle mit
// Gewicht, „Herstellerin & Sicherheit“ (eigene Datei `legal/gpsr.e2e.spec.ts`), Versand & Rückgabe, „Mehr aus …“.
test.describe('Produktseite – Beschreibung, Details, Versand & Rückgabe, „Mehr aus …“ (P3.9)', () => {
  holdListData(test, 'shared')
  test('Blöcke 7–11 nach dem Kaufbereich, ohne Interaktion sichtbar (S01)', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    const order = [
      page.locator('[data-buy-area]'),
      page.locator('[data-warranty-notice]'),
      page.locator('[data-product-description]'),
      page.locator('[data-product-details]'),
      page.locator('[data-product-safety]'),
      page.locator('[data-product-shipping]'),
    ]
    for (let i = 0; i + 1 < order.length; i++)
      expect(await isBefore(order[i]!, order[i + 1]!)).toBe(true)
    for (const block of order.slice(1)) await expect(block).toBeVisible()
    await expect(page.locator('[data-product-page] details')).toHaveCount(0)
    await expect(page.locator('[data-product-description] h2')).toHaveText('Beschreibung')
    await expect(page.locator('[data-product-description] p').first()).toContainText(
      'In dieser Schale wohnen ein Hase',
    )
    await expect(page.locator('[data-jutta-says]')).toContainText('Ein Wort von mir')
    await expect(page.locator('[data-jutta-says] blockquote')).toHaveText(
      'Die beiden gehören zusammen. Bitte trenn sie nicht.',
    )
  })

  for (const locale of ['de', 'en'] as const) {
    test(`Details-Tabelle /${locale}: Gewicht „210 g“ (S01, DA-9), Reihenfolge laut KO-09b, keine leeren Zeilen`, async ({
      page,
      request,
    }) => {
      await openProduct(page, request, ANCHORS.S01[locale])
      const details = page.locator('[data-product-details]')
      await expect(details.locator('h2')).toHaveText('Details')
      const keys = await details
        .locator('[data-detail]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-detail')))
      // S01 hat Maße, Gewicht und Material; Größe, Zustand, Pflege fehlen und erzeugen keine Zeile.
      expect(keys).toEqual(['dimensions', 'weight', 'material'])
      await expect(details.locator('[data-detail="weight"] dt')).toHaveText(
        locale === 'de' ? 'Gewicht' : 'Weight',
      )
      await expect(details.locator('[data-detail="weight"] dd')).toHaveText('210 g')
      for (const dd of await details.locator('dd').all()) await expect(dd).not.toBeEmpty()
    })
  }

  test('Details-Tabelle Textil (S11): Größe, Zustand und Pflege; Gewicht steht für jede Kategorie', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S11.en)
    const details = page.locator('[data-product-details]')
    const keys = await details
      .locator('[data-detail]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-detail')))
    expect(keys).toEqual(['dimensions', 'weight', 'material', 'size', 'condition', 'care'])
    await expect(details.locator('[data-detail="weight"] dd')).toHaveText('200 g')
    for (const [url, weight] of [
      [ANCHORS.S20.de, '15 g'],
      [ANCHORS.S26.de, '4 g'],
    ] as const) {
      await openProduct(page, request, url)
      await expect(page.locator('[data-detail="weight"] dd'), url).toHaveText(weight)
    }
    await openProduct(page, request, ANCHORS.S20.de)
    await expect(page.locator('[data-detail="technique"] dt')).toHaveText('Technik')
  })

  test('R-031 Versand & Rückgabe: Versandklasse mit Preis, Abholung, Widerrufshinweis ohne V-19 mit Links R24/R25', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    const block = page.locator('[data-product-shipping]')
    await expect(block.locator('h2')).toHaveText('Versand & Rückgabe')
    await expect(block.locator('[data-shipping-class="keramik"]')).toHaveText(
      'Versand als Keramik-Paket 8,90 €',
    )
    await expect(block.locator('[data-pickup]')).toHaveText('Abholung in Berlin möglich')
    const note = block.locator('[data-withdrawal-note]')
    await expect(note).toContainText(
      'Infos zu deinem Widerrufsrecht findest du in der Widerrufsbelehrung.',
    )
    await expect(note).toContainText(
      'Die unmittelbaren Kosten der Rücksendung der Waren trägst du.',
    )
    await expect(note.getByRole('link', { name: 'Widerrufsbelehrung' })).toHaveAttribute(
      'href',
      '/de/widerrufsbelehrung',
    )
    await expect(note.getByRole('link', { name: 'Versand & Zahlung' })).toHaveAttribute(
      'href',
      '/de/versand-und-zahlung',
    )
    const text = await page.locator('[data-product-page]').innerText()
    expect(text).not.toMatch(/14\s*Tage\s*(Widerrufs|Rückgabe)recht/i)
    expect(text).not.toMatch(/kein(e|en)?\s+(Widerruf|Umtausch|Rückgabe|Rücknahme)/i)

    await openProduct(page, request, ANCHORS.S26.en)
    await expect(page.locator('[data-shipping-class="brief"]')).toHaveText(
      'Shipping: Letter, €4.50',
    )
    await expect(page.locator('[data-product-shipping] [data-pickup]')).toHaveText(
      'Pickup in Berlin possible',
    )
  })

  test('R-031 nur Abholung (Fixture analog S30): kein Versandpreis, keine Abhol-Doppelung', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('sonstiges', {
      ...PUBLISHED,
      shippingClass: 'nur_abholung',
    })
    await openProduct(page, request, await pathOf(itemNumber, 'de'))
    const block = page.locator('[data-product-shipping]')
    await expect(block.locator('[data-shipping-class="nur_abholung"]')).toHaveText(
      'Nur Abholung in Berlin nach Absprache',
    )
    await expect(block.locator('[data-pickup]')).toHaveCount(0)
    await expect(block).not.toContainText('€')
  })

  test('„Mehr aus …“: sichtbare Stücke der Kategorie, kein sold, nicht das aktuelle Stück', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const now = new Date().toISOString()
    const current = await fixtureProducts.create('keramik', { ...PUBLISHED, firstPublishedAt: now })
    const other = await fixtureProducts.create('keramik', { ...PUBLISHED, firstPublishedAt: now })
    const sold = await fixtureProducts.create('keramik', {
      status: 'sold',
      firstPublishedAt: now,
      soldAt: now,
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt',
      showInArchiveAfterSale: true,
    })
    await openProduct(page, request, await pathOf(current.itemNumber, 'de'))
    const more = page.locator('[data-product-more]')
    await expect(more.locator('h2')).toHaveText('Mehr aus Keramik')
    await expect(more.locator('h2 a')).toHaveAttribute('href', '/de/shop/kategorie/keramik')
    const cards = more.locator('[data-product-card]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(4)
    const numbers = await cards.evaluateAll((els) =>
      els.map((e) => Number(e.getAttribute('data-item-number'))),
    )
    expect(numbers).toContain(other.itemNumber)
    expect(numbers).not.toContain(current.itemNumber)
    expect(numbers).not.toContain(sold.itemNumber)
    await expect(more.locator('[data-product-card][data-status="sold"]')).toHaveCount(0)
    // S06 (sold) erscheint nie – auch nicht auf der Seite von S01.
    await openProduct(page, request, ANCHORS.S01.de)
    await expect(page.locator('[data-product-more] [data-item-number="906"]')).toHaveCount(0)
    await expect(page.locator('[data-product-more] [data-item-number="901"]')).toHaveCount(0)
  })
})
