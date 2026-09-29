import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { InvalidEmailRequestError } from '@/lib/email/outbox'
import { getEnv } from '@/lib/env'

import { getTestPayload } from '../helpers/payload'

// P5.2 – `notifyAdmin` (KONZEPT §6.4): Outbox-Eintrag an `settings.adminNotificationEmail`, Rückfall
// `ADMIN_NOTIFY_EMAIL`; A12 höchstens eine Mail je Fehlerart und Stunde (vorgestellte Uhr); A05 ohne Kund:innen-Daten.

let payload: Payload
let before: string | null | undefined
const logIds: number[] = []
const run = `${Date.now().toString(36)}`

const inquiry = (n: number) => ({
  inquiryId: 900 + n,
  reference: `AA-2026-${String(9000 + n)}`,
  objectType: 'schale' as const,
  imageCount: 1,
})

async function setAdminEmail(value: string | null) {
  await payload.updateGlobal({
    slug: 'settings',
    data: { adminNotificationEmail: value } as never,
    overrideAccess: true,
    locale: 'de',
    context: { seed: true },
  })
}

async function logOf(id: number) {
  return payload.findByID({ collection: 'email-log', id, depth: 0, overrideAccess: true })
}

beforeAll(async () => {
  payload = await getTestPayload()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  before = settings.adminNotificationEmail
})

afterAll(async () => {
  await setAdminEmail(before ?? null)
  if (logIds.length > 0) {
    await payload.delete({
      collection: 'payload-jobs',
      where: { 'input.emailLogId': { in: logIds } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'email-log',
      where: { id: { in: logIds } },
      overrideAccess: true,
    })
  }
})

describe('notifyAdmin: Empfänger (KONZEPT §6.4)', () => {
  it('settings.adminNotificationEmail hat Vorrang, leer → Rückfall ADMIN_NOTIFY_EMAIL; immer Deutsch', async () => {
    await setAdminEmail('werkstatt@planetclaire.local')
    const a = await notifyAdmin(
      await createLocalReq({}, payload),
      'admin_inquiry_received',
      inquiry(1),
      {
        idempotencyKey: `admin_inquiry_received:${run}-1:new`,
      },
    )
    expect(a.status).toBe('queued')
    logIds.push(a.emailLogId!)
    const la = await logOf(a.emailLogId!)
    expect(la.to).toBe('werkstatt@planetclaire.local')
    expect(la.locale).toBe('de')
    expect(la.subject).toBe(`Neue Anfrage AA-2026-9001 (Schale)`)

    await setAdminEmail(null)
    const b = await notifyAdmin(
      await createLocalReq({}, payload),
      'admin_inquiry_received',
      inquiry(2),
      {
        idempotencyKey: `admin_inquiry_received:${run}-2:new`,
      },
    )
    logIds.push(b.emailLogId!)
    expect((await logOf(b.emailLogId!)).to).toBe(getEnv().ADMIN_NOTIFY_EMAIL)
  })

  it('gleicher Idempotenz-Schlüssel → keine zweite Mail', async () => {
    const key = `admin_inquiry_received:${run}-3:new`
    const req = await createLocalReq({}, payload)
    const a = await notifyAdmin(req, 'admin_inquiry_received', inquiry(3), { idempotencyKey: key })
    const b = await notifyAdmin(req, 'admin_inquiry_received', inquiry(3), { idempotencyKey: key })
    logIds.push(a.emailLogId!)
    expect([a.status, b.status]).toEqual(['queued', 'duplicate'])
    expect(b.emailLogId).toBe(a.emailLogId)
  })

  it('R-160 A05 mit Name, E-Mail oder Freitext wird abgelehnt (keine Zeile im email-log)', async () => {
    const req = await createLocalReq({}, payload)
    const key = `admin_inquiry_received:${run}-4:new`
    await expect(
      notifyAdmin(
        req,
        'admin_inquiry_received',
        { ...inquiry(4), message: 'Bitte mit Hund', email: 'x@planetclaire.local' } as never,
        { idempotencyKey: key },
      ),
    ).rejects.toBeInstanceOf(InvalidEmailRequestError)
    const rows = await payload.count({
      collection: 'email-log',
      where: { idempotencyKey: { equals: key } },
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(0)
  })

  it('ohne Idempotenz-Schlüssel (außer A12) → Fehler', async () => {
    await expect(
      notifyAdmin(await createLocalReq({}, payload), 'admin_inquiry_received', inquiry(5)),
    ).rejects.toThrow(/Idempotenz-Schlüssel fehlt/)
  })
})

describe('A12 über notifyAdmin: höchstens eine Mail je Fehlerart und Stunde', () => {
  it('drei A12 derselben Art innerhalb einer Stunde → genau eine Mail; neue Stunde → neue Mail', async () => {
    const kind = `notify_test_${run}`
    const data = { kind, summary: 'Testfehler' }
    // 10:05, 10:20, 10:55 Berlin (MESZ) → eine Mail; 11:10 → neue Stunde, > 60 min nach der ersten → neue Mail
    const times = [
      '2026-10-15T08:05:00.000Z',
      '2026-10-15T08:20:00.000Z',
      '2026-10-15T08:55:00.000Z',
      '2026-10-15T09:10:00.000Z',
    ]
    const statuses: string[] = []
    for (const iso of times) {
      const r = await notifyAdmin(await createLocalReq({}, payload), 'admin_alert', data, {
        now: new Date(iso),
      })
      statuses.push(r.status)
      if (r.emailLogId) logIds.push(r.emailLogId)
    }
    expect(statuses).toEqual(['queued', 'throttled', 'throttled', 'queued'])
    const rows = await payload.find({
      collection: 'email-log',
      where: { idempotencyKey: { like: `admin_alert:${kind}@` } },
      overrideAccess: true,
      depth: 0,
    })
    expect(rows.docs).toHaveLength(2)
    expect(rows.docs.every((d) => d.template === 'admin_alert' && d.locale === 'de')).toBe(true)
  })

  it('Uhrzeit aus req.context.now, wenn keine Zeit übergeben wird', async () => {
    const kind = `notify_ctx_${run}`
    const req = await createLocalReq({ context: { now: '2026-11-02T07:00:00.000Z' } }, payload)
    const r = await notifyAdmin(req, 'admin_alert', { kind, summary: 'Kontextzeit' })
    expect(r.status).toBe('queued')
    logIds.push(r.emailLogId!)
    expect((await logOf(r.emailLogId!)).idempotencyKey).toBe(
      `admin_alert:${kind}@2026-11-02T07:00:00.000Z`,
    )
  })
})
