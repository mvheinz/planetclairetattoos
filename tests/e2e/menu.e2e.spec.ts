import { expect, test, type Page } from '@playwright/test'

// P2.9 Menü (DESIGN KO-03, KONZEPT §3.0.2) als Verhaltensmodul `menu` (MI-05).

const trigger = (page: Page) => page.locator('[data-site-header] [data-menu-trigger]')
const dialog = (page: Page) => page.locator('dialog#menu')

/** Wartet, bis das Modul gebunden ist (Auslöser als Knopf markiert). */
async function ready(page: Page) {
  await expect(trigger(page)).toHaveAttribute('role', 'button')
}

test.describe('Menü @smoke', () => {
  for (const key of ['Enter', ' '] as const) {
    test(`AK-DS-08 Tastatur: ${key === ' ' ? 'Leertaste' : 'Enter'} öffnet, Fokus auf erstem Link, Tab bleibt im Dialog, Esc schließt, Fokus zurück @smoke`, async ({
      page,
    }) => {
      await page.goto('/de/impressum')
      await ready(page)
      await trigger(page).focus()
      await page.keyboard.press(key)
      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page)).toHaveAttribute('open', '')
      await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true')
      await expect(dialog(page).getByRole('link', { name: 'Start', exact: true })).toBeFocused()
      await expect(page.locator('html')).toHaveAttribute('data-menu-open', '')
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
        'hidden',
      )

      const count = await dialog(page)
        .locator('a[href], button')
        .evaluateAll((els) => els.length)
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press('Tab')
        expect(
          await page.evaluate(() => !!document.activeElement?.closest('dialog#menu')),
          `Tab ${i + 1}`,
        ).toBe(true)
      }
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Shift+Tab')
        expect(
          await page.evaluate(() => !!document.activeElement?.closest('dialog#menu')),
          `Shift+Tab ${i + 1}`,
        ).toBe(true)
      }

      await page.keyboard.press('Escape')
      await expect(dialog(page)).toBeHidden()
      await expect(trigger(page)).toBeFocused()
      await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('html')).not.toHaveAttribute('data-menu-open', '')
    })
  }

  test('AK-DS-08 mit reducedMotion reduce ist der Endzustand nach ≤ 1 Frame erreicht @smoke', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/de')
    await ready(page)
    const state = await page.evaluate(
      () =>
        new Promise<{ open: boolean; animations: number; clip: string; opacity: string }>(
          (resolve) => {
            document.querySelector<HTMLElement>('[data-site-header] [data-menu-trigger]')!.click()
            requestAnimationFrame(() => {
              const d = document.querySelector<HTMLElement>('dialog#menu')!
              const first = d.querySelector<HTMLElement>('[data-menu-item]')!
              resolve({
                open: d.hasAttribute('open'),
                // Nur, was länger als ein Frame dauert (CSS-Übergänge laufen bei reduce 0,01 ms).
                animations: document
                  .getAnimations()
                  .filter((a) => Number(a.effect?.getComputedTiming().endTime ?? 0) > 17).length,
                clip: getComputedStyle(d).clipPath,
                opacity: getComputedStyle(first).opacity,
              })
            })
          },
        ),
    )
    expect(state).toEqual({ open: true, animations: 0, clip: 'none', opacity: '1' })
    await page.keyboard.press('Escape')
    // Schließen ebenfalls sofort (keine Ausblende-Animation).
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((a) => Number(a.effect?.getComputedTiming().endTime ?? 0) > 17).length,
      ),
    ).toBe(0)
    await expect(dialog(page)).toBeHidden()
  })

  test('Menü mit Animation: MI-05 läuft ≤ 700 ms, Schließen-Knopf schließt, Fokus zurück @smoke', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await ready(page)
    // Jede per `Element.animate` gestartete Animation mitschreiben: `document.getAnimations()` kennt beendete
    // Animationen nicht mehr – unter Last war der erste gestaffelte Link schon fertig, bevor die Abfrage lief (P4.25).
    await page.evaluate(() => {
      const w = window as Window & { __menuAnimations?: Animation[] }
      const started: Animation[] = (w.__menuAnimations = [])
      const animate = Element.prototype.animate
      Element.prototype.animate = function (
        this: Element,
        ...args: Parameters<Element['animate']>
      ) {
        const a = animate.apply(this, args)
        started.push(a)
        return a
      }
    })
    await trigger(page).click()
    await expect(dialog(page)).toBeVisible()
    // Nur die Animationen des Menüs zählen (MI-05). `document.getAnimations()` liefert in WebKit auch den Boil der
    // Leinen-Coco hinter dem Dialog (CSS `coco-boil`, `iterations: Infinity`, per Boil-Budget DESIGN §10.3 nach 2 s
    // beendet) – der gehört nicht zu MI-05. Chromium meldet Animationen auf `<use>`-Elementen dort nicht.
    const menuAnimations = await page.evaluate(() =>
      [
        ...new Set([
          ...((window as Window & { __menuAnimations?: Animation[] }).__menuAnimations ?? []),
          ...document.getAnimations(),
        ]),
      ]
        .filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target
          return !!target && !!target.closest('dialog#menu')
        })
        .map((a) => ({
          dialog: (a.effect as KeyframeEffect).target?.matches('dialog#menu') ?? false,
          end: Number((a.effect as KeyframeEffect).getComputedTiming().endTime),
        })),
    )
    // Kreis-Öffnung des Dialogs, 7 gestaffelte Links und Coco laufen; die längste endet nach ≤ 700 ms.
    expect(menuAnimations.filter((a) => a.dialog)).toHaveLength(1)
    expect(menuAnimations.length).toBeGreaterThanOrEqual(9)
    const longest = Math.max(...menuAnimations.map((a) => a.end))
    expect(longest).toBeGreaterThan(0)
    expect(longest).toBeLessThanOrEqual(700)
    await dialog(page).locator('[data-menu-close-button]').click()
    await expect(dialog(page)).toBeHidden()
    await expect(trigger(page)).toBeFocused()
  })

  test('Inhalt: Hauptliste, Kategorien, Tattoo-Unterseiten, Sprache, Instagram, Pflichtlinks inkl. Vertrag widerrufen @smoke', async ({
    page,
  }) => {
    await page.goto('/de')
    await ready(page)
    await trigger(page).click()
    const d = dialog(page)
    await expect(d).toHaveAttribute('aria-label', 'Menü')
    const main = await d
      .locator('[data-menu-item] > a')
      .evaluateAll((els) => els.map((e) => [e.textContent?.trim(), e.getAttribute('href')]))
    expect(main).toEqual([
      ['Start', '/de'],
      ['Shop', '/de/shop'],
      ['Archiv', '/de/archiv'],
      ['Auftragsarbeiten', '/de/auftragsarbeiten'],
      ['Tattoo', '/de/tattoo'],
      ['Über mich & Coco', '/de/ueber-mich'],
      ['Kontakt', '/de/kontakt'],
    ])
    await expect(d.locator('a[href^="/de/shop/kategorie/"]').first()).toBeVisible()
    await expect(d.getByRole('link', { name: 'Flash' })).toHaveAttribute('href', '/de/tattoo/flash')
    await expect(d.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en')
    await expect(d.getByRole('link', { name: /Instagram/ })).toHaveAttribute(
      'href',
      /^https:\/\/www\.instagram\.com\/[a-z0-9._]+\/$/,
    )
    await expect(d.getByRole('link', { name: 'Vertrag widerrufen' })).toHaveAttribute(
      'href',
      '/de/vertrag-widerrufen',
    )
    await expect(d.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
      'href',
      '/de/impressum',
    )
    // aktuelle Seite markiert
    await expect(d.getByRole('link', { name: 'Start', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('Ein Linkklick schließt sofort und navigiert @smoke', async ({ page }) => {
    await page.goto('/de')
    await ready(page)
    await trigger(page).click()
    await dialog(page)
      .locator('[data-menu-item]')
      .getByRole('link', { name: 'Kontakt', exact: true })
      .click()
    await expect(page).toHaveURL(/\/de\/kontakt$/)
    await expect(page.locator('h1')).toHaveText('Kontakt')
    await expect(dialog(page)).toBeHidden()
    await expect(page.locator('html')).not.toHaveAttribute('data-menu-open', '')
  })
})

test.describe('Menü ohne JavaScript @smoke', () => {
  test.use({ javaScriptEnabled: false })

  test('„Menü“ führt zu #fussnavigation @smoke', async ({ page }) => {
    await page.goto('/de')
    const link = trigger(page)
    await expect(link).toHaveAttribute('href', '#fussnavigation')
    await link.click()
    await expect(page).toHaveURL(/#fussnavigation$/)
    await expect(dialog(page)).toBeHidden()
  })
})
