import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// axe-Prüfung (ARCHITEKTUR §7.5, T-11, R-191): Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; Gate 0 Verstöße
// `serious`/`critical`, `moderate`/`minor` als Annotation im Report. Gemeinsam für `a11y.e2e.spec.ts` und die
// Seiten-Suiten mit Tag `@a11y` (z. B. R25, R06).

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export async function expectNoSeriousViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const describe = (v: (typeof result.violations)[number]) =>
    `${v.id} (${v.impact}): ${v.help} – ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join(' | ')}`
  for (const v of result.violations.filter(
    (v) => v.impact !== 'serious' && v.impact !== 'critical',
  ))
    test.info().annotations.push({
      type: `axe ${v.impact ?? 'minor'}`,
      description: `${label}: ${describe(v)}`,
    })
  const blocking = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(describe)
  expect(blocking, `axe serious/critical: ${label}`).toEqual([])
  expect(result.passes.length, 'axe hat geprüft').toBeGreaterThan(0)
}
