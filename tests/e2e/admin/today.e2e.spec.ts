import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  removeOrder,
} from './orderHelpers'

// P5.28 – „Heute“ (KONZEPT §7.3): Kacheln mit Zahl und Link, rote Hinweise (Anfechtung) mit Link, letzte Bestellungen,
// Schnellknopf „Neues Stück“; Handy 390 × 844 ohne horizontales Scrollen, axe ohne serious/critical.
// P5.27 – „Texte“: Bereiche, Mail-Bausteine DE/EN und Vorlagen mit Bestellnummer (mailto, Arbeitsfassung).

test('@a11y „Heute“: Kacheln, roter Hinweis Anfechtung mit Link, letzte Bestellungen, 390 px', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik')
  const disputed = await fixtureOrder(
    payload,
    piece,
    90_000 + piece.itemNumber * 10 + 3,
    {
      status: 'disputed',
      statusBeforeDispute: 'delivered',
      seed: true,
      timestamps: { placedAt: new Date().toISOString() },
    },
    { seed: true },
  )
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/heute'))
    for (const key of ['packen', 'vorkasse', 'abholung', 'widerrufe', 'anfragen']) {
      await expect(page.getByTestId(`today-tile-${key}`)).toBeVisible()
    }
    await expect(page.getByTestId('today-tile-packen')).toHaveAttribute(
      'href',
      adminPath('/packen'),
    )
    const hint = page.locator(`[data-hint="dispute-${disputed.id}"]`)
    await expect(hint).toHaveAttribute('data-tone', 'error')
    await expect(hint).toContainText(disputed.orderNumber)
    await expect(hint.getByRole('link')).toHaveAttribute(
      'href',
      adminPath(`/bestellungen/${disputed.id}`),
    )
    await expect(page.locator('[data-hint="seed"]')).toContainText('Beispieldaten vorhanden')
    await expect(page.getByTestId('today-recent')).toContainText(disputed.orderNumber)
    await expect(page.getByTestId('today-startklar')).toContainText('kommt in P10')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // Startseite `ADMIN_ROUTE` zeigt dieselbe Ansicht; Schnellknopf „Neues Stück“
    await page.goto(adminPath(''))
    await expect(page.getByTestId('today')).toBeVisible()
    await page.getByTestId('today-new-piece').click()
    await expect(page).toHaveURL(new RegExp(`${adminPath('/neues-stueck')}$`))
  } finally {
    await removeOrder(payload, disputed.id)
  }
})

test('@a11y „Texte“: Bereiche, Mail-Bausteine DE/EN, Vorlagen mit Bestellnummer und mailto, 390 px', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik')
  const shipped = await fixtureOrder(
    payload,
    piece,
    90_000 + piece.itemNumber * 10 + 4,
    {
      status: 'shipped',
      seed: true,
      customer: { name: 'Frieda Fiktiv', email: 'frieda.fiktiv@example.com' },
      shipment: { carrier: 'dhl' },
      timestamps: {
        placedAt: '2026-10-12T08:00:00.000Z',
        shippedAt: '2026-10-14T09:30:00.000Z',
      },
    },
    { seed: true },
  )
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/texte'))
    await expect(page.getByTestId('texts-pages-later')).toContainText('P8')
    // Rechtstexte seit P6.4: je Typ eine Karte (Ablauf prüft `admin/legal-texts.e2e.spec.ts`).
    await expect(page.getByTestId('legal-type')).toHaveCount(6)
    const mail = page.getByTestId('texts-mail')
    for (const key of ['signature', 'pickupInstructions', 'inquiryResponseTime']) {
      await expect(mail.getByTestId(`mail-text-${key}`).locator('textarea')).toHaveCount(2)
    }
    await expect(page.getByTestId('area-save-mailTexts')).toBeVisible()
    await expect(page.getByTestId('text-template')).toHaveCount(2)
    await expect(page.getByTestId('text-template').first()).toContainText('Arbeitsfassung')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    await page.getByTestId('texts-order-input').fill(shipped.orderNumber)
    await page.getByTestId('texts-order-input').press('Enter')
    await expect(page.getByTestId('texts-order-active')).toContainText(shipped.orderNumber)
    const breakage = page.locator('[data-testid="text-template"][data-key="breakage_photos"]')
    await expect(breakage.getByTestId('text-template-body')).toContainText('Hallo Frieda,')
    await expect(breakage.getByTestId('text-template-owner-note')).toContainText(
      'bis 21.10.2026 bei DHL reklamieren',
    )
    const href = await breakage.getByTestId('text-template-mailto').getAttribute('href')
    expect(href).toMatch(/^mailto:frieda\.fiktiv@example\.com\?subject=/)
    // „Bitte um IBAN“ passt nicht zu einer versendeten Bestellung → ohne mailto
    await expect(
      page
        .locator('[data-testid="text-template"][data-key="prepayment_refund_iban"]')
        .getByTestId('text-template-mailto'),
    ).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')
  } finally {
    await removeOrder(payload, shipped.id)
  }
})
