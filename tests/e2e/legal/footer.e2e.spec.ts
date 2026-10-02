import type { Page } from '@playwright/test'

import { LEGAL_LINKS } from '../../../src/components/layout/navItems'
import { hasSamplePath, localizedPath, pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../../src/lib/routes/registry'
import { holdConformityData } from '../../helpers/adminSessionLock'
import { expect, test, testPayload } from '../fixtures'
import { cleanup, fixtureOrder, submittedCheckout } from '../order/orderFixtures'

// P2.10/P6.6 Fußbereich (DESIGN KO-04, KONZEPT §3.0.3): Pflichtlinks (R-011), „Vertrag widerrufen“ als Knopf-Link
// (R-090, AK-3-11, AK-DS-09) auf jeder Registry-Route DE/EN – inkl. Kasse, Danke und Bestellstatus (Fixture-Bestellung),
// 404 und 500 –, bei 390×844 und 1440×900, mit `reducedMotion` `reduce` und `no-preference`; Sprachumschalter.

const WITHDRAW: Record<Locale, string> = {
  de: 'Vertrag widerrufen',
  en: 'Withdraw from contract here',
}

// Token-Seiten (R08, R09) ohne Beispiel-Adresse: eigener Block mit Fixture-Bestellung (unten).
const LIVE_PAGES = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const

/** Link muss an seiner Mittelpunkt-Position selbst getroffen werden (nichts darüber, R-011/AK-DS-09). */
async function hitTest(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) return { found: false, hit: false, height: 0 }
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    const r = el.getBoundingClientRect()
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { found: true, hit: !!at && (at === el || el.contains(at)), height: r.height }
  }, selector)
}

/** Alle 6 Pflichtlinks bei beiden Größen und beiden Bewegungs-Einstellungen sichtbar, getroffen, Knopf ≥ 44 px. */
async function expectFooterLinks(page: Page, locale: Locale, label: string) {
  const expected = [
    ...LEGAL_LINKS.filter((id) => id !== 'R20').map((id) => localizedPath(id, locale)),
    localizedPath('R26', locale),
  ]
  expect(expected).toHaveLength(6)
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      await page.emulateMedia({ reducedMotion })
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      )
      const where = `${label} ${viewport.width} ${reducedMotion}`
      const footer = page.locator('[data-site-footer]')
      for (const href of expected) {
        const link = footer.locator(`a[href="${href}"]`).first()
        await expect(link, `${where} ${href}`).toBeVisible()
        const isWithdraw = href === localizedPath('R26', locale)
        const sel = isWithdraw
          ? '[data-site-footer] [data-withdraw-link]'
          : `[data-site-footer] a[href="${href}"]`
        const hit = await hitTest(page, sel)
        expect(hit, `${where} ${href}`).toMatchObject({ found: true, hit: true })
        expect(hit.height, `${where} ${href} Höhe`).toBeGreaterThanOrEqual(44)
      }
      await expect(footer.locator('[data-withdraw-link]')).toHaveText(WITHDRAW[locale])
      // Kontakt steht zusätzlich im Pflichtlink-Block.
      await expect(
        footer.locator(`[data-legal-link="R20"][href="${localizedPath('R20', locale)}"]`),
      ).toBeVisible()
    }
  }
}

test.describe('Fußbereich @smoke', () => {
  for (const locale of LOCALES) {
    for (const route of LIVE_PAGES) {
      const path = samplePath(route.id, locale)
      test(`R-011 AK-DS-09 AK-3-11 ${route.id} ${path}: 6 Pflichtlinks sichtbar und getroffen (390/1440, reduce/no-preference) @smoke`, async ({
        page,
      }) => {
        const res = await page.goto(path)
        expect(res?.status(), path).toBeLessThan(400)
        await expectFooterLinks(page, locale, route.id)
      })
    }
    test(`R-011 AK-3-11 ${locale}: 404 und 500 mit Pflichtlinks @smoke`, async ({ page }) => {
      const missing = `/${locale}/${locale === 'de' ? 'gibt-es-nicht' : 'does-not-exist'}`
      expect((await page.goto(missing))?.status()).toBe(404)
      await expectFooterLinks(page, locale, 'R28')
      expect((await page.goto(`/${locale}/__fehler-test`))?.status()).toBe(500)
      await expectFooterLinks(page, locale, 'R29')
    })
  }
})

