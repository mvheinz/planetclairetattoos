import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getTodaySummary } from '@/lib/admin/today'
import { runTaskNow } from '@/lib/jobs/runTask'
import { runPrivacyRequestReminders } from '@/lib/privacy/reminders'
import { createPrivacyRequest, savePrivacyRequest } from '@/lib/privacy/requests'
import { inTransaction } from '@/lib/payload/transaction'
import { addBerlinDays, berlinDateKey, parseBerlinLocal } from '@/lib/time'
import type { PrivacyRequest } from '@/payload-types'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'

// P6.16 – Datenschutz-Anfragen: Erfassung und Fristen (KONZEPT §7.15, LOESCHKONZEPT §5, DATENMODELL §6.26, R-153):
// Nummer DS-JJJJ-NNNN, `dueAt` = Eingang + 1 Monat (Monatsende), Verlängerung nur mit Grund und Mitteilung im ersten
// Monat, Task `privacyRequestsDeadlineReminder` mit A14 genau an Tag −7 und −1 (verlängerte Frist verschiebt), Beispiel-
// daten ohne A14, aber unter „Heute“.

let payload: Payload
const db = () => dbOf(payload)
const at = (day: string, time = '12:00') => parseBerlinLocal(`${day}T${time}`)!
const EMAIL = 'ds-anfrage@planetclaire.local'

async function create(
  day: string,
  extra: Record<string, unknown> = {},
  nowDay = day,
): Promise<PrivacyRequest> {
  const now = at(nowDay, '15:00')
  const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
  return inTransaction(req, () =>
    createPrivacyRequest(
      req,
      { types: ['access'], receivedAt: day, channel: 'email', contactEmail: EMAIL, ...extra },
      now,
    ),
  )
}

async function save(id: number, body: Record<string, unknown>, day: string) {
  const now = at(day, '15:00')
  const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
  return inTransaction(req, () => savePrivacyRequest(req, id, body, now))
}

async function a14Keys(): Promise<string[]> {
  const res = await db().execute(sql`
    SELECT e.idempotency_key AS k FROM email_log e
      JOIN privacy_requests p ON e.idempotency_key LIKE 'admin_privacy_request_due:' || p.id || ':%'
     WHERE e.template = 'admin_privacy_request_due' AND p.contact_email = ${EMAIL} ORDER BY e.id`)
  return (res.rows as { k: string }[]).map((r) => r.k)
}

async function cleanup() {
  await db().execute(sql`DELETE FROM email_log WHERE template = 'admin_privacy_request_due'`)
  await db().execute(sql`DELETE FROM privacy_requests WHERE contact_email = ${EMAIL}`)
  await db().execute(sql`DELETE FROM job_runs WHERE task = 'privacyRequestsDeadlineReminder'`)
  await payload.jobs.cancel({ where: { taskSlug: { equals: 'privacyRequestsDeadlineReminder' } } })
}

