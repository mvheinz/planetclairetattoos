import { createLocalReq, Forbidden, type Payload, type PayloadRequest } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { getStatusHistory, writeAudit } from '@/lib/audit'
import { writeDeletionLog } from '@/lib/retention/log'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.7: Protokoll-Collections (DATENMODELL §6.21–§6.24, §6.27).
const LOG_COLLECTIONS = [
  'audit-log',
  'email-log',
  'consent-log',
  'webhook-events',
  'deletion-log',
] as const
type LogSlug = (typeof LOG_COLLECTIONS)[number]

let payload: Payload
const ids = {} as Record<LogSlug, number>
let run = 0
const uid = () => `${Date.now().toString(36)}-${++run}`

const sample = (): Record<LogSlug, Record<string, unknown>> => ({
  'audit-log': {
    action: 'product_created',
    actorType: 'system',
    entityCollection: 'products',
    entityId: '981',
    summary: 'Nr. 981 angelegt',
    retainUntil: '2030-01-01T00:00:00.000Z',
  },
  'email-log': {
    template: 'order_confirmation',
    to: 'kundin@example.com',
    locale: 'de',
    subject: 'Deine Bestellung',
    status: 'queued',
    retainUntil: '2030-01-01T00:00:00.000Z',
  },
  'consent-log': {
    purpose: 'carrier_email_forwarding',
    granted: true,
    textSnapshot: 'Ich bin einverstanden, dass …',
    textSha256: 'x',
    locale: 'de',
    email: 'kundin@example.com',
    retainUntil: '2030-01-01T00:00:00.000Z',
  },
  'webhook-events': {
    provider: 'mock',
    eventId: `evt_mock_${uid()}`,
    type: 'checkout.session.completed',
    livemode: false,
    status: 'processing',
    attempts: 1,
  },
  'deletion-log': {
    entityCollection: 'orders',
    entityId: '990',
    ruleId: 'L-05 Stufe D',
    action: 'anonymized',
    trigger: 'job',
    taskSlug: 'retentionOrders',
    storageObjectsCount: 0,
    executedAt: '2026-09-27T08:00:00.000Z',
    retainUntil: '2026-09-27T08:00:00.000Z',
  },
})

async function systemReq(): Promise<PayloadRequest> {
  return createLocalReq({}, payload)
}

beforeAll(async () => {
  payload = await getTestPayload()
  const data = sample()
  for (const slug of LOG_COLLECTIONS) {
    const doc = await payload.create({
      collection: slug,
      data: data[slug] as never,
      overrideAccess: true,
    })
    ids[slug] = doc.id as number
  }
})

