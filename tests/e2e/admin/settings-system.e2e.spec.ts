import { sql } from '@payloadcms/db-postgres'

import { dbOf } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  removeOrder,
} from './orderHelpers'

// P5.22 – Einstellungen, Teil 2: Versand mit EU-Sperre (`/einstellungen/versand`, R-202), Beispieldaten (Anzahl je
// Collection, Entfernen kommt in P8) und System (`/einstellungen/system`, ARCHITEKTUR §11.5): „Jetzt ausführen“ für
// `markDelivered` erzeugt einen `job_runs`-Eintrag; eine fehlgeschlagene Mail lässt sich erneut senden.
// 390×844 ohne horizontales Scrollen, axe ohne serious/critical.

const runCount = async (task: string) => {
  const payload = await testPayload()
  return Number(
    (await dbOf(payload).execute(sql`SELECT count(*)::int AS n FROM job_runs WHERE task = ${task}`))
      .rows[0]?.n,
  )
}

test('@a11y System: „Jetzt ausführen“ markDelivered schreibt job_runs; fehlgeschlagene Mail erneut senden', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const order = await fixtureOrder(payload, piece, 90_000 + piece.itemNumber * 10 + 7)
  const failed = await payload.create({
    collection: 'email-log',
    data: {
      template: 'order_confirmation',
      to: 'erika@example.com',
      locale: 'de',
      subject: `Danke! Deine Bestellung ${order.orderNumber}`,
      idempotencyKey: `order_confirmation:${order.id}:O1`,
      status: 'failed',
      attempts: 6,
      lastError: 'SMTP nicht erreichbar',
      order: order.id,
    } as never,
    overrideAccess: true,
    context: { system: true, skipAudit: true },
  })
  // Reservierte Domains werden beim Anlegen unterdrückt (R-180) – Status danach auf „gescheitert“ setzen.
  await payload.update({
    collection: 'email-log',
    id: failed.id,
    data: { status: 'failed' } as never,
    overrideAccess: true,
    context: { system: true, skipAudit: true },
  })
  const mails = async () =>
    Number(
      (
        await dbOf(payload).execute(
          sql`SELECT count(*)::int AS n FROM email_log WHERE order_id = ${order.id} AND template = 'order_confirmation'`,
        )
      ).rows[0]?.n,
    )
  try {
    await page.goto(adminPath('/einstellungen/system'))
    const view = page.getByTestId('settings-system-view')
    await expect(view).toBeVisible()
    await expect(page.getByTestId('system-env')).not.toBeEmpty()
    await expect(view).toContainText('Startklar-Prüfung kommt in P10')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // Jetzt ausführen (Dialog, dann ein Lauf im Protokoll)
    const before = await runCount('markDelivered')
    await page.getByTestId('system-run-markDelivered').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Lauf-Protokoll')
    await expectAccessible(page, 'dialog[open]')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect(page.getByText(/Ausgeführt/)).toBeVisible()
    await expect.poll(() => runCount('markDelivered')).toBe(before + 1)
    await expect(page.getByTestId('system-runs')).toContainText('markDelivered')

    // Fehlgeschlagene Mail erneut senden
    await expect(page.getByTestId('system-failed-mails')).toContainText('SMTP nicht erreichbar')
    await page.getByTestId(`system-resend-${order.id}-order_confirmation`).click()
    await expect(dialog).toContainText('Die Kundin bekommt diese Mail noch einmal.')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect(page.getByText('Die Mail ist unterwegs.')).toBeVisible()
    expect(await mails()).toBe(2)
    await expect(page.getByTestId(`system-resent-${failed.id}`)).toBeVisible()
  } finally {
    await removeOrder(payload, order.id)
  }
})

test('@a11y Versand: EU-Land erst nach allen fünf Häkchen; Beispieldaten-Anzahl in den Einstellungen', async ({
  adminPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const payload = await testPayload()
  const before = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  try {
    await page.goto(adminPath('/einstellungen/versand'))
    await expect(page.getByTestId('settings-shipping-view')).toBeVisible()
    await expect(page.getByTestId('settings-country-DE')).toBeChecked()
    await expect(page.getByTestId('settings-country-GB')).toHaveCount(0)
    await expect(page.getByTestId('settings-country-US')).toHaveCount(0)
    await expect(page.getByTestId('packaging-year-total')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // NL ohne Häkchen → Hinweis am Feld, nichts gespeichert
    const form = page.getByTestId('area-form-shipping')
    const ack = form.getByTestId('area-field-shipping.euShippingAcknowledged')
    await expect(ack).toBeDisabled()
    await form.getByTestId('settings-country-NL').check()
    await form.getByTestId('area-save-shipping').click()
    await expect(form.getByTestId('area-errors-shipping')).toContainText('EU-Checkliste')
    expect(
      (await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })).shipping
        ?.enabledCountries,
    ).toEqual(['DE'])
    // Alle Häkchen → „geprüft“ lässt sich setzen
    for (const key of [
      'authorisedRepresentativeNamed',
      'ossThresholdChecked',
      'textileLanguageChecked',
      'ratesMaintained',
      'legalTextsAdapted',
    ]) {
      await form.getByTestId(`area-field-shipping.euChecklist.${key}`).check()
    }
    await expect(ack).toBeEnabled()
    await form.getByTestId('settings-country-NL').uncheck()

    // Beispieldaten: Anzahl je Bereich, Entfernen kommt in P8
    await page.goto(adminPath('/einstellungen'))
    await expect(page.getByRole('heading', { level: 2, name: 'Beispieldaten' })).toBeVisible()
    await expect(page.getByTestId('settings-seed-remove')).toBeDisabled()
    await expect(page.locator('#settings-seed-later')).toContainText('P8')
  } finally {
    await payload.updateGlobal({
      slug: 'settings',
      data: { shipping: before.shipping } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
})

test('@a11y Umsatz-Wächter: Balken, Monatstabelle, Eingaben, Satz „ersetzt keine Steuerberatung“', async ({
  adminPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/einstellungen/umsatz-waechter'))
  await expect(page.getByTestId('settings-revenue-view')).toBeVisible()
  await expect(page.getByTestId('revenue-bar')).toBeVisible()
  await expect(page.getByTestId('revenue-table')).toContainText('Tattoo')
  await expect(page.getByTestId('revenue-stages')).toContainText('U1')
  await expect(page.getByTestId('revenue-disclaimer')).toHaveText(
    'Der Wächter ersetzt keine Steuerberatung.',
  )
  await expect(page.getByTestId('revenue-year-totals')).toContainText('Vorjahr auch mit 0 €')
  await expect(page.getByTestId('revenue-entry-form')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')
})
