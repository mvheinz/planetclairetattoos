import path from 'node:path'

import type { Page, Request } from '@playwright/test'

import { createOrder, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { removeOrder } from './orderHelpers'

// P5.14 – Sendungsnummer scannen: ohne natives `BarcodeDetector` (Chromium ohne Unterstützung) füllt das Foto eines
// Code-128-Etiketts das Feld über den Rückfall `@zxing/browser` (eigener Chunk, erst beim Foto geladen). Auf „Heute“
// wird dieser Chunk nicht geladen; keine Anfrage an fremde Hosts.

const PHOTO = path.resolve('tests/fixtures/barcodes/code128-photo.png')

/** Alle HTTP(S)-Anfragen der Seite (ohne `data:`/`blob:`). */
function track(page: Page): Request[] {
  const list: Request[] = []
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) list.push(r)
  })
  return list
}

const scripts = (list: Request[]) =>
  list.filter((r) => r.resourceType() === 'script').map((r) => r.url())

test('Foto eines Code-128-Barcodes füllt die Sendungsnummer über den Rückfall; zxing-Chunk nicht auf /heute, keine fremden Hosts', async ({
  adminPage: page,
  fixtureProducts,
  baseURL,
}) => {
  const payload = await testPayload()
  const product = await fixtureProducts.create('textil', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const created = await createOrder(
    payload,
    orderData(
      90_000 + product.itemNumber * 10 + 6,
      [{ id: product.id, itemNumber: product.itemNumber, shippingClass: 'paket_klein' }],
      {
        seed: true,
        shippingClass: 'paket_klein',
        timestamps: { placedAt: new Date().toISOString() },
      },
    ),
  )
  const orderId = created.id as number
  const own = new URL(baseURL!).host
  try {
    // Chromium ohne BarcodeDetector (wie die meisten Desktop- und iOS-Browser)
    await page.addInitScript(() => {
      delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector
    })
    const requests = track(page)
    await page.goto(adminPath(`/bestellungen/${orderId}`))
    const form = page.getByTestId('ship-form')
    const field = form.getByLabel('Sendungsnummer')
    await expect(field).toHaveValue('')
    // Kamera erst nach Tipp; bis dahin kein zxing
    const before = new Set(scripts(requests))

    const chooser = page.waitForEvent('filechooser')
    await form.getByTestId('tracking-scan').click()
    const fc = await chooser
    expect(fc.isMultiple()).toBe(false)
    await expect(form.getByTestId('tracking-scan-input')).toHaveAttribute('capture', 'environment')
    await fc.setFiles(PHOTO)
    await expect(field).toHaveValue('0034043431234567890')
    await expect(form.getByTestId('tracking-scan-status')).toContainText('0034043431234567890')
    // Texteingabe bleibt möglich
    await field.fill('JJD000390007123456')
    await expect(field).toHaveValue('JJD000390007123456')

    const zxing = scripts(requests).filter((u) => !before.has(u))
    expect(zxing.length, 'Rückfall lädt eigenen Chunk').toBeGreaterThan(0)
    for (const r of requests) expect(new URL(r.url()).host, r.url()).toBe(own)

    // /heute: weder der zxing-Chunk noch fremde Hosts
    const heute = await page.context().newPage()
    const heuteRequests = track(heute)
    await heute.goto(adminPath('/heute'))
    await heute.waitForLoadState('networkidle')
    const loaded = scripts(heuteRequests)
    for (const u of zxing) expect(loaded, u).not.toContain(u)
    for (const r of heuteRequests) expect(new URL(r.url()).host, r.url()).toBe(own)
    await heute.close()
  } finally {
    await removeOrder(payload, orderId)
  }
})
