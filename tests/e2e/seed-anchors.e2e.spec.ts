import { buildProductSlug } from '../../src/lib/products/itemNumber'
import { seedToken } from '../../src/lib/seed/tokens'
import { addBerlinDays, berlinDateKey, formatBerlin } from '../../src/lib/time'
import { adminPath, expect, test, testPayload } from './fixtures'
import { freshPage, holdListData, refresh } from './shop/fresh'
import { refreshTattoo } from './tattoo/tattooFixtures'

// P8.21 – Seed-Anker gegen den Beispielbestand (SEED-SPEC §17; Voraussetzung `db:reset --test --seed=all` wie
// `pnpm test:e2e`). Die Anker aus P3–P7, die dort gegen gleichartige Fixtures (Nummern 980–999) liefen, laufen hier
// gegen die echten Seed-Dokumente: Archiv/Sitemap S19/S08, Produktseiten S01, S11, S14, S19, S26, S29, S30, S08 als
// 404-Variante, Bestellstatus O01/O03/O10/O13, Verwaltung „Heute“, Zu packen, Vorkasse, Abholung, Widerrufe, Tattoo
// F-901/F-903/F-905 und die Seite `commissions`. Nur lesend – kein Test reserviert oder kauft ein Seed-Stück.

const status = (key: string) => seedToken(`orders:${key}`, 'status')
const order = (key: string) => `PC-2026-900${key.slice(1)}`
const S08 = {
  de: `/de/shop/${buildProductSlug(908, 'Kleiner Teller „Fuchs auf dem Mond“')}`,
}

async function productUrl(nr: number, locale: 'de' | 'en'): Promise<string> {
  const payload = await testPayload()
  const doc = (
    await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: nr } },
      locale,
      fallbackLocale: 'de',
      overrideAccess: true,
      limit: 1,
      depth: 0,
    })
  ).docs[0] as { slug?: string | null; title?: string | null } | undefined
  expect(doc, `Seed-Stück ${nr}`).toBeTruthy()
  const slug = doc!.slug ?? buildProductSlug(nr, doc!.title)
  return `/${locale}/shop/${slug}`
}

