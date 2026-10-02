import type { Page } from '@playwright/test'

import { DOUBLE_TAP_MS } from '../../../src/behaviors/lightbox'
import { expect, test } from '../fixtures'
import { holdListData } from './fresh'
import { ANCHORS, openProduct } from './productPage'

// P3.10 Produktgalerie, Zoom und mobile Kauf-Leiste (DESIGN KO-09, KO-09a; KONZEPT §3.4 Nr. 1): Projekte `desktop` und
// `iphone-15`. S01 (Nr. 901) hat zwei Fotos, S06 (Nr. 906) ist verkauft.

test.beforeEach(({}, testInfo) => {
  test.skip(
    !['desktop', 'iphone-15'].includes(testInfo.project.name),
    'Galerie-Tests laut PLAN P3.10 in den Projekten desktop und iphone-15',
  )
})

// Seed-Anker S01/S06 und die Kauf-Leiste nicht gleichzeitig mit Tests lesen, die den Bestand kurz ändern (Archiv-
// Leerzustand, „Shop pausiert“ – beide exklusiv).
holdListData(test, 'shared')

const gallery = (page: Page) => page.locator('[data-gallery]')
const counter = (page: Page) => page.locator('[data-gallery-counter]')
const bound = (page: Page) => expect(gallery(page)).toHaveAttribute('data-gallery-index', '0')

test.describe('KO-09 Galerie', () => {
  test('erstes Foto ist LCP-Kandidat: fetchpriority high, ohne lazy, srcset nur aus card/detail; Galerie vor der H1', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    const first = page.locator('[data-gallery-slide="0"] img')
    await expect(first).toHaveAttribute('fetchpriority', 'high')
    expect(await first.getAttribute('loading')).toBeNull()
    await expect(first).toHaveAttribute('sizes', '(min-width: 768px) 36rem, 100vw')
    // `srcset` nur aus vorhandenen Größen `card`/`detail` (die Seed-Fotos sind kleiner, dann nur `src`).
    const srcset = await first.getAttribute('srcset')
    if (srcset) expect(srcset).toMatch(/^\S+ \d+w(, \S+ \d+w)?$/)
    await expect(page.locator('[data-gallery-slide="1"] img')).toHaveAttribute('loading', 'lazy')
    const before = await gallery(page).evaluate(
      (g) =>
        !!(
          g.compareDocumentPosition(document.querySelector('h1')!) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
    )
    expect(before).toBe(true)
    await expect(page.locator('[data-gallery-track]')).toHaveAttribute(
      'aria-roledescription',
      'Bildergalerie',
    )
  })

  test('Tastatur: Pfeiltasten wechseln das Foto, Zähler wird nach der Taste angesagt', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    await bound(page)
    await expect(counter(page)).toHaveText('1 / 2')
    await expect(counter(page)).not.toHaveAttribute('aria-live', /.+/)
    await page.locator('[data-gallery-track]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(counter(page)).toHaveText('2 / 2')
    await expect(counter(page)).toHaveAttribute('aria-live', 'polite')
    await expect
      .poll(() => page.locator('[data-gallery-track]').evaluate((t) => Math.round(t.scrollLeft)))
      .toBeGreaterThan(0)
    await page.keyboard.press('ArrowLeft')
    await expect(counter(page)).toHaveText('1 / 2')
  })

  test('ab 768 px: Knöpfe und Miniaturen (aria-current); mobil ausgeblendet', async ({
    page,
    request,
  }, testInfo) => {
    await openProduct(page, request, ANCHORS.S01.de)
    await bound(page)
    const next = page.getByRole('button', { name: 'Nächstes Foto' })
    if (testInfo.project.name === 'iphone-15') {
      await expect(next).toBeHidden()
      await expect(page.locator('[data-gallery-thumbs]')).toBeHidden()
      return
    }
    await next.click()
    await expect(counter(page)).toHaveText('2 / 2')
    await expect(page.locator('[data-gallery-thumb="1"]')).toHaveAttribute('aria-current', 'true')
    await page.locator('[data-gallery-thumb="0"]').click()
    await expect(counter(page)).toHaveText('1 / 2')
    await expect(page.locator('[data-gallery-thumb="0"]')).toHaveAttribute('aria-current', 'true')
  })

  test('Lightbox: öffnen, Esc schließt, Fokus zurück aufs Foto; Zurück-Taste schließt ebenfalls', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    await bound(page)
    const url = page.url()
    const photo = page.locator('[data-gallery-slide="0"] a[data-zoom-src]')
    const dialog = page.locator('dialog[data-lightbox]')
    await photo.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-lightbox-img]')).toHaveAttribute('src', /.+/)
    await expect(page.getByRole('button', { name: 'Schließen' })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('2 / 2')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(photo).toBeFocused()
    expect(page.url()).toBe(url)

    await photo.click()
    await expect(dialog).toBeVisible()
    await page.goBack()
    await expect(dialog).toBeHidden()
    expect(page.url()).toBe(url)
    await expect(photo).toBeFocused()
    await expect(page.locator('[data-product-page]')).toBeVisible()
  })

  test('Lightbox: Knopf „Schließen“ und Zoom 1× ↔ 2× (Maus-Klick bzw. Doppeltipp)', async ({
    page,
    request,
  }, testInfo) => {
    await openProduct(page, request, ANCHORS.S01.de)
    await bound(page)
    await page.locator('[data-gallery-slide="0"] a[data-zoom-src]').click()
    const stage = page.locator('[data-lightbox-stage]')
    const img = page.locator('[data-lightbox-img]')
    await expect(img).toBeVisible()
    if (testInfo.project.name === 'desktop') {
      await img.click()
      await expect(stage).toHaveAttribute('data-zoomed', '')
      await img.click()
      await expect(stage).not.toHaveAttribute('data-zoomed', '')
    } else {
      // Doppeltipp: zwei Touch-Tipps in einem Zug (das Modul wertet die Zeitstempel der Ereignisse aus, Fenster 300 ms).
      // Zwei getrennte `tap()` lagen unter Maschinenlast bis knapp an das Fenster heran (P4.25) – das prüfte die
      // Auslastung des Testrechners, nicht die Seite. Ein einzelner echter Tipp zoomt nicht.
      await img.tap()
      await page.waitForTimeout(DOUBLE_TAP_MS + 50)
      await expect(stage).not.toHaveAttribute('data-zoomed', '')
      await img.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
        for (let i = 0; i < 2; i++)
          for (const type of ['pointerdown', 'pointerup'])
            el.dispatchEvent(
              new PointerEvent(type, {
                ...at,
                bubbles: true,
                cancelable: true,
                pointerType: 'touch',
                pointerId: 7,
                isPrimary: true,
              }),
            )
      })
      await expect(stage).toHaveAttribute('data-zoomed', '')
    }
    await page.getByRole('button', { name: 'Schließen' }).click()
    await expect(page.locator('dialog[data-lightbox]')).toBeHidden()
  })

  test('verkauftes Stück: Fotos nicht gedämpft (S06)', async ({ page, request }) => {
    await openProduct(page, request, ANCHORS.S06.de)
    const img = page.locator('[data-gallery-slide="0"] img')
    await expect(img).toBeVisible()
    for (const el of [img, page.locator('[data-gallery]')])
      expect(await el.evaluate((e) => Number(getComputedStyle(e).opacity))).toBe(1)
    await expect(page.locator('[data-buy-bar]')).toHaveCount(0)
  })

  test('reduzierte Bewegung: Taste springt ohne weiches Scrollen', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openProduct(page, request, ANCHORS.S01.de)
    await bound(page)
    await page.locator('[data-gallery-track]').focus()
    await page.keyboard.press('End')
    // Ohne Animation steht die Leiste sofort am Ziel.
    const left = await page
      .locator('[data-gallery-track]')
      .evaluate((t) => Math.round(t.scrollLeft / t.clientWidth))
    expect(left).toBe(1)
    await expect(counter(page)).toHaveText('2 / 2')
  })
})