describe('Zugriff (P1.7 Akzeptanz)', () => {
  for (const slug of LOG_COLLECTIONS) {
    it(`AK-P1.7-01 ${slug}: anonymes REST-POST/PATCH/DELETE (und GET) ist verboten`, async () => {
      const data = sample()[slug]
      expect((await rest('POST', `/${slug}`, data)).status).toBe(403)
      expect((await rest('PATCH', `/${slug}/${ids[slug]}`, { summary: 'x' })).status).toBe(403)
      expect((await rest('DELETE', `/${slug}/${ids[slug]}`)).status).toBe(403)
      expect((await rest('GET', `/${slug}`)).status).toBe(403)
      expect((await rest('GET', `/${slug}/${ids[slug]}`)).status).toBe(403)
      // Eintrag ist unverändert vorhanden
      const doc = await payload.findByID({ collection: slug, id: ids[slug], overrideAccess: true })
      expect(doc.id).toBe(ids[slug])
    })

    it(`AK-P1.7-02 ${slug}: Local API ohne overrideAccess kann nicht anlegen (auch nicht als Admin)`, async () => {
      const data = sample()[slug] as never
      await expect(
        payload.create({ collection: slug, data, overrideAccess: false }),
      ).rejects.toBeInstanceOf(Forbidden)
      const user = { id: 1, collection: 'users', email: 'admin@example.com' } as never
      await expect(
        payload.create({ collection: slug, data, overrideAccess: false, user }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.delete({ collection: slug, id: ids[slug], overrideAccess: false, user }),
      ).rejects.toBeInstanceOf(Forbidden)
    })
  }

  it('Admin darf lesen (read: isAdmin)', async () => {
    const user = { id: 1, collection: 'users', email: 'admin@example.com' } as never
    const res = await payload.find({
      collection: 'audit-log',
      overrideAccess: false,
      user,
      limit: 1,
    })
    expect(res.totalDocs).toBeGreaterThan(0)
  })
})

describe('Unveränderlichkeit (Hooks)', () => {
  it('audit-log und deletion-log: kein Feld änderbar, auch nicht mit overrideAccess', async () => {
    await expect(
      payload.update({
        collection: 'audit-log',
        id: ids['audit-log'],
        data: { summary: 'neu' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'deletion-log',
        id: ids['deletion-log'],
        data: { ruleId: 'ADMIN' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('consent-log: nur withdrawnAt änderbar; email/Text bleiben', async () => {
    const id = ids['consent-log']
    const upd = await payload.update({
      collection: 'consent-log',
      id,
      data: { withdrawnAt: '2026-09-27T10:00:00.000Z' },
      overrideAccess: true,
    })
    expect(upd.withdrawnAt).toBe('2026-09-27T10:00:00.000Z')
    await expect(
      payload.update({
        collection: 'consent-log',
        id,
        data: { email: 'andere@example.com' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    expect(upd.textSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('email-log: Versandstatus änderbar, Empfänger und Vorlage nicht', async () => {
    const id = ids['email-log']
    await expect(
      payload.update({
        collection: 'email-log',
        id,
        data: { to: 'x@example.org' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    const sent = await payload.update({
      collection: 'email-log',
      id,
      data: { attempts: 1, sentAt: '2026-09-27T08:00:00.000Z' },
      overrideAccess: true,
    })
    // L-12 ohne Bezug: sentAt + 90 Berliner Kalendertage (10:00 MESZ → 10:00 MEZ)
    expect(sent.retainUntil).toBe('2026-12-26T09:00:00.000Z')
  })

  it('webhook-events: eventId eindeutig und unveränderlich', async () => {
    const dup = { ...sample()['webhook-events'], eventId: 'evt_mock_dup' }
    await payload.create({ collection: 'webhook-events', data: dup as never, overrideAccess: true })
    await expect(
      payload.create({ collection: 'webhook-events', data: dup as never, overrideAccess: true }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'webhook-events',
        id: ids['webhook-events'],
        data: { eventId: 'evt_x' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    const ok = await payload.update({
      collection: 'webhook-events',
      id: ids['webhook-events'],
      data: { status: 'processed', processedAt: '2026-09-27T08:00:01.000Z' },
      overrideAccess: true,
    })
    expect(ok.status).toBe('processed')
    expect(ok.receivedAt).toBeTruthy()
  })
})

describe('email-log: reservierte Domains (R-180)', () => {
  it('Empfänger @example.com wird immer als suppressed protokolliert', async () => {
    const doc = await payload.create({
      collection: 'email-log',
      data: { ...sample()['email-log'], to: 'test@kunde.test' } as never,
      overrideAccess: true,
    })
    expect(doc.status).toBe('suppressed')
  })
})

describe('writeAudit (DATENMODELL §6.21)', () => {
  it('AK-P1.7-03 maskiert Werte, die wie E-Mail oder IBAN aussehen, und personenbezogene Felder', async () => {
    const req = await systemReq()
    const doc = await writeAudit(req, {
      action: 'order_address_changed',
      entityCollection: 'orders',
      entityId: 990,
      summary:
        'PC-2026-90001: Mail an maria@example.com, IBAN DE89 3704 0044 0532 0130 00 geändert',
      changes: {
        note: ['alt', 'Konto DE89370400440532013000 bitte nutzen'],
        email: ['maria@example.com', 'maria.neu@example.com'],
        shippingAddress: [
          { name: 'Maria Muster', city: 'Berlin' },
          { name: 'Maria Muster', city: 'Köln' },
        ],
        priceCents: [4500, 4900],
      },
    })
    expect(doc).not.toBeNull()
    const text = JSON.stringify(doc)
    expect(text).not.toMatch(/maria/i)
    expect(text).not.toMatch(/DE89/)
    expect(text).not.toMatch(/Muster/)
    expect(doc!.summary).toContain('[redacted]')
    expect((doc!.changes as Record<string, unknown>).priceCents).toEqual([4500, 4900])
    expect(doc!.actorType).toBe('system')
    // Bestell-Aktion: 10 Jahre ab Jahresende (L-13 h)
    expect(new Date(doc!.retainUntil).getUTCMonth()).toBe(11)
    expect(new Date(doc!.retainUntil).getUTCDate()).toBe(31)
  })

  it('context.skipAudit verhindert Einträge; req.context bleibt erhalten', async () => {
    const req = await systemReq()
    req.context = { skipAudit: true }
    expect(
      await writeAudit(req, {
        action: 'seed_imported',
        entityCollection: 'x',
        entityId: 1,
        summary: 's',
      }),
    ).toBeNull()
    const req2 = await systemReq()
    req2.context = { system: true }
    await writeAudit(req2, {
      action: 'settings_changed',
      entityCollection: 'settings',
      entityId: 'settings',
      summary: 'Einstellungen geändert',
    })
    expect(req2.context).toEqual({ system: true })
  })

  it('getStatusHistory liefert den Verlauf aus audit-log in zeitlicher Reihenfolge', async () => {
    const req = await systemReq()
    const entityId = `98${run++}`
    await writeAudit(req, {
      action: 'product_status_changed',
      entityCollection: 'products',
      entityId,
      summary: 'Nr. 98x: Entwurf → online',
      changes: { status: ['draft', 'available'] },
      transition: 'P1',
      actorType: 'admin',
    })
    await writeAudit(req, {
      action: 'product_status_changed',
      entityCollection: 'products',
      entityId,
      summary: 'Nr. 98x: online → reserviert',
      changes: { status: ['available', 'reserved'] },
      transition: 'P3',
      actorType: 'system',
    })
    const history = await getStatusHistory('products', entityId, { payload })
    expect(history.map((h) => [h.from, h.to, h.transition, h.actorType])).toEqual([
      ['draft', 'available', 'P1', 'admin'],
      ['available', 'reserved', 'P3', 'system'],
    ])
    expect(await getStatusHistory('orders', entityId, { payload })).toEqual([])
  })
})

describe('deletion-log (DATENMODELL §6.27, L-18)', () => {
  const create = (ruleId: string) =>
    payload.create({
      collection: 'deletion-log',
      data: { ...sample()['deletion-log'], ruleId } as never,
      overrideAccess: true,
    })

  for (const ok of ['L-10', 'L-13 a', 'L-23 d', 'L-05 Stufe C', 'L-04 Stufe 1', 'DSGVO', 'ADMIN']) {
    it(`AK-P1.7-04 ruleId „${ok}“ wird akzeptiert`, async () => {
      expect((await create(ok)).ruleId).toBe(ok)
    })
  }
  for (const bad of [
    'L-1',
    'L-100',
    'L-13 i',
    'L-05 Stufe E',
    'l-10',
    'dsgvo',
    'L-10 ',
    'Löschung',
  ]) {
    it(`AK-P1.7-04 ruleId „${bad}“ wird abgelehnt`, async () => {
      await expect(create(bad)).rejects.toThrow()
    })
  }

  it('AK-P1.7-05 retainUntil = executedAt + 3 Jahre (L-18); keine E-Mail als entityId', async () => {
    const req = await systemReq()
    const doc = await writeDeletionLog(req, {
      entityCollection: 'inquiries',
      entityId: 991,
      ruleId: 'L-10',
      action: 'deleted',
      trigger: 'job',
      taskSlug: 'retentionCommissionInquiries',
      storageObjectsCount: 2,
      executedAt: new Date('2026-09-27T08:00:00.000Z'),
    })
    expect(doc.retainUntil).toBe('2029-09-27T08:00:00.000Z')
    await expect(
      writeDeletionLog(req, {
        entityCollection: 'inquiries',
        entityId: 'maria@example.com',
        ruleId: 'DSGVO',
        action: 'deleted',
        trigger: 'privacy_request',
        privacyRequestRef: 'DS-2026-0001',
        executedAt: new Date('2026-09-27T08:00:00.000Z'),
      }),
    ).rejects.toThrow()
  })

  it('writeDeletionLog läuft in der Transaktion des Aufrufers (Rollback entfernt den Eintrag)', async () => {
    const req = await systemReq()
    const transactionID = await payload.db.beginTransaction()
    req.transactionID = transactionID!
    const doc = await writeDeletionLog(req, {
      entityCollection: 'orders',
      entityId: 992,
      ruleId: 'L-05 Stufe D',
      action: 'anonymized',
      trigger: 'job',
      executedAt: new Date('2026-09-27T08:00:00.000Z'),
    })
    await payload.db.rollbackTransaction(transactionID!)
    const found = await payload.find({
      collection: 'deletion-log',
      where: { id: { equals: doc.id } },
      overrideAccess: true,
    })
    expect(found.totalDocs).toBe(0)
  })
})
