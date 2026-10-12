import type { APIResponse } from '@playwright/test'

import { isFreshInShop } from '../../../src/lib/shop/fresh'
import { expect, test, testPayload } from '../fixtures'
import { NO_CACHE, freshPage, holdListData } from './fresh'

// V-60 Instagram-Brücke (U-93, P20.3) mit dem Beispielbestand: Nummernfeld „Nr. aus dem Post“ im Shop-Kopf und im Menü
// (GET /nr, Sprache der Seite vor Accept-Language, ohne Cookie), Stempel „frisch im Shop“ (Stücke der letzten 14 Tage,
// ohne Erstbefüllung), Kurzadresse /on-tour (→ Schaukasten auf der Startseite) und „In den Kalender“ (.ics vom eigenen
// Server) samt Hinweis zum Instagram-Browser.

const S01_DE = '/de/shop/901-schale-langohr-wuschel'
const S01_EN = '/en/shop/901-bowl-long-ears-fluff'

function expectNoCookie(res: APIResponse) {
  expect(
    res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie'),
    res.url(),
  ).toEqual([])
}

/** Wie `tourNow()` im Server: in der Testumgebung gilt `SEED_NOW`. */
const serverNow = () =>
  process.env.APP_ENV === 'test' && process.env.SEED_NOW
    ? new Date(process.env.SEED_NOW)
    : new Date()