test.describe('Fußbereich auf Danke und Bestellstatus @smoke', () => {
  const checkouts: number[] = []
  test.afterEach(async () => {
    await cleanup(await testPayload(), checkouts.splice(0))
  })

  for (const locale of LOCALES) {
    test(`R-011 R-090 AK-3-11 ${locale}: R08 Danke und R09 Bestellstatus (Fixture-Bestellung) @smoke`, async ({
      page,
      fixtureProducts,
    }) => {
      test.slow()
      const payload = await testPayload()
      const piece = await fixtureProducts.create('keramik', {
        status: 'available',
        firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
      })
      const c = await submittedCheckout(payload, [piece.id], { seed: true, locale })
      checkouts.push(c.checkoutId)
      const { statusToken } = await fixtureOrder(payload, c.checkoutId, 'O1')
      for (const [id, token] of [
        ['R08', c.token],
        ['R09', statusToken],
      ] as const) {
        const path = localizedPath(id, locale, { token })
        expect((await page.goto(path))?.status(), path).toBe(200)
        await expectFooterLinks(page, locale, id)
        // Danke- und Statusseite verlinken „Vertrag widerrufen“ zusätzlich im Inhalt (KONZEPT §4.10).
        await expect(
          page.locator(`main a[href^="${localizedPath('R26', locale)}"]`).first(),
        ).toBeVisible()
      }
    })
  }
})

