import type { Locator, Page } from '@playwright/test'

import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'
import { completeProduct, createProductFixtures } from '../../int/helpers/products'
import { expect, test, testPayload } from '../fixtures'
import { freshPage, holdListData, refresh } from '../shop/fresh'

// P3.12 Startseite: Kategorie-Stationen mit echten Stücken (KONZEPT §3.1, DESIGN KO-21, KA-17): Kopf-Station + genau 6
// Stationen (AK-3-01; „Komm näher.“ entfiel mit U-40), je Kategorie-Station höchstens 4 Stücke, nur `available`/`reserved`, neueste zuerst (AK-3-02),
// Station Textil = `textil` + `cap`, Karten ohne Schnur mit Schild `pinned` am Kartenfuß, Link „Alle …“ → R03,
// Preis-Fußnote einmal pro Seite, Leerzustand mit Archiv-Link (Test-Kategorie `sonstiges` ohne Stücke). Die Tattoo-Station
// bleibt ohne Karten (P7).

const STATION_IDS = ['keramik', 'textil', 'zeichnungen', 'schmuck', 'tattoo', 'jutta-und-coco']
const SHELVES = ['keramik', 'textil', 'zeichnungen', 'schmuck']
const CATEGORIES: Record<string, string[]> = {
  keramik: ['keramik'],
  textil: ['textil', 'cap'],
  zeichnungen: ['zeichnung'],
  schmuck: ['schmuck'],
}

const station = (page: Page, id: string) => page.locator(`[data-home-station="${id}"]`)
const numbersOf = (cards: Locator) =>
  cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-item-number'))))

async function openHome(page: Page, request: import('@playwright/test').APIRequestContext) {
  await freshPage(page)
  await refresh(request, ['/de', '/en'])
  const res = await page.goto('/de')
  expect(res?.status()).toBe(200)
}

/** Status, Kategorie und Veröffentlichung der gezeigten Stücke aus der Datenbank. */
async function lookup(numbers: number[]) {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'products',
    where: { itemNumber: { in: numbers } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return new Map(res.docs.map((d) => [d.itemNumber, d]))
}

test.describe('Startseite – Stationen mit Stücken (lesend)', () => {
  holdListData(test, 'shared')

  test('AK-3-01 AK-3-02: 6 Stationen; je Kategorie-Station ≤ 4 Karten, nur available/reserved, neueste zuerst, passende Kategorie', async ({
    page,
    request,
  }) => {
    await openHome(page, request)
    const stations = page.locator('[data-home-station]')
    await expect(stations).toHaveCount(6)
    expect(
      await stations.evaluateAll((els) => els.map((el) => el.getAttribute('data-home-station'))),
    ).toEqual(STATION_IDS)

    let total = 0
    for (const id of SHELVES) {
      const cards = station(page, id).locator('[data-product-card]')
      const count = await cards.count()
      expect(count, id).toBeLessThanOrEqual(4)
      total += count
      const numbers = await numbersOf(cards)
      const docs = await lookup(numbers)
      // Stücke paralleler Fixture-Tests können inzwischen gelöscht sein – geprüft wird, was noch existiert.
      const found = numbers.flatMap((nr) => {
        const doc = docs.get(nr)
        return doc ? [doc] : []
      })
      for (const doc of found) {
        expect(['available', 'reserved'], `${id} Nr. ${doc.itemNumber}`).toContain(doc.status)
        expect(CATEGORIES[id], `${id} Nr. ${doc.itemNumber}`).toContain(doc.category)
      }
      const published = found.map((doc) => doc.firstPublishedAt ?? '')
      expect(published, id).toEqual([...published].sort().reverse())
      // Karten ohne Schnur: Schild `pinned` am Kartenfuß, kein Faden-Anker der Schnur.
      if (count > 0) {
        await expect(cards.locator('[data-price-tag="pinned"]')).toHaveCount(count)
        await expect(cards.locator('[data-leash-anchor="tag"]')).toHaveCount(0)
      }
    }
    expect(total).toBeGreaterThan(0)
    // Keine Karten außerhalb der Kategorie-Stationen (Tattoo bis P7 unverändert).
    for (const id of ['tattoo', 'jutta-und-coco'])
      await expect(station(page, id).locator('[data-product-card]')).toHaveCount(0)
    // „Alle …“ → R03; Preis-Fußnote genau einmal.
    await expect(station(page, 'keramik').locator('[data-station-all] a')).toHaveAttribute(
      'href',
      '/de/shop/kategorie/keramik',
    )
    await expect(station(page, 'keramik').locator('[data-station-all] a')).toHaveText(
      'Alle Keramik',
    )
    await expect(page.locator('#price-footnote')).toHaveCount(1)
    // Live-Zustand der Karten nach dem Laden (ohne Cookie).
    await expect(page.locator('[data-home-stations]')).toHaveAttribute('data-status-live', '')
    expect(await page.context().cookies()).toEqual([])
  })

  test('EN: Stationen mit Karten, „All ceramics“ → /en/shop/category/ceramics', async ({
    page,
    request,
  }) => {
    await openHome(page, request)
    await page.goto('/en')
    await expect(station(page, 'keramik').locator('[data-station-all] a')).toHaveAttribute(
      'href',
      '/en/shop/category/ceramics',
    )
    await expect(page.locator('#price-footnote')).toHaveCount(1)
  })
})

test.describe('Startseite – eigene Stücke (nur desktop, exklusiv)', () => {
  // Eigene Nummern 975–979 mit exklusivem Bereichs-Lock (wie shop.e2e): parallele Fixture-Tests verschieben sonst die
  // „neuesten 4“.
  const OWN = [975, 976, 977, 978, 979]
  let releaseRange: ReleaseLock | undefined

  const removeOwn = async () =>
    (await testPayload()).delete({
      collection: 'products',
      where: { itemNumber: { in: OWN } },
      overrideAccess: true,
      context: { seed: true },
    })

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    releaseRange = await holdFixtureRange('exclusive')
    await removeOwn()
  })

  test.afterEach(async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    try {
      await removeOwn()
      await refresh(request, ['/de', '/en'])
    } finally {
      await releaseRange?.()
    }
  })

  test('AK-3-02 höchstens 4 je Station (neueste zuerst), nie sold; Textil zeigt auch Caps (KA-17)', async ({
    page,
    request,
  }) => {
    const payload = await testPayload()
    const fx = await createProductFixtures(payload)
    const at = (min: number) => new Date(Date.now() - (10 - min) * 60_000).toISOString()
    const create = (nr: number, extra: Record<string, unknown>) =>
      payload.create({
        collection: 'products',
        data: { ...completeProduct('keramik', nr, fx), seed: true, ...extra } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    // 4 neue verfügbare Stücke (975 älteste … 978 neueste) + Seed-Keramik = mehr als 4 sichtbare, dazu 979 verkauft
    // (am neuesten).
    for (const [i, nr] of [975, 976, 977, 978].entries())
      await create(nr, { status: 'available', firstPublishedAt: at(i) })
    await create(979, {
      status: 'sold',
      firstPublishedAt: at(8),
      soldAt: at(9),
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt',
      showInArchiveAfterSale: true,
    })

    await openHome(page, request)
    expect(await numbersOf(station(page, 'keramik').locator('[data-product-card]'))).toEqual([
      978, 977, 976, 975,
    ])
    // Seed (SEED-SPEC §5.1): Textil-Station = die 4 neuesten sichtbaren Stücke aus textil + cap (S17, S14 reserviert,
    // S11, S12); der Entwurf S18 (cap) und die verkauften S10/S13/S16 fehlen.
    const textil = await numbersOf(station(page, 'textil').locator('[data-product-card]'))
    expect(textil).toEqual([917, 914, 911, 912])
  })
})

