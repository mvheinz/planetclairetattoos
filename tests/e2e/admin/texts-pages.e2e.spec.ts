import type { Page as PayloadPage } from '@/payload-types'

import { PAGE_KEYS } from '../../../src/lib/enums'
import { localizedPath } from '../../../src/lib/routes/paths'
import { ADMIN_VIEWS } from '../../../scripts/preview-export/adminViews'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { refresh } from '../shop/fresh'
import { refreshTattoo } from '../tattoo/tattooFixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P8.19a – Verwaltung „Texte“ → „Seiten und FAQ“ (KONZEPT §7.13) auf dem Handy (390 × 844): jede Seite aus `PAGE_KEYS`
// mit Titel/SEO/Textblöcken DE und EN, „Übersetzen“ (Mock „[EN] …“), Speichern → öffentlich ≤ 60 s; FAQ-Reihenfolge per
// „Hoch“ (Tastatur) erscheint öffentlich genauso; axe ohne serious/critical; keine Verwaltungsansicht zeigt mehr
// „kommt in P…“ außer dem Startklar-Hinweis „kommt in P10“. Geänderte Seed-Seite und FAQ werden danach per Local API
// in den Seed-Zustand zurückgesetzt (gemeinsame E2E-Datenbank, andere Suiten prüfen die Seed-Texte).

test.describe.configure({ mode: 'serial' })

type Snapshot = { de: PayloadPage; en: PayloadPage }

