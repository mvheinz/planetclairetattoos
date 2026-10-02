import { LEGAL_LINKS } from '../../src/components/layout/navItems'
import { hasSamplePath, localizedPath, pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../src/lib/routes/registry'
import { expectCalm } from './calm'
import { expect, test, testPayload } from './fixtures'

// P2.14 Kontakt R20 (KONZEPT §3.13) und Gerüst „Vertrag widerrufen“ R26 (§3.16): beide DE/EN mit einer `h1` (R-010),
// R26 `noindex, follow` und ruhig (AK-DS-11), R20 ohne `pages:contact` mit Leerzustand statt 500 (DM-PAGE-01),
// Fußlinks (6 Pflichtlinks aus R-011 plus Kontakt) führen nie auf 404 (R-090).

const EMAIL = 'jutta@planetclairetattoos.com'
const WITHDRAW_H1: Record<Locale, string> = {
  de: 'Vertrag widerrufen',
  en: 'Withdraw from contract here',
}

test.describe('Kontakt R20 @smoke', () => {
  for (const locale of LOCALES) {
    test(`R-010 ${locale}: 200, eine h1, E-Mail und Instagram aus den Einstellungen, kein Formular @smoke`, async ({
      page,
    }) => {
      const path = localizedPath('R20', locale)
      expect((await page.goto(path))?.status(), path).toBe(200)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('h1')).toHaveText(locale === 'de' ? 'Kontakt' : 'Contact')
      await expect(page.locator('body')).toHaveAttribute('data-preset', 'margin')
      const main = page.locator('main')
      await expect(main.locator('[data-contact-email]')).toHaveAttribute(
        'href',
        new RegExp(`^mailto:${EMAIL.replace('.', '\\.')}`),
      )
      await expect(main.locator('[data-contact-instagram]')).toHaveAttribute(
        'href',
        'https://www.instagram.com/planet.claire.tattoos/',
      )
      await expect(main.locator('[data-contact-dm]')).toHaveAttribute(
        'href',
        'https://ig.me/m/planet.claire.tattoos',
      )
      await expect(main.locator('form')).toHaveCount(0)
      await expect(main.locator('[data-withdraw-cta]')).toHaveAttribute(
        'href',
        localizedPath('R26', locale),
      )
    })
  }
})

