import { expectNoSeriousViolations } from '../axe'
import { expect, test, testPayload } from '../fixtures'
import { refreshTattoo, removeMedia, uploadImage } from './tattooFixtures'

// P7.2 – R12 Flash (KONZEPT §9.3, §9.4, DESIGN KO-20): Fixture-Motive 981 „Kelch mit Schlange“ (`available`, analog
// F-901) und 983/985 (`claimed`, analog F-903/F-905); Mail-Knopf mit exaktem Betreff (AK-9-02, R-170), vergebene ohne
// Anfrage-Knöpfe hinter den verfügbaren, Preise mit Sternchen und Gesamtpreis-Hinweis (R-034), Filter „verfügbar“,
// axe, ohne JavaScript lesbar. Mit den echten Ankern F-901, F-903, F-905 prüft P8.21.

const NUMBERS = [981, 983, 985]
let image: { id: number; filename: string }

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
  const payload = await testPayload()
  await payload.delete({
    collection: 'flash',
    where: { number: { in: NUMBERS } },
    overrideAccess: true,
    context: { seed: true },
  })
  image = await uploadImage('Kelch mit Schlange, Tusche auf Papier')
  const base = { image: image.id, sizeCm: 9, sizeNote: 'Größe anpassbar', seed: true }
  const make = async (data: Record<string, unknown>, en: string) => {
    const doc = await payload.create({
      collection: 'flash',
      data: { ...base, ...data } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.update({
      collection: 'flash',
      id: doc.id,
      locale: 'en',
      data: { title: en } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  }
  await make(
    { number: 983, title: 'Hasen-Trio', status: 'claimed', priceCents: 9000, sortOrder: 0 },
    'Bunny trio',
  )
  await make(
    {
      number: 981,
      title: 'Kelch mit Schlange',
      status: 'available',
      priceCents: 12000,
      sortOrder: 50,
    },
    'Chalice with snake',
  )
  await make(
    { number: 985, title: 'Herz mit Beinen', status: 'claimed', priceCents: 8000, sortOrder: 1 },
    'Heart with legs',
  )
  await refreshTattoo(request)
})

test.afterAll(async ({ request }) => {
  const payload = await testPayload()
  await payload.delete({
    collection: 'flash',
    where: { number: { in: NUMBERS } },
    overrideAccess: true,
    context: { seed: true },
  })
  await removeMedia([image.id])
  await refreshTattoo(request)
})

test('AK-9-02 Mail-Knopf von F-981 mit exaktem Betreff; vergebene ohne Anfrage-Knöpfe hinter den verfügbaren', async ({
  page,
}) => {
  await page.goto('/de/tattoo/flash')
  const card = page.locator('#f-981')
  await expect(card).toBeVisible()
  const mail = card.locator('[data-flash-mail]')
  const href = (await mail.getAttribute('href'))!
  expect(href).toMatch(
    /^mailto:[^?]+\?subject=Flash-Anfrage%20F-981%20%E2%80%93%20Kelch%20mit%20Schlange&body=/,
  )
  expect(decodeURIComponent(/body=([^&]+)/.exec(href)![1]!)).toContain(
    'Bitte keine Gesundheitsinfos – die klären wir persönlich.',
  )
  // P12.7 (U-15): Anfrageweg nur E-Mail – kein DM-Knopf, kein DM-Baustein.
  await expect(card.locator('[data-flash-dm], [data-flash-snippet]')).toHaveCount(0)
  await expect(card.locator('a[href*="ig.me"]')).toHaveCount(0)
  await expect(card.locator('[data-flash-number]')).toHaveText('F-981')

  const order = await page
    .locator('[data-flash-card]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-flash-card')))
  const fixtureOrder = order.filter((n) => ['F-981', 'F-983', 'F-985'].includes(n ?? ''))
  expect(fixtureOrder).toEqual(['F-981', 'F-983', 'F-985'])
  for (const n of ['983', '985']) {
    const claimed = page.locator(`#f-${n}`)
    await expect(claimed).toHaveAttribute('data-flash-status', 'claimed')
    await expect(claimed.locator('[data-flash-mail]')).toHaveCount(0)
    await expect(claimed.locator('[data-flash-taken]')).toContainText(
      'Schon vergeben – schau dir die anderen an',
    )
    await expect(claimed.locator('[data-taken-stamp]')).toContainText('vergeben')
  }

  await page.goto('/en/tattoo/flash#f-981')
  const en = page.locator('#f-981 [data-flash-mail]')
  expect(await en.getAttribute('href')).toContain(
    'subject=Flash%20request%20F-981%20%E2%80%93%20Chalice%20with%20snake&',
  )
  await expect(page.locator('#f-983 [data-taken-stamp]')).toContainText('taken')
})

test('R-034 Preise mit Sternchen und Gesamtpreis-Hinweis; Filter „verfügbar“ zeigt nur verfügbare', async ({
  page,
}) => {
  await page.goto('/de/tattoo/flash')
  await expect(page.locator('#f-981 [data-flash-price]')).toHaveText(/120\s€\*$/)
  await expect(page.locator('#f-981 [data-flash-price]')).toHaveAttribute(
    'aria-describedby',
    'tattoo-price-footnote',
  )
  const note = page.locator('#tattoo-price-footnote')
  await expect(note).toHaveCount(1)
  await expect(note).toContainText('Gesamtpreis')
  await expect(note).toContainText('§ 19 UStG')
  await expect(page.locator('main')).not.toContainText(/inkl\.\s*MwSt/)
  // Kein Preisschild, kein Korb, kein Formular (E-51).
  await expect(
    page.locator('main form, main [data-price-tag], main [data-add-to-cart]'),
  ).toHaveCount(0)

  await page.locator('[data-flash-filter] [data-chip="available"]').click()
  await expect(page).toHaveURL(/\/de\/tattoo\/flash\?available=1$/)
  await expect(page.locator('[data-flash-filter] [data-chip="available"]')).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.locator('#f-981')).toBeVisible()
  await expect(page.locator('[data-flash-status="claimed"]')).toHaveCount(0)
})

test('AK-9-02 R12 axe ohne serious/critical und ohne JavaScript vollständig lesbar @a11y', async ({
  page,
  browser,
}) => {
  await page.goto('/de/tattoo/flash')
  await expect(page.locator('#f-981')).toBeVisible()
  await expectNoSeriousViolations(page, '/de/tattoo/flash')
  // Hover/Fokus: Stencil-Schatten ohne Übergang (MI-14).
  await page.locator('#f-981 [data-flash-mail]').focus()
  const shadow = await page
    .locator('#f-981')
    .evaluate((el) => [getComputedStyle(el).boxShadow, getComputedStyle(el).transitionDuration])
  expect(shadow[0]).not.toBe('none')
  expect(shadow[1]).toBe('0s')

  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const noJs = await context.newPage()
    await noJs.goto('/de/tattoo/flash')
    await expect(noJs.locator('#f-981 h3')).toHaveText('Kelch mit Schlange')
    await expect(noJs.locator('#f-981 [data-flash-mail]')).toBeVisible()
    await expect(noJs.locator('#tattoo-price-footnote')).toBeVisible()
    await expect(noJs.locator('[data-tattoo-contact] [data-tattoo-email]')).toBeVisible()
  } finally {
    await context.close()
  }
})
