import { localizedPath } from '../../../src/lib/routes/paths'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { freshPage } from '../shop/fresh'
import { refreshTattoo } from '../tattoo/tattooFixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P20.5 – Verwaltung, Tattoo → Reiter „Texte“ (V-64, V-28 a; U-94: am iPad wie am Computer): Schalter „Anfragen offen“
// aus, Monat und kurzer Hinweis mit „Übersetzen“ (Mock) → Stand „Gerade ausgebucht bis einschließlich …“ und der Hinweis
// auf der Tattoo-Übersicht; „Preise stimmen – bestätigen“ mit Rückfrage → „Bestätigt am …“. iPad-Breite hoch (820 px).

test.describe.configure({ mode: 'serial' })

type TattooSettings = Record<string, unknown>
let snapshot: { de: TattooSettings; en: TattooSettings }
const year = new Date().getUTCFullYear() + 1

test.beforeAll(async () => {
  const payload = await testPayload()
  const load = async (locale: 'de' | 'en') =>
    ((
      (await payload.findGlobal({
        slug: 'settings',
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
      })) as { tattoo?: TattooSettings }
    ).tattoo ?? {}) as TattooSettings
  snapshot = { de: await load('de'), en: await load('en') }
})

test.afterAll(async ({ request }) => {
  const payload = await testPayload()
  for (const locale of ['de', 'en'] as const) {
    await payload.updateGlobal({
      slug: 'settings',
      locale,
      data: { tattoo: snapshot[locale] } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
  await refreshTattoo(request)
})

test('V-64 Schalter aus mit Monat und Hinweis DE/EN; V-28 a Preise bestätigen', async ({
  adminPage: page,
  browser,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto(adminPath('/tattoo?reiter=texte'))
  const form = page.getByTestId('area-form-tattooBooking')
  await expect(page.getByTestId('tattoo-booking-status')).toHaveAttribute('data-status', 'open')
  await expect(form.getByTestId('area-field-tattoo.bookedUntil')).toHaveCount(0)

  await form.getByTestId('area-field-tattoo.inquiriesOpen').uncheck()
  await form.getByTestId('area-field-tattoo.bookedUntil').fill(`${year}-02`)
  await form
    .getByTestId('area-field-tattoo.bookedNote.de')
    .fill('Gerade ausgebucht – neue Anfragen ab März')
  await form.getByTestId('translate-button').click()
  await expect(form.getByTestId('area-field-tattoo.bookedNote.en')).toHaveValue(
    '[EN] Gerade ausgebucht – neue Anfragen ab März',
  )
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')
  await form.getByTestId('area-save-tattooBooking').click()
  await expect(page.getByTestId('tattoo-booking-status')).toHaveAttribute('data-status', 'booked')
  await expect(page.getByTestId('tattoo-booking-status')).toContainText(`Februar ${year}`)

  // öffentlich: Hinweis auf der Tattoo-Übersicht (DE: Juttas Text, EN: die Übersetzung)
  const ctx = await browser.newContext()
  try {
    const pub = await ctx.newPage()
    await freshPage(pub)
    await pub.goto(localizedPath('R11', 'de'))
    await expect(pub.locator('[data-booking-notice] [data-booking-text]')).toHaveText(
      'Gerade ausgebucht – neue Anfragen ab März',
    )
    await pub.goto(localizedPath('R11', 'en'))
    await expect(pub.locator('[data-booking-notice] [data-booking-text]')).toHaveText(
      '[EN] Gerade ausgebucht – neue Anfragen ab März',
    )
  } finally {
    await ctx.close()
  }

  // Preise bestätigen: Rückfrage, dann Datum
  const confirm = page.getByTestId('area-form-tattooPricesConfirm')
  await expect(page.getByTestId('tattoo-prices-confirmed')).toContainText('Noch nicht bestätigt')
  await confirm.getByTestId('area-save-tattooPricesConfirm').click()
  await page.getByTestId('confirm-dialog-ok').click()
  await expect(page.getByTestId('tattoo-prices-confirmed')).toContainText(
    /Bestätigt am \d{2}\.\d{2}\.\d{4}/,
  )
})
