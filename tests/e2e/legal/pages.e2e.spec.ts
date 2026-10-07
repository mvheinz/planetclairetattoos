import { shortLinks } from '../../../src/lib/routes/registry'
import { hasSamplePath, localizedPath, pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../../src/lib/routes/registry'
import { serverURL } from '../../helpers/adminEnv'
import { adminCall, adminLogin } from '../adminApi'
import { expect, test, testPayload } from '../fixtures'
import { expectWarrantyNotice } from './warranty'

// P6.5 Rechtsseiten R21–R24, R27, Kontakt R20 und Kurz-URLs (KONZEPT §3.13/§3.14, RECHT R-002, R-010, R-015, R-020,
// R-021, R-023, R-049): Grund-Seed mit Platzhalter-Fassungen (nur Deutsch).

const LEGAL_ROUTES = ['R21', 'R22', 'R23', 'R24', 'R25', 'R27', 'R20'] as const
const BANNER_ROUTES = ['R21', 'R22', 'R23', 'R24', 'R25'] as const
const BANNER: Record<Locale, string> = {
  de: 'PLATZHALTER – nicht rechtsverbindlich',
  en: 'PLACEHOLDER – not legally binding',
}

test.describe('Rechtsseiten P6.5 @smoke', () => {
  test.describe('ohne JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    for (const locale of LOCALES) {
      test(`R-010 ${locale}: jede Rechtsroute 200, genau eine h1, Textkörper ohne JavaScript sichtbar @smoke`, async ({
        page,
      }) => {
        for (const id of LEGAL_ROUTES) {
          const path = localizedPath(id, locale)
          expect((await page.goto(path))?.status(), path).toBe(200)
          await expect(page.locator('h1'), path).toHaveCount(1)
          await expect(page.locator('h1'), path).toBeVisible()
          const body =
            id === 'R27'
              ? page.locator('[data-conformity-list], [data-conformity-empty]').first()
              : id === 'R20'
                ? page.locator('main [data-contact-email]').first()
                : page.locator('[data-legal-text]').first()
          await expect(body, path).toBeVisible()
          expect(await page.content(), `${path}: rohes Token`).not.toContain('{{')
        }
      })
    }
  })

  test('R-010 Kurz-URLs → 308 auf das DE-Ziel; /en/<de-slug> → 308 auf den EN-Slug @smoke', async ({
    request,
  }) => {
    expect(shortLinks.map((s) => s.path).sort()).toEqual(
      [
        '/agb',
        '/datenschutz',
        '/impressum',
        '/versand',
        '/vertrag-widerrufen',
        '/widerruf',
        '/widerrufsbelehrung',
      ].sort(),
    )
    for (const s of shortLinks) {
      const res = await request.get(`${serverURL}${s.path}`, { maxRedirects: 0 })
      expect(res.status(), s.path).toBe(308)
      expect(new URL(res.headers()['location']!, serverURL).pathname, s.path).toBe(
        localizedPath(s.routeId, 'de'),
      )
      // Ziel erreichbar
      expect((await request.get(`${serverURL}${localizedPath(s.routeId, 'de')}`)).status()).toBe(
        200,
      )
    }
    for (const id of [...BANNER_ROUTES, 'R26', 'R27', 'R20']) {
      const de = localizedPath(id, 'de')
      const en = localizedPath(id, 'en')
      if (de.replace(/^\/de/, '') === en.replace(/^\/en/, '')) continue
      const from = `/en${de.replace(/^\/de/, '')}`
      const res = await request.get(`${serverURL}${from}`, { maxRedirects: 0 })
      expect(res.status(), from).toBe(308)
      expect(new URL(res.headers()['location']!, serverURL).pathname, from).toBe(en)
    }
  })

  for (const locale of LOCALES) {
    test(`R-002 ${locale}: jede Rechtsseite mit Platzhalter zeigt das Band oben, „Stand“ und PDF (außer Impressum) @smoke`, async ({
      page,
    }) => {
      for (const id of BANNER_ROUTES) {
        const path = localizedPath(id, locale)
        await page.goto(path)
        const banner = page.locator('[data-placeholder-banner]')
        await expect(banner, path).toHaveCount(1)
        await expect(banner, path).toHaveText(BANNER[locale])
        const bannerFirst = await page.evaluate(() => {
          const b = document.querySelector('[data-placeholder-banner]')
          const h = document.querySelector('main h1')
          return !!b && !!h && !!(b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)
        })
        expect(bannerFirst, `${path}: Band über der h1`).toBe(true)
        await expect(page.locator('[data-legal-as-of]').first(), path).toBeVisible()
        // P12.11: ausformulierte Platzhalter-Fassung (Gliederung mit Überschriften, kein „Text folgt …“ mehr)
        await expect(page.locator('[data-legal-text] h2').first(), path).toBeVisible()
        await expect(page.locator('[data-legal-text]').first(), path).not.toContainText(
          'Text folgt von der Kanzlei.',
        )
        const pdfs = page.locator('main [data-legal-pdf]')
        if (id === 'R21') {
          await expect(pdfs, path).toHaveCount(0)
        } else {
          await expect(pdfs.first(), path).toBeVisible()
          const href = await pdfs.first().getAttribute('href')
          const res = await page.request.get(href!)
          expect(res.status(), href!).toBe(200)
          expect(res.headers()['content-type']).toBe('application/pdf')
        }
      }
    })
  }

  test('R-015 /en/terms mit EN-Fassung: englischer Text mit Übersetzungs-Hinweis, kein „Only available in German“ @smoke', async ({
    page,
  }) => {
    await page.goto('/en/terms')
    await expect(page.getByText('Only available in German.')).toHaveCount(0)
    await expect(page.locator('[data-translation-disclaimer]')).toHaveCount(1)
    await expect(page.locator('[data-legal-text="agb"] h2').first()).toHaveText('Scope')
    await expect(page.locator('[data-legal-text="agb"] [lang="de"]')).toHaveCount(0)
  })

  test('R24 Belehrung mit {{withdrawalUrl}}, Muster-Formular als HTML und PDF, Link „Vertrag widerrufen“ (R-095) @smoke', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      await page.goto(localizedPath('R24', locale))
      // EN-Fassung (seit P12.11 vorhanden, U-00) löst {{withdrawalUrl}} zur englischen Adresse auf (R-095)
      await expect(page.locator('[data-legal-text="widerrufsbelehrung"]')).toContainText(
        locale === 'de' ? '/de/vertrag-widerrufen' : '/en/withdraw-from-contract',
      )
      await expect(page.locator('[data-legal-text="widerrufsformular"]')).toBeVisible()
      await expect(page.locator('[data-legal-pdf="widerrufsformular"]')).toHaveAttribute(
        'href',
        `/api/legal/widerrufsformular.pdf?locale=${locale}`,
      )
      await expect(page.locator('main [data-withdraw-cta]')).toHaveAttribute(
        'href',
        localizedPath('R26', locale),
      )
    }
  })

  test('KANZLEI-BRIEFING §11.10 Anker der Datenschutzerklärung und Platz für die Auftragsverarbeiter-Tabelle @smoke', async ({
    page,
  }) => {
    await page.goto('/de/datenschutz')
    for (const id of ['verantwortliche', 'hosting', 'bestellung', 'empfaenger', 'beschwerde']) {
      await expect(page.locator(`main h2#${id}`), id).toHaveCount(1)
    }
    await expect(page.locator('#auftragsverarbeiter-tabelle')).toHaveCount(1)
  })

  test('R-049 WarrantyNotice steht auf R25 (DE/EN) @smoke', async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(localizedPath('R25', locale))
      await expectWarrantyNotice(page, locale)
    }
  })

  test('R-023 Kontaktseite: E-Mail als Text und mailto, „Adresse kopieren“, Instagram, kein Formular, kein iframe @smoke', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      await page.goto(localizedPath('R20', locale))
      const main = page.locator('main')
      const email = main.locator('[data-contact-email]').first()
      await expect(email).toHaveAttribute('href', /^mailto:/)
      await expect(email).toContainText('@')
      const copy = main.locator('[data-contact-copy]').first()
      await expect(copy).toBeVisible()
      await expect(copy).toHaveText(locale === 'de' ? 'Adresse kopieren' : 'Copy address')
      await expect(main.locator('[data-contact-instagram]').first()).toBeVisible()
      await expect(main.locator('[data-contact-dm]').first()).toBeVisible()
      await expect(page.locator('form')).toHaveCount(0)
      await expect(page.locator('iframe')).toHaveCount(0)
      // Nur der Bezirk, keine Straße
      const studio = main.locator('[data-contact-studio]')
      if (await studio.count()) await expect(studio.first()).toContainText(/Berlin-/)
    }
  })
})

