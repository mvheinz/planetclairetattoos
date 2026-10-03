import { serverURL } from '../../helpers/adminEnv'
import { expect, test, testPayload } from '../fixtures'
import { refreshTattoo } from './tattooFixtures'

// P7.3 – AK-9-03 (KONZEPT §9.5, R-171, DM-OFF-01): Ein Angebot, dessen `endsAt` erreicht ist, verschwindet nach dem Lauf
// von `revalidateEndedOffers` von R11, R13 und der Startseite. Angelegt wird ein kurz laufendes Angebot über die Local
// API (Ende in wenigen Sekunden); die statischen Seiten zeigen es zuerst, nach dem Ende ruft der Test
// `POST /api/cron/run/revalidateEndedOffers` mit `CRON_SECRET` auf – danach ist es auf allen drei Seiten weg.

const TITLE = 'Flash-Day Testlauf AK-9-03'
let offerId: number | null = null

test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.afterAll(async ({ request }) => {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tattoo-offers',
    where: { title: { equals: TITLE } },
    overrideAccess: true,
    context: { seed: true },
  })
  await refreshTattoo(request)
})

test('AK-9-03 abgelaufenes Angebot ist nach dem Task-Lauf auf R11, R13 und der Startseite nicht sichtbar', async ({
  page,
  request,
}) => {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tattoo-offers',
    where: { title: { equals: TITLE } },
    overrideAccess: true,
    context: { seed: true },
  })
  const endsAt = new Date(Date.now() + 20_000)
  const offer = await payload.create({
    collection: 'tattoo-offers',
    data: {
      type: 'flash_day',
      title: TITLE,
      description: 'Kleine Motive, großer Spaß – nur ganz kurz.',
      startsAt: new Date(Date.now() - 3_600_000).toISOString(),
      endsAt: endsAt.toISOString(),
      published: true,
      seed: true,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  offerId = offer.id as number
  await refreshTattoo(request)

  const card = `[data-offer-card="${offerId}"]`
  const pages = ['/de/tattoo', '/de/tattoo/angebote', '/de']
  await page.goto('/de/tattoo/angebote')
  await expect(page.locator(card)).toBeVisible()
  await expect(page.locator(`${card} [data-offer-status]`)).toHaveText('läuft gerade')
  await expect(page.locator(`${card} [data-offer-mail]`)).toHaveAttribute(
    'href',
    /subject=Anfrage%20Flash-Day%20Testlauf%20AK-9-03%20am%20\d{2}\.\d{2}\.\d{4}&/,
  )
  await page.goto('/de/tattoo')
  await expect(page.locator(`[data-tattoo-offer-teaser] ${card}`)).toBeVisible()
  await page.goto('/de')
  await expect(page.locator(`[data-home-station="tattoo"] ${card}`)).toBeVisible()

  // Ende abwarten; die statische Seite kennt den Wechsel erst nach dem Task-Lauf.
  await expect.poll(() => Date.now(), { timeout: 40_000 }).toBeGreaterThan(endsAt.getTime() + 500)
  const run = await request.post(`${serverURL}/api/cron/run/revalidateEndedOffers`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
  })
  expect(run.status(), await run.text()).toBe(200)

  for (const url of pages) {
    await expect
      .poll(
        async () => {
          const res = await request.get(`${serverURL}${url}`)
          return (await res.text()).includes(`data-offer-card="${offerId}"`)
        },
        { timeout: 20_000, message: url },
      )
      .toBe(false)
  }
  // Auch die API liefert das abgelaufene Angebot nicht mehr (R-171).
  const api = await request.get(`${serverURL}/api/tattoo-offers/${offerId}`)
  expect(api.status()).toBe(404)
})