test.describe('P8.21 Seed-Anker öffentlich', () => {
  holdListData(test, 'shared')

  test('P8.21 S19 Archiv und Sitemap (P3.6, P3.7, P3.13): S19 im Archiv und in sitemap.xml, S08 nirgends', async ({
    page,
    request,
  }) => {
    await refresh(request, ['/de/archiv', '/en/archive', '/sitemap.xml'])
    await freshPage(page)
    await page.goto('/de/archiv')
    await expect(page.locator('[data-product-card][data-item-number="919"]')).toBeVisible()
    await expect(page.locator('[data-product-card][data-item-number="908"]')).toHaveCount(0)
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toMatch(/\/de\/shop\/919-/)
    expect(xml).toMatch(/\/en\/shop\/919-/)
    expect(xml).not.toMatch(/\/shop\/908-/)
  })

  test('P8.21 S08 /de/shop/908-… → 404-Variante „schon ein Zuhause“ mit noindex (AK-3-04)', async ({
    page,
    request,
  }) => {
    const res = await request.get(S08.de)
    expect(res.status()).toBe(404)
    expect(await res.text()).toMatch(/<meta name="robots" content="noindex"/)
    await freshPage(page)
    await page.goto(S08.de)
    await expect(page.locator('h1')).toHaveText('Dieses Stück ist weitergezogen')
  })

  test('P8.21 Produktseiten S01 (2 Bilder), S11 (Abweichung, Mischgewebe), S14 (reserviert, Etikett fehlt), S19 (verkauft), S26 (Schmuck), S29 (EN-Rückfall), S30 (nur Abholung)', async ({
    page,
    request,
  }) => {
    const open = async (url: string) => {
      await refresh(request, [url])
      const res = await page.goto(url)
      expect(res?.status(), url).toBe(200)
      await expect(page.locator('[data-product-page]')).toBeVisible()
    }
    await freshPage(page)
    await open(await productUrl(901, 'de'))
    expect(
      await page
        .locator('[data-product-page] [data-gallery] img, [data-product-page] figure img')
        .count(),
    ).toBeGreaterThanOrEqual(2)

    await open(await productUrl(911, 'de'))
    await expect(page.locator('[data-deviation]')).toContainText('Besonderheit dieses Stücks:')
    await expect(page.locator('[data-legal-row="fibers"] dd')).toContainText('%')

    await open(await productUrl(914, 'de'))
    await expect(page.locator('[data-buy-area]')).toHaveAttribute('data-buy-state', 'reserved')
    await expect(page.locator('[data-legal-row="fibers"] [data-label-missing]')).toBeVisible()
    await expect(page.locator('[data-legal-note="textileLabelMissing"]')).toBeVisible()

    await open(await productUrl(919, 'de'))
    await expect(page.locator('[data-sold-text]')).toHaveText('Schon verkauft')
    await expect(page.locator('[data-add-to-cart]')).toHaveCount(0)

    await open(await productUrl(926, 'de'))
    await expect(page.locator('[data-legal-row="metalParts"] dd')).not.toBeEmpty()

    await open(await productUrl(929, 'en'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('[data-add-to-cart] button, [data-sold-text]').first()).toBeVisible()

    await open(await productUrl(930, 'de'))
    await expect(page.locator('[data-product-page]')).toContainText('Abholung')
  })

  test('P8.21 O03 Bestellstatus (P4.23): angefochten → die Kund:in sieht „delivered“ aus statusBeforeDispute; O01, O10, O13 öffnen per seedToken', async ({
    page,
  }) => {
    const res = await page.goto(`/de/bestellung/${status('O03')}`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('[data-order-status-page]')).toHaveAttribute(
      'data-order-status',
      'delivered',
    )
    expect(await page.content()).not.toMatch(/angefochten|disputed/i)
    for (const key of ['O01', 'O10', 'O13']) {
      const r = await page.goto(`/de/bestellung/${status(key)}`)
      expect(r?.status(), key).toBe(200)
      await expect(page.getByText(order(key)).first()).toBeVisible()
      await expect(page.locator('[data-example-note]')).toContainText('Beispiel')
    }
  })

  test('P8.21 F-901/F-903/F-905 Tattoo (P7.2): F-901 mit Anfrage-Knopf, F-903 und F-905 (claimed) ohne Anfrage-Knöpfe hinter den verfügbaren', async ({
    page,
    request,
  }) => {
    await refreshTattoo(request)
    await page.goto('/de/tattoo/flash')
    await expect(page.locator('#f-901 [data-flash-mail]')).toBeVisible()
    for (const n of ['903', '905']) {
      const card = page.locator(`#f-${n}`)
      await expect(card).toHaveAttribute('data-flash-status', 'claimed')
      await expect(card.locator('[data-flash-mail]')).toHaveCount(0)
    }
    const statuses = await page
      .locator('[data-flash-status]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-flash-status')))
    const firstClaimed = statuses.indexOf('claimed')
    expect(firstClaimed).toBeGreaterThan(0)
    expect(statuses.slice(firstClaimed).every((s) => s === 'claimed')).toBe(true)
  })

  test('P8.21 commissions Auftragsarbeiten (P7.10): Seed-Text aus SEED-SPEC §13.4 DE/EN, genau eine h1', async ({
    page,
  }) => {
    await page.goto('/de/auftragsarbeiten')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('main')).toContainText(
      'Ich antworte per Mail mit Preis und ungefährer Dauer.',
    )
    await page.goto('/en/commissions')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('main')).toContainText(
      'I answer by email with a price and a rough timeframe.',
    )
  })
})