test.describe('KO-09 ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('alle Fotos per Scrollen erreichbar, Knöpfe/Miniaturen verborgen, Foto-Link auf die Datei', async ({
    page,
  }) => {
    await page.goto(ANCHORS.S01.de)
    const track = page.locator('[data-gallery-track]')
    await expect(page.locator('[data-gallery-slide]')).toHaveCount(2)
    await track.evaluate((t) => t.scrollTo({ left: t.scrollWidth }))
    await expect(page.locator('[data-gallery-slide="1"] img')).toBeInViewport()
    await expect(page.locator('[data-gallery-next]')).toBeHidden()
    await expect(page.locator('[data-buy-bar]')).toBeHidden()
    const link = page.locator('[data-gallery-slide="0"] a')
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/.+/)
    expect(href).toBe(await link.getAttribute('data-zoom-src'))
  })
})

test.describe('KO-09a Kauf-Leiste', () => {
  test('mobil bei available: erscheint, wenn „In den Korb“ oben aus dem Bild ist; Desktop nie', async ({
    page,
    request,
  }, testInfo) => {
    await openProduct(page, request, ANCHORS.S01.de)
    const bar = page.locator('[data-buy-bar]')
    await page.locator('[data-product-shipping]').scrollIntoViewIfNeeded()
    await expect(page.locator('#add-to-cart')).not.toBeInViewport()
    if (testInfo.project.name === 'desktop') {
      await expect(bar).toBeHidden()
      return
    }
    await expect(bar).toHaveAttribute('data-visible', '')
    await expect(bar).toBeInViewport()
    await expect(bar.getByRole('button', { name: 'In den Korb' })).toBeVisible()
    await page.locator('#add-to-cart').scrollIntoViewIfNeeded()
    await expect(bar).not.toHaveAttribute('data-visible', '')
  })

  test('nicht bei reserviert (S27)', async ({ page, request }) => {
    await openProduct(page, request, ANCHORS.S27.de)
    await expect(page.locator('[data-buy-bar]')).toHaveCount(0)
  })
})
