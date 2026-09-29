import { expect, test, type Page } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import type { Locale } from '../../src/lib/routes/registry'
import { holdListData } from './shop/fresh'
import { ANCHORS } from './shop/productPage'

// P2.22 Tastatur-Durchlauf (ARCHITEKTUR §7.5, KONZEPT EK-07, RECHT R-191, DESIGN AK-DS-08): Skip-Link, Kopf, Menü,
// Fuß, Schalter „Animationen“ und Sprachumschalter sind allein mit der Tastatur erreichbar und bedienbar; jedes
// fokussierbare Element der Seite wird per Tab erreicht, und an jedem Halt ist der Fokus sichtbar (Screenshot mit und
// ohne Fokus unterscheiden sich). Bewegung ist dabei reduziert, damit nur der Fokus das Bild verändert.

// WebKit springt mit Tab standardmäßig nur zwischen Formularfeldern und Knöpfen (Safari-Einstellung „Mit Tab-Taste
// Objekte auf Webseiten hervorheben“); Alt+Tab erreicht dort auch Links – das ist die Tastatur-Bedienung in Safari.
const tabKey = (page: Page, shift = false) => {
  const webkit = page.context().browser()?.browserType().name() === 'webkit'
  return `${shift ? 'Shift+' : ''}${webkit ? 'Alt+' : ''}Tab`
}

const SKIP: Record<Locale, string> = { de: 'Zum Inhalt springen', en: 'Skip to content' }

/** Kennung des fokussierten Elements (für Vergleiche über Tab-Schritte hinweg). */
const activeKey = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    el.dataset.kbd ??= String(Math.random()).slice(2)
    return el.dataset.kbd
  })

/** Alle per Tastatur zu erreichenden, sichtbaren Elemente außerhalb geschlossener Dialoge. */
const tabbables = (page: Page) =>
  page.evaluate(() => {
    const sel =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        if (el.closest('dialog:not([open])') || el.closest('[inert]')) return false
        if (el.tabIndex < 0) return false
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        // Der Skip-Link ist bis zum Fokus aus dem Bild geschoben, aber im Layout.
        return s.visibility !== 'hidden' && s.display !== 'none' && (r.width > 0 || r.height > 0)
      })
      .map((el) => {
        el.dataset.kbd ??= String(Math.random()).slice(2)
        return {
          key: el.dataset.kbd,
          label: (el.getAttribute('aria-label') || el.textContent || el.tagName)
            .trim()
            .slice(0, 40),
        }
      })
  })

/** Fokus-Anzeige: Bildausschnitt um das Element mit und ohne Fokus darf nicht gleich sein. */
async function expectVisibleFocus(page: Page, label: string) {
  const box = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  const pad = 8
  const vp = page.viewportSize()!
  const x = Math.max(0, box.x - pad)
  const y = Math.max(0, box.y - pad)
  const clip = {
    x,
    y,
    width: Math.min(vp.width - x, box.width + 2 * pad),
    height: Math.min(vp.height - y, box.height + 2 * pad),
  }
  const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })
  const restore = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    el.dataset.kbd ??= String(Math.random()).slice(2)
    el.blur()
    return el.dataset.kbd
  })
  const plain = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })
  expect(focused.equals(plain), `Fokus sichtbar: ${label}`).toBe(false)
  // Fokus zurück (Tastatur-Modalität bleibt erhalten → :focus-visible).
  await page.evaluate(
    (k) => document.querySelector<HTMLElement>(`[data-kbd="${k}"]`)!.focus(),
    restore,
  )
}

/**
 * Tab-Durchlauf (EK-07): jedes fokussierbare Element wird per Tab erreicht, an jedem Halt ist der Fokus sichtbar, und
 * rückwärts kommt man vom letzten Element wieder zum Anfang (keine Falle außerhalb des Menüs).
 */
async function tabWalk(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('[data-site-header] [data-menu-trigger]')).toHaveAttribute(
    'role',
    'button',
  )
  await page.waitForLoadState('networkidle')
  const expected = await tabbables(page)
  expect(expected.length).toBeGreaterThan(10)

  const visited: string[] = []
  for (let i = 0; i < expected.length + 5; i++) {
    await page.keyboard.press(tabKey(page))
    const key = await activeKey(page)
    if (key === null || visited.includes(key)) break
    visited.push(key)
    const label = expected.find((e) => e.key === key)?.label ?? key
    await expectVisibleFocus(page, `${path} #${i + 1} ${label}`)
  }
  const missing = expected.filter((e) => !visited.includes(e.key)).map((e) => e.label)
  expect(missing, 'nicht per Tab erreichbar').toEqual([])

  await page.evaluate(
    (k) => document.querySelector<HTMLElement>(`[data-kbd="${k}"]`)!.focus(),
    visited.at(-1)!,
  )
  for (let i = 0; i < visited.length - 1; i++) await page.keyboard.press(tabKey(page, true))
  expect(await activeKey(page)).toBe(visited[0])
}

