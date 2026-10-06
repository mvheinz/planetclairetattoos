import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { TEST_BUSINESS, withBusiness } from '../../int/helpers/invoices'
import { expect, test, testPayload } from '../fixtures'
import { refreshTattoo } from './tattooFixtures'

// P7.15 – Rechtliche Prüfungen Tattoo (KONZEPT §9, E-51): Auf allen Tattoo-Routen R11–R18 (DE/EN) gibt es kein „In den
// Korb“, kein `<form>` und keinen Stripe-Request (AK-9-01, R-170); die Straße aus den Stammdaten erscheint nicht (AK-9-05,
// V-31); Instagram nur als einfacher Link mit `rel="noopener noreferrer"`, ohne Einbettung und ohne Anfrage an Instagram
// (R-139, V-05). Für AK-9-05 steht vorübergehend eine echte Straße in den Stammdaten (danach wiederhergestellt).

const TATTOO = ['R11', 'R12', 'R14', 'R15', 'R16', 'R17', 'R18'] as const
const PAGES = TATTOO.flatMap((id) => LOCALES.map((locale) => ({ id, locale })))

test.describe.configure({ mode: 'serial' })

let restore: (() => Promise<void>) | undefined

test.beforeAll(async ({ request }) => {
  restore = await withBusiness(await testPayload(), { street: TEST_BUSINESS.street })
  await refreshTattoo(request)
})

test.afterAll(async ({ request }) => {
  await restore?.()
  await refreshTattoo(request)
})

for (const { id, locale } of PAGES) {
  const url = localizedPath(id, locale)

  test(`AK-9-01 R-170 ${id} ${locale}: kein „In den Korb“, kein Formular, kein Stripe-Request (${url})`, async ({
    page,
    foreignRequests,
  }) => {
    const stripe: string[] = []
    page.on('request', (r) => {
      if (/stripe\.(com|network)/i.test(r.url())) stripe.push(r.url())
    })
    const res = await page.goto(url)
    expect(res?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('form')).toHaveCount(0)
    await expect(page.locator('[data-behavior~="add-to-cart"], [data-add-to-cart]')).toHaveCount(0)
    await expect(
      page.getByRole('button', {
        name: /In den Korb|Add to (cart|basket)|Zahlungspflichtig bestellen|Order with obligation to pay/i,
      }),
    ).toHaveCount(0)
    expect(stripe).toEqual([])
    expect(foreignRequests).toEqual([])
  })

  test(`AK-9-05 R-139 ${id} ${locale}: keine Straße aus den Stammdaten, Instagram nur als Link`, async ({
    page,
    foreignRequests,
  }) => {
    await page.goto(url)
    const body = await page.locator('body').innerText()
    expect(body).not.toContain(TEST_BUSINESS.street)
    expect(await page.content()).not.toContain(TEST_BUSINESS.street)
    // keine Einbettung (V-05)
    await expect(
      page.locator('iframe, embed, object, blockquote.instagram-media, script[src*="instagram"]'),
    ).toHaveCount(0)
    const links = page.locator('a[href*="instagram.com"], a[href*="ig.me"]')
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      const rel = (await links.nth(i).getAttribute('rel')) ?? ''
      expect(rel, (await links.nth(i).getAttribute('href')) ?? '').toContain('noopener')
      expect(rel).toContain('noreferrer')
    }
    expect(foreignRequests.filter((u) => /instagram|cdninstagram|fbcdn/i.test(u))).toEqual([])
  })
}
