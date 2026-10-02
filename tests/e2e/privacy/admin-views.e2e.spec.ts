import { ADMIN_DETAIL_VIEWS, ADMIN_VIEWS } from '../../../src/admin/views/registry'
import { adminPath, expect, test } from '../fixtures'

// P6.13 – T-03 auch in den Verwaltungsansichten (R-131, R-136, ARCHITEKTUR §7.4/§8.4): jede Ansicht aus der
// Ansichten-Registry (Handy-Ansichten und Einstellungs-Unterseiten ohne `:id`) lädt nur vom eigenen Origin. Die Fixture
// `foreignRequests` blockiert und protokolliert jede Anfrage an fremde Hosts. Ansichten mit `:id` brauchen einen
// Datensatz und laufen in ihren eigenen Suiten (Bestellung, Widerruf, Anfrage) – dort gilt derselbe Wächter.

const VIEWS = [...ADMIN_VIEWS, ...ADMIN_DETAIL_VIEWS]
  .map((v) => v.path as string)
  .filter((p) => !p.includes(':id'))

test.describe('Verwaltungsansichten ohne Fremd-Requests @privacy', () => {
  test.describe.configure({ timeout: 240_000 })

  test('R-131 T-03 alle Verwaltungsansichten der Registry laden nichts von fremden Hosts @privacy', async ({
    adminPage: page,
    foreignRequests,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Verwaltung: Inhalte sind geräteunabhängig')
    expect(VIEWS.length).toBeGreaterThanOrEqual(15)
    for (const view of VIEWS) {
      const res = await page.goto(adminPath(view))
      expect(res?.status(), view).toBeLessThan(400)
      await page.waitForLoadState('networkidle')
      expect(foreignRequests, view).toEqual([])
    }
  })
})
