import type { Page } from '@playwright/test'

import { ADMIN_BOTTOM_BAR, ADMIN_VIEWS } from '../../../src/admin/views/registry'
import { serverURL } from '../../helpers/adminEnv'
import { expectNoSeriousViolations } from '../axe'
import { adminPath, expect, test } from '../fixtures'

// P5.1 – Verwaltungs-Gerüst (KONZEPT §7.1/§7.2, ARCHITEKTUR §8.1/§8.4): alle 13 Ansichten unter ADMIN_ROUTE (200),
// `/admin/heute` 404 (AK-2-04), Startseite = „Heute“, Header des Kontexts `admin`, Request-Log nur eigener Origin,
// Handy (390 × 844): Leiste unten „Heute · Neues Stück · Packen · Mehr“, kein horizontales Scrollen, Tipp-Flächen
// ≥ 44 px, axe ohne serious/critical (AK-7-04, T-11); Desktop: Seitenleiste mit allen Ansichten vor „Alle Daten“.

const ORIGIN = new URL(serverURL).origin

/** Alle Anfragen der Seite mitschreiben (Request-Log wie T-03). */
function requestLog(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  return urls
}

const foreignOrigins = (urls: string[]) =>
  [...new Set(urls.filter((u) => /^(https?|wss?):/.test(u)).map((u) => new URL(u).origin))].filter(
    (o) => o !== ORIGIN && o !== ORIGIN.replace(/^http/, 'ws'),
  )

async function tapTargetsBelow44(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.height < 44 || r.width < 44
      })
      .map(
        (el) => `${el.textContent?.trim()} (${Math.round(el.getBoundingClientRect().height)} px)`,
      ),
  )
}

async function noHorizontalScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))
  expect(scroll, 'kein horizontales Scrollen').toBeLessThanOrEqual(width)
}

