import { expect, test, testPayload } from './fixtures'
import { refreshTattoo } from './tattoo/tattooFixtures'
import { splitTourDates, tourState } from '../../src/lib/tour/dates'
import type { Locale } from '../../src/lib/routes/registry'

// P12.8 (U-20, KONZEPT §3.1a) und P13.3 (U-42) – „Planet Claire on Tour“ auf der Startseite mit dem Beispielbestand
// (SEED-SPEC §12.5): oben rechts Koko (`data-slot="chairwoman"`) und direkt rechts daneben der schmale Schaukasten (ab 600 px
// nebeneinander, ab 1100 px neben dem Titel, mobil untereinander). Auf der Tafel nur die nächsten drei Termine (kompakt:
// Datum, Name, eine Zeile); weitere und vergangene Termine in einem `<details>`; abgesagte durchgestrichen mit Text; darunter
// der Instagram-Hinweis mit gezeichnetem Zeichen; keine Karte und keine Anfrage an Dritte. Erwartungen aus den Daten und der
// aktuellen Uhr berechnet (der Beispielbestand liegt relativ zu `SEED_NOW`).

// Wie `tourNow()` im Server: in der Testumgebung gilt `SEED_NOW` (sonst wandert der Beispielbestand mit der echten Uhr).
const tourNow = () =>
  process.env.APP_ENV === 'test' && process.env.SEED_NOW
    ? new Date(process.env.SEED_NOW)
    : new Date()

type Item = {
  id: number
  name: string
  startsAt: string
  endsAt: string
  status: 'planned' | 'cancelled' | 'past'
}

async function seededDates(locale: Locale): Promise<Item[]> {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'tour-dates',
    where: { seed: { equals: true } },
    locale,
    limit: 100,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs.map((d) => ({
    id: d.id,
    name: d.name,
    startsAt: d.startsAt,
    endsAt: d.endsAt ?? d.startsAt,
    status: d.status,
  }))
}

test.beforeAll(async ({ request }) => {
  await refreshTattoo(request)
})

const ON_BOARD = 3

