import { expect, test, testPayload } from './fixtures'
import { refreshTattoo } from './tattoo/tattooFixtures'
import { splitTourDates, tourState } from '../../src/lib/tour/dates'
import type { Locale } from '../../src/lib/routes/registry'

// P12.8 (U-20, KONZEPT §3.1a) – „Planet Claire on Tour“ auf der Startseite mit dem Beispielbestand (SEED-SPEC §12.5): rechte
// Spalte neben dem Kopf (ab 1100 px) bzw. darunter (mobil), oben der benannte Bereich mit Koko
// (`data-slot="chairwoman"`), kommende Termine oben, vergangene in `<details>` eingeklappt, abgesagte durchgestrichen mit
// Text, keine Karte und keine Anfrage an Dritte. Erwartungen aus den Daten und der aktuellen Uhr berechnet (der
// Beispielbestand liegt relativ zu `SEED_NOW`, der Server rechnet mit der echten Zeit).

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

for (const locale of ['de', 'en'] as const) {
  test(`AK-3-13 AK-SEED-23 /${locale}: rechte Spalte mit Platz für Koko und Terminen – kommende oben, vergangene eingeklappt, abgesagte durchgestrichen`, async ({
    page,
    foreignRequests,
  }) => {
    const items = await seededDates(locale)
    expect(items).toHaveLength(8)
    const { upcoming, past } = splitTourDates(items, tourNow())

    const res = await page.goto(`/${locale}`)
    expect(res?.status()).toBe(200)
    const aside = page.locator('[data-home-aside]')
    await expect(aside).toHaveCount(1)

    // benannter Bereich mit Koko, der Vorsitzenden (P12.6) – oberhalb der Termine
    const slot = aside.locator('[data-slot="chairwoman"]')
    await expect(slot).toHaveCount(1)
    expect(await slot.evaluate((el) => el.childElementCount)).toBeGreaterThan(0)
    const slotBox = await slot.boundingBox()
    const tour = aside.locator('[data-tour]')
    const tourBox = await tour.boundingBox()
    expect(tourBox).not.toBeNull()
    if (slotBox) expect(slotBox.y).toBeLessThanOrEqual(tourBox!.y)

    // Platz: rechts neben dem Kopf (Desktop) bzw. darunter (mobil)
    const heroBox = (await page.locator('[data-home-hero]').boundingBox())!
    const asideBox = (await aside.boundingBox())!
    const wide = (page.viewportSize()?.width ?? 0) >= 1100
    if (wide) {
      expect(asideBox.x).toBeGreaterThanOrEqual(heroBox.x + heroBox.width - 1)
    } else {
      expect(asideBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height - 1)
      expect(asideBox.x).toBeLessThan(heroBox.x + heroBox.width)
    }

    // kommende Termine oben, in der Reihenfolge der Daten
    const list = tour.locator('[data-tour-upcoming] > li')
    await expect(list).toHaveCount(upcoming.length)
    expect(
      await list.evaluateAll((els) => els.map((e) => e.getAttribute('data-tour-date'))),
    ).toEqual(upcoming.map((i) => String(i.id)))
    for (const i of upcoming) {
      const li = tour.locator(`[data-tour-date="${i.id}"]`)
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

    // Schaukasten (U-20): Tafel mit Zetteln; der erste kommende Termin ist das Plakat „als Nächstes“, alle anderen kleine Zettel
    await expect(tour.locator('[data-tour-next]')).toHaveCount(upcoming.length > 0 ? 1 : 0)
    if (upcoming.length > 0) {
      await expect(list.first()).toHaveAttribute('data-tour-next', '')
      const heroDay = await list
        .first()
        .locator('div[aria-hidden="true"] span')
        .first()
        .boundingBox()
      expect(heroDay).not.toBeNull()
      if (upcoming.length > 1) {
        const otherDay = await list
          .nth(1)
          .locator('div[aria-hidden="true"] span')
          .first()
          .boundingBox()
        expect(heroDay!.height).toBeGreaterThan(otherDay!.height)
      }
      // kompakt: ein kleiner Zettel ist nicht höher als 14 rem
      for (let k = 1; k < upcoming.length; k++) {
        const b = await list.nth(k).boundingBox()
        expect(b!.height).toBeLessThan(14 * 16)
      }
    }

    // vergangene: eingeklappt, Anzahl in der Beschriftung, nach dem Aufklappen sichtbar
    const details = tour.locator('details[data-tour-past]')
    if (past.length > 0) {
      await expect(details).toHaveCount(1)
      expect(await details.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false)
      await expect(details.locator('summary')).toContainText(`(${past.length})`)
      await expect(details.locator('li').first()).toBeHidden()
      await details.locator('summary').click()
      await expect(details.locator('li')).toHaveCount(past.length)
      await expect(details.locator('li').first()).toBeVisible()
    } else {
      await expect(details).toHaveCount(0)
    }

    // keine Karte, keine Einbettung, nichts bei Dritten
    await expect(aside.locator('iframe, embed, object, [data-map], img[src*="maps"]')).toHaveCount(
      0,
    )
    expect(foreignRequests).toEqual([])
  })
}

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('AK-3-13 vergangene Termine lassen sich ohne JavaScript aufklappen', async ({ page }) => {
    const items = await seededDates('de')
    const { past } = splitTourDates(items, tourNow())
    expect(past.length, 'Beispieltermine in der Vergangenheit').toBeGreaterThan(0)
    await page.goto('/de')
    const details = page.locator('[data-tour] details[data-tour-past]')
    await expect(details.locator('li').first()).toBeHidden()
    await details.locator('summary').click()
    await expect(details.locator('li').first()).toBeVisible()
  })
})
