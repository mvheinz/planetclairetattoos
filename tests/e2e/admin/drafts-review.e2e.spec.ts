import type { Page } from '@playwright/test'
import type { Payload } from 'payload'

import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'
import { completeProduct, createProductFixtures } from '../../int/helpers/products'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P20.6 (U-93) – Verwaltung, Teil 1, im Browser (Projekte desktop und pixel-7):
// V-31 „zu prüfen“: EINE gelbe Sammelzeile unter „Heute“ mit Link auf den Filter, „Erledigt“ an der Karte und im
//      Formular (die Markierung verschwindet, ohne „Alle Daten“).
// V-32 Formular „Was fehlt noch?“, schon hochgeladenen Nickel-Nachweis auswählen, „Speichern und nächstes Stück“;
//      Karte „fertig“ / „fehlt: …“ und „Alle fertigen online stellen“ (Dialog mit Zahl, Bericht, setzt keine Häkchen –
//      exklusiv und nur im Projekt desktop, weil die Aktion alle Entwürfe betrifft).

test.describe.configure({ timeout: 120_000 })

const MANUAL = { flag: true, reason: 'manual', note: 'Bitte prüfen: aus deinen Fotos angelegt.' }
const cardOf = (page: Page, nr: number) =>
  page.locator(`[data-testid="piece-card"][data-item-number="${nr}"]`)
const productOf = async (id: number) =>
  (await testPayload()).findByID({ collection: 'products', id, depth: 0, overrideAccess: true })

test('@a11y V-31 „zu prüfen“: Sammelzeile unter „Heute“ → Filter → „Erledigt“ an Karte und im Formular', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const a = await fixtureProducts.create('keramik', {
    adminAttention: MANUAL,
    title: 'Prüf-Schale A',
  })
  const b = await fixtureProducts.create('keramik', {
    adminAttention: MANUAL,
    title: 'Prüf-Schale B',
  })

  await page.goto(adminPath('/heute'))
  const line = page.locator('[data-hint="products-review"]')
  await expect(line).toHaveAttribute('data-tone', 'warning')
  await expect(line).toContainText(/\d+ Stücke warten auf deine Prüfung\./)
  // keine einzelne rote Zeile je Stück
  await expect(page.locator(`[data-hint="attention-product-${a.id}"]`)).toHaveCount(0)
  await line.getByRole('link', { name: 'Zu prüfen ansehen' }).click()
  await expect(page).toHaveURL(/\/stuecke\?pruefen=1$/)
  await expect(page.getByTestId('pieces-review-filter')).toHaveValue('1')
  const cardA = cardOf(page, a.itemNumber)
  await expect(cardA.getByTestId('piece-attention')).toContainText('zu prüfen')
  await expect(cardOf(page, b.itemNumber)).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')

  // „Erledigt“ an der Karte: Karte fällt aus dem Filter
  await cardA.getByTestId('piece-attention-done').click()
  await expect(cardOf(page, a.itemNumber)).toHaveCount(0)
  expect((await productOf(a.id)).adminAttention).toMatchObject({ flag: false })

  // „Erledigt“ im Formular
  await page.goto(adminPath(`/stuecke/${b.id}`))
  const box = page.getByTestId('piece-attention-box')
  await expect(box).toContainText('Zu prüfen:')
  await expect(box).toContainText(MANUAL.note)
  await box.getByTestId('piece-attention-done').click()
  await expect(page.getByTestId('piece-attention-box')).toHaveCount(0)
  expect((await productOf(b.id)).adminAttention).toMatchObject({ flag: false })
})