test.describe('P8.21 Seed-Anker Verwaltung', () => {
  test('P8.21 Heute (SEED-SPEC §17): Zu packen 2, Vorkasse 1, Abholung 1, Widerrufe 3, Anfragen 1; rote Anfechtung O03; 3 Datenschutz-Anfragen; Beispieldaten vorhanden', async ({
    adminPage: page,
  }) => {
    const payload = await testPayload()
    // „Heute“ zählt alle Datensätze (auch die, die andere Specs desselben Laufs anlegen, z. B. ein Widerruf über das
    // Formular). Der Anker prüft deshalb: genau n Seed-Dokumente je Kachel, und die Kachel zeigt Seed + Nicht-Seed.
    const tiles = [
      ['packen', 2, 'orders', { fulfillmentMethod: { equals: 'shipping' } }, ['paid', 'packed']],
      ['vorkasse', 1, 'orders', {}, ['awaiting_prepayment']],
      [
        'abholung',
        1,
        'orders',
        { fulfillmentMethod: { equals: 'pickup' } },
        ['paid', 'ready_for_pickup'],
      ],
      ['widerrufe', 3, 'withdrawals', {}, ['received', 'goods_returned']],
      ['anfragen', 1, 'inquiries', {}, ['new']],
    ] as const
    const counts = new Map<string, { seed: number; other: number }>()
    for (const [key, , collection, extra, statuses] of tiles) {
      const where = (seed: boolean) => ({
        and: [
          extra,
          { status: { in: [...statuses] } },
          seed ? { seed: { equals: true } } : { seed: { not_equals: true } },
        ],
      })
      const n = async (seed: boolean) =>
        (await payload.count({ collection, where: where(seed) as never, overrideAccess: true }))
          .totalDocs
      counts.set(key, { seed: await n(true), other: await n(false) })
    }
    await page.goto(adminPath('/heute'))
    for (const [key, n] of tiles) {
      const c = counts.get(key)!
      expect(c.seed, `${key} (Seed)`).toBe(n)
      await expect(page.getByTestId(`today-tile-${key}`), key).toHaveAttribute(
        'data-count',
        String(n + c.other),
      )
    }
    const o03 = (
      await payload.find({
        collection: 'orders',
        where: { orderNumber: { equals: order('O03') } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!
    await expect(page.locator(`[data-hint="dispute-${o03.id}"]`)).toHaveAttribute(
      'data-tone',
      'error',
    )
    await expect(page.locator('[data-hint="privacy-requests"]')).toContainText(
      '3 offene Datenschutz-Anfragen',
    )
    await expect(page.locator('[data-hint="seed"]')).toContainText('Beispieldaten vorhanden')
  })

  test('P8.21 O14/O12 Zu packen, O13 Vorkasse offen, O09 Abholung (P5.10, P5.17, P5.18)', async ({
    adminPage: page,
  }) => {
    await page.goto(adminPath('/packen'))
    const packing = await page
      .getByTestId('packing-card')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-order-number')))
    expect(packing).toEqual(expect.arrayContaining([order('O14'), order('O12')]))
    await page.goto(adminPath('/vorkasse'))
    await expect(
      page.locator(`[data-testid="prepayment-card"][data-order-number="${order('O13')}"]`),
    ).toBeVisible()
    await page.goto(adminPath('/abholung'))
    await expect(
      page.locator(`[data-testid="pickup-card"][data-order-number="${order('O09')}"]`),
    ).toBeVisible()
  })

  test('P8.21 W3–W7 Widerrufe (P5.19): W3–W5 offen (W4 „nicht zugeordnet“, W5 mit Frist D+13), W6/W7 abgeschlossen', async ({
    adminPage: page,
  }) => {
    await page.goto(adminPath('/widerrufe'))
    const open = page.getByTestId('withdrawals-open-list')
    const done = page.getByTestId('withdrawals-done-list')
    for (const n of [3, 4, 5])
      await expect(open.locator(`[data-reference="WR-2026-9000${n}"]`)).toBeVisible()
    for (const n of [6, 7])
      await expect(done.locator(`[data-reference="WR-2026-9000${n}"]`)).toBeVisible()
    await expect(
      open.locator('[data-reference="WR-2026-90004"] [data-testid="withdrawal-order"]'),
    ).toContainText('nicht zugeordnet')
    const payload = await testPayload()
    const w5 = (
      await payload.find({
        collection: 'withdrawals',
        where: { reference: { equals: 'WR-2026-90005' } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0] as { receivedAt: string; refundDueAt: string }
    // Frist = Eingang + 14 Kalendertage in Berlin (Eingang D-1 → D+13)
    expect(berlinDateKey(new Date(w5.refundDueAt))).toBe(
      berlinDateKey(addBerlinDays(new Date(w5.receivedAt), 14)),
    )
    await expect(
      open.locator('[data-reference="WR-2026-90005"] [data-testid="withdrawal-refund-due"]'),
    ).toContainText(formatBerlin(new Date(w5.refundDueAt), 'dd.MM.yyyy'))
  })
})