test.describe('Fußbereich – weitere Prüfungen @smoke', () => {
  test('R-090 AK-3-11 „Vertrag widerrufen“ auf jeder öffentlichen Route (DE/EN, inkl. 404) im DOM und sichtbar @smoke', async ({
    page,
  }) => {
    // Rund 30 Seitenaufrufe in einem Test (WebKit unter Last > 30 s).
    test.slow()
    const paths = [
      ...LIVE_PAGES.flatMap((r) => LOCALES.map((l) => [l, samplePath(r.id, l)] as const)),
      ['de', '/de/gibt-es-nicht'] as const,
      ['en', '/en/does-not-exist'] as const,
    ]
    for (const [locale, path] of paths) {
      const res = await page.goto(path)
      expect(res?.status(), path).toBe(
        path.includes('nicht') || path.includes('not-exist') ? 404 : 200,
      )
      const link = page.locator('[data-site-footer] [data-withdraw-link]')
      await expect(link, path).toHaveCount(1)
      await expect(link, path).toHaveAttribute('href', localizedPath('R26', locale))
      await link.scrollIntoViewIfNeeded()
      await expect(link, path).toBeVisible()
    }
  })

  test('Konformitätserklärungen nur, wenn eine aktive Erklärung existiert (KONZEPT §3.0.3) @smoke', async ({
    page,
  }) => {
    const payload = await testPayload()
    // Kein anderer Test legt währenddessen eine Erklärung an (Produktseite P3.8, `holdConformityData`).
    const release = await holdConformityData('shared')
    try {
      const { totalDocs } = await payload.count({
        collection: 'conformity-declarations',
        where: { status: { equals: 'active' } },
        overrideAccess: true,
      })
      await page.goto('/de/impressum')
      const link = page.locator('[data-site-footer] [data-legal-link="R27"]')
      await expect(link).toHaveCount(totalDocs > 0 ? 1 : 0)
    } finally {
      await release()
    }
    // Die Seite selbst bleibt erreichbar.
    expect((await page.goto('/de/konformitaetserklaerungen'))?.status()).toBe(200)
  })

  test('Fußnavigation #fussnavigation mit Menüliste und Instagram, Sprachumschalter /de/impressum → /en/legal-notice @smoke', async ({
    page,
  }) => {
    await page.goto('/de/impressum')
    const nav = page.locator('nav#fussnavigation')
    await expect(nav).toHaveAttribute('aria-label', 'Seitenübersicht')
    const links = await nav
      .locator('a')
      .evaluateAll((els) => els.map((e) => [e.textContent?.trim(), e.getAttribute('href')]))
    expect(links.slice(0, 7)).toEqual([
      ['Start', '/de'],
      ['Shop', '/de/shop'],
      ['Archiv', '/de/archiv'],
      ['Auftragsarbeiten', '/de/auftragsarbeiten'],
      ['Tattoo', '/de/tattoo'],
      ['Über mich & Coco', '/de/ueber-mich'],
      ['Kontakt', '/de/kontakt'],
    ])
    const insta = nav.getByRole('link', { name: /Instagram/ })
    await expect(insta).toHaveAttribute('href', /^https:\/\/www\.instagram\.com\/[a-z0-9._]+\/$/)
    // R-139: Instagram nur als einfacher Link mit rel="noopener noreferrer"
    await expect(insta).toHaveAttribute('rel', 'noopener noreferrer')

    const switcher = page.locator('[data-site-footer] [data-language-switcher]')
    const en = switcher.getByRole('link', { name: 'English' })
    await expect(en).toHaveAttribute('href', '/en/legal-notice')
    await expect(en).toHaveAttribute('hreflang', 'en')
    await expect(switcher.locator('[aria-current]')).toHaveText('Deutsch')
    await en.click()
    await expect(page).toHaveURL(/\/en\/legal-notice$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(
      page
        .locator('[data-site-footer] [data-language-switcher]')
        .getByRole('link', { name: 'Deutsch' }),
    ).toHaveAttribute('href', '/de/impressum')
    // 404 → Startseite der anderen Sprache
    await page.goto('/de/gibt-es-nicht')
    await expect(
      page
        .locator('[data-site-footer] [data-language-switcher]')
        .getByRole('link', { name: 'English' }),
    ).toHaveAttribute('href', '/en')
  })

  test('Fußbereich: © Berliner Jahr, Dekor-Ebene ohne Zeigerereignisse unter dem Fuß @smoke', async ({
    page,
  }) => {
    await page.goto('/de')
    const year = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
    }).format(new Date())
    await expect(page.locator('[data-site-footer]')).toContainText(
      `© ${year} Planet Claire · Berlin`,
    )
    const layers = await page.evaluate(() => {
      const leash = document.querySelector('[data-leash-layer]')!
      const footer = document.querySelector('[data-site-footer]')!
      return {
        leashPointer: getComputedStyle(leash).pointerEvents,
        leashZ: Number(getComputedStyle(leash).zIndex),
        footerZ: Number(getComputedStyle(footer).zIndex),
      }
    })
    expect(layers.leashPointer).toBe('none')
    expect(layers.footerZ).toBeGreaterThan(layers.leashZ)
  })
})

test.describe('Fußbereich ohne JavaScript @smoke', () => {
  test.use({ javaScriptEnabled: false })

  test('R-011 Pflichtlinks und „Vertrag widerrufen“ ohne JavaScript sichtbar @smoke', async ({
    page,
  }) => {
    for (const path of ['/de', '/en/legal-notice']) {
      await page.goto(path)
      const footer = page.locator('[data-site-footer]')
      await expect(footer.locator('[data-withdraw-link]')).toBeVisible()
      await expect(footer.locator('[data-legal-link]')).toHaveCount(
        6 + (await footer.locator('[data-legal-link="R27"]').count()),
      )
      // Schalter „Animationen“ braucht JavaScript und ist ohne es verborgen.
      await expect(footer.locator('[data-behavior="motion-toggle"]')).toBeHidden()
    }
  })
})
