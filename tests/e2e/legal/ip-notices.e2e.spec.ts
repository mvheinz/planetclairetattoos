import { expect, test } from '../fixtures'
import { ANCHORS, PUBLISHED, openProduct, pathOf } from '../shop/productPage'

// P12.11 / U-22: Schutz des geistigen Eigentums sichtbar (R-140: Footer, Produktseite, Flash/Preise/Ablauf) und
// technisch (R-141: /ai.txt, TDMRep, Meta, Header). E2E läuft mit APP_ENV=test: robots.txt sperrt dort alles, der
// KI-Ausschluss in `robots.txt` und im Header der Produktion ist unit-getestet (`tests/unit/seo/ai-reservation`).

test.describe('R-140 Urheberrechtsvermerk, Kaufklausel, Flash-Genehmigung', () => {
  for (const [locale, path] of [
    ['de', '/de'],
    ['en', '/en'],
  ] as const) {
    test(`R-140 ${locale}: Footer zeigt Urheberrechtsvermerk und KI-/TDM-Vorbehalt (aus den Bausteinen)`, async ({
      page,
    }) => {
      await page.goto(path)
      const notice = page.locator('[data-site-footer] [data-ip-notice="footer"]')
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(
        locale === 'de' ? 'urheberrechtlich geschützt' : 'protected by copyright',
      )
      await expect(notice).toContainText('44b')
      await expect(notice).toHaveAttribute('lang', locale)
    })
  }

  test('R-140 Produktseite zeigt die Kaufklausel (nur das Unikat, keine Rechte am Motiv), DE und EN', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('keramik', PUBLISHED)
    await openProduct(page, request, await pathOf(itemNumber, 'de'))
    await expect(page.locator('[data-ip-notice="purchase"]')).toContainText('Nachdruck')
    await expect(page.locator('[data-ip-notice="purchase"]')).toContainText('Unikat')
    await openProduct(page, request, await pathOf(itemNumber, 'en'))
    await expect(page.locator('[data-ip-notice="purchase"]')).toContainText('reprints')
    await openProduct(page, request, ANCHORS.S11.en)
    await expect(page.locator('[data-ip-notice="purchase"]')).toHaveCount(1)
  })

  for (const path of [
    '/de/tattoo/flash',
    '/de/tattoo/preise',
    '/de/tattoo/ablauf',
    '/en/tattoo/flash',
    '/en/tattoo/prices',
    '/en/tattoo/process',
  ]) {
    test(`R-140 ${path}: Hinweis „Nachstechen nur mit schriftlicher Genehmigung“`, async ({
      page,
    }) => {
      await page.goto(path)
      const notice = page.locator('[data-ip-notice="flash"]')
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(
        path.startsWith('/de') ? 'schriftlichen Genehmigung' : 'written permission',
      )
    })
  }

  test('R-140 andere Tattoo-Seiten (Aftercare) tragen den Flash-Hinweis nicht', async ({
    page,
  }) => {
    await page.goto('/de/tattoo/aftercare')
    await expect(page.locator('[data-ip-notice="flash"]')).toHaveCount(0)
  })

  test('R-140 AGB DE/EN enthalten Kaufklausel, KI-Vorbehalt und Flash-Abschnitt', async ({
    page,
  }) => {
    await page.goto('/de/agb')
    const de = page.locator('[data-legal-text="agb"]')
    await expect(de.locator('h2', { hasText: 'Urheberrecht und Kaufklausel' })).toBeVisible()
    await expect(de.locator('h2', { hasText: 'Tattoo-Motive und Flash' })).toBeVisible()
    await expect(de).toContainText('Weiterverkauf als Reproduktion')
    await page.goto('/en/terms')
    const en = page.locator('[data-legal-text="agb"]')
    await expect(en.locator('h2', { hasText: 'Copyright and purchase clause' })).toBeVisible()
    await expect(en.locator('h2', { hasText: 'Tattoo designs and flash' })).toBeVisible()
    await expect(en).toContainText('resale as a reproduction')
  })
})

test.describe('R-141 KI-/Text-und-Data-Mining-Vorbehalt technisch', () => {
  test('R-141 /ai.txt und /.well-known/tdmrep.json sind erreichbar, ohne Cookie', async ({
    request,
  }) => {
    const ai = await request.get('/ai.txt', { maxRedirects: 0 })
    expect(ai.status()).toBe(200)
    const body = await ai.text()
    for (const bot of [
      'GPTBot',
      'ClaudeBot',
      'CCBot',
      'Google-Extended',
      'PerplexityBot',
      'Bytespider',
      'anthropic-ai',
    ])
      expect(body, bot).toContain(`User-Agent: ${bot}`)
    expect(ai.headers()['set-cookie']).toBeUndefined()
    const tdm = await request.get('/.well-known/tdmrep.json', { maxRedirects: 0 })
    expect(tdm.status()).toBe(200)
    expect(await tdm.json()).toEqual([{ location: '/*', 'tdm-reservation': 1 }])
  })

  test('R-141 Antworten tragen den TDMRep-Header, indexierbare Seiten das Meta tdm-reservation', async ({
    page,
    request,
  }) => {
    const res = await request.get('/de/impressum')
    expect(res.headers()['tdm-reservation']).toBe('1')
    await page.goto('/de/impressum')
    await expect(page.locator('meta[name="tdm-reservation"]')).toHaveAttribute('content', '1')
  })

  test('R-141 Impressum nennt den Vorbehalt samt robots.txt, ai.txt und Meta-Angaben (DE und EN)', async ({
    page,
  }) => {
    await page.goto('/de/impressum')
    await expect(page.locator('[data-legal-text="impressum"]')).toContainText('§ 44b Abs. 3 UrhG')
    await expect(page.locator('[data-legal-text="impressum"]')).toContainText('ai.txt')
    await page.goto('/en/legal-notice')
    await expect(page.locator('[data-legal-text="impressum"]')).toContainText(
      'Section 44b (3) UrhG',
    )
  })
})
