import { expect, test, type Page } from '@playwright/test'

import { serverURL } from '../helpers/adminEnv'

// P2.8 Seitenrahmen, Kopfleiste, Vorschau-Banner (DESIGN KO-01/KO-02, KONZEPT §3.0.1/§3.0.4).

const WIDTHS = [320, 360, 390, 1440] as const

/** `pc_cart` mit zwei Stücken (ARCHITEKTUR §8.7), nur als Test-Fixture. */
const cartCookie = () => ({
  name: 'pc_cart',
  value: Buffer.from(
    JSON.stringify({
      v: 1,
      items: [
        { id: 981, p: 3800 },
        { id: 982, p: 4200 },
      ],
      delivery: 'shipping',
    }),
  ).toString('base64url'),
  url: serverURL,
})

const headerItems = (page: Page) => {
  const header = page.locator('[data-site-header]')
  return {
    header,
    shop: header.getByRole('link', { name: 'Shop', exact: true }),
    tattoo: header.getByRole('link', { name: 'Tattoo', exact: true }),
    cart: header.locator('[data-header-cart]'),
    menu: header.locator('[data-menu-trigger]'),
  }
}

async function boxes(page: Page) {
  const items = headerItems(page)
  const out: Record<string, { x: number; y: number; width: number; height: number }> = {}
  for (const [name, loc] of Object.entries(items)) {
    const box = await loc.boundingBox()
    expect(box, name).not.toBeNull()
    out[name] = box!
  }
  return out
}

