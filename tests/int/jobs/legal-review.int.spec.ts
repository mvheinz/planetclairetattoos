import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getTodaySummary } from '@/lib/admin/today'
import { runTaskNow } from '@/lib/jobs/runTask'
import { legalReviewStates } from '@/lib/legal/review'
import { addBerlinDays } from '@/lib/time'

import { dbOf } from '../helpers/commerce'
import { ensureLegalTextFixtures } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'

// P6.20 – Task `legalReviewReminder` (R-014, DATENMODELL §11): Alter je Typ = jüngeres Datum aus `activatedAt` der
// aktiven Fassung und `settings.legal.reviews[type].reviewedAt`; ab 365 Tagen A10 einmal mit allen fälligen Typen,
// danach alle 30 Tage erneut, bis neue Version oder „geprüft“. „Heute“-Kachel „Rechtstexte“ mit Warnungen.

let payload: Payload
const db = () => dbOf(payload)

const T0 = '2026-01-15T09:00:00.000Z' // Do 15.01.2026 10:00 Berlin
/** Tag n nach T0, jeweils 10:00 Berlin (auch über die Zeitumstellung). */
const day = (n: number) => addBerlinDays(new Date(T0), n)

let original: { id: number; activated_at: string | null; origin: string }[] = []

async function mailKeys(): Promise<string[]> {
  const res = await db().execute(sql`
    SELECT idempotency_key AS k FROM email_log WHERE template = 'admin_legal_review_due' ORDER BY id`)
  return (res.rows as { k: string }[]).map((r) => r.k)
}

async function reviews(): Promise<Record<string, string | null>> {
  const res = await db().execute(
    sql`SELECT type::text AS t, last_reminder_sent_at AS s FROM settings_legal_reviews`,
  )
  return Object.fromEntries(
    (res.rows as { t: string; s: Date | string | null }[]).map((r) => [
      r.t,
      r.s ? new Date(r.s).toISOString() : null,
    ]),
  )
}

const run = (d: Date) => runTaskNow(payload, 'legalReviewReminder', { now: d })

