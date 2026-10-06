import type { Payload, PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.fn()
const notifyAdmin = vi.fn()
vi.mock('@/lib/jobs/runLog', () => ({ poolDb: () => ({ execute }) }))
vi.mock('@/lib/email/notifyAdmin', () => ({
  notifyAdmin: (...args: unknown[]) => notifyAdmin(...args),
}))

import { LEGAL_TEXT_TYPES } from '@/lib/enums'
import {
  berlinDaysBetween,
  legalReviewStates,
  loadLegalReviewStates,
  runLegalReviewReminder,
  setLegalReviewDates,
} from '@/lib/legal/review'

const NOW = new Date('2027-06-01T10:00:00Z')
const [T1, T2] = LEGAL_TEXT_TYPES

describe('R-014 jährliche Prüf-Erinnerung (Zweige)', () => {
  beforeEach(() => {
    execute.mockReset()
    notifyAdmin.mockReset()
  })

  it('Kalendertage in Berlin', () => {
    expect(
      berlinDaysBetween(new Date('2027-05-31T22:30:00Z'), new Date('2027-06-01T10:00:00Z')),
    ).toBe(0)
    expect(
      berlinDaysBetween(new Date('2027-05-30T10:00:00Z'), new Date('2027-06-01T10:00:00Z')),
    ).toBe(2)
  })

  it('Zustände: fehlend, nicht von der Kanzlei, fällig, Erinnerungsabstand, ungültige Daten', () => {
    const states = legalReviewStates(
      [
        {
          type: T1!,
          version: 3,
          validFrom: '2025-01-01',
          activatedAt: '2025-01-05T00:00:00Z',
          origin: 'lawyer',
        },
        { type: T2!, validFrom: 'kaputt', activatedAt: 'auch kaputt', origin: null },
      ],
      [
        {
          type: T1!,
          reviewedAt: '2025-09-01T00:00:00Z',
          lastReminderSentAt: '2027-05-20T00:00:00Z',
        },
        { type: T2!, reviewedAt: null, lastReminderSentAt: 'x' },
        { type: 'nicht-da' as never, reviewedAt: '2027-01-01' },
      ],
      NOW,
    )
    const [a, b] = states
    expect(a).toMatchObject({
      present: true,
      due: true,
      remind: false,
      version: 3,
      origin: 'lawyer',
    })
    expect(a!.warnings).toEqual(['overdue'])
    expect(b).toMatchObject({
      present: true,
      due: false,
      remind: false,
      lastReviewedAt: null,
      ageDays: null,
      version: null,
      origin: null,
    })
    expect(b!.warnings).toEqual(['not_lawyer'])
    const missing = states.find((s) => !s.present)
    expect(missing).toMatchObject({ warnings: ['missing'], lastReviewedAt: null })
    const again = legalReviewStates(
      [{ type: T1!, validFrom: '2025-01-01', origin: 'lawyer' }],
      [{ type: T1!, lastReminderSentAt: '2027-04-01T00:00:00Z' }],
      NOW,
      30,
    )
    expect(again[0]).toMatchObject({ due: true, remind: true })
    expect(again[0]!.lastReminderSentAt).toBe('2027-04-01T00:00:00.000Z')
    const noReminder = legalReviewStates([{ type: T1!, validFrom: '2025-01-01' }], [], NOW, 10)
    expect(noReminder[0]!.remind).toBe(true)
  })

  const makeReq = (settings: unknown, texts: unknown[] = []) => {
    const updateGlobal = vi.fn(async () => ({}))
    const payload = {
      find: vi.fn(async () => ({ docs: texts })),
      findGlobal: vi.fn(async () => settings),
      updateGlobal,
    } as unknown as Payload
    return { req: { payload, context: { a: 1 } } as unknown as PayloadRequest, updateGlobal }
  }

  it('lädt Texte und Einstellungen; Standardintervall ohne Einstellung', async () => {
    const { req } = makeReq({}, [{ type: T1, validFrom: '2026-12-01', origin: 'lawyer' }])
    const states = await loadLegalReviewStates(req.payload, NOW, req)
    expect(states[0]).toMatchObject({ due: false })
    const { req: req2 } = makeReq(
      {
        legal: {
          reviewIntervalDays: 1,
          reviews: [{ type: T1, reviewedAt: '2027-01-01T00:00:00Z' }],
        },
      },
      [{ type: T1, validFrom: '2026-12-01', origin: 'lawyer' }],
    )
    expect((await loadLegalReviewStates(req2.payload, NOW, req2))[0]!.due).toBe(true)
  })

  it('Task: ohne Erinnerungsbedarf keine Mail; mit Bedarf Mail + Datum gesetzt', async () => {
    const quiet = makeReq({}, [{ type: T1, validFrom: '2027-05-01', origin: 'lawyer' }])
    expect(await runLegalReviewReminder(quiet.req, NOW)).toEqual({
      sent: false,
      due: [],
      reminded: [],
    })
    expect(notifyAdmin).not.toHaveBeenCalled()

    const due = makeReq({}, [{ type: T1, validFrom: '2025-01-01', origin: 'lawyer' }])
    execute.mockResolvedValue({ rowCount: 1 })
    notifyAdmin.mockResolvedValue({ status: 'queued' })
    const res = await runLegalReviewReminder(due.req, NOW)
    expect(res).toEqual({ sent: true, due: [T1], reminded: [T1] })
    expect(notifyAdmin.mock.calls[0]![3].idempotencyKey).toBe(
      'admin_legal_review_due:2027-06-01:annual',
    )
    expect(execute).toHaveBeenCalledTimes(1)
    expect(due.updateGlobal).not.toHaveBeenCalled()
    notifyAdmin.mockResolvedValue({})
    expect((await runLegalReviewReminder(due.req, NOW)).sent).toBe(false)
  })

  it('setLegalReviewDates: nichts zu tun; SQL genügt; fehlende Zeilen über die Global-API ohne Audit', async () => {
    const { req, updateGlobal } = makeReq({
      legal: { reviewIntervalDays: 365, reviews: [{ type: T1, reviewedAt: null }] },
    })
    await setLegalReviewDates(req, [], 'reviewedAt', NOW)
    expect(execute).not.toHaveBeenCalled()

    execute.mockResolvedValueOnce({ rowCount: 2 })
    await setLegalReviewDates(req, [T1!, T2!], 'reviewedAt', NOW)
    expect(updateGlobal).not.toHaveBeenCalled()

    execute.mockResolvedValueOnce({})
    await setLegalReviewDates(req, [T1!, T2!], 'lastReminderSentAt', NOW)
    expect(updateGlobal).toHaveBeenCalledTimes(1)
    const call = updateGlobal.mock.calls[0]![0] as unknown as {
      data: { legal: { reviews: { type: string; lastReminderSentAt: string }[] } }
      context: Record<string, unknown>
    }
    expect(call.data.legal.reviews.map((r) => r.type)).toEqual([T1, T2])
    expect(call.data.legal.reviews[1]!.lastReminderSentAt).toBe(NOW.toISOString())
    expect(call.context).toMatchObject({ system: true, skipAudit: true, a: 1 })
    expect(req.context).toEqual({ a: 1 })

    const bare = makeReq({})
    execute.mockResolvedValueOnce({ rowCount: 0 })
    await setLegalReviewDates(bare.req, [T1!], 'reviewedAt', NOW)
    expect(bare.updateGlobal).toHaveBeenCalledTimes(1)
  })
})