describe('Datenschutz-Anfragen: Erfassung und Fristen (P6.16)', () => {
  beforeAll(async () => {
    payload = await getTestPayload()
  })
  beforeEach(cleanup)
  afterAll(cleanup)

  it('DM-PRQ-01 Nummer DS-JJJJ-NNNN, Frist kalendergenau, Monatsende 31.01. und 31.03.', async () => {
    const a = await create('2026-10-15')
    expect(a.reference).toMatch(/^DS-2026-\d{4}$/)
    expect(a.status).toBe('received')
    expect(berlinDateKey(new Date(a.dueAt))).toBe('2026-11-15')
    const b = await create('2026-01-31')
    expect(berlinDateKey(new Date(b.dueAt))).toBe('2026-02-28')
    const c = await create('2026-03-31')
    expect(berlinDateKey(new Date(c.dueAt))).toBe('2026-04-30')
    expect(a.contactEmail).toBe(EMAIL)
  })

  it('R-153 Eingang in der Zukunft und Verlängerung ohne Grund/Mitteilung bzw. zu spät werden abgelehnt', async () => {
    await expect(create('2026-10-17', {}, '2026-10-16')).rejects.toMatchObject({ status: 400 })
    const r = await create('2026-10-15')
    await expect(save(r.id, { extendedDueAt: '2026-12-15' }, '2026-10-20')).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      save(
        r.id,
        {
          extendedDueAt: '2027-01-16',
          extensionReason: 'Viele Anfragen gleichzeitig',
          extensionNotifiedAt: '2026-10-20',
        },
        '2026-10-20',
      ),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      save(
        r.id,
        {
          extendedDueAt: '2026-12-15',
          extensionReason: 'Viele Anfragen gleichzeitig',
          extensionNotifiedAt: '2026-11-16',
        },
        '2026-11-16',
      ),
    ).rejects.toMatchObject({ status: 400 })
    const ok = await save(
      r.id,
      {
        extendedDueAt: '2026-12-15',
        extensionReason: 'Viele Anfragen gleichzeitig',
        extensionNotifiedAt: '2026-11-10',
      },
      '2026-11-10',
    )
    expect(berlinDateKey(new Date(ok.doc.extendedDueAt!))).toBe('2026-12-15')
  })

  it('R-153 Status inkl. identity_check: Frist läuft weiter; Abschluss nur mit Antwortdatum, Ablehnung mit Ergebnis', async () => {
    const r = await create('2026-10-15')
    const s1 = await save(r.id, { status: 'identity_check' }, '2026-10-16')
    expect(s1.doc.status).toBe('identity_check')
    expect(s1.doc.dueAt).toBe(r.dueAt)
    await expect(save(r.id, { status: 'answered' }, '2026-10-17')).rejects.toMatchObject({
      status: 400,
    })
    await save(r.id, { identityVerified: true, identityMethod: 'stored_email' }, '2026-10-17')
    await save(r.id, { status: 'in_progress' }, '2026-10-17')
    await expect(
      save(r.id, { status: 'rejected', answeredAt: '2026-10-18' }, '2026-10-18'),
    ).rejects.toMatchObject({ status: 400 })
    const done = await save(r.id, { status: 'answered', answeredAt: '2026-10-18' }, '2026-10-18')
    expect(done.doc.status).toBe('answered')
    expect(done.doc.retainUntil).toBeTruthy()
    const again = await save(r.id, { status: 'answered' }, '2026-10-18')
    expect(again.unchanged).toBe(true)
  })

  it('R-153 DM-PRQ-02 Erinnerungen genau an Tag −7 und −1, keine sonst; verlängerte Frist verschiebt die Erinnerungen', async () => {
    const r = await create('2026-10-15')
    const due = at('2026-11-15')
    for (let n = -20; n <= 2; n++) {
      await runPrivacyRequestReminders(payload, addBerlinDays(at('2026-11-15', '08:10'), n))
    }
    // zweiter Lauf am selben Tag schickt nichts erneut
    await runPrivacyRequestReminders(payload, addBerlinDays(at('2026-11-15', '18:00'), -7))
    expect(await a14Keys()).toEqual([
      `admin_privacy_request_due:${r.id}:7d:${berlinDateKey(due)}`,
      `admin_privacy_request_due:${r.id}:1d:${berlinDateKey(due)}`,
    ])
    const mail = await payload.find({
      collection: 'email-log',
      where: { template: { equals: 'admin_privacy_request_due' } },
      sort: 'id',
      overrideAccess: true,
    })
    expect(mail.docs[0]!.subject).toBe(
      `Datenschutz-Anfrage ${r.reference}: Frist endet am 15.11.2026`,
    )

    // Verlängerung bis 15.01.2027 → neue Erinnerungen am 08.01. und 14.01.
    const r2 = await create('2026-10-20')
    await save(
      r2.id,
      {
        extendedDueAt: '2027-01-15',
        extensionReason: 'Umfangreiche Auskunft über mehrere Bestellungen',
        extensionNotifiedAt: '2026-11-02',
      },
      '2026-11-02',
    )
    for (const d of ['2026-11-13', '2026-11-19', '2027-01-07', '2027-01-08', '2027-01-14']) {
      await runPrivacyRequestReminders(payload, at(d, '08:10'))
    }
    const keys = (await a14Keys()).filter((k) => k.includes(`:${r2.id}:`))
    expect(keys).toEqual([
      `admin_privacy_request_due:${r2.id}:7d:2027-01-15`,
      `admin_privacy_request_due:${r2.id}:1d:2027-01-15`,
    ])
  })

  it('R-153 Monatsende 31.01.: Erinnerungen am 21.02. und 27.02.', async () => {
    const r = await create('2026-01-31')
    expect(berlinDateKey(new Date(r.dueAt))).toBe('2026-02-28')
    for (const d of ['2026-02-20', '2026-02-21', '2026-02-26', '2026-02-27', '2026-02-28']) {
      await runPrivacyRequestReminders(payload, at(d, '08:10'))
    }
    expect(await a14Keys()).toEqual([
      `admin_privacy_request_due:${r.id}:7d:2026-02-28`,
      `admin_privacy_request_due:${r.id}:1d:2026-02-28`,
    ])
  })

  it('R-153 Anfrage mit seed = true: keine A14, aber Hinweis unter „Heute“', async () => {
    const r = await create('2026-10-15')
    await db().execute(sql`UPDATE privacy_requests SET seed = true WHERE id = ${r.id}`)
    await runPrivacyRequestReminders(payload, at('2026-11-08', '08:10'))
    expect(await a14Keys()).toEqual([])
    const today = await getTodaySummary(at('2026-11-08', '08:10'), payload)
    const hint = today.hints.find((h) => h.id === 'privacy-requests')
    expect(hint).toBeDefined()
    expect(hint!.tone).toBe('error')
    expect(hint!.href).toBe('/export/datenschutz')
    expect(hint!.text).toContain(r.reference)
  })

  it('R-153 Task privacyRequestsDeadlineReminder: einmal je Tag ab 08:00 Berlin', async () => {
    const r = await create('2026-10-15')
    await runTaskNow(payload, 'privacyRequestsDeadlineReminder', { now: at('2026-11-08', '07:30') })
    expect(await a14Keys()).toEqual([])
    await runTaskNow(payload, 'privacyRequestsDeadlineReminder', { now: at('2026-11-08', '08:05') })
    expect(await a14Keys()).toEqual([`admin_privacy_request_due:${r.id}:7d:2026-11-15`])
  })
})
