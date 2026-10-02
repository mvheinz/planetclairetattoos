import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { adminRecipient } from '@/lib/email/outbox'
import { parseEnv } from '@/lib/env'
import { listProtocols, parseProtocolFilters } from '@/lib/privacy/logs'
import { maskEmail } from '@/lib/privacy/mask'

import { resetAdmin } from '../helpers/admin'
import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P6.19 – Einwilligungs- und Mail-Protokolle in der Verwaltung (KONZEPT §6.1, §7.15): „Kopie an mich“ für M08 geht
// ausschließlich an die Verwaltungs-Adresse (auch wenn der Aufruf etwas anderes verlangt); die Protokoll-Listen zeigen
// Typ, Betreff, Zeitpunkt, Anbieter-ID, Status und Anhang-Namen bzw. Zweck, Zeitpunkt, Baustein-Version und Widerruf –
// Empfänger maskiert, keine Mail-Inhalte und keine Freitexte von Kund:innen.

const CUSTOMER = 'wiebke.widerruf@planetclaire.local'
const REASON = 'Freitext-Grund: Die Glasur passt nicht zu meiner Küche'
const CONSENT_TEXT = 'Einwilligungstext mit Freitext-Spur 4711'
let payload: Payload
let token: string
let withdrawalId: number
const db = () => dbOf(payload)
const auth = () => ({ authorization: `JWT ${token}` })

async function cleanup() {
  await db()
    .execute(sql`DELETE FROM email_log WHERE template = 'withdrawal_receipt' OR "to" = ${CUSTOMER}
    OR idempotency_key LIKE 'logs-test:%'`)
  await db().execute(sql`DELETE FROM consent_log WHERE email = ${CUSTOMER}`)
  await db().execute(sql`DELETE FROM withdrawals WHERE email = ${CUSTOMER}`)
}