// Ändert `pages:contact` in der gemeinsamen Test-DB – nur im Projekt `desktop`, nacheinander; die übrigen Tests prüfen
// nur, was in beiden Zuständen gilt.
test.describe.serial('Kontakt R20 Inhalt und Leerzustand @smoke', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert gemeinsame Daten – nur einmal je Lauf')
  })

  test('Inhalt aus pages:contact (Seed P1.30) @smoke', async ({ page }) => {
    await page.goto('/de/kontakt')
    const main = page.locator('main')
    await expect(main.locator('[data-empty-state]')).toHaveCount(0)
    await expect(main.getByRole('heading', { level: 2, name: 'Schreib mir' })).toBeVisible()
    await expect(main.locator('[data-contact-email]')).toHaveAttribute(
      'href',
      `mailto:${EMAIL}?subject=Hallo%20Jutta`,
    )
    await expect(main.locator('[data-callout]').first()).toContainText('Bestellnummer')
    await page.goto('/en/contact')
    await expect(
      page.locator('main').getByRole('heading', { level: 2, name: 'Write to me' }),
    ).toBeVisible()
  })

  // Der Statuswechsel läuft wie in der Verwaltung über die REST-API des laufenden Servers: Nur dort löst der Seiten-Hook
  // die Erneuerung des Zwischenspeichers aus (ARCHITEKTUR §9.3, Statuswechsel sofort). Eine Änderung über die Local API
  // im Testprozess erreicht den Cache des Produktions-Servers nicht.
  test('DM-PAGE-01 ohne veröffentlichte Seite `contact`: Leerzustand statt 500 @smoke', async ({
    adminPage,
    browser,
  }) => {
    const payload = await testPayload()
    const { docs } = await payload.find({
      collection: 'pages',
      where: { key: { equals: 'contact' } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const doc = docs[0]
    expect(doc, 'Seed-Seite contact').toBeTruthy()
    const setStatus = async (status: 'draft' | 'published') => {
      const res = await adminPage.request.patch(`/api/pages/${doc!.id}`, {
        data: { _status: status },
      })
      expect(res.status(), `PATCH pages/${doc!.id} → ${status}`).toBe(200)
    }
    // Öffentliche Seiten in einem eigenen Kontext ohne Anmeldung.
    const visitor = await browser.newContext()
    const page = await visitor.newPage()
    await setStatus('draft')
    try {
      for (const locale of LOCALES) {
        const path = localizedPath('R20', locale)
        expect((await page.goto(path))?.status(), path).toBe(200)
        await expect(page.locator('h1')).toHaveCount(1)
        await expect(page.locator('main [data-empty-state]')).toBeVisible()
        await expect(page.locator('main [data-contact-email]')).toHaveAttribute(
          'href',
          `mailto:${EMAIL}`,
        )
      }
    } finally {
      await setStatus('published')
      // Speichern über die Verwaltung übernimmt die Seite (`seed: false`, `adoptOnSave`) – Seed-Kennzeichen zurück.
      await payload.update({
        collection: 'pages',
        id: doc!.id,
        data: { seed: true },
        overrideAccess: true,
        context: { seed: true },
      })
    }
    await page.goto('/de/kontakt')
    await expect(page.locator('main [data-empty-state]')).toHaveCount(0)
    await visitor.close()
  })
})

test.describe('Vertrag widerrufen R26 @smoke', () => {
  for (const locale of LOCALES) {
    test(`R-090 R-010 AK-DS-11 ${locale}: 200, h1, noindex/follow, Hinweis, Link zur Belehrung, E-Mail @smoke`, async ({
      page,
    }) => {
      const path = localizedPath('R26', locale)
      expect((await page.goto(path))?.status(), path).toBe(200)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('h1')).toHaveText(WITHDRAW_H1[locale])
      await expect(page.locator('body')).toHaveAttribute('data-preset', 'calm')
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      )
      await expect(page.locator('[data-withdraw-preview-notice]')).toContainText('P6')
      await expect(page.locator('[data-withdraw-policy-link]')).toHaveAttribute(
        'href',
        localizedPath('R24', locale),
      )
      await expect(page.locator('[data-withdraw-email]')).toHaveAttribute('href', `mailto:${EMAIL}`)
      await expect(page.locator('main form')).toHaveCount(0)
      await expectCalm(page, path)
    })
  }
})

test.describe('Fußlinks ohne 404 @smoke', () => {
  test('R-011 R-090: 6 Pflichtlinks plus Kontakt auf allen Live-Seiten DE/EN liefern 200 @smoke', async ({
    page,
    request,
  }) => {
    // Alle Live-Seiten nacheinander (seit P4.9 auch die Kasse R07, ohne Kasse 307 auf den Korb) – im Dev-Server langsam.
    test.slow()
    const checked = new Map<string, number>()
    // Token-Seiten (R08, R09) ohne Beispiel-Adresse prüft `privacy/p4-pages.e2e.spec.ts` mit Fixture-Bestellungen.
    const live = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))
    for (const locale of LOCALES) {
      const expected = [...LEGAL_LINKS, 'R26'].map((id) => localizedPath(id, locale))
      expect(expected).toHaveLength(7)
      for (const route of live) {
        const path = samplePath(route.id, locale)
        await page.goto(path)
        const hrefs = await page
          .locator('[data-site-footer] a[href]')
          .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
        for (const href of expected) expect(hrefs, `${path} → ${href}`).toContain(href)
        for (const href of expected) {
          if (!checked.has(href)) checked.set(href, (await request.get(href)).status())
        }
      }
    }
    expect(checked.size).toBe(14)
    for (const [href, status] of checked) expect(status, href).toBe(200)
  })
})
