import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { resetEnvCache } from '@/lib/env'
import { runGoliveCheck } from '@/lib/golive/collect'

import { getTestPayload } from '../helpers/payload'

// P10.14 – Go-live-Sperre (DATENMODELL §13.7, R-210): „Shop öffnen“ in Produktion listet genau die roten Punkte der
// Startklar-Prüfung (dieselbe Funktion wie `pnpm check:golive`); in der Vorschau-Umgebung wird gespeichert.

let payload: Payload

beforeAll(async () => {
  payload = await getTestPayload()
  await payload.updateGlobal({
    slug: 'settings',
    data: { shop: { isOpen: false } } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
})

afterAll(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  await payload.updateGlobal({
    slug: 'settings',
    data: { shop: { isOpen: true } } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
})

describe('Go-live-Sperre (P10.14)', () => {
  it('R-210 Prüfung liest die echte Datenbank: Grund-Zustand ist rot mit den erwarteten Punkten', async () => {
    const report = await runGoliveCheck(payload, new Date('2026-10-20T10:00:00Z'))
    expect(report.ready).toBe(false)
    const red = report.checks.filter((c) => !c.ok).map((c) => c.id)
    // Rechtstexte, Stammdaten (Platzhalter), IBAN, LUCID, AVVs, Treiber, Statistik, Steuer, harmonisierte Mitteilung
    for (const id of [
      'R210-01',
      'R210-03',
      'R210-04',
      'R210-05',
      'R210-06',
      'R210-09',
      'R210-10',
      'R210-11',
      'R210-12',
    ])
      expect(red, id).toContain(id)
    expect(report.openItems).toHaveLength(red.length)
  })

  it('DM-41 „Shop öffnen“ in Produktion: Fehlermeldung nennt dieselben roten Punkte wie die Prüfung', async () => {
    vi.stubEnv('APP_ENV', 'production')
    resetEnvCache()
    try {
      const report = await runGoliveCheck(payload, new Date())
      let message = ''
      try {
        await payload.updateGlobal({
          slug: 'settings',
          data: { shop: { isOpen: true } } as never,
          overrideAccess: true,
        })
      } catch (e) {
        message = JSON.stringify(
          e instanceof Error ? e.message + JSON.stringify((e as { data?: unknown }).data) : e,
        )
      }
      expect(message).toContain('Startklar-Prüfung grün ist')
      for (const item of report.openItems) expect(message).toContain(item.replace(/"/g, '\\"'))
      const doc = (await payload.findGlobal({
        slug: 'settings',
        depth: 0,
        overrideAccess: true,
      })) as {
        shop?: { isOpen?: boolean }
      }
      expect(doc.shop?.isOpen).toBe(false)
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
  })

  it('DM-41 in der Vorschau-Umgebung wird „Shop öffnen“ gespeichert', async () => {
    vi.stubEnv('APP_ENV', 'preview')
    resetEnvCache()
    try {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: { isOpen: true } } as never,
        overrideAccess: true,
      })
      const doc = (await payload.findGlobal({
        slug: 'settings',
        depth: 0,
        overrideAccess: true,
      })) as {
        shop?: { isOpen?: boolean }
      }
      expect(doc.shop?.isOpen).toBe(true)
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
  })
})
