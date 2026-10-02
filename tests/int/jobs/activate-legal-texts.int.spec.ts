import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { activateLegalSnippet, activateLegalText } from '@/lib/legal/activate'
import { jobAlarm } from '@/lib/jobs/alarm'
import { runTaskNow } from '@/lib/jobs/runTask'

import { lexical } from '../helpers/legal'
import { shopHarness } from '../helpers/shop'

// P6.3: Task `activateScheduledLegalTexts` (DATENMODELL §11, KONZEPT §7.13): geplante Rechtstext- und
// Baustein-Fassungen werden am `validFrom` aktiv (vorgestellte Uhr), die Vorgänger `superseded`; der Weckzeitpunkt
// kommt aus `jobAlarm.bump(validFrom)`; ein zweiter Lauf ändert nichts.

const NOW = '2026-10-20T10:00:00.000Z'
const VALID_FROM = '2026-10-31T23:00:00.000Z' // 01.11.2026 00:00 Berlin
const h = shopHarness({ start: NOW, numbers: [], tag: 'activate-legal' })

const ctx = { now: NOW }

describe('activateScheduledLegalTexts (P6.3)', () => {
  it('geplante Version wird am validFrom durch den Task aktiv; doppelter Lauf ohne Wirkung', async () => {
    const { payload } = h
    const v1 = h.legal.agb!
    const draft = await payload.create({
      collection: 'legal-texts',
      data: {
        type: 'agb',
        validFrom: VALID_FROM,
        origin: 'draft',
        content: lexical('§ 1 Geltungsbereich (neu)', 'Anbieter: {{name}}'),
      } as never,
      overrideAccess: true,
      context: ctx,
    })
    const snippet = await payload.create({
      collection: 'legal-snippets',
      data: {
        key: 'price.shippingNote',
        validFrom: VALID_FROM,
        text: 'zzgl. Versandkosten (ab November)',
        origin: 'draft',
      } as never,
      overrideAccess: true,
      context: ctx,
    })

    // Planen: Status `scheduled`, Weckzeit = validFrom
    await jobAlarm.markFullRun(new Date(NOW), null)
    const planned = await activateLegalText(
      await createLocalReq({ context: ctx }, payload),
      draft.id,
    )
    expect(planned).toMatchObject({ status: 'scheduled', supersededId: null, pdfJobId: null })
    expect((await jobAlarm.read()).nextDueAt).toBe(VALID_FROM)
    const plannedSnippet = await activateLegalSnippet(
      await createLocalReq({ context: ctx }, payload),
      snippet.id,
    )
    expect(plannedSnippet.status).toBe('scheduled')

    const status = async () => ({
      draft: (await payload.findByID({ collection: 'legal-texts', id: draft.id, depth: 0 })).status,
      v1: (await payload.findByID({ collection: 'legal-texts', id: v1, depth: 0 })).status,
      snippet: (
        await payload.findByID({
          collection: 'legal-snippets',
          id: snippet.id,
          depth: 0,
          overrideAccess: true,
        })
      ).status,
    })

    // Vor dem validFrom: nichts passiert
    await runTaskNow(payload, 'activateScheduledLegalTexts', {
      now: new Date('2026-10-31T22:30:00.000Z'),
    })
    expect(await status()).toEqual({ draft: 'scheduled', v1: 'active', snippet: 'scheduled' })

    // Am validFrom: aktiv, Vorgänger abgelöst
    const at = new Date('2026-10-31T23:00:30.000Z')
    await runTaskNow(payload, 'activateScheduledLegalTexts', { now: at })
    expect(await status()).toEqual({ draft: 'active', v1: 'superseded', snippet: 'active' })
    const active = await payload.findByID({
      collection: 'legal-texts',
      id: draft.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(active.activatedAt).toBe(at.toISOString())
    expect(active.contentSha256De).toMatch(/^[0-9a-f]{64}$/)
    const pdfJobs = await payload.count({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'renderLegalTextPdf' } },
      overrideAccess: true,
    })
    expect(pdfJobs.totalDocs).toBeGreaterThan(0)

    // Zweiter Lauf: keine Änderung, keine weiteren Audit-Einträge
    const audits = async () =>
      (
        await payload.count({
          collection: 'audit-log',
          where: {
            action: {
              in: [
                'legal_text_activated',
                'legal_text_superseded',
                'legal_snippet_activated',
                'legal_snippet_superseded',
              ],
            },
          },
          overrideAccess: true,
        })
      ).totalDocs
    const before = await audits()
    await runTaskNow(payload, 'activateScheduledLegalTexts', {
      now: new Date('2026-11-01T08:00:00.000Z'),
    })
    expect(await status()).toEqual({ draft: 'active', v1: 'superseded', snippet: 'active' })
    expect(await audits()).toBe(before)
  })
})
