import type { APIRequestContext, Page } from '@playwright/test'

import { localizedPath } from '../../../src/lib/routes/paths'
import { formatBerlin } from '../../../src/lib/time'
import { adminCall, adminLogin, type AdminSession } from '../adminApi'
import { serverURL } from '../../helpers/adminEnv'
import { prepaymentReserved, removePrepayment } from '../../int/helpers/pieces'
import { expectNoSeriousViolations } from '../axe'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { NO_CACHE, refresh } from '../shop/fresh'

// P5.8 – „Meine Stücke“ (KONZEPT §7.5): Suche, Filter, Karten, Knöpfe je Status. „Verkauft (Markt/privat)“ (V-34,
// früher „Offline verkauft“) mit Schalter an →
// fehlt im Shop, erscheint im Archiv mit sold-Stempel (Produktions-Build ≤ 5 s wie T-21); Schalter aus → auch nicht im
// Archiv. Filter „reserviert“ zeigt ein Vorkasse-Fixture (analog S14/O13) mit Hinweis. Mini-Satz bleibt unverändert.
// Daten ändernde Tests nur im Projekt desktop; Ansicht und axe bei 390 × 844 in allen Projekten.

const PRODUCTION = process.env.E2E_SERVER === 'start'
const LIMIT_MS = PRODUCTION ? 5_000 : 30_000
const SHOP = localizedPath('R02', 'de')
const ARCHIVE = localizedPath('R05', 'de')

test.describe.configure({ timeout: 120_000 })

async function seedStatuses(): Promise<Record<number, string>> {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'products',
    where: { itemNumber: { less_than: 975 } },
    depth: 0,
    pagination: false,
    select: { itemNumber: true, status: true },
    overrideAccess: true,
  })
  return Object.fromEntries(res.docs.map((d) => [d.itemNumber, d.status]))
}

const html = async (request: APIRequestContext, url: string) =>
  (
    await request.get(`${serverURL}${url}`, {
      headers: PRODUCTION ? {} : NO_CACHE,
      failOnStatusCode: false,
    })
  ).text()

const cardOf = (page: Page, nr: number) =>
  page.locator(`[data-testid="piece-card"][data-item-number="${nr}"]`)

async function noHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))
  expect(scroll, 'kein horizontales Scrollen').toBeLessThanOrEqual(width)
}

