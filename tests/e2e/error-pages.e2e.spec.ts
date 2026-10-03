import { expect, test, type Page } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import type { Locale } from '../../src/lib/routes/registry'
import { expectCalm } from './calm'

// P2.19 Fehlerseiten (DESIGN KO-18, KONZEPT §3.17): 404 R28 „Coco hat sich losgerissen“ (Preset `lost`, lose Leine,
// Coco rennt am Horizont weg, MI-11) und 500 R29 „Hoppla – die Leine hat sich verheddert“ (statisch). Auf beiden ist
// „Vertrag widerrufen“ sichtbar (AK-3-11, R-011). Der 500-Auslöser `/<sprache>/__fehler-test` wirft nur bei
// APP_ENV=test (Playwright-Webserver).

// Text: Rich Text der Seite `not_found` (Beispielbestand „Coco hat überall geschnüffelt – diese Seite …“) oder der
// Rückfall „Diese Seite gibt es nicht (mehr).“ (P8.16) – beide enthalten denselben Kernsatz.
const NOT_FOUND: Record<Locale, { path: string; h1: string; text: RegExp; withdraw: string }> = {
  de: {
    path: '/de/gibt-es-nicht',
    h1: 'Coco hat sich losgerissen',
    text: /diese Seite gibt es nicht \(mehr\)/i,
    withdraw: 'Vertrag widerrufen',
  },
  en: {
    path: '/en/does-not-exist',
    h1: 'Coco slipped her leash',
    text: /this page does(n't| not) exist \(anymore\)/i,
    withdraw: 'Withdraw from contract here',
  },
}

const SERVER_ERROR: Record<Locale, { h1: string; retry: string }> = {
  de: { h1: 'Hoppla – die Leine hat sich verheddert', retry: 'Nochmal versuchen' },
  en: { h1: 'Oops – the leash got tangled', retry: 'Try again' },
}

async function expectWithdrawVisible(page: Page, locale: Locale) {
  const link = page.locator('[data-site-footer] [data-withdraw-link]')
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', localizedPath('R26', locale))
  await link.scrollIntoViewIfNeeded()
  await expect(link).toBeVisible()
}

/** Laufende Animationen der Seite (Web Animations + CSS). */
const animationCount = (page: Page, selector?: string) =>
  page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) : null
    return (sel ? (el?.getAnimations({ subtree: true }) ?? []) : document.getAnimations()).length
  }, selector)