beforeAll(async () => {
  payload = await getTestPayload()
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
  await cleanup()
  ;({ token } = await resetAdmin(payload, '198.51.100.61'))
  const w = await payload.create({
    collection: 'withdrawals',
    data: {
      reference: 'WR-2026-00961',
      channel: 'online_form',
      locale: 'de',
      receivedAt: '2026-09-30T10:00:00.000Z',
      name: 'Wiebke Widerruf',
      contractIdentification: 'Bestellung vom 20.09.',
      email: CUSTOMER,
      reason: REASON,
      matchStatus: 'needs_manual_match',
      status: 'received',
      refundDueAt: '2026-10-14T10:00:00.000Z',
      submissionSnapshot: { name: 'Wiebke Widerruf' },
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  withdrawalId = w.id as number
  const seedLog = (template: string, status: string, createdAt: string, extra = {}) =>
    payload.create({
      collection: 'email-log',
      data: {
        template,
        to: CUSTOMER,
        locale: 'de',
        subject: `Betreff ${template}`,
        idempotencyKey: `logs-test:${template}:${status}:${createdAt}`,
        status,
        attempts: 1,
        messageId: status === 'sent' ? '<abc-123@mail.test>' : undefined,
        attachments:
          status === 'sent'
            ? [{ filename: 'RE-2026-00001.pdf', sha256: 'a'.repeat(64), sizeBytes: 1234 }]
            : [],
        withdrawal: withdrawalId,
        ...extra,
      } as never,
      overrideAccess: true,
      context: { system: true, skipAudit: true },
    })
  const sent = await seedLog('withdrawal_receipt', 'sent', '2026-09-30')
  const failed = await seedLog('refund_confirmation', 'failed', '2026-10-01')
  await db().execute(
    sql`UPDATE email_log SET created_at = '2026-09-30T10:01:00Z' WHERE id = ${sent.id}`,
  )
  await db().execute(
    sql`UPDATE email_log SET created_at = '2026-10-01T10:01:00Z' WHERE id = ${failed.id}`,
  )
  await payload.create({
    collection: 'consent-log',
    data: {
      purpose: 'carrier_email_forwarding',
      granted: true,
      textSnapshot: CONSENT_TEXT,
      snippetKey: 'checkout.dhlEmailConsent',
      snippetVersion: '3',
      locale: 'de',
      email: CUSTOMER,
      withdrawnAt: '2026-10-02T09:00:00.000Z',
    } as never,
    overrideAccess: true,
    context: { system: true },
  })
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await cleanup()
})

describe('Protokolle in der Verwaltung (P6.19)', () => {
  it('R-093 „Kopie an mich“ für M08 geht ausschließlich an die Verwaltungs-Adresse', async () => {
    const admin = await adminRecipient(await createLocalReq({}, payload))
    expect(admin).not.toBe(CUSTOMER)
    clearMemoryOutbox()
    const res = await rest(
      'POST',
      `/withdrawals/${withdrawalId}/receipt-copy`,
      { to: CUSTOMER, email: CUSTOMER },
      { ...auth(), 'idempotency-key': 'copy-1' },
    )
    expect(res.status).toBe(200)
    const logs = await payload.find({
      collection: 'email-log',
      where: { idempotencyKey: { like: `withdrawal_receipt:${withdrawalId}:copy:` } },
      overrideAccess: true,
    })
    expect(logs.docs).toHaveLength(1)
    expect(logs.docs[0]!.to).toBe(admin)
    const mails = getMemoryOutbox().filter((m) => m.type === 'withdrawal_receipt')
    expect(mails).toHaveLength(1)
    expect(mails[0]!.to).toEqual([admin])
    expect(mails[0]!.to).not.toContain(CUSTOMER)
    // derselbe Klick (gleicher Schlüssel) verschickt keine zweite Kopie, ein neuer Klick schon
    await rest(
      'POST',
      `/withdrawals/${withdrawalId}/receipt-copy`,
      {},
      { ...auth(), 'idempotency-key': 'copy-1' },
    )
    await rest(
      'POST',
      `/withdrawals/${withdrawalId}/receipt-copy`,
      {},
      { ...auth(), 'idempotency-key': 'copy-2' },
    )
    const again = await payload.count({
      collection: 'email-log',
      where: { idempotencyKey: { like: `withdrawal_receipt:${withdrawalId}:copy:` } },
      overrideAccess: true,
    })
    expect(again.totalDocs).toBe(2)
    // ohne Anmeldung nicht erlaubt; M08 lässt sich nicht über „Mail erneut senden“ an die Kundin schicken
    expect((await rest('POST', `/withdrawals/${withdrawalId}/receipt-copy`, {})).status).toBe(403)
  })

  it('Mail-Protokoll: Typ, Betreff, Zeitpunkt, Anbieter-ID, Status, Anhang-Namen; Empfänger maskiert, keine Freitexte', async () => {
    const req = await createLocalReq({}, payload)
    const { emails } = await listProtocols(req, parseProtocolFilters({ art: 'mails' }))
    const sent = emails.find((m) => m.subject === 'Betreff withdrawal_receipt')!
    expect(sent).toMatchObject({
      konzeptId: 'M08',
      subject: 'Betreff withdrawal_receipt',
      messageId: '<abc-123@mail.test>',
      attachments: ['RE-2026-00001.pdf'],
      to: maskEmail(CUSTOMER),
    })
    expect(sent.to).toBe('wi***@pl***.local')
    const dump = JSON.stringify(emails)
    expect(dump).not.toContain(CUSTOMER)
    expect(dump).not.toContain(REASON)
    expect(dump).not.toContain('Wiebke')
    // Filter: Status und Zeitraum (Berliner Tage)
    const failed = await listProtocols(
      req,
      parseProtocolFilters({ art: 'mails', status: 'failed' }),
    )
    expect(failed.emails.every((m) => m.status === 'failed')).toBe(true)
    expect(failed.emails.some((m) => m.template === 'refund_confirmation')).toBe(true)
    const day = await listProtocols(
      req,
      parseProtocolFilters({ art: 'mails', von: '2026-09-30', bis: '2026-09-30' }),
    )
    expect(day.emails.map((m) => m.template)).toContain('withdrawal_receipt')
    expect(day.emails.map((m) => m.template)).not.toContain('refund_confirmation')
    const typed = await listProtocols(
      req,
      parseProtocolFilters({ art: 'mails', typ: 'refund_confirmation' }),
    )
    expect(typed.emails.every((m) => m.template === 'refund_confirmation')).toBe(true)
  })

  it('Einwilligungs-Protokoll: Zweck, Zeitpunkt, Baustein-Version, Widerruf – ohne Einwilligungstext, Adresse maskiert', async () => {
    const req = await createLocalReq({}, payload)
    const all = await listProtocols(req, parseProtocolFilters({ art: 'einwilligungen' }))
    const row = all.consents.find((c) => c.email === maskEmail(CUSTOMER))!
    expect(row).toMatchObject({
      purpose: 'carrier_email_forwarding',
      granted: true,
      snippet: 'checkout.dhlEmailConsent · v3',
    })
    expect(row.withdrawnAt).toBe('02.10.2026, 11:00')
    const dump = JSON.stringify(all.consents)
    expect(dump).not.toContain(CONSENT_TEXT)
    expect(dump).not.toContain(CUSTOMER)
    const withdrawn = await listProtocols(
      req,
      parseProtocolFilters({ art: 'einwilligungen', status: 'withdrawn' }),
    )
    expect(withdrawn.consents.every((c) => c.withdrawnAt !== null)).toBe(true)
    const active = await listProtocols(
      req,
      parseProtocolFilters({ art: 'einwilligungen', status: 'granted' }),
    )
    expect(active.consents.some((c) => c.email === maskEmail(CUSTOMER))).toBe(false)
  })

  it('maskEmail verdeckt Adressen teilweise', () => {
    expect(maskEmail('erika@example.com')).toBe('er***@ex***.com')
    expect(maskEmail('a@b.de')).toBe('a***@b***.de')
    expect(maskEmail(null)).toBe('–')
  })
})