test.describe('Meine Stücke (P5.8) @a11y', () => {
  let admin: AdminSession | undefined

  test.afterEach(async () => {
    await admin?.release()
    admin = undefined
  })

  test('Suche nach Nummer (auch „0…“) und Titel, Karte mit Nr., Preis und Status; axe 390×844', async ({
    adminPage: page,
    fixtureProducts,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { itemNumber: nr } = await fixtureProducts.create('keramik', {
      title: 'Suchtest Schale',
    })
    await page.goto(adminPath(`/stuecke?q=0${nr}`))
    await expect(page.getByTestId('piece-card')).toHaveCount(1)
    const card = cardOf(page, nr)
    await expect(card).toContainText(`Nr. ${String(nr).padStart(3, '0')}`)
    await expect(card).toContainText('Suchtest Schale')
    await expect(card).toContainText('45,00 €')
    await expect(card).toContainText('Entwurf')
    await page.goto(adminPath('/stuecke?q=suchtest'))
    await expect(cardOf(page, nr)).toBeVisible()
    await noHorizontalScroll(page)
    await expectNoSeriousViolations(page, 'Meine Stücke 390×844')
    // Filter per Formular (Tastatur-bedienbar, ohne JavaScript)
    await page.getByLabel('Status').selectOption('draft')
    await page.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(page).toHaveURL(/status=draft/)
    await expect(cardOf(page, nr)).toBeVisible()
  })

  test('Filter „reserviert“ zeigt Vorkasse-Fixture mit Hinweis und „Zur Bestellung“', async ({
    adminPage: page,
    fixtureProducts,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    admin = await adminLogin()
    const payload = await testPayload()
    const p = await fixtureProducts.create('keramik')
    await adminCall(request, admin, 'post', `/products/${p.id}/publish`)
    const pre = await prepaymentReserved(payload, p, 90_000 + p.itemNumber, { seed: true })
    try {
      await page.goto(adminPath('/stuecke?status=reserved'))
      const card = cardOf(page, p.itemNumber)
      await expect(card).toBeVisible()
      await expect(card.getByTestId('piece-reservation')).toHaveText(
        `Vorkasse ${pre.orderNumber} bis ${formatBerlin(pre.dueAt, 'dd.MM.yyyy')}`,
      )
      await expect(card.getByTestId('piece-to-order')).toHaveAttribute(
        'href',
        adminPath(`/bestellungen/${pre.orderId}`),
      )
      await expect(card.getByTestId('piece-sell-offline')).toHaveCount(0)
      await expect(
        page.locator('[data-testid="piece-card"]:not([data-status="reserved"])'),
      ).toHaveCount(0)
    } finally {
      await removePrepayment(payload, pre)
    }
  })

  test('„Offline verkauft“: Schalter an → Archiv mit Stempel, Schalter aus → nicht im Archiv; Mini-Satz unverändert', async ({
    adminPage: page,
    fixtureProducts,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    admin = await adminLogin()
    const before = await seedStatuses()
    const shown = await fixtureProducts.create('keramik', { title: 'Offline mit Archiv' })
    const hidden = await fixtureProducts.create('keramik', { title: 'Offline ohne Archiv' })
    for (const p of [shown, hidden])
      await adminCall(request, admin, 'post', `/products/${p.id}/publish`)
    await refresh(request, [SHOP, ARCHIVE])
    const marker = (nr: number) => `data-item-number="${nr}"`
    await expect
      .poll(() => html(request, SHOP), { timeout: LIMIT_MS })
      .toContain(marker(shown.itemNumber))

    // 1. Schalter an (Standard)
    await page.goto(adminPath(`/stuecke?q=${shown.itemNumber}`))
    await cardOf(page, shown.itemNumber).getByTestId('piece-sell-offline').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAccessibleName(
      `Nr. ${shown.itemNumber} als verkauft eintragen (Markt oder privat)?`,
    )
    await expect(dialog).toHaveAccessibleDescription('Es verschwindet sofort aus dem Shop.')
    await expect(dialog.getByTestId('piece-sell-offline-archive')).toBeChecked()
    await dialog.getByTestId('confirm-dialog-ok').click()
    const sentAt = Date.now()
    await expect(cardOf(page, shown.itemNumber)).toHaveAttribute('data-status', 'sold')
    await expect
      .poll(() => html(request, ARCHIVE), { timeout: LIMIT_MS, intervals: [100, 250, 500] })
      .toContain(`${marker(shown.itemNumber)} data-status="sold"`)
    expect(Date.now() - sentAt).toBeLessThanOrEqual(LIMIT_MS + 2_000)
    // „Fehlt im Shop“: nicht mehr kaufbar – die Shop-Liste zeigt verkaufte Archiv-Stücke gedämpft mit Stempel
    // (KONZEPT §3.2), die Liste „nur verfügbare“ (AK-3-03) gar nicht mehr.
    await expect
      .poll(() => html(request, `${SHOP}?available=1`), { timeout: LIMIT_MS })
      .not.toContain(marker(shown.itemNumber))
    expect(await html(request, SHOP)).toContain(`${marker(shown.itemNumber)} data-status="sold"`)
    await page.goto(ARCHIVE)
    await expect(
      page.locator(`[data-product-card][data-item-number="${shown.itemNumber}"] [data-sold-stamp]`),
    ).toBeVisible()

    // 2. Schalter aus
    await page.goto(adminPath(`/stuecke?q=${hidden.itemNumber}`))
    await cardOf(page, hidden.itemNumber).getByTestId('piece-sell-offline').click()
    await page.getByRole('dialog').getByTestId('piece-sell-offline-archive').uncheck()
    await page.getByRole('dialog').getByTestId('confirm-dialog-ok').click()
    await expect(cardOf(page, hidden.itemNumber)).toHaveAttribute('data-status', 'sold')
    await expect(cardOf(page, hidden.itemNumber).getByTestId('piece-toggle-archive')).toHaveText(
      'Im Archiv zeigen',
    )
    await expect
      .poll(() => html(request, SHOP), { timeout: LIMIT_MS })
      .not.toContain(marker(hidden.itemNumber))
    expect(await html(request, ARCHIVE)).not.toContain(marker(hidden.itemNumber))

    // Mini-Satz (Beispielbestand unter 975) unverändert
    expect(await seedStatuses()).toEqual(before)
  })

  test('U-60 „Offline verkauft“ mit Markt-Termin und Preis; „Als neues Stück kopieren“ ohne Fotos, als Entwurf', async ({
    adminPage: page,
    fixtureProducts,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    admin = await adminLogin()
    const payload = await testPayload()
    const tour = await payload.create({
      collection: 'tour-dates',
      data: {
        name: 'E2E Markt U60',
        place: 'Berlin-Wedding',
        startsAt: new Date().toISOString(),
      } as never,
      overrideAccess: true,
    })
    const p = await fixtureProducts.create('keramik', { title: 'Markt-Schale' })
    await adminCall(request, admin, 'post', `/products/${p.id}/publish`)
    let copyId: number | null = null
    try {
      await page.goto(adminPath(`/stuecke?q=${p.itemNumber}`))
      await cardOf(page, p.itemNumber).getByTestId('piece-sell-offline').click()
      const dialog = page.getByRole('dialog')
      await dialog.getByTestId('piece-sell-offline-tour').selectOption(String(tour.id))
      await dialog.getByTestId('piece-sell-offline-price').fill('45,00')
      await dialog.getByTestId('confirm-dialog-ok').click()
      await expect(cardOf(page, p.itemNumber)).toHaveAttribute('data-status', 'sold')
      const sold = await payload.findByID({
        collection: 'products',
        id: p.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(sold).toMatchObject({ offlineSaleTourDate: tour.id, offlineSalePriceCents: 4500 })
      await page.goto(adminPath('/einstellungen/umsatz-waechter'))
      await expect(page.getByTestId('revenue-table')).toContainText('Markt-Verkäufe (Stücke)')

      // Kopieren: neuer Entwurf, nächste freie Nummer, keine Fotos
      await page.goto(adminPath(`/stuecke/${p.id}`))
      await expect(async () => {
        await page.getByTestId('piece-duplicate').click()
        await expect(page.getByRole('button', { name: 'Ja, kopieren' })).toBeVisible({
          timeout: 1500,
        })
      }).toPass({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Ja, kopieren' }).click()
      await page.waitForURL((url) => {
        const m = /\/stuecke\/(\d+)$/.exec(url.pathname)
        return !!m && Number(m[1]) !== p.id
      })
      copyId = Number(/\/stuecke\/(\d+)$/.exec(new URL(page.url()).pathname)![1])
      await expect(page.getByTestId('piece-form')).toBeVisible()
      const copy = await payload.findByID({
        collection: 'products',
        id: copyId,
        depth: 0,
        locale: 'de',
        overrideAccess: true,
      })
      expect(copy).toMatchObject({
        status: 'draft',
        title: 'Markt-Schale (Kopie)',
        category: 'keramik',
        priceCents: sold.priceCents,
      })
      expect(copy.images ?? []).toEqual([])
      expect(copy.itemNumber).not.toBe(p.itemNumber)
    } finally {
      if (copyId)
        await payload.delete({
          collection: 'products',
          id: copyId,
          overrideAccess: true,
          context: { seed: true },
        })
      await payload.delete({
        collection: 'tour-dates',
        id: tour.id,
        overrideAccess: true,
        context: { seed: true },
      })
    }
  })

  test('V-34 „Aus dem Shop nehmen“ fragt „Kommt es wieder?“: Ja → Entwurf, Nein → weggelegt; Entwurf „Weglegen“; Markt-Preis nachtragen', async ({
    adminPage: page,
    fixtureProducts,
    request,
  }) => {
    admin = await adminLogin()
    const payload = await testPayload()
    const back = await fixtureProducts.create('keramik', { title: 'Kommt wieder' })
    const gone = await fixtureProducts.create('keramik', { title: 'Kommt nicht wieder' })
    const draft = await fixtureProducts.create('keramik', { title: 'Entwurf weglegen' })
    const sold = await fixtureProducts.create('keramik', { title: 'Markt-Schale' })
    for (const p of [back, gone, sold])
      await adminCall(request, admin, 'post', `/products/${p.id}/publish`)
    await adminCall(request, admin, 'post', `/products/${sold.id}/sell-offline`, {})
    const statusOf = async (id: number) =>
      (await payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true }))
        .status

    await page.setViewportSize({ width: 390, height: 844 })
    // Online: nur noch ein Knopf statt „Offline nehmen“ und „Ausblenden“
    await page.goto(adminPath(`/stuecke?q=${back.itemNumber}`))
    const card = cardOf(page, back.itemNumber)
    await expect(card.getByRole('button', { name: 'Offline nehmen' })).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Ausblenden' })).toHaveCount(0)
    await expect(card.getByTestId('piece-sell-offline')).toHaveText('Verkauft (Markt/privat)')
    // per Tastatur öffnen, Escape bricht ab
    await card.getByTestId('piece-take-off').focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAccessibleName(
      `Nr. ${back.itemNumber} aus dem Shop nehmen – kommt es wieder?`,
    )
    await expect(dialog.getByTestId('piece-take-off-back')).toHaveAccessibleDescription(
      'Es wird wieder ein Entwurf. Mit „Online stellen“ ist es zurück im Shop.',
    )
    await expectNoSeriousViolations(page, 'Dialog „Kommt es wieder?“')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(await statusOf(back.id)).toBe('available')
    // Ja → zurück zum Entwurf
    await card.getByTestId('piece-take-off').click()
    await page.getByRole('dialog').getByTestId('piece-take-off-back').click()
    await expect(cardOf(page, back.itemNumber)).toHaveAttribute('data-status', 'draft')

    // Nein → weggelegt (ausgeblendet)
    await page.goto(adminPath(`/stuecke?q=${gone.itemNumber}`))
    await cardOf(page, gone.itemNumber).getByTestId('piece-take-off').click()
    await page.getByRole('dialog').getByTestId('piece-take-off-gone').click()
    await expect(cardOf(page, gone.itemNumber)).toHaveAttribute('data-status', 'archived')
    await expect(cardOf(page, gone.itemNumber)).toContainText('ausgeblendet')

    // Entwurf: „Weglegen“ mit Rückfrage
    await page.goto(adminPath(`/stuecke?q=${draft.itemNumber}`))
    await cardOf(page, draft.itemNumber).getByTestId('piece-shelve').click()
    await expect(page.getByRole('dialog')).toHaveAccessibleName(`Nr. ${draft.itemNumber} weglegen?`)
    await page.getByRole('dialog').getByTestId('confirm-dialog-ok').click()
    await expect(cardOf(page, draft.itemNumber)).toHaveAttribute('data-status', 'archived')

    // Markt-Verkauf: Preis nachtragen (V-33 a)
    await page.goto(adminPath(`/stuecke?q=${sold.itemNumber}`))
    const soldCard = cardOf(page, sold.itemNumber)
    await soldCard.getByTestId('piece-offline-price-edit').click()
    await page.getByRole('dialog').getByTestId('piece-offline-price-input').fill('38,00')
    await page.getByRole('dialog').getByTestId('confirm-dialog-ok').click()
    await expect(soldCard.getByTestId('piece-offline-price')).toHaveText('Markt-Preis: 38,00 €')
    const doc = await payload.findByID({
      collection: 'products',
      id: sold.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc.offlineSalePriceCents).toBe(3800)
    await noHorizontalScroll(page)
  })
})