test.describe('Seitenrahmen und Kopfleiste @smoke', () => {
  for (const width of WIDTHS) {
    test(`AK-DS-07 bei ${width} px kein Überlauf, Shop/Tattoo/Korb/Menü sichtbar und ≥ 44 × 44 px @smoke`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/de')
      const overflow = await page.evaluate(() => {
        const header = document.querySelector('[data-site-header]')!
        return {
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          header: header.scrollWidth - header.clientWidth,
        }
      })
      expect(overflow.doc).toBeLessThanOrEqual(0)
      expect(overflow.header).toBeLessThanOrEqual(0)
      const items = headerItems(page)
      for (const [name, loc] of Object.entries(items)) {
        if (name === 'header') continue
        await expect(loc, name).toBeVisible()
        const box = (await loc.boundingBox())!
        expect(box.width, `${name} Breite`).toBeGreaterThanOrEqual(44)
        expect(box.height, `${name} Höhe`).toBeGreaterThanOrEqual(44)
        // nichts umgebrochen: alle Einträge in einer Zeile innerhalb der Kopfleiste
        expect(box.x + box.width, `${name} rechts`).toBeLessThanOrEqual(width)
      }
      // Wortmarke bzw. unter 375 px die Planet-Marke, zugänglicher Name bleibt.
      await expect(
        items.header.getByRole('link', { name: 'planet claire – Startseite' }),
      ).toBeVisible()
    })
  }

  test('AK-DS-07 Korb-Anzahl ändert die Breite nicht (Cookie-Fixture pc_cart mit 2 IDs) @smoke', async ({
    page,
    context,
  }) => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 800 })
      await context.clearCookies()
      await page.goto('/de')
      const before = await boxes(page)
      await expect(page.locator('[data-cart-count]')).toBeHidden()

      await context.addCookies([cartCookie()])
      await page.reload()
      await expect(page.locator('[data-cart-count]')).toHaveText('2')
      await expect(page.locator('[data-cart-count]')).toBeVisible()
      const after = await boxes(page)
      expect(after, `Breite ${width}`).toEqual(before)
    }
  })

  test('Skip-Link ist das erste fokussierbare Element und springt zu <main id="inhalt"> @smoke', async ({
    page,
    browserName,
  }) => {
    await page.goto('/de/impressum')
    const first = await page.evaluate(() => {
      const focusable = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, [tabindex]',
        ),
      ].filter((el) => el.tabIndex >= 0 && !el.hasAttribute('disabled'))
      return focusable[0]?.getAttribute('href')
    })
    expect(first).toBe('#inhalt')
    const skip = page.getByRole('link', { name: 'Zum Inhalt springen' })
    await expect(page.locator('main#inhalt')).toHaveCount(1)
    // Tastatur (Chromium; Safari fokussiert Links per Tab nur mit Systemeinstellung).
    if (browserName === 'chromium') {
      await page.keyboard.press('Tab')
      await expect(skip).toBeFocused()
      await expect(skip).toBeInViewport()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/#inhalt$/)
      await expect(page.locator('main#inhalt')).toBeFocused()
    }
    await page.goto('/en')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#inhalt',
    )
  })

  test('Reihenfolge Skip-Link → Kopf → Banner → main → Linien-Ebene als Geschwister von main @smoke', async ({
    page,
  }) => {
    await page.goto('/de')
    // Ohne lokale Hilfsfunktionen im Browser-Callback (tsx ergänzt sonst `__name`).
    const order = await page.evaluate(() => {
      const els = ['a[href="#inhalt"]', '[data-site-header]', 'main#inhalt'].map((sel) =>
        document.querySelector(sel),
      )
      const leash = document.querySelector('[data-leash-layer]')
      const main = document.querySelector('main#inhalt')!
      return {
        sorted: els.every(
          (el, i) =>
            i === 0 ||
            (els[i - 1]!.compareDocumentPosition(el!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        ),
        leashSibling: leash?.parentElement === main.parentElement,
        leashHidden: leash?.getAttribute('aria-hidden'),
        leashPointer: leash ? getComputedStyle(leash).pointerEvents : null,
        headerNav: document.querySelector('[data-site-header] nav')?.getAttribute('aria-label'),
      }
    })
    expect(order).toEqual({
      sorted: true,
      leashSibling: true,
      leashHidden: 'true',
      leashPointer: 'none',
      headerNav: 'Hauptnavigation',
    })
  })

  test('<html lang>, <body data-preset> aus der Registry und Menü-Knopf mit ARIA @smoke', async ({
    page,
  }) => {
    const cases = [
      ['/de', 'de', 'journey'],
      ['/de/impressum', 'de', 'legal'],
      ['/en/withdraw-from-contract', 'en', 'calm'],
      ['/en/contact', 'en', 'margin'],
    ] as const
    for (const [path, lang, preset] of cases) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('body')).toHaveAttribute('data-preset', preset)
    }
    const menu = page.locator('[data-menu-trigger]')
    await expect(menu).toHaveAttribute('aria-controls', 'menu')
    await expect(menu).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(menu).toHaveAttribute('aria-expanded', /true|false/)
    // Ohne gespeicherte Wahl kein data-motion (Systemeinstellung gilt, DESIGN §11.7).
    expect(await page.locator('html').getAttribute('data-motion')).toBeNull()
  })

  test('Vorschau-Banner nur bei SEED_PREVIEW_MODE=true und APP_ENV≠production @smoke', async ({
    page,
  }) => {
    const active =
      /^(true|1)$/i.test(process.env.SEED_PREVIEW_MODE ?? '') &&
      process.env.APP_ENV !== 'production'
    for (const [path, text] of [
      ['/de', 'Vorschau mit Beispieldaten'],
      ['/en/legal-notice', 'Preview with sample data'],
    ] as const) {
      await page.goto(path)
      const banner = page.locator('[data-preview-banner]')
      if (active) {
        await expect(banner).toBeVisible()
        await expect(banner).toContainText(text)
        // Reihenfolge: unter dem Kopf, vor main.
        const between = await page.evaluate(() => {
          const b = document.querySelector('[data-preview-banner]')!
          const h = document.querySelector('[data-site-header]')!
          const m = document.querySelector('main#inhalt')!
          return (
            (h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
            (b.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          )
        })
        expect(between).toBe(true)
      } else {
        await expect(banner).toHaveCount(0)
      }
    }
  })
})