test.describe('Tastatur-Durchlauf @a11y', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  for (const locale of ['de', 'en'] as const) {
    test(`R-191 Skip-Link zuerst, springt zum Inhalt (${locale}) @a11y`, async ({ page }) => {
      await page.goto(localizedPath('R01', locale))
      await page.keyboard.press(tabKey(page))
      const skip = page.getByRole('link', { name: SKIP[locale] })
      await expect(skip).toBeFocused()
      await expect(skip).toBeInViewport()
      await expectVisibleFocus(page, 'Skip-Link')
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/#inhalt$/)
      await expect(page.locator('main#inhalt')).toBeFocused()
    })
  }

  for (const path of [localizedPath('R01', 'de'), localizedPath('R21', 'en')]) {
    test(`EK-07 alle Elemente per Tab erreichbar, Fokus überall sichtbar: ${path} @a11y`, async ({
      page,
    }) => {
      // Zwei Bildschirmfotos je Tab-Halt; die Startseite hat seit P3.12 zusätzlich die Karten der Stationen.
      test.slow()
      await tabWalk(page, path)
    })
  }

  test('Kopf → Menü per Tastatur: Enter öffnet, Tab bleibt im Dialog, Esc schließt @a11y', async ({
    page,
  }) => {
    // Zwei Bildschirmfotos je Tab-Halt im Menü; in WebKit liegt das sonst an der 30-s-Grenze.
    test.slow()
    await page.goto(localizedPath('R01', 'de'))
    const trigger = page.locator('[data-site-header] [data-menu-trigger]')
    await expect(trigger).toHaveAttribute('role', 'button')
    // Vom Skip-Link aus durch den Kopf bis zum Menü-Knopf.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(tabKey(page))
      if (await trigger.evaluate((el) => el === document.activeElement)) break
    }
    await expect(trigger).toBeFocused()
    await expectVisibleFocus(page, 'Menü-Knopf')
    await page.keyboard.press('Enter')
    const dialog = page.locator('dialog#menu')
    await expect(dialog).toBeVisible()
    const inside = () => page.evaluate(() => !!document.activeElement?.closest('dialog#menu'))
    const count = await dialog.locator('a[href], button').count()
    for (let i = 0; i < count + 1; i++) {
      await page.keyboard.press(tabKey(page))
      expect(await inside()).toBe(true)
      await expectVisibleFocus(page, `Menü #${i + 1}`)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Fuß: Schalter „Animationen“ und Sprachumschalter per Tastatur @a11y', async ({ page }) => {
    await page.goto(localizedPath('R21', 'de'))
    const toggle = page.locator('[data-site-footer] [data-behavior="motion-toggle"]')
    await expect(toggle).toBeVisible()
    const english = page.locator('[data-site-footer] [data-language-switcher] a[hreflang="en"]')

    const reach = async (target: typeof toggle) => {
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press(tabKey(page))
        if (await target.evaluate((el) => el === document.activeElement)) return
      }
      throw new Error('per Tab nicht erreicht')
    }

    await reach(toggle)
    await expectVisibleFocus(page, 'Schalter Animationen')
    const before = await toggle.getAttribute('aria-pressed')
    await page.keyboard.press('Space')
    await expect(toggle).not.toHaveAttribute('aria-pressed', before ?? '')
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-pressed', before ?? '')

    await page.keyboard.press(tabKey(page, true))
    // Der Sprachumschalter steht direkt vor dem Schalter (DESIGN KO-02).
    await expect(english).toBeFocused()
    await expectVisibleFocus(page, 'Sprachumschalter')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${localizedPath('R21', 'en')}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

// P3.16 Tastatur-Durchlauf auf den Shop-Seiten (T-11, EK-07, R-191): Shop mit Filter-Chips und Karten, Produktseite
// (Galerie, Kaufknopf, Blöcke 7–11, „Mehr aus …“) und Archiv.
test.describe('Tastatur-Durchlauf Shop P3 @a11y', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  // desktop (Chromium) und iphone-15 (WebKit, Alt+Tab); pixel-7 ist dieselbe Engine wie desktop (CI-Minuten).
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'pixel-7', 'Shop-Tastatur: desktop und iphone-15 (WebKit)')
  })
  // Seed-Anker (S01, S06) nicht während eines exklusiven Bestandstests lesen.
  holdListData(test, 'shared')

  for (const path of [localizedPath('R02', 'de'), ANCHORS.S01.de, localizedPath('R05', 'en')]) {
    test(`EK-07 R-191 alle Elemente per Tab erreichbar, Fokus überall sichtbar: ${path} @a11y`, async ({
      page,
    }) => {
      test.slow()
      await tabWalk(page, path)
    })
  }
})
