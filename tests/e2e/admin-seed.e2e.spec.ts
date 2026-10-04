import pg from 'pg'

import { adminPath, expect, test, testPayload } from './fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './admin/orderHelpers'

// P8.19 – Einstellungen → Beispieldaten (KONZEPT §11.3) auf dem Handy (390 × 844): Anzahl je Bereich, Sperre mit
// Platzhalter-Rechtstexten, Freigabe mit Fixture-Rechtstexten (`origin = lawyer`), Dialog mit Mengen, vorausgewählter
// Checkbox „Seitentexte und FAQ behalten“ und Bestätigungswort „ENTFERNEN“; „Übernehmen“ für ein Bild.
// Das eigentliche Entfernen läuft hier nicht gegen die gemeinsame E2E-Datenbank (die Seed-Anker anderer Suiten blieben
// sonst weg): Der Aufruf `POST /api/admin/seed/remove` wird im Browser abgefangen und sein Inhalt geprüft; die Wirkung selbst
// (AK-11-03, R-180, Sperre, 400/403/409) belegt `tests/int/seed/admin-remove.int.spec.ts` gegen eine eigene Test-DB.

async function setLegalOrigin(origin: 'lawyer' | 'placeholder') {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `UPDATE legal_texts SET origin = $1, is_placeholder = $2 WHERE status = 'active'`,
      [origin, origin === 'placeholder'],
    )
  } finally {
    await client.end()
  }
}

test.describe.configure({ mode: 'serial' })

test('@a11y P8.19 Beispieldaten: Sperre, Dialog mit ENTFERNEN, Übernehmen – 390 px', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const [media] = (
    await payload.find({
      collection: 'media',
      where: { seed: { equals: true } },
      sort: '-id',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs
  expect(media, 'Seed-Bild vorhanden').toBeTruthy()
  await page.setViewportSize({ width: 390, height: 844 })
  try {
    // 1) Platzhalter-Rechtstexte → gesperrt
    await page.goto(adminPath('/einstellungen#beispieldaten'))
    const area = page.getByTestId('settings-seed')
    await expect(area.getByTestId('settings-seed-counts')).toBeVisible()
    await expect(area.getByTestId('settings-seed-locked')).toContainText(
      'Bitte zuerst die Texte der Kanzlei einsetzen – sonst wären die Rechtsseiten leer.',
    )
    await expect(area.getByTestId('settings-seed-remove')).toBeDisabled()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '#beispieldaten')

    // 2) Fixture: Kanzleitexte eingesetzt → frei
    await setLegalOrigin('lawyer')
    await page.reload()
    await expect(area.getByTestId('settings-seed-locked')).toHaveCount(0)
    const button = area.getByTestId('settings-seed-remove')
    await expect(button).toBeEnabled()
    await button.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Beispieldaten entfernen?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('settings-seed-dialog-counts')).toContainText('Stücke')
    await expect(dialog.getByTestId('settings-seed-keep-texts')).toBeChecked()
    const ok = dialog.getByTestId('confirm-dialog-ok')
    await expect(ok).toBeDisabled()
    await dialog.getByTestId('settings-seed-confirm-word').fill('entfernen')
    await expect(ok).toBeDisabled()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, 'dialog')

    // Im Browser abfangen (fetch ersetzen) statt per `page.route`: Unter WebKit ging die Anfrage trotz Route zum echten
    // Endpunkt durch und löschte die Beispieldaten der gemeinsamen E2E-Datenbank (Phasen-Abnahme P8).
    await page.evaluate(() => {
      const w = window as unknown as { __seedRemoveSent?: unknown; fetch: typeof fetch }
      const original = w.fetch.bind(window)
      w.fetch = async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (!url.includes('/api/admin/seed/remove')) return original(input, init)
        w.__seedRemoveSent = JSON.parse(String(init?.body ?? 'null'))
        return new Response(
          JSON.stringify({ doc: null, unchanged: false, keepTexts: true, counts: {} }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
    })
    await dialog.getByTestId('settings-seed-confirm-word').fill('ENTFERNEN')
    await expect(ok).toBeEnabled()
    await ok.click()
    await expect(area.getByTestId('settings-seed-feedback')).toContainText('Beispieldaten entfernt')
    expect(
      await page.evaluate(
        () => (window as unknown as { __seedRemoveSent?: unknown }).__seedRemoveSent,
      ),
    ).toEqual({ keepTexts: true, confirm: 'ENTFERNEN' })

    // 3) Übernehmen (Bild) – echter Endpunkt
    await area.getByTestId('settings-seed-adopt').locator('summary').click()
    const adopt = area.getByTestId(`settings-seed-adopt-media-${media!.id}`)
    await adopt.scrollIntoViewIfNeeded()
    await adopt.click()
    await expect
      .poll(
        async () =>
          (await payload.findByID({ collection: 'media', id: media!.id, overrideAccess: true }))
            .seed,
      )
      .toBe(false)
    await expectNoHorizontalScroll(page)
  } finally {
    await setLegalOrigin('placeholder')
    await payload.update({
      collection: 'media',
      id: media!.id,
      data: { seed: true } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  }
})
