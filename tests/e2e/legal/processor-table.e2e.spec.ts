import { readFileSync } from 'node:fs'
import path from 'node:path'

import * as cheerio from 'cheerio'

import { parseServicesYaml } from '../../../scripts/legal/gen-services'
import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { expect, test } from '../fixtures'

// P6.21 – Auftragsverarbeiter-Tabelle (R-155, DIENSTE §7): R22 DE/EN zeigt unter dem Text der Datenschutzerklärung die
// generierte Tabelle mit jedem Dienst aus der YAML (`production: true`, also jeder Auftragsverarbeiter) – auch mit dem
// Platzhalter-Rechtstext, ohne JavaScript, ohne Token im Text.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const services = parseServicesYaml(
  readFileSync(path.join(ROOT, 'docs/recht/DIENSTE.md'), 'utf8'),
).services.filter((s) => s.production)

for (const locale of LOCALES) {
  test(`R-155 R22 ${locale}: Tabelle mit jedem Auftragsverarbeiter aus der YAML`, async ({
    request,
  }) => {
    const res = await request.get(localizedPath('R22', locale))
    expect(res.status()).toBe(200)
    const $ = cheerio.load(await res.text())
    const table = $('[data-processor-table] table')
    expect(table).toHaveLength(1)
    expect(table.find('thead th')).toHaveLength(4)
    const rows = table.find('tbody tr')
    expect(rows.map((_, el) => $(el).attr('data-service')).get()).toEqual(services.map((s) => s.id))
    for (const s of services) {
      const row = table.find(`tr[data-service="${s.id}"]`)
      expect(row.find('th').text()).toBe(s.name)
      expect(row.text()).toContain(s.seat[locale])
    }
    // Processors (Rolle AV) sind alle dabei
    const processors = services.filter(
      (s) => s.role === 'processor' || s.role === 'processorAndController',
    )
    expect(processors.length).toBeGreaterThan(0)
    // kein rohes Token im HTML (R-012)
    expect($('main').text()).not.toMatch(/\{\{[^}]*\}\}/)
  })
}

test('R-155 R22 ohne JavaScript: Tabelle sichtbar', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto(localizedPath('R22', 'de'))
  await expect(page.locator('[data-processor-table] table')).toBeVisible()
  await expect(page.locator('[data-processor-table] tbody tr').first()).toBeVisible()
  await ctx.close()
})