test.describe('V-60 Nummernfeld „Nr. aus dem Post“', () => {
  // Der Browser spricht Deutsch – die Sprache der Seite, auf der das Feld steht, gewinnt trotzdem.
  test.use({ locale: 'de-DE' })
  holdListData(test, 'shared')

  test('Shop-Kopf (EN): Nummer → englische Produktseite, ohne Cookie', async ({
    page,
    context,
  }) => {
    await freshPage(page)
    await page.goto('/en/shop')
    const form = page.locator('form[data-nr-lookup="shop"]')
    await expect(form).toBeVisible()
    await expect(form).toHaveAttribute('action', '/nr')
    await expect(form).toHaveAttribute('method', 'get')
    // Sprache reist mit dem Knopf (kein verstecktes Feld)
    await expect(form.locator('button[type="submit"][name="locale"]')).toHaveAttribute(
      'value',
      'en',
    )
    await expect(form.locator('input[type="hidden"]')).toHaveCount(0)
    // Feld im Kopf unter der Einleitung, vor dem Raster
    const head = (await page.locator('header').filter({ has: form }).boundingBox())!
    const grid = (await page.locator('#liste').boundingBox())!
    expect(head.y + head.height).toBeLessThanOrEqual(grid.y + 1)
    await form.getByLabel('No. from the post').fill('901')
    await form.getByRole('button', { name: 'Show' }).click()
    await expect(page).toHaveURL(new RegExp(`${S01_EN}$`))
    await expect(page.locator('h1')).toHaveText('Bowl “Long Ears & Fluff”')
    expect(await context.cookies()).toEqual([])
  })

  test('Kategorie-Seite (DE) hat das Feld; „Nr. 901“ wie auf Instagram wird verstanden', async ({
    page,
  }) => {
    await freshPage(page)
    await page.goto('/de/shop/kategorie/keramik')
    const form = page.locator('form[data-nr-lookup="shop"]')
    await form.getByLabel('Nr. aus dem Post').fill('Nr. 901')
    await form.getByRole('button', { name: 'Zeigen' }).click()
    await expect(page).toHaveURL(new RegExp(`${S01_DE}$`))
  })

  test('Menü: Feld im Menü führt zum Stück und schließt das Menü; Tastatur bleibt im Dialog', async ({
    page,
  }) => {
    await page.goto('/en/legal-notice')
    const trigger = page.locator('[data-site-header] [data-menu-trigger]')
    await expect(trigger).toHaveAttribute('role', 'button')
    await trigger.click()
    const dialog = page.locator('dialog#menu')
    await expect(dialog).toBeVisible()
    const form = dialog.locator('form[data-nr-lookup="menu"]')
    await expect(form.locator('button[name="locale"]')).toHaveAttribute('value', 'en')
    const input = form.getByLabel('No. from the post')
    await input.focus()
    await page.keyboard.press('Tab')
    await expect(form.getByRole('button', { name: 'Show' })).toBeFocused()
    await input.fill('0901')
    await input.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${S01_EN}$`))
    await expect(page.locator('dialog#menu')).toBeHidden()
  })

  test('unbekannte Nummer → freundliche 404 in der Sprache der Seite mit Nummernfeld', async ({
    request,
  }) => {
    const res = await request.get('/nr?nummer=12345&locale=en', {
      maxRedirects: 0,
      headers: { ...NO_CACHE, 'accept-language': 'de-DE,de;q=0.9' },
    })
    expect(res.status()).toBe(404)
    expectNoCookie(res)
    const html = await res.text()
    expect(html).toContain('This page has drawn itself into the fog')
    expect(html).toContain('data-number-form')
    const ok = await request.get('/nr?nummer=901&locale=en', {
      maxRedirects: 0,
      headers: { 'accept-language': 'de-DE,de;q=0.9' },
    })
    expect(ok.status()).toBe(307)
    expect(new URL(ok.headers()['location']!, 'http://x').pathname).toBe(S01_EN)
    expectNoCookie(ok)
  })
})

test.describe('V-60 Nummernfeld ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false, locale: 'de-DE' })

  test('reines HTML-Formular im Shop-Kopf', async ({ page }) => {
    await page.goto('/de/shop')
    const form = page.locator('form[data-nr-lookup="shop"]')
    await form.getByLabel('Nr. aus dem Post').fill('901')
    await form.getByRole('button', { name: 'Zeigen' }).click()
    await expect(page).toHaveURL(new RegExp(`${S01_DE}$`))
  })
})

test.describe('V-60 Stempel „frisch im Shop“', () => {
  holdListData(test, 'shared')

  /** Erwartung aus den Daten: verfügbar, höchstens 14 Tage online, nicht Teil der Erstbefüllung. */
  async function expectedFresh(): Promise<{ fresh: number[]; stale: number[] }> {
    const payload = await testPayload()
    const res = await payload.find({
      collection: 'products',
      where: { firstPublishedAt: { exists: true } },
      sort: 'firstPublishedAt',
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { itemNumber: true, status: true, firstPublishedAt: true },
    })
    const start = res.docs[0]?.firstPublishedAt ?? null
    const ctx = { now: serverNow(), shopStartedAt: start }
    const available = res.docs.filter((d) => d.status === 'available' && d.itemNumber >= 901)
    return {
      fresh: available
        .filter((d) => isFreshInShop(d.firstPublishedAt, ctx))
        .map((d) => d.itemNumber),
      stale: available
        .filter((d) => !isFreshInShop(d.firstPublishedAt, ctx))
        .map((d) => d.itemNumber),
    }
  }

  test('Karten im Shop und Produktseite: nur frische, verfügbare Stücke; gezeichnet, nicht neu', async ({
    page,
  }) => {
    const { fresh, stale } = await expectedFresh()
    expect(fresh.length, 'Beispielbestand mit frischen Stücken (D-5 … D-8)').toBeGreaterThan(0)
    await freshPage(page)
    await page.goto('/de/shop')
    for (const nr of fresh) {
      const card = page.locator(`[data-product-card][data-item-number="${nr}"]`).first()
      if ((await card.count()) === 0) continue // auf einer späteren Seite
      const stamp = card.locator('[data-fresh-stamp="card"]')
      await expect(stamp, `Nr. ${nr}`).toBeVisible()
      await expect(stamp).toHaveAttribute('aria-hidden', 'true')
      await expect(card).toHaveAttribute('aria-label', /, frisch im Shop$/)
      // gezeichneter Rahmen (SVG-Pfade), kein Abzeichen; Wort nie „neu“
      expect(await stamp.locator('svg path').count()).toBeGreaterThan(1)
      await expect(stamp).not.toContainText(/neu/i)
      // oben rechts auf dem Foto
      const photo = (await card.locator('img').first().boundingBox())!
      const box = (await stamp.boundingBox())!
      expect(box.x + box.width / 2).toBeGreaterThan(photo.x + photo.width / 2)
      expect(box.y).toBeLessThan(photo.y + photo.height / 2)
    }
    for (const nr of stale) {
      const card = page.locator(`[data-product-card][data-item-number="${nr}"]`).first()
      if ((await card.count()) === 0) continue
      await expect(card.locator('[data-fresh-stamp]'), `Nr. ${nr}`).toHaveCount(0)
    }

    await page.goto(`/de/shop/${fresh[0]}`)
    const pageStamp = page.locator('[data-fresh-stamp="page"]')
    await expect(pageStamp).toBeVisible()
    await expect(pageStamp).toContainText('frisch im Shop')
    await page.goto(S01_DE)
    await expect(page.locator('[data-fresh-stamp]')).toHaveCount(0)
  })
})

test.describe('V-60 Kurzadresse /on-tour', () => {
  test('307 auf den Schaukasten der erkannten Sprache (Vary, kein Cookie); mit Präfix 308', async ({
    request,
  }) => {
    for (const [lang, to] of [
      ['en-GB,en;q=0.9', '/en#on-tour'],
      ['de-DE', '/de#on-tour'],
    ] as const) {
      const res = await request.get('/on-tour', {
        maxRedirects: 0,
        headers: { 'accept-language': lang },
      })
      expect(res.status(), lang).toBe(307)
      const location = new URL(res.headers()['location']!, 'http://x')
      expect(`${location.pathname}${location.hash}`).toBe(to)
      expect(res.headers()['vary']).toMatch(/Accept-Language/i)
      expectNoCookie(res)
    }
    const prefixed = await request.get('/en/on-tour', { maxRedirects: 0 })
    expect(prefixed.status()).toBe(308)
    const loc = new URL(prefixed.headers()['location']!, 'http://x')
    expect(`${loc.pathname}${loc.hash}`).toBe('/en#on-tour')
  })

  test('landet beim Schaukasten; am Handy klappt er von selbst auf', async ({ page, context }) => {
    await page.goto('/on-tour')
    await expect(page).toHaveURL(/\/(de|en)#on-tour$/)
    const aside = page.locator('aside#on-tour')
    await expect(aside).toHaveCount(1)
    await expect
      .poll(() =>
        aside.locator('details[data-tour-fold]').evaluate((d) => (d as HTMLDetailsElement).open),
      )
      .toBe(true)
    await expect(aside.locator('[data-tour]')).toBeVisible()
    await expect(aside).toBeInViewport()
    expect(await context.cookies()).toEqual([])
  })
})

test.describe('V-60 „In den Kalender“', () => {
  test('Link je kommendem Termin, .ics als Download (text/calendar), Hinweis zum Instagram-Browser', async ({
    page,
    request,
    foreignRequests,
  }) => {
    await page.goto('/de#on-tour')
    const tour = page.locator('[data-tour]')
    await expect(tour).toBeVisible()
    const items = tour.locator('li[data-tour-date]')
    const n = await items.count()
    expect(n).toBeGreaterThan(0)
    let withLink = 0
    for (let i = 0; i < n; i++) {
      const li = items.nth(i)
      const state = await li.getAttribute('data-tour-state')
      const links = li.locator('a[data-tour-calendar]')
      if (state === 'upcoming' || state === 'running') {
        await expect(links, `Termin ${i} (${state})`).toHaveCount(1)
        const id = await li.getAttribute('data-tour-date')
        await expect(links).toHaveAttribute('href', `/api/public/tour-dates/${id}.ics?locale=de`)
        // Name je Termin (spätere Termine liegen im zugeklappten Teil – dort nur das Attribut)
        await expect(links).toHaveAttribute('aria-label', /^In den Kalender: .+/)
        withLink++
      } else {
        await expect(links, `Termin ${i} (${state})`).toHaveCount(0)
      }
    }
    expect(withLink, 'Beispieltermine in der Zukunft').toBeGreaterThan(0)
    await expect(
      tour.locator('[data-tour-upcoming] a[data-tour-calendar]').first(),
    ).toHaveAccessibleName(/^In den Kalender: /)
    // Hinweis einmal unter der Tafel (nicht je Zettel)
    const hint = page.locator('aside#on-tour [data-tour-calendar-hint]')
    await expect(hint).toHaveCount(1)
    await expect(hint).toContainText('Im Browser öffnen')
    expect((await hint.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await tour.boundingBox())!.y + (await tour.boundingBox())!.height - 1,
    )

    const href = (await tour.locator('a[data-tour-calendar]').first().getAttribute('href'))!
    const res = await request.get(href)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('text/calendar; charset=utf-8')
    expect(res.headers()['content-disposition']).toMatch(
      /^attachment; filename="planet-claire-on-tour-\d{4}-\d{2}-\d{2}\.ics"$/,
    )
    expectNoCookie(res)
    const body = await res.text()
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(body).toMatch(/\r\nBEGIN:VEVENT\r\nUID:tour-\d+@[^\r]+\r\n/)
    expect(body).toMatch(/DTSTART(;TZID=Europe\/Berlin:\d{8}T\d{6}|;VALUE=DATE:\d{8})\r\n/)
    expect(body).not.toMatch(/ORGANIZER|ATTENDEE/)
    const en = await request.get(href.replace('locale=de', 'locale=en'))
    expect(await en.text()).toContain('PRODID:-//Planet Claire//on Tour//EN')
    expect(foreignRequests).toEqual([])
  })
})
