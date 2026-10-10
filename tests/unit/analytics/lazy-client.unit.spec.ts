import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// P14.13 (U-62, Ladebudget): Die Statistik-Bibliothek gehört nicht ins Erstlade-JS jeder Seite. `AnalyticsClient` lädt
// `AnalyticsView` (mit `@vercel/analytics`) per `import()` nach; nur `AnalyticsView` importiert die Bibliothek.

const ROOT = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

describe('Statistik nachgeladen (P14.13)', () => {
  it('AnalyticsClient importiert die Bibliothek nicht statisch, sondern AnalyticsView per import()', () => {
    const client = read('src/lib/analytics/AnalyticsClient.tsx')
    expect(client).not.toContain('@vercel/analytics')
    expect(client).toContain("import('./AnalyticsView')")
    expect(client).not.toMatch(/^import .*AnalyticsView/m)
  })

  it('AnalyticsView rendert <Analytics mode="production"> mit beforeSend (unverändert)', () => {
    const view = read('src/lib/analytics/AnalyticsView.tsx')
    expect(view).toContain("from '@vercel/analytics/next'")
    expect(view).toContain('<Analytics mode="production" beforeSend={analyticsBeforeSend} />')
  })
})