test.describe('Startseite – Leerzustand (exklusiv)', () => {
  // Die Test-Kategorie `sonstiges` ist im Mini-Bestand leer; Fixture-Tests legen dort kurz Stücke an → exklusiv.
  holdListData(test, 'exclusive')

  test('Kategorie ohne sichtbare Stücke → „Gerade ist hier nichts – …“ + Archiv-Link, keine Karten', async ({
    page,
    request,
  }) => {
    const payload = await testPayload()
    const home = (
      await payload.find({
        collection: 'pages',
        where: { key: { equals: 'home' } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        locale: 'de',
      })
    ).docs[0]!
    type Block = { blockType: string; stationId?: string; link?: { category?: string | null } }
    const layout = (home.layout ?? []) as unknown as Block[]
    const withCategory = (category: string) =>
      layout.map((b) =>
        b.blockType === 'station' && b.stationId === 'schmuck'
          ? { ...b, link: { ...b.link, category } }
          : b,
      )
    const update = (category: string) =>
      payload.update({
        collection: 'pages',
        id: home.id,
        data: { layout: withCategory(category) } as never,
        locale: 'de',
        overrideAccess: true,
        context: { seed: true },
      })
    try {
      await update('sonstiges')
      await openHome(page, request)
      const schmuck = station(page, 'schmuck')
      await expect(schmuck.locator('[data-product-card]')).toHaveCount(0)
      const empty = schmuck.locator('[data-station-empty]')
      await expect(empty).toContainText(
        'Gerade ist es hier still. Komm später wieder – oder wandere durchs Archiv.',
      )
      await expect(empty.getByRole('link', { name: 'Ins Archiv' })).toHaveAttribute(
        'href',
        '/de/archiv',
      )
      // Die anderen Stationen zeigen weiter ihre Stücke.
      expect(await station(page, 'keramik').locator('[data-product-card]').count()).toBeGreaterThan(
        0,
      )
    } finally {
      await update('schmuck')
      await refresh(request, ['/de', '/en'])
    }
    const en = await payload.find({
      collection: 'pages',
      where: { key: { equals: 'home' } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      locale: 'en',
    })
    const block = (en.docs[0]!.layout ?? []).find(
      (b) => b.blockType === 'station' && b.stationId === 'schmuck',
    ) as { heading?: string } | undefined
    expect(block?.heading).toBe('Jewellery')
  })
})