describe('legalReviewReminder (P6.20)', () => {
  beforeAll(async () => {
    payload = await getTestPayload()
    await ensureLegalTextFixtures(payload)
    const res = await db().execute(sql`
      SELECT id, activated_at, origin::text AS origin FROM legal_texts WHERE status = 'active'`)
    original = res.rows as typeof original
  })

  beforeEach(async () => {
    await db().execute(sql`UPDATE legal_texts SET activated_at = ${T0}::timestamptz
      WHERE status = 'active'`)
    await db().execute(
      sql`UPDATE settings_legal_reviews SET reviewed_at = NULL, last_reminder_sent_at = NULL`,
    )
    await db().execute(sql`DELETE FROM email_log WHERE template = 'admin_legal_review_due'`)
    await db().execute(sql`DELETE FROM job_runs WHERE task = 'legalReviewReminder'`)
    await payload.jobs.cancel({ where: { taskSlug: { equals: 'legalReviewReminder' } } })
  })

  afterAll(async () => {
    for (const r of original) {
      await db().execute(sql`UPDATE legal_texts SET activated_at = ${r.activated_at}::timestamptz
        WHERE id = ${r.id}`)
    }
    await db().execute(
      sql`UPDATE settings_legal_reviews SET reviewed_at = NULL, last_reminder_sent_at = NULL`,
    )
    await db().execute(sql`DELETE FROM email_log WHERE template = 'admin_legal_review_due'`)
    await db().execute(sql`DELETE FROM job_runs WHERE task = 'legalReviewReminder'`)
  })

  it('R-014 vorgestellte Uhr: Tag 364 keine Mail, Tag 365 eine, Tag 380 keine, Tag 395 eine', async () => {
    await run(day(364))
    expect(await mailKeys()).toHaveLength(0)

    await run(day(365))
    let keys = await mailKeys()
    expect(keys).toHaveLength(1)
    // eine Mail mit allen fälligen Typen; `lastReminderSentAt` je Typ gesetzt
    const mail = await db().execute(sql`
      SELECT j.input FROM payload_jobs j
        JOIN email_log l ON (j.input->>'emailLogId')::int = l.id
       WHERE j.task_slug = 'sendEmail' AND l.template = 'admin_legal_review_due'
       ORDER BY j.id DESC LIMIT 1`)
    const input = (mail.rows[0] as { input: { data: { texts: { type: string }[] } } }).input
    const active = await db().execute(
      sql`SELECT DISTINCT type::text AS t FROM legal_texts WHERE status = 'active'`,
    )
    expect(input.data.texts.map((t) => t.type).sort()).toEqual(
      (active.rows as { t: string }[]).map((r) => r.t).sort(),
    )
    const r365 = await reviews()
    for (const { t } of active.rows as { t: string }[]) {
      expect(r365[t]).toBe(day(365).toISOString())
    }

    // gleicher Tag noch einmal: keine zweite Mail
    await run(new Date(day(365).getTime() + 3 * 3_600_000))
    expect(await mailKeys()).toHaveLength(1)

    await run(day(380))
    expect(await mailKeys()).toHaveLength(1)

    await run(day(395))
    keys = await mailKeys()
    expect(keys).toHaveLength(2)
    expect(new Set(keys).size).toBe(2)
  })

  it('R-014 vor 08:30 Berlin keine Mail; „geprüft“ setzt das Alter zurück', async () => {
    // 07:00 Berlin (Winterzeit = 06:00 UTC) am Tag 365: noch zu früh
    const early = addBerlinDays(new Date('2026-01-15T06:00:00.000Z'), 365)
    await run(early)
    expect(await mailKeys()).toHaveLength(0)

    // Prüfung am Tag 200 bestätigt → Tag 365 nicht fällig, Tag 565 fällig
    await db().execute(
      sql`UPDATE settings_legal_reviews SET reviewed_at = ${day(200).toISOString()}::timestamptz`,
    )
    await run(day(365))
    expect(await mailKeys()).toHaveLength(0)
    await run(day(565))
    expect(await mailKeys()).toHaveLength(1)
  })

  it('R-014 Heute-Kachel „Rechtstexte“: Version, gültig ab, Herkunft, Alter, Warnungen', async () => {
    const summary = await getTodaySummary(day(366), payload)
    expect(summary.legalTexts.map((r) => r.type)).toEqual([
      'impressum',
      'datenschutz',
      'agb',
      'widerrufsbelehrung',
      'widerrufsformular',
      'versand-zahlung',
    ])
    for (const r of summary.legalTexts.filter((x) => x.present)) {
      expect(r.version).toBeGreaterThan(0)
      expect(r.validFrom).toBeTruthy()
      expect(r.ageDays).toBe(366)
      expect(r.warnings).toContain('overdue')
      if (r.origin !== 'lawyer') expect(r.warnings).toContain('not_lawyer')
    }
    expect(summary.hints.find((h) => h.id === 'legal-review')).toBeTruthy()
  })

  it('R-014 rein: fehlender Typ und Kanzlei-Fassung', () => {
    const now = new Date('2026-06-01T10:00:00.000Z')
    const states = legalReviewStates(
      [
        {
          type: 'agb',
          version: 2,
          validFrom: '2026-05-01T00:00:00.000Z',
          activatedAt: '2026-05-01T00:00:00.000Z',
          origin: 'lawyer',
        },
      ],
      [],
      now,
    )
    expect(states.find((s) => s.type === 'agb')).toMatchObject({
      present: true,
      due: false,
      warnings: [],
      ageDays: 31,
    })
    expect(states.find((s) => s.type === 'impressum')).toMatchObject({
      present: false,
      warnings: ['missing'],
    })
  })
})
