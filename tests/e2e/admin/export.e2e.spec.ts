import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P5.24/P5.25 – Ansicht „Export und Datenschutz“ `/export` (KONZEPT §7.15): Monatsauswahl mit Monats-CSV
// (`GET /api/admin/export/{JJJJ-MM}.csv`) und Rechnungs-ZIP (`.zip`), DATEV-Knopf ausgegraut mit Hinweis
// „Konten mit der Steuerberatung festlegen“, solange Konten fehlen (409 am Endpunkt), und mit Test-Konten als Download;
// Jahresauswahl der Verpackungsmengen (P5.11). 390×844 ohne horizontales Scrollen, axe ohne serious/critical.

test('@a11y Export: Monat wählen, CSV und ZIP laden, DATEV ausgegraut ohne Konten', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const before = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  try {
    // Ohne Konten
    await payload.updateGlobal({
      slug: 'settings',
      data: { export: { datev: { consultantNumber: null, clientNumber: null } } } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/export'))
    await expect(page.getByRole('heading', { level: 2, name: 'Buchhaltung (Monat)' })).toBeVisible()
    await expect(page.getByTestId('packaging-report-form')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    const datev = page.getByTestId('export-datev')
    await expect(datev).toBeDisabled()
    await expect(page.getByTestId('export-datev-hint')).toContainText(
      'Konten mit der Steuerberatung festlegen',
    )
    const conflict = await page.request.get('/api/admin/export/2026-09.datev.csv')
    expect(conflict.status()).toBe(409)

    // Monat wählen → Links zeigen auf den Monat
    await page.getByTestId('export-month-select').selectOption('2026-09')
    await expect(page.getByTestId('export-csv')).toHaveAttribute(
      'href',
      '/api/admin/export/2026-09.csv',
    )
    await expect(page.getByTestId('export-zip')).toHaveAttribute(
      'href',
      '/api/admin/export/2026-09.zip',
    )

    // CSV als Download (UTF-8 mit BOM, `;`), ohne `@`
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-csv').click(),
    ])
    expect(download.suggestedFilename()).toBe('planetclaire-2026-09.csv')
    const csv = await page.request.get('/api/admin/export/2026-09.csv')
    expect(csv.status()).toBe(200)
    const body = await csv.body()
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(body.toString('utf8')).toContain(';')
    expect(body.toString('utf8')).not.toContain('@')

    const zip = await page.request.get('/api/admin/export/2026-09.zip')
    expect([200, 409]).toContain(zip.status())
    if (zip.status() === 200) expect(zip.headers()['content-type']).toContain('application/zip')

    // Ohne Anmeldung kein Export
    const anon = await page.context().browser()!.newContext()
    try {
      const res = await anon.request.get(new URL('/api/admin/export/2026-09.csv', page.url()).href)
      expect(res.status()).toBe(401)
    } finally {
      await anon.close()
    }

    // Mit Test-Konten: Knopf aktiv, Download Windows-1252
    await payload.updateGlobal({
      slug: 'settings',
      data: {
        export: {
          datev: {
            consultantNumber: '1234567',
            clientNumber: '12345',
            fiscalYearStart: '01-01',
            revenueAccount: '8400',
            stripeTransitAccount: '1360',
            bankAccount: '1200',
            feeAccount: '4970',
          },
        },
      } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
    await page.reload()
    await expect(page.getByTestId('export-datev')).toHaveAttribute('href', /\.datev\.csv$/)
    await expect(page.getByTestId('export-datev-hint')).toHaveCount(0)
    const ok = await page.request.get(
      (await page.getByTestId('export-datev').getAttribute('href'))!,
    )
    expect(ok.status()).toBe(200)
    expect((await ok.body()).toString('latin1')).toMatch(/^"EXTF";700;21;/)
    await expectAccessible(page, '.pc-admin-view')
  } finally {
    await payload.updateGlobal({
      slug: 'settings',
      data: { export: before.export } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
})