test.describe('Fehlerseiten @smoke', () => {
  for (const locale of ['de', 'en'] as const) {
    const nf = NOT_FOUND[locale]

    test(`AK-3-11 R-011 R28 ${nf.path}: Status 404, H1, Links, „Vertrag widerrufen“ @smoke`, async ({
      page,
    }) => {
      const res = await page.goto(nf.path)
      expect(res?.status()).toBe(404)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('h1')).toHaveText(nf.h1)
      await expect(page.locator('body')).toHaveAttribute('data-preset', 'lost')
      await expect(page.locator('[data-not-found-text]')).toContainText(nf.text)
      const links = page.locator('[data-not-found] nav a')
      await expect(links).toHaveCount(3)
      await expect(links.nth(0)).toHaveAttribute('href', localizedPath('R01', locale))
      await expect(links.nth(1)).toHaveAttribute('href', localizedPath('R02', locale))
      await expect(links.nth(2)).toHaveAttribute('href', localizedPath('R11', locale))
      // Leinenende: offener Karabiner mit Geschirr; Schlingen-Anker für die Linie.
      await expect(page.locator('[data-lost-end]')).toBeVisible()
      await expect(page.locator('[data-leash-station][data-leash-loop="coil"]')).toHaveCount(1)
      await expectWithdrawVisible(page, locale)
    })

    test(`AK-3-11 R-011 R29 ${locale}: Fehler-Auslöser zeigt die 500-Seite ohne Animation @smoke`, async ({
      page,
    }) => {
      const path = `/${locale}/__fehler-test`
      const res = await page.goto(path)
      expect(res?.status()).toBe(500)
      await expect(page.locator('h1')).toHaveText(SERVER_ERROR[locale].h1)
      await expect(page.getByRole('button', { name: SERVER_ERROR[locale].retry })).toBeVisible()
      await expect(page.locator('[data-error-knot]')).toBeVisible()
      await expect(page.locator('[data-server-error] .coco')).toHaveAttribute(
        'data-pose',
        'kopfschief',
      )
      await expect(page.locator('body')).toHaveAttribute('data-page-error', '')
      await expect(page.locator('body')).not.toHaveAttribute('data-preset', /.+/)
      await expectWithdrawVisible(page, locale)
      // Keine Animation: keine Web-/CSS-Animation, keine Übergänge im Inhalt, keine Linie.
      await expectCalm(page, path)
      expect(await animationCount(page)).toBe(0)
      await expect(page.locator('[data-leash-layer] svg')).toHaveCount(0)
      // „Nochmal versuchen“ rendert neu – der Auslöser wirft erneut, die Seite bleibt stehen.
      await page.getByRole('button', { name: SERVER_ERROR[locale].retry }).click()
      await expect(page.locator('h1')).toHaveText(SERVER_ERROR[locale].h1)
    })
  }

  test('MI-11 R28: Linie zeichnet einmal, Coco rennt einmal am Horizont weg, danach Stillstand (≤ 5 s) @smoke', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(NOT_FOUND.de.path)
    const layer = page.locator('[data-leash-layer]')
    await expect(layer).toHaveAttribute('data-leash-drawn', '', { timeout: 8_000 })
    await expect(layer.locator('svg').first()).toBeAttached()
    // Direkt nach dem Zeichnen: Coco läuft (Web Animation) und Leine/Leinenende schwingen.
    await expect
      .poll(() => animationCount(page, '[data-lost-coco]'), { timeout: 2_000 })
      .toBeGreaterThan(0)
    expect(await animationCount(page, '[data-lost-end]')).toBeGreaterThan(0)
    // Spätestens 5 s nach dem Zeichnen steht alles still, Coco ist wieder unsichtbar.
    await expect.poll(() => animationCount(page), { timeout: 5_500 }).toBe(0)
    await expect(page.locator('[data-lost-coco]')).toHaveCSS('opacity', '0')
    await expect(page.locator('[data-lost-coco]')).toHaveAttribute('data-boil', 'off')
  })

  test('R28 mit reduzierter Bewegung: Linie statisch, Coco nicht animiert und nicht sichtbar @smoke', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(NOT_FOUND.en.path)
    const layer = page.locator('[data-leash-layer]')
    await expect(layer).toHaveAttribute('data-leash-drawn', '', { timeout: 8_000 })
    await page.waitForTimeout(1_000)
    expect(await animationCount(page, '[data-lost-coco]')).toBe(0)
    expect(await animationCount(page, '[data-lost-end]')).toBe(0)
    expect(await animationCount(page)).toBe(0)
    await expect(page.locator('[data-lost-coco]')).toHaveCSS('opacity', '0')
    await expect(page.locator('[data-lost-coco]')).toHaveAttribute('data-boil', 'off')
  })
})

test.describe('Fehlerseiten ohne JavaScript @smoke', () => {
  test.use({ javaScriptEnabled: false })

  for (const locale of ['de', 'en'] as const) {
    test(`R-011 R28 ${locale}: H1, Text und „Vertrag widerrufen“ schon im HTML @smoke`, async ({
      page,
    }) => {
      const nf = NOT_FOUND[locale]
      const res = await page.goto(nf.path)
      expect(res?.status()).toBe(404)
      await expect(page.locator('h1')).toHaveText(nf.h1)
      await expect(page.locator('[data-not-found-text]')).toBeVisible()
      await expect(page.locator('[data-site-footer] [data-withdraw-link]')).toHaveText(nf.withdraw)
      await expect(page.locator('[data-site-footer] [data-withdraw-link]')).toBeVisible()
      await expect(page.locator('[data-lost-coco]')).toHaveCSS('opacity', '0')
    })
  }
})
