import { localizedPath } from '../../../src/lib/routes/paths'
import { expectNoSeriousViolations } from '../axe'
import { expect, test, testPayload } from '../fixtures'
import { freshPage } from '../shop/fresh'
import { refreshTattoo } from './tattooFixtures'

// P20.5 – Schalter „Anfragen offen / ausgebucht bis …“ (V-64, U-93; KONZEPT §9.1, DATENMODELL §7.1): Ist er aus, zeigen
// die Tattoo-Seiten (R11, R12) oben den ruhigen Hinweis „Gerade ausgebucht“, der Mail-Knopf der Tattoo-Anfrage weicht
// ihm (Kontakt-Block und Flash-Karten), die E-Mail-Adresse bleibt sichtbar; die Auftragsarbeiten (R10) zeigen den
// Hinweis über dem Formular, das offen bleibt. DE und EN; mit Monat „neue Anfragen ab …“, mit eigenem Hinweis dessen
// Text; ist der Monat vorbei, verschwindet alles von selbst. Voraussetzung: `db:reset --test --seed=all`.

test.describe.configure({ mode: 'serial' })

type TattooSettings = Record<string, unknown>
let snapshot: { de: TattooSettings; en: TattooSettings }

const year = new Date().getUTCFullYear() + 1
const MONTH_DE = `April ${year}`
const MONTH_EN = `April ${year}`

async function setBooking(
  data: { inquiriesOpen: boolean; bookedUntil: string | null },
  note: { de: string | null; en: string | null } = { de: null, en: null },
) {
  const payload = await testPayload()
  for (const locale of ['de', 'en'] as const) {
    await payload.updateGlobal({
      slug: 'settings',
      locale,
      data: {
        tattoo: { ...snapshot[locale], ...data, bookedNote: note[locale] },
      } as never,
      overrideAccess: true,
      // `seed`: ohne Audit und ohne die Sperre „Monat schon vorbei“ (hier gewollt, um das Ablaufen zu prüfen)
      context: { seed: true, skipAudit: true },
    })
  }
}

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

test.beforeEach(async ({ page }) => {
  await freshPage(page)
})

test('V-64 ausgebucht bis März: Hinweis auf R11/R12, Mail-Knopf weg, Adresse bleibt (DE/EN)', async ({
  page,
  request,
}) => {
  await setBooking({ inquiriesOpen: false, bookedUntil: `${year}-03` })
  await refreshTattoo(request)

  await page.goto(localizedPath('R11', 'de'))
  const notice = page.locator('[data-booking-notice="tattoo"]')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('Gerade ausgebucht')
  await expect(notice).toContainText(`Neue Anfragen nehme ich ab ${MONTH_DE} wieder an.`)
  await expect(notice.locator('[role="note"]')).toHaveCount(1)
  const contact = page.locator('[data-tattoo-contact]')
  await expect(contact.locator('[data-tattoo-mail]')).toHaveCount(0)
  await expect(contact.locator('[data-tattoo-booked]')).toContainText('Gerade ausgebucht.')
  await expect(contact.locator('[data-tattoo-email]')).toBeVisible()
  // Pflichtlinks bleiben: „Vertrag widerrufen“ im Fuß
  await expect(page.locator('[data-site-footer] [data-withdraw-link]')).toHaveCount(1)
  await expectNoSeriousViolations(page, localizedPath('R11', 'de'))

  // Flash: verfügbare Karten ohne Mail-Knopf, mit „Gerade ausgebucht“
  await page.goto(localizedPath('R12', 'de'))
  await expect(page.locator('[data-booking-notice="tattoo"]')).toBeVisible()
  await expect(page.locator('[data-flash-mail]')).toHaveCount(0)
  const available = page.locator('[data-flash-card][data-flash-status="available"]')
  expect(await available.count()).toBeGreaterThan(0)
  await expect(available.first().locator('[data-flash-booked]')).toHaveText('Gerade ausgebucht')

  await page.goto(localizedPath('R11', 'en'))
  const en = page.locator('[data-booking-notice="tattoo"]')
  await expect(en).toContainText('Fully booked right now')
  await expect(en).toContainText(`I'll take new requests again from ${MONTH_EN}.`)
  await expect(page.locator('[data-tattoo-contact] [data-tattoo-mail]')).toHaveCount(0)
})

test('V-64 Auftragsarbeiten: Hinweis über dem Formular, Formular bleibt (DE/EN)', async ({
  page,
}) => {
  await setBooking({ inquiriesOpen: false, bookedUntil: `${year}-03` })
  for (const locale of ['de', 'en'] as const) {
    await page.goto(localizedPath('R10', locale))
    const notice = page.locator('[data-booking-notice="commission"]')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(
      locale === 'de' ? 'Gerade ausgebucht' : 'Fully booked right now',
    )
    await expect(notice).toContainText(
      locale === 'de' ? 'Das Formular bleibt offen' : 'The form stays open',
    )
    const block = page.locator('[data-commission-form-block]')
    await expect(block).toBeVisible()
    // Hinweis steht vor dem Formular
    const before = await notice.evaluate(
      (n, b) => !!b && !!(n.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING),
      await block.elementHandle(),
    )
    expect(before, locale).toBe(true)
  }
})

test('V-64 eigener kurzer Hinweis ersetzt den Standardsatz; ohne Monat ohne Datum', async ({
  page,
  request,
}) => {
  await setBooking(
    { inquiriesOpen: false, bookedUntil: null },
    {
      de: 'Gerade ausgebucht – neue Anfragen ab März',
      en: 'Fully booked – new requests from March',
    },
  )
  await refreshTattoo(request)
  await page.goto(localizedPath('R16', 'de'))
  await expect(page.locator('[data-booking-notice="tattoo"] [data-booking-text]')).toHaveText(
    'Gerade ausgebucht – neue Anfragen ab März',
  )
  await page.goto(localizedPath('R16', 'en'))
  await expect(page.locator('[data-booking-notice="tattoo"] [data-booking-text]')).toHaveText(
    'Fully booked – new requests from March',
  )
})

test('V-64 Monat vorbei bzw. Schalter an: kein Hinweis, Mail-Knopf wieder da', async ({
  page,
  request,
}) => {
  await setBooking({ inquiriesOpen: false, bookedUntil: '2020-01' })
  await refreshTattoo(request)
  await page.goto(localizedPath('R11', 'de'))
  await expect(page.locator('[data-booking-notice]')).toHaveCount(0)
  await expect(page.locator('[data-tattoo-contact] [data-tattoo-mail]')).toBeVisible()
  await page.goto(localizedPath('R10', 'de'))
  await expect(page.locator('[data-booking-notice]')).toHaveCount(0)

  await setBooking({ inquiriesOpen: true, bookedUntil: null })
  await refreshTattoo(request)
  await page.goto(localizedPath('R12', 'en'))
  await expect(page.locator('[data-booking-notice]')).toHaveCount(0)
  await expect(page.locator('[data-flash-mail]').first()).toBeVisible()
})