for (const locale of ['de', 'en'] as const) {
  test(`AK-3-13 AK-SEED-23 U-42 /${locale}: Koko und schmaler Schaukasten nebeneinander – nächste drei Termine kompakt, weitere/vergangene eingeklappt, abgesagte durchgestrichen, Instagram darunter`, async ({
    page,
    foreignRequests,
  }) => {
    const items = await seededDates(locale)
    expect(items).toHaveLength(8)
    const { upcoming, past } = splitTourDates(items, tourNow())
    const board = upcoming.slice(0, ON_BOARD)
    const later = upcoming.slice(ON_BOARD)

    const res = await page.goto(`/${locale}`)
    expect(res?.status()).toBe(200)
    const aside = page.locator('[data-home-aside]')
    await expect(aside).toHaveCount(1)

    // Koko links, der Schaukasten rechts daneben (ab 600 px) bzw. darunter (Handy)
    const slot = aside.locator('[data-slot="chairwoman"]')
    await expect(slot).toHaveCount(1)
    expect(await slot.evaluate((el) => el.childElementCount)).toBeGreaterThan(0)
    const kokoBox = (await slot.boundingBox())!
    const tour = aside.locator('[data-tour]')
    const tourBox = (await tour.boundingBox())!
    const vw = page.viewportSize()?.width ?? 0
    if (vw >= 600) {
      expect(tourBox.x).toBeGreaterThanOrEqual(kokoBox.x + kokoBox.width - 1) // rechts neben Koko
      expect(tourBox.y).toBeLessThan(kokoBox.y + kokoBox.height) // auf gleicher Höhe
      expect(tourBox.width).toBeLessThanOrEqual(20 * 16) // schmal
    } else {
      expect(tourBox.y).toBeGreaterThanOrEqual(kokoBox.y + kokoBox.height - 1) // darunter
    }

    // Platz: neben dem Titel (≥ 1100 px; beides über dem Falz) bzw. unter dem Kopf der Seite
    const heroBox = (await page.locator('[data-home-hero]').boundingBox())!
    const asideBox = (await aside.boundingBox())!
    if (vw >= 1100) {
      expect(asideBox.x).toBeGreaterThanOrEqual(heroBox.x + heroBox.width - 1)
      expect(kokoBox.y + kokoBox.height).toBeLessThanOrEqual(page.viewportSize()!.height)
      const firstNote = tour.locator('[data-tour-upcoming] > li').first()
      if (board.length)
        expect((await firstNote.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height)
      // Stationen laufen darunter über die volle Breite
      const stations = (await page.locator('[data-home-stations]').boundingBox())!
      expect(stations.y).toBeGreaterThanOrEqual(asideBox.y + asideBox.height - 1)
    } else {
      expect(asideBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height - 1)
      expect(asideBox.x).toBeLessThan(heroBox.x + heroBox.width)
    }

    // U-43: Überschrift in Spectral
    expect(
      await tour.locator('#tour-heading').evaluate((el) => getComputedStyle(el).fontFamily),
    ).toMatch(/spectral/i)

    // auf der Tafel: die nächsten drei kommenden Termine in der Reihenfolge der Daten
    const list = tour.locator('[data-tour-upcoming] > li')
    await expect(list).toHaveCount(board.length)
    expect(
      await list.evaluateAll((els) => els.map((e) => e.getAttribute('data-tour-date'))),
    ).toEqual(board.map((i) => String(i.id)))
    for (const i of upcoming) {
      const li = tour.locator(`[data-tour-date="${i.id}"]`)
      await expect(li).toHaveCount(1)
      await expect(li).toHaveAttribute('data-tour-state', tourState(i, tourNow()))
      if (i.status === 'cancelled') {
        await expect(li).toHaveAttribute('data-cancelled', '')
        await expect(li.locator('[data-tour-badge="cancelled"]')).toHaveText(
          locale === 'de' ? 'abgesagt' : 'cancelled',
        )
        await expect(li.getByRole('heading').locator('span').first()).toHaveCSS(
          'text-decoration-line',
          'line-through',
        )
      }
    }

    // kompakt: der erste Zettel trägt den Reiter „als Nächstes“ und einen größeren Tag; jeder Zettel ist niedrig
    await expect(tour.locator('[data-tour-next]')).toHaveCount(board.length > 0 ? 1 : 0)
    if (board.length > 0) {
      await expect(list.first()).toHaveAttribute('data-tour-next', '')
      // Petrol-Datumsblock des nächsten Termins ist breiter als die der anderen Zettel
      const block = (k: number) =>
        list.nth(k).locator('div[aria-hidden="true"]').first().boundingBox()
      if (board.length > 1) expect((await block(0))!.width).toBeGreaterThan((await block(1))!.width)
      for (let k = 0; k < board.length; k++) {
        const b = (await list.nth(k).boundingBox())!
        // 10 rem: Namen in Spectral mindestens 16 px (LG-03) – ein langer englischer Name bricht in der schmalen Spalte um
        expect(b.height, `Zettel ${k}`).toBeLessThan(10 * 16)
        // eine Zeile unter dem Namen (Ort · Uhrzeit), das volle Datum für Screenreader
        await expect(list.nth(k).locator('p')).toHaveCount(1)
        await expect(list.nth(k).locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}/)
      }
      const tafel = (await tour.boundingBox())!
      expect(tafel.height).toBeLessThan(32 * 16) // drei Zettel + Aufklapper, keine lange Liste
    }

    // weitere und vergangene Termine: eingeklappt, Anzahl in der Beschriftung, nach dem Aufklappen sichtbar
    const details = tour.locator('details[data-tour-more]')
    const more = later.length + past.length
    if (more > 0) {
      await expect(details).toHaveCount(1)
      expect(await details.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false)
      await expect(details.locator('summary')).toContainText(`(${more})`)
      await expect(details.locator('li').first()).toBeHidden()
      await details.locator('summary').click()
      await expect(details.locator('[data-tour-later] > li')).toHaveCount(later.length)
      await expect(details.locator('[data-tour-past] > li')).toHaveCount(past.length)
      await expect(details.locator('li').first()).toBeVisible()
    } else {
      await expect(details).toHaveCount(0)
    }

    // Instagram-Hinweis (U-42): unter dem Schaukasten, gezeichnetes Zeichen, Profil-Link ohne Verweis-Header
    const ig = aside.locator('[data-home-instagram] a')
    await expect(ig).toHaveCount(1)
    await expect(ig).toHaveAttribute('href', 'https://www.instagram.com/planet.claire.tattoos/')
    await expect(ig).toHaveAttribute('rel', 'me noopener noreferrer')
    await expect(ig).toContainText('@planet.claire.tattoos')
    await expect(ig).toHaveAccessibleName(locale === 'de' ? /auf Instagram/ : /on Instagram/)
    await expect(ig.locator('svg[data-instagram-glyph]')).toHaveCount(1)
    await expect(ig.locator('img')).toHaveCount(0)
    const igBox = (await ig.boundingBox())!
    const boardBox = (await tour.boundingBox())!
    expect(igBox.y).toBeGreaterThanOrEqual(boardBox.y + boardBox.height - 1)
    expect(igBox.height).toBeGreaterThanOrEqual(44)

    // keine Karte, keine Einbettung, nichts bei Dritten
    await expect(aside.locator('iframe, embed, object, [data-map], img[src*="maps"]')).toHaveCount(
      0,
    )
    expect(foreignRequests).toEqual([])
  })
}

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('AK-3-13 weitere und vergangene Termine lassen sich ohne JavaScript aufklappen', async ({
    page,
  }) => {
    const items = await seededDates('de')
    const { past } = splitTourDates(items, tourNow())
    expect(past.length, 'Beispieltermine in der Vergangenheit').toBeGreaterThan(0)
    await page.goto('/de')
    const details = page.locator('[data-tour] details[data-tour-more]')
    await expect(details.locator('li').first()).toBeHidden()
    await details.locator('summary').click()
    await expect(details.locator('li').first()).toBeVisible()
  })
})