test('V-32 Formular: „Was fehlt noch?“, Nickel-Nachweis auswählen, „Speichern und nächstes Stück“', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const older = await fixtureProducts.create('keramik', { title: 'Älterer Entwurf' })
  const jewel = await fixtureProducts.create('schmuck', {
    title: 'Anhänger ohne Nachweis',
    nickelEvidence: null,
    smallPartsWarning: true,
  })
  await page.goto(adminPath(`/stuecke/${jewel.id}`))
  const box = page.getByTestId('piece-readiness-box')
  await expect(box).toHaveAttribute('data-ready', 'false')
  await expect(box).toContainText('Nickel-Nachweis (Lieferantenerklärung) fehlt.')
  // Tipp für Schmuck, sperrt nicht
  await expect(page.getByTestId('piece-readiness-tip')).toContainText('Foto an der Hand')

  // schon hochgeladenen Nachweis auswählen statt neu hochladen
  const pick = page.locator('#pf-nickelEvidencePick')
  await expect(pick.locator('option')).not.toHaveCount(1)
  await pick.selectOption({ index: 1 })
  await expect(page.getByTestId('piece-evidence-status')).toContainText('Nachweis angehängt:')
  await page.getByTestId('piece-save').click()
  await expect(page.getByTestId('piece-result')).toContainText('Gespeichert.')
  await expect(page.getByTestId('piece-readiness-box')).toHaveAttribute('data-ready', 'true')
  expect((await productOf(jewel.id)).nickelEvidence).toBeTruthy()

  // „Speichern und nächstes Stück“ öffnet den nächsten Entwurf in der Reihenfolge von „Meine Stücke“
  await page.goto(adminPath(`/stuecke/${jewel.id}`))
  await page.getByTestId('piece-save-next').click()
  await page.waitForURL((url) => {
    const m = /\/stuecke\/(\d+)$/.exec(url.pathname)
    return !!m && Number(m[1]) !== jewel.id
  })
  const nextId = Number(/\/stuecke\/(\d+)$/.exec(new URL(page.url()).pathname)![1])
  expect((await productOf(nextId)).status).toBe('draft')
  // im ruhigen Lauf ist es der zuvor angelegte Entwurf
  if (test.info().config.workers === 1) expect(nextId).toBe(older.id)
  await expect(page.getByTestId('piece-form')).toBeVisible()
})

test.describe('V-32 „Alle fertigen online stellen“ (exklusiv, nur desktop)', () => {
  const OWN = [997, 998, 999]
  let payload: Payload
  let release: ReleaseLock | undefined

  const removeOwn = () =>
    payload.delete({
      collection: 'products',
      where: { itemNumber: { in: OWN } },
      overrideAccess: true,
      context: { seed: true },
    })

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'betrifft alle Entwürfe – einmal je Lauf')
    release = await holdFixtureRange('exclusive')
    payload = await testPayload()
    await removeOwn()
  })

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    try {
      await removeOwn()
    } finally {
      await release?.()
      release = undefined
    }
  })

  test('Karten „fertig“ / „fehlt: …“, Dialog mit Zahl, nur fertige online, keine Häkchen gesetzt', async ({
    adminPage: page,
  }) => {
    const fx = await createProductFixtures(payload)
    const create = async (nr: number, category: 'keramik' | 'schmuck', extra = {}) =>
      (
        await payload.create({
          collection: 'products',
          data: { ...completeProduct(category, nr, fx), seed: true, ...extra } as never,
          overrideAccess: true,
          context: { seed: true },
        })
      ).id as number
    const ready = await create(997, 'keramik')
    const notMine = await create(998, 'keramik', { ownDesignConfirmed: false })
    const jewel = await create(999, 'schmuck', { smallPartsWarning: true })
    const before = await payload.count({
      collection: 'products',
      where: { status: { equals: 'draft' } },
      overrideAccess: true,
    })

    await page.goto(adminPath('/stuecke?status=draft'))
    await expect(cardOf(page, 997).getByTestId('piece-readiness')).toHaveAttribute(
      'data-ready',
      'true',
    )
    await expect(cardOf(page, 997).getByTestId('piece-readiness')).toContainText('fertig')
    await expect(cardOf(page, 998).getByTestId('piece-readiness')).toContainText(
      'fehlt: Häkchen „eigene Figuren“',
    )
    await expect(cardOf(page, 999).getByTestId('piece-readiness-hint')).toContainText(
      'Tipp: Foto an der Hand',
    )

    await page.getByTestId('pieces-publish-ready').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAccessibleName('Alle fertigen Entwürfe online stellen?')
    await expect(dialog).toContainText(`2 von ${before.totalDocs} Entwürfen sind fertig.`)
    await expect(dialog).toContainText('hier wird nichts angehakt')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect(dialog).toContainText('2 Stücke sind jetzt online.')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect(cardOf(page, 998)).toHaveAttribute('data-status', 'draft')

    expect((await productOf(ready)).status).toBe('available')
    expect((await productOf(jewel)).status).toBe('available')
    expect(await productOf(notMine)).toMatchObject({ status: 'draft', ownDesignConfirmed: false })
  })
})