async function snapshotPage(key: string): Promise<Snapshot> {
  const payload = await testPayload()
  const get = async (locale: 'de' | 'en') =>
    (
      await payload.find({
        collection: 'pages',
        where: { key: { equals: key } },
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0] as PayloadPage
  return { de: await get('de'), en: await get('en') }
}

async function restorePage(s: Snapshot) {
  const payload = await testPayload()
  for (const locale of ['de', 'en'] as const) {
    const doc = s[locale]
    await payload.update({
      collection: 'pages',
      id: doc.id,
      locale,
      data: { title: doc.title, layout: doc.layout, seo: doc.seo, seed: doc.seed } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  }
}

test('@a11y P8.19a jede Seite aus PAGE_KEYS bei 390 px in DE und EN bearbeitbar, ohne horizontales Scrollen, axe', async ({
  adminPage: page,
}) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/texte'))
  await expect(page.getByTestId('texts-page-item')).toHaveCount(PAGE_KEYS.length)
  await expectAccessible(page, '[data-testid="texts-pages-area"]')
  for (const key of PAGE_KEYS) {
    await page.getByTestId(`texts-page-link-${key}`).click()
    const editor = page.getByTestId('texts-page-editor')
    await expect(editor, key).toHaveAttribute('data-key', key, { timeout: 20_000 })
    const form = editor.getByTestId(`page-texts-all-${key}`)
    await expect(form.getByTestId('tf-title.de')).not.toHaveValue('')
    await expect(form.getByTestId('tf-title.en')).toBeVisible()
    await expect(form.getByTestId('tf-seo.metaTitle.en')).toBeVisible()
    expect(
      await form.locator('[data-testid^="tf-blocks."][data-testid$=".en"]').count(),
      `${key}: englische Blockfelder`,
    ).toBeGreaterThan(0)
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '[data-testid="texts-pages-area"]')
  }
})

test('P8.19a Seite „Archiv“: Übersetzen füllt EN, Speichern setzt seed = false, öffentlich ≤ 60 s sichtbar', async ({
  adminPage: page,
  request,
}) => {
  test.setTimeout(150_000)
  const snapshot = await snapshotPage('archive')
  expect(snapshot.de.seed).toBe(true)
  const stamp = `Juttas Archiv-Text ${Date.now().toString(36)}`
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/texte'))
    await page.getByTestId('texts-page-link-archive').click()
    const form = page.getByTestId('page-texts-all-archive')
    await expect(form).toBeVisible()
    await expect(page.getByTestId('texts-page-seed-hint')).toBeVisible()
    const block = form.locator('[data-testid="page-block"][data-block-type="richText"]').first()
    const field = (l: 'de' | 'en') =>
      block.locator(`[data-testid^="tf-blocks."][data-testid$=".fields.content.${l}"]`)
    await field('de').fill(stamp)
    await field('en').fill('')
    await form.getByTestId('tf-title.en').fill('')
    await form.getByTestId('translate-button').click()
    const onlyEmpty = page.getByTestId('confirm-dialog-ok')
    await onlyEmpty
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => onlyEmpty.click())
      .catch(() => undefined)
    await expect(field('en')).toHaveValue(`[EN] ${stamp}`)
    await expect(form.getByTestId('tf-title.en')).toHaveValue(/^\[EN\] /)
    await form.getByTestId('page-save-all-archive').click()
    await expect(form.getByTestId('page-saved-all-archive')).toBeVisible()
    await expectNoHorizontalScroll(page)

    const payload = await testPayload()
    const saved = await payload.findByID({
      collection: 'pages',
      id: snapshot.de.id,
      overrideAccess: true,
    })
    expect(saved.seed).toBe(false)

    // Öffentlich sichtbar nach spätestens 60 s (KONZEPT §1.6, stale-while-revalidate)
    for (const [locale, text] of [
      ['de', stamp],
      ['en', `[EN] ${stamp}`],
    ] as const) {
      await expect
        .poll(
          async () => {
            const res = await request.get(localizedPath('R05', locale))
            return (await res.text()).includes(text)
          },
          { timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
        )
        .toBe(true)
    }
  } finally {
    await restorePage(snapshot)
    await refresh(request, [localizedPath('R05', 'de'), localizedPath('R05', 'en')])
  }
})

test('P8.19a FAQ-Reihenfolge per Tastatur ändern – erscheint öffentlich genauso', async ({
  adminPage: page,
  request,
}) => {
  test.setTimeout(150_000)
  const payload = await testPayload()
  const before = (
    await payload.find({
      collection: 'faqs',
      where: { category: { equals: 'tattoo' } },
      sort: 'sortOrder',
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
  ).docs
  expect(before.length).toBeGreaterThan(1)
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/texte'))
    const list = page.getByTestId('texts-faq-tattoo')
    const items = list.getByTestId('faq-item')
    await expect(items).toHaveCount(before.length)
    await expect(items.nth(1)).toHaveAttribute('data-id', String(before[1]!.id))
    const up = items.nth(1).getByTestId('faq-up')
    await up.focus()
    await page.keyboard.press('Enter')
    await expect(items.nth(0)).toHaveAttribute('data-id', String(before[1]!.id))
    await expect(items.nth(1)).toHaveAttribute('data-id', String(before[0]!.id))
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '[data-testid="texts-pages-area"]')

    // öffentlich (R18 Tattoo-FAQ, Kategorie tattoo) in derselben Reihenfolge
    await expect
      .poll(
        async () => {
          const html = await (await request.get(localizedPath('R18', 'de'))).text()
          const a = html.indexOf(`data-faq="${before[1]!.id}"`)
          const b = html.indexOf(`data-faq="${before[0]!.id}"`)
          return a >= 0 && b >= 0 && a < b
        },
        { timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
      )
      .toBe(true)
  } finally {
    for (const f of before) {
      await payload.update({
        collection: 'faqs',
        id: f.id,
        data: { sortOrder: f.sortOrder, seed: f.seed } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    }
    await refreshTattoo(request)
  }
})

test('P8.19a keine Verwaltungsansicht zeigt mehr „kommt in P…“ außer „kommt in P10“ (Startklar)', async ({
  adminPage: page,
}) => {
  // 20+ Ansichten nacheinander: eigenes Zeitbudget. Eine Ansicht, die nach dem Laden selbst neu lädt (z. B.
  // `router.refresh`), kann den nächsten `goto` abbrechen (ERR_ABORTED) – dann einmal wiederholen.
  test.setTimeout(180_000)
  const open = async (url: string) => {
    try {
      return await page.goto(url)
    } catch (e) {
      if (!String(e).includes('ERR_ABORTED')) throw e
      return page.goto(url)
    }
  }
  for (const view of ADMIN_VIEWS) {
    if (view.anonymous) continue
    const res = await open(adminPath(view.path))
    if (!res || res.status() >= 400) continue
    await expect(page.locator('body')).not.toHaveText(/^$/)
    const text = await page.locator('body').innerText()
    const hits = [...text.matchAll(/kommt in P(\d+)/g)].map((m) => m[0])
    expect(
      hits.filter((h) => h !== 'kommt in P10'),
      `${view.key} (${view.path || '/'})`,
    ).toEqual([])
  }
})
