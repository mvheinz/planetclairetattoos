import { readFileSync } from 'node:fs'

import exifr from 'exifr'
import { serverURL } from '../../helpers/adminEnv'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { formNumber, jpeg, listedMediaIds, removePieces } from './pieceHelpers'

// P5.5 – Foto-Baustein „Neues Stück“ (KONZEPT §7.4, ARCHITEKTUR §8.8): Kamera- und Galerie-Knopf, Verkleinerung im
// Browser auf ≤ 2560 px lange Kante (ein Bild je Anfrage), GPS-EXIF in keiner Größe (AK-7-02, R-135), höchstens 12
// Fotos (das 13. mit Hinweis abgelehnt), Reihenfolge per Tastatur, Titelbild und Reihenfolge gespeichert, 390 × 844
// ohne horizontales Scrollen (AK-7-04).

const GPS_JPEG = readFileSync('tests/fixtures/images/gps-orientation-6.jpg')
const SMALL_JPEG = readFileSync('tests/fixtures/images/landscape-small.jpg')

test.describe.configure({ timeout: 180_000 })

test.describe('Foto-Baustein (P5.5)', () => {
  const uploaded: number[] = []
  let numbers: number[] = []

  test.afterEach(async () => {
    await removePieces(numbers, uploaded.splice(0))
    numbers = []
  })

  test('AK-7-02 6000×4000 kommt mit ≤ 2560 px an; GPS in keiner Größe; Hinweis unter 2 Fotos', async ({
    adminPage: page,
    request,
  }, testInfo) => {
    // Dateinamen je Geräteprofil: `media.filename` ist eindeutig, und Payload prüft den Namen vor dem Einfügen ohne
    // Sperre – laufen Profile parallel, kollidieren gleichnamige Uploads sonst („Wert muss einzigartig sein“).
    const tag = testInfo.project.name
    await page.setViewportSize({ width: 390, height: 844 })
    // Maße der hochgeladenen Datei im Browser selbst messen: WebKit liefert Playwright den Datei-Teil einer
    // multipart-Anfrage (Blob) nicht mit (`postDataBuffer()` ohne Inhalt) – das Mitschneiden muss im Seitenkontext
    // geschehen, damit der Nachweis „Browser hat verkleinert“ auf allen Geräteprofilen gleich funktioniert.
    await page.addInitScript(() => {
      const w = window as unknown as { __pcUploads: { width?: number; height?: number }[] }
      w.__pcUploads = []
      const original = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const file = init?.body instanceof FormData ? init.body.get('file') : null
        if (
          init?.method === 'POST' &&
          new URL(url, location.href).pathname.endsWith('/api/media') &&
          file instanceof Blob
        ) {
          const entry: { width?: number; height?: number } = {}
          w.__pcUploads.push(entry)
          void createImageBitmap(file)
            .then((bm) => {
              entry.width = bm.width
              entry.height = bm.height
              bm.close()
            })
            .catch(() => undefined)
        }
        return original(input, init)
      }
    })
    const sent = (): Promise<{ width?: number; height?: number }[]> =>
      page.evaluate(
        () =>
          (window as unknown as { __pcUploads?: { width?: number; height?: number }[] })
            .__pcUploads ?? [],
      )
    await page.goto(adminPath('/neues-stueck'))
    await expect(page.getByRole('heading', { name: /Fotos \(0 von 12\)/ })).toBeVisible()
    // Kamera-Knopf: nur Bilder, Rückkamera
    const camera = page.getByTestId('photo-camera')
    await expect(camera).toHaveAttribute('capture', 'environment')
    await expect(camera).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    await expect(page.getByTestId('photo-gallery')).toHaveAttribute('multiple', '')

    await camera.setInputFiles({ name: `gps-${tag}.jpg`, mimeType: 'image/jpeg', buffer: GPS_JPEG })
    await expect(page.getByTestId('photo-list').locator('li')).toHaveCount(1)
    await expect(page.getByTestId('photo-few')).toHaveText('Mindestens 2 Fotos empfohlen.')

    await page.getByTestId('photo-gallery').setInputFiles({
      name: `gross-${tag}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await jpeg(6000, 4000),
    })
    await expect(page.getByTestId('photo-list').locator('li')).toHaveCount(2)
    await expect(page.getByTestId('photo-few')).toHaveCount(0)
    const ids = await listedMediaIds(page)
    uploaded.push(...ids)

    // Browser hat verkleinert (Anfrage) und der Server speichert ≤ 2560 px.
    await expect.poll(async () => (await sent()).length).toBe(2)
    await expect.poll(async () => (await sent())[1]?.width).toBe(2560)
    expect((await sent())[1]!.height).toBe(1707)
    const payload = await testPayload()
    const big = await payload.findByID({ collection: 'media', id: ids[1]!, overrideAccess: true })
    expect(Math.max(big.width ?? 0, big.height ?? 0)).toBeLessThanOrEqual(2560)

    // GPS-EXIF in keiner ausgelieferten Größe (auch nicht im Original)
    const gps = await payload.findByID({ collection: 'media', id: ids[0]!, overrideAccess: true })
    const urls = [
      gps.url,
      ...Object.values(gps.sizes ?? {}).map((s) => (s as { url?: string | null } | null)?.url),
    ].filter((u): u is string => typeof u === 'string' && u !== '')
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      const res = await request.get(new URL(url, serverURL).toString())
      expect(res.status(), url).toBe(200)
      const meta = await exifr.parse(await res.body(), { gps: true }).catch(() => undefined)
      expect(meta?.latitude, url).toBeUndefined()
      expect(meta?.GPSLatitude, url).toBeUndefined()
    }
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    )
    expect(scroll, 'kein horizontales Scrollen').toBe(true)
  })

  test('13. Foto abgelehnt; Reihenfolge per Tastatur; Reihenfolge und Titelbild gespeichert', async ({
    adminPage: page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const nr = formNumber(testInfo.project.name, 2)
    numbers = [nr]
    await removePieces(numbers)
    await page.goto(adminPath('/neues-stueck'))
    const files = Array.from({ length: 13 }, (_, i) => ({
      name: `foto-${testInfo.project.name}-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: SMALL_JPEG,
    }))
    await page.getByTestId('photo-gallery').setInputFiles(files)
    await expect(page.getByTestId('photo-list').locator('li')).toHaveCount(12, { timeout: 60_000 })
    await expect(page.getByTestId('photo-feedback-error')).toContainText(
      `Höchstens 12 Fotos je Stück – „foto-${testInfo.project.name}-13.jpg“ wurde nicht hinzugefügt.`,
    )
    await expect(page.getByTestId('photo-gallery')).toBeDisabled()
    const before = await listedMediaIds(page)
    uploaded.push(...before)

    // Tastatur: Foto 1 eine Stelle nach hinten
    const down = page.getByRole('button', { name: 'Foto 1 nach hinten' })
    await down.focus()
    await page.keyboard.press('Enter')
    const after = await listedMediaIds(page)
    expect(after).toEqual([before[1], before[0], ...before.slice(2)])
    await expect(page.getByTestId('photo-list').locator('li').first()).toContainText('Titelbild')

    // Pflichtfelder fürs Speichern als Entwurf, dann Vorschlag für die Bildbeschreibungen
    await page.getByLabel('Keramik', { exact: true }).check()
    await page.getByLabel('Objektnummer').fill(String(nr))
    await page.getByLabel('Titel', { exact: true }).fill('Schale mit Hund')
    await page.getByLabel('Preis').fill('45,50')
    await page.getByTestId('photo-suggest-alt').click()
    await expect(page.getByTestId('photo-alt-de').first()).toHaveValue(
      `Keramik „Schale mit Hund“, Nr. ${nr}, Foto 1 von 12`,
    )
    await page.getByTestId('piece-save').click()
    await expect(page.getByTestId('piece-result')).toContainText('Gespeichert.')
    await expect(page).toHaveURL(/\/stuecke\/\d+$/)

    const payload = await testPayload()
    const saved = (
      await payload.find({
        collection: 'products',
        where: { itemNumber: { equals: nr } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!
    expect(saved.images).toEqual(after)
    expect(saved.priceCents).toBe(4550)
    const cover = await payload.findByID({
      collection: 'media',
      id: after[0]!,
      locale: 'de',
      overrideAccess: true,
    })
    expect(cover.alt).toBe(`Keramik „Schale mit Hund“, Nr. ${nr}, Foto 1 von 12`)

    // Nach dem Neuladen: gleiche Reihenfolge, Titelbild vorne
    await page.reload()
    expect(await listedMediaIds(page)).toEqual(after)
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    )
    expect(scroll, 'kein horizontales Scrollen').toBe(true)
  })
})