// Ändert `settings.business` in der gemeinsamen Test-DB über die Verwaltung (Cache-Tags im Server) – nur im Projekt
// `desktop`, danach wiederhergestellt.
test.describe.serial('Stammdaten im Impressum und Telefonnummer @smoke', () => {
  const PHONE = '+49 30 5550123'
  const TAX = '27/815/40011'
  let original: Record<string, string | null> = {}

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert gemeinsame Daten – nur einmal je Lauf')
  })

  test.beforeAll(async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    const payload = await testPayload()
    const settings = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as {
      business?: Record<string, string | null>
    }
    original = {
      'business.phone': settings.business?.phone ?? null,
      'business.taxNumber': settings.business?.taxNumber ?? null,
    }
    const admin = await adminLogin()
    try {
      await adminCall(request, admin, 'post', '/globals/settings/section', {
        section: 'business',
        values: { 'business.phone': PHONE, 'business.taxNumber': TAX },
      })
    } finally {
      await admin.release()
    }
  })

  test.afterAll(async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    const admin = await adminLogin()
    try {
      await adminCall(request, admin, 'post', '/globals/settings/section', {
        section: 'business',
        values: original,
      })
    } finally {
      await admin.release()
    }
  })

  test('R-020 Impressum enthält alle gesetzten Stammdaten und keine Steuernummer @smoke', async ({
    page,
  }) => {
    const payload = await testPayload()
    const settings = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as {
      business: Record<string, string | null>
    }
    const b = settings.business
    for (const locale of LOCALES) {
      // Einstellungen erneuern die Seiten per stale-while-revalidate (ARCHITEKTUR §9.3): neu laden, bis sie da sind.
      await expect(async () => {
        await page.goto(localizedPath('R21', locale))
        await expect(page.locator('[data-legal-text="impressum"]')).toContainText(PHONE, {
          timeout: 1000,
        })
      }).toPass({ timeout: 30_000 })
      const text = page.locator('[data-legal-text="impressum"]')
      for (const key of ['legalName', 'street', 'postalCode', 'city', 'email', 'phone']) {
        if (b[key]) await expect(text, `${locale} ${key}`).toContainText(b[key]!)
      }
      expect(await page.content(), 'Steuernummer').not.toContain(TAX)
    }
  })

  test('R-021 Telefonnummer nur in Impressum und Widerrufsbelehrung (DE/EN), auf keiner anderen Registry-Route @smoke', async ({
    page,
  }) => {
    test.slow()
    const allowed = new Set(
      ['R21', 'R24'].flatMap((id) => LOCALES.map((l) => localizedPath(id, l))),
    )
    for (const path of allowed) {
      await expect(async () => {
        await page.goto(path)
        await expect(page.locator('main'), path).toContainText(PHONE, { timeout: 1000 })
      }).toPass({ timeout: 30_000 })
    }
    const others = pageRoutes()
      .filter((r) => r.status === 'live' && hasSamplePath(r))
      .flatMap((r) => LOCALES.map((l) => samplePath(r.id, l)))
      .filter((p) => !allowed.has(p))
    expect(others.length).toBeGreaterThan(10)
    for (const path of others) {
      await page.goto(path)
      expect(await page.content(), path).not.toContain('5550123')
    }
  })
})
