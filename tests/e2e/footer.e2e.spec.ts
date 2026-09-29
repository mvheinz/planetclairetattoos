import { expect, test, type Page } from '@playwright/test'

import { LEGAL_LINKS } from '../../src/components/layout/navItems'
import { localizedPath, pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../src/lib/routes/registry'
import { holdConformityData } from '../helpers/adminSessionLock'
import { testPayload } from './fixtures'

// P2.10 Fußbereich (DESIGN KO-04, KONZEPT §3.0.3): Pflichtlinks (R-011), „Vertrag widerrufen“ (R-090, AK-3-11,
// AK-DS-09), Sprachumschalter. Die 500-Seite (R29) folgt mit ihrem Test-Auslöser in P2.19.

const WITHDRAW: Record<Locale, string> = {
  de: 'Vertrag widerrufen',
  en: 'Withdraw from contract here',
}

/** Ein Vertreter je `live`-Seitentyp (R-011) plus 404. */
const PAGE_TYPES: { type: string; path: (l: Locale) => string }[] = [
  ...['R01', 'R20', 'R21', 'R26', 'R27'].map((id) => ({
    type: id,
    path: (l: Locale) => localizedPath(id, l),
  })),
  {
    type: 'R28 (404)',
    path: (l: Locale) => `/${l}/${l === 'de' ? 'gibt-es-nicht' : 'does-not-exist'}`,
  },
]

const LIVE_PAGES = pageRoutes().filter((r) => r.status === 'live')

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

test.describe('Fußbereich @smoke', () => {
  for (const locale of LOCALES) {
    test(`R-011 AK-DS-09 ${locale}: 6 Pflichtlinks je Seitentyp, sichtbar und getroffen (390/1440, reduce/no-preference) @smoke`, async ({
      page,
    }) => {
      const expected = [
        ...LEGAL_LINKS.filter((id) => id !== 'R20').map((id) => localizedPath(id, locale)),
        localizedPath('R26', locale),
      ]
      expect(expected).toHaveLength(6)
      for (const pageType of PAGE_TYPES) {
        await page.goto(pageType.path(locale))
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport)
          for (const reducedMotion of ['reduce', 'no-preference'] as const) {
            await page.emulateMedia({ reducedMotion })
            await page.evaluate(() =>
              window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
            )
            const label = `${pageType.type} ${viewport.width} ${reducedMotion}`
            const footer = page.locator('[data-site-footer]')
            for (const href of expected) {
              const link = footer.locator(`a[href="${href}"]`).first()
              await expect(link, `${label} ${href}`).toBeVisible()
              const sel =
                href === localizedPath('R26', locale)
                  ? '[data-site-footer] [data-withdraw-link]'
                  : `[data-site-footer] a[href="${href}"]`
              const hit = await hitTest(page, sel)
              expect(hit, `${label} ${href}`).toMatchObject({ found: true, hit: true })
              expect(hit.height, `${label} ${href} Höhe`).toBeGreaterThanOrEqual(44)
            }
            const withdraw = footer.locator('[data-withdraw-link]')
            await expect(withdraw).toHaveText(WITHDRAW[locale])
            // Kontakt steht zusätzlich im Pflichtlink-Block.
            await expect(
              footer.locator(`[data-legal-link="R20"][href="${localizedPath('R20', locale)}"]`),
            ).toBeVisible()
          }
        }
      }
    })
  }

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
