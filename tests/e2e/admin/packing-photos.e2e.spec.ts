import path from 'node:path'

import { request as pwRequest } from '@playwright/test'

import { serverURL } from '../../helpers/adminEnv'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  fixtureOrder,
  orderStatus,
  packingPanelReady,
  removeOrder,
} from './orderHelpers'

// P5.11 – Packen im Bestell-Detail: Checkliste aus `settings.packingChecklists`, Verpackung vorbelegt mit der
// Standard-Vorlage der Versandklasse, Packfoto über die Kamera (`capture="environment"`, privat – ohne Anmeldung nicht
// abrufbar, DM-PRIV-01); Keramik ohne Packfoto: „Versendet melden“ fragt „Ohne Packfoto versenden?“ (R-100).

const PHOTO = path.resolve('tests/fixtures/images/gps-orientation-6.jpg')

test('@a11y Packfotos, Checkliste, Verpackung und Rückfrage „Ohne Packfoto versenden?“', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const live = {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  }
  const a = await fixtureProducts.create('keramik', live)
  const b = await fixtureProducts.create('keramik', live)
  const withPhoto = await fixtureOrder(payload, a, 90_000 + a.itemNumber * 10 + 3)
  const without = await fixtureOrder(payload, b, 90_000 + b.itemNumber * 10 + 3)
  try {
    await page.goto(adminPath(`/bestellungen/${withPhoto.id}`))
    const panel = await packingPanelReady(page)
    await expect(panel.getByTestId('packing-checklist')).toContainText('Schütteltest')
    await expect(panel.getByTestId('packing-checklist')).toContainText(
      'zwei Fotos vor dem Zukleben',
    )
    const packaging = panel.getByTestId('packaging')
    await expect(packaging.getByLabel('Vorlage')).toHaveValue('keramik-doppelkarton')
    await expect(packaging.getByLabel('Gramm')).toHaveValue('900')
    await expectAccessible(page, '[data-testid="packing-panel"]')

    // Häkchen werden sofort gespeichert
    await panel.getByLabel('Schütteltest').check()
    await expect(panel.getByText('Gespeichert.', { exact: true })).toBeVisible()

    const input = panel.getByTestId('packing-photo-input')
    await expect(input).toHaveAttribute('capture', 'environment')
    await input.setInputFiles(PHOTO)
    const img = panel.getByTestId('packing-photos').locator('img')
    await expect(img).toHaveCount(1)
    const src = await img.getAttribute('src')
    expect(src).toBeTruthy()
    // ohne Anmeldung nicht abrufbar
    const anon = await pwRequest.newContext({ baseURL: serverURL })
    try {
      const res = await anon.get(src!)
      expect([401, 403, 404]).toContain(res.status())
    } finally {
      await anon.dispose()
    }
    const order = (await payload.findByID({
      collection: 'orders',
      id: withPhoto.id,
      depth: 0,
      overrideAccess: true,
    })) as { packingChecklistState?: Record<string, boolean>; packingPhotos?: unknown[] }
    expect(order.packingChecklistState?.['Schütteltest']).toBe(true)
    expect(order.packingPhotos).toHaveLength(1)

    // Mit Packfoto: keine Rückfrage
    await panel.getByLabel('Sendungsnummer').fill('00340434312345678901')
    await panel.getByTestId('ship-order').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).not.toContainText('Ohne Packfoto')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect.poll(async () => (await orderStatus(payload, withPhoto.id)).status).toBe('shipped')
    // Erst weiter, wenn `router.refresh()` nach dem Versand durch ist (Formular weg) – sonst unterbricht die Aktualisierung
    // unter WebKit die nächste Navigation.
    await expect(page.getByTestId('ship-order')).toHaveCount(0)

    // Ohne Packfoto: Rückfrage, nach Bestätigung versendet
    await page.goto(adminPath(`/bestellungen/${without.id}`))
    const panel2 = await packingPanelReady(page)
    await panel2.getByLabel('Sendungsnummer').fill('00340434312345678902')
    await panel2.getByTestId('ship-order').click()
    const ask = page.locator('dialog[open]')
    await expect(ask).toContainText('Ohne Packfoto versenden?')
    await expectAccessible(page, 'dialog[open]')
    await ask.getByTestId('confirm-dialog-ok').click()
    await expect.poll(async () => (await orderStatus(payload, without.id)).status).toBe('shipped')
  } finally {
    await removeOrder(payload, withPhoto.id)
    await removeOrder(payload, without.id)
  }
})
