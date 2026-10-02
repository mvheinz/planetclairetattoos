import { sql } from '@payloadcms/db-postgres'

import { dbOf } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  removeOrder,
} from './orderHelpers'

// P6.4 Rechtstexte in der Verwaltung (KONZEPT §7.13) bei 390×844: Vorschau zeigt Token-Fehler ohne zu speichern, neue
// AGB-Fassung veröffentlichen (Rückfrage „Ab {Datum} gilt dieser Text für neue Bestellungen.“), danach unveränderlich;
// Anzahl Bestellungen je Fassung stimmt mit den Fixture-Bestellungen (analog Seed, `legalTextVersions` = aktive
// Fassung). Die neue Fassung behält die Platzhalter-Gliederung (Arbeitsfassung, nur Deutsch), damit die öffentlichen
// Rechtsseiten-Tests (Band, R-015) weiter gelten.

const AGB_OUTLINE = [
  'Geltungsbereich',
  'Vertragsschluss',
  'Preise und Zahlung',
  'Vorkasse',
  'Lieferung und Abholung',
  'Eigentumsvorbehalt',
  'Mängelhaftung',
  'Vertragstext und Vertragssprache',
]
  .map((h) => `<h2>${h}</h2>\n<p>Text folgt von der Kanzlei.</p>`)
  .join('\n')

async function agbOrderCounts(): Promise<Map<number, number>> {
  const res = await dbOf(await testPayload()).execute(sql`
    SELECT legal_text_versions_agb_id AS id, count(*)::int AS n FROM orders GROUP BY 1
  `)
  return new Map(res.rows.map((r) => [Number(r.id), Number(r.n)]))
}

async function activeAgb() {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'legal-texts',
    where: { and: [{ type: { equals: 'agb' } }, { status: { equals: 'active' } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0]!
}

// Veröffentlicht eine echte neue Fassung in der gemeinsamen Test-DB – nur einmal je Lauf (Projekt `desktop`).
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'ändert gemeinsame Daten – nur einmal je Lauf')
})

test('@a11y P6.4 neue AGB-Version bei 390×844: Vorschau mit Token-Fehler speichert nichts, Veröffentlichen, danach unveränderlich, Bestellzahlen je Fassung', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  test.slow()
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik')
  const orders = [
    await fixtureOrder(payload, piece, 90_000 + piece.itemNumber * 10 + 4),
    await fixtureOrder(payload, piece, 90_000 + piece.itemNumber * 10 + 5),
  ]
  try {
    const before = await activeAgb()
    const v = before.version ?? 0
    const counts = await agbOrderCounts()
    expect(counts.get(before.id) ?? 0).toBeGreaterThanOrEqual(2)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/texte'))
    const card = page.locator('[data-testid="legal-type"][data-type="agb"]')
    await expect(page.getByTestId('legal-type')).toHaveCount(6)
    await expect(card.getByTestId('legal-active-version')).toHaveText(`v${v}`)
    await expect(card.getByTestId('legal-active-orders')).toHaveText(
      String(counts.get(before.id) ?? 0),
    )
    await expect(
      page.locator('[data-testid="legal-snippet-row"][data-key="checkout.legalNotice"]'),
    ).toContainText('ja')
    await expectNoHorizontalScroll(page)

    // Vorschau mit unbekanntem Platzhalter: Fehlerliste, Veröffentlichen gesperrt, nichts gespeichert.
    const total = await payload.count({
      collection: 'legal-texts',
      where: { type: { equals: 'agb' } },
      overrideAccess: true,
    })
    await card.getByTestId('legal-new-version').click()
    const editor = card.getByTestId('legal-editor')
    await editor.getByTestId('legal-text-de').fill(`${AGB_OUTLINE}\n<p>Anbieterin: {{firma}}</p>`)
    await editor.getByTestId('legal-preview').click()
    await expect(editor.getByTestId('legal-preview-errors')).toContainText('{{firma}}')
    await expect(editor.getByTestId('legal-publish')).toBeDisabled()
    expect(
      (
        await payload.count({
          collection: 'legal-texts',
          where: { type: { equals: 'agb' } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(total.totalDocs)
    await expectNoHorizontalScroll(page)

    // Korrigiert: Vorschau ohne Fehler, Veröffentlichen mit Rückfrage.
    await editor.getByTestId('legal-text-de').fill(AGB_OUTLINE)
    await editor.getByTestId('legal-preview').click()
    await expect(editor.getByTestId('legal-preview-ok')).toBeVisible()
    await expect(editor.getByTestId('legal-preview-de').locator('h2').first()).toHaveText(
      'Geltungsbereich',
    )
    await editor.getByTestId('legal-publish').click()
    const today = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date())
    await expect(page.locator('dialog[open]')).toContainText(
      `Ab ${today} gilt dieser Text für neue Bestellungen.`,
    )
    await expectAccessible(page, '.pc-admin-view')
    await page.getByTestId('confirm-dialog-ok').click()
    await expect(card.getByTestId('legal-published')).toContainText(
      `Version ${v + 1} ist veröffentlicht`,
    )

    const after = await activeAgb()
    expect(after.version).toBe(v + 1)
    expect(after.origin).toBe('draft')
    await expect(card.getByTestId('legal-active-version')).toHaveText(`v${after.version}`)
    await expect(card.getByTestId('legal-active-orders')).toHaveText('0')
    const now = await agbOrderCounts()
    await card.locator('summary').click()
    await expect(
      card.locator(`[data-testid="legal-version-row"][data-id="${before.id}"]`),
    ).toContainText(String(now.get(before.id)))
    await expect(
      card
        .locator(`[data-testid="legal-version-row"][data-id="${before.id}"]`)
        .getByTestId('legal-version-orders'),
    ).toHaveText(String(now.get(before.id) ?? 0))
    await expectNoHorizontalScroll(page)

    // Veröffentlichte Fassung nicht mehr änderbar (KONZEPT §7.16).
    const patch = await page.request.patch(`/api/legal-texts/${after.id}`, {
      data: { changeNote: 'nachträglich geändert' },
    })
    expect(patch.status()).toBeGreaterThanOrEqual(400)
    const reread = await payload.findByID({
      collection: 'legal-texts',
      id: after.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(reread.changeNote ?? null).not.toBe('nachträglich geändert')
  } finally {
    for (const o of orders) await removeOrder(payload, o.id)
  }
})