test.describe('Verwaltungs-Gerüst (P5.1) @a11y', () => {
  test('AK-2-04 alle 13 Pfade antworten angemeldet mit 200, /admin/heute mit 404; Header admin', async ({
    adminPage: page,
    request,
  }) => {
    for (const view of ADMIN_VIEWS) {
      const res = await page.goto(adminPath(view.path))
      expect(res?.status(), view.path).toBe(200)
      await expect(page.locator('h1').first(), view.path).toHaveText(view.title)
    }
    // Detailansichten (Direktlinks der Verwaltungs-Mails)
    for (const p of ['/bestellungen/1', '/widerrufe/1', '/anfragen/1', '/stuecke/1']) {
      expect((await page.goto(adminPath(p)))?.status(), p).toBe(200)
      await expect(page.getByTestId('admin-view-placeholder')).toBeVisible()
    }
    // ADMIN_ROUTE selbst zeigt „Heute“.
    await page.goto(adminPath(''))
    await expect(page.locator('h1').first()).toHaveText('Heute')
    // Unbekannter Pfad unterhalb der Verwaltung → 404.
    expect((await page.goto(adminPath('/gibt-es-nicht')))?.status()).toBe(404)

    for (const p of ['/admin/heute', '/admin/packen']) {
      const res = await request.get(`${serverURL}${p}`, { maxRedirects: 0 })
      expect(res.status(), p).toBe(404)
    }

    const res = await page.request.get(`${serverURL}${adminPath('/packen')}`)
    expect(res.status()).toBe(200)
    const h = res.headers()
    expect(h['x-robots-tag']).toBe('noindex, nofollow')
    expect(h['permissions-policy']).toContain('camera=(self)')
    expect(h['cache-control']).toContain('no-store')
  })

  test('ohne Anmeldung: eigene Ansichten leiten zur Anmeldung (mit Rücksprung)', async ({
    page,
  }) => {
    await page.goto(adminPath('/packen'))
    await expect(page).toHaveURL(/\/login\?redirect=/)
    expect(decodeURIComponent(page.url())).toContain(adminPath('/packen'))
    await expect(page.locator('#field-email')).toBeVisible()
  })

  test('Request-Log der Verwaltung enthält nur den eigenen Origin', async ({ adminPage: page }) => {
    const log = requestLog(page)
    for (const p of ['', '/packen', '/bestellungen/1', '/collections/orders']) {
      await page.goto(adminPath(p))
      await page.waitForLoadState('networkidle')
    }
    expect(log.length).toBeGreaterThan(0)
    expect(foreignOrigins(log)).toEqual([])
  })

  test('Handy 390 × 844: Leiste unten, „Mehr“ mit allen Ansichten und „Alle Daten“, ≥ 44 px, axe', async ({
    adminPage: page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'nur Handy-Projekte')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath(''))
    const bar = page.getByRole('navigation', { name: 'Schnellzugriff' })
    await expect(bar).toBeVisible()
    const labels = await bar.locator('.pc-admin-bottombar__item').allInnerTexts()
    expect(labels.map((l) => l.trim())).toEqual(['Heute', 'Neues Stück', 'Packen', 'Mehr'])
    expect(ADMIN_BOTTOM_BAR).toHaveLength(3)
    expect(await tapTargetsBelow44(page, '.pc-admin-bottombar__item, .pc-admin-btn')).toEqual([])
    await expect(bar.getByRole('link', { name: 'Heute' })).toHaveAttribute('aria-current', 'page')
    await noHorizontalScroll(page)
    await expectNoSeriousViolations(page, 'Heute (390)')

    // „Mehr“ öffnet das Menü mit allen Ansichten und den Standard-Ansichten unter „Alle Daten“.
    const more = bar.getByRole('button', { name: 'Mehr' })
    await more.click()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    const menu = page.getByTestId('admin-nav-views')
    await expect(menu).toBeVisible()
    for (const view of ADMIN_VIEWS)
      await expect(menu.getByRole('link', { name: view.title })).toBeVisible()
    await expect(page.locator('#pc-admin-all-data')).toHaveText('Alle Daten')
    await expect(page.locator('.nav a[href$="/collections/orders"]').first()).toBeVisible()
    expect(await tapTargetsBelow44(page, '.pc-admin-nav__link')).toEqual([])
    const small = await page
      .locator('.nav a[href*="/collections/"]')
      .evaluateAll(
        (els) =>
          els.filter(
            (e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44,
          ).length,
      )
    expect(small, 'Menü-Einträge „Alle Daten“ ≥ 44 px hoch').toBe(0)
    await expectNoSeriousViolations(page, 'Menü „Mehr“ (390)')

    // Ansicht wechseln über das Menü
    await menu.getByRole('link', { name: 'Zu packen' }).click()
    await expect(page).toHaveURL(new RegExp(`${adminPath('/packen')}$`))
    await expect(page.locator('h1').first()).toHaveText('Zu packen')
    await expect(bar.getByRole('link', { name: 'Packen' })).toHaveAttribute('aria-current', 'page')

    for (const view of ADMIN_VIEWS) {
      await page.goto(adminPath(view.path))
      await expect(page.locator('h1').first()).toHaveText(view.title)
      await noHorizontalScroll(page)
    }
    await expectNoSeriousViolations(page, 'Export (390)')
  })

  test('Desktop: Seitenleiste mit allen Ansichten vor „Alle Daten“, keine Leiste unten, Tastatur', async ({
    adminPage: page,
    isMobile,
  }) => {
    test.skip(isMobile, 'nur Desktop')
    await page.goto(adminPath(''))
    await expect(page.getByRole('navigation', { name: 'Schnellzugriff' })).toBeHidden()
    // Die Seitenleiste lässt sich einklappen (Payload speichert das je Konto) – für den Test aufklappen.
    const aside = page.locator('aside.nav')
    if ((await aside.getAttribute('inert')) !== null) {
      await page.getByRole('button', { name: 'Öffnen Menü' }).click()
      await expect(aside).not.toHaveAttribute('inert', '')
    }
    const side = page.getByTestId('admin-nav-views')
    await expect(side).toBeVisible()
    const titles = (await side.locator('.pc-admin-nav__link').allInnerTexts()).map((t) => t.trim())
    expect(titles).toEqual(ADMIN_VIEWS.map((v) => v.title))
    await expect(page.locator('#pc-admin-all-data')).toBeVisible()

    // Tastatur: Link fokussieren, sichtbarer Fokus, Enter öffnet die Ansicht.
    const link = side.getByRole('link', { name: 'Vorkasse offen' })
    await side.getByRole('link', { name: 'Zu packen' }).focus()
    await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${adminPath('/vorkasse')}$`))
    await expect(side.getByRole('link', { name: 'Vorkasse offen' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Platzhalter führt in „Alle Daten“.
    await page.getByRole('link', { name: 'In „Alle Daten“ öffnen' }).click()
    await expect(page).toHaveURL(new RegExp(`${adminPath('/collections/orders')}`))
    await expectNoSeriousViolations(page, 'Alle Daten: Bestellungen (Desktop)')
    await page.goto(adminPath('/heute'))
    await expectNoSeriousViolations(page, 'Heute (Desktop)')
  })
})
