import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { withdrawCarrierConsent } from '@/lib/commerce/carrierConsent'
import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { parseEnv } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { inTransaction } from '@/lib/payload/transaction'
import { applyErasure, buildErasurePlan, erasureChoices, followUpsOf } from '@/lib/privacy/erasure'
import { runErasureFollowUps } from '@/lib/privacy/erasureFollowUp'
import { buildPrivacyExportZip, searchForRequest } from '@/lib/privacy/export'
import { searchPerson } from '@/lib/privacy/search'
import { rectifyOrder } from '@/lib/privacy/rectify'
import { createPrivacyRequest, savePrivacyRequest } from '@/lib/privacy/requests'
import { ANONYMIZED_EMAIL } from '@/lib/retention/jobs'
import { readStoredFile } from '@/lib/storage/read'
import type { Invoice, Order, PrivacyRequest, PrivateUpload } from '@/payload-types'

import { REMINDER_FIXTURE } from '../../helpers/mails'
import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.18 – Löschen/Einschränken, Berichtigung, Einwilligungswiderruf (R-151, R-152, LOESCHKONZEPT §5.5–§5.10):
// alte Bestellung (Frist abgelaufen) wird gelöscht (Stufe D), abgeschlossene eingeschränkt (Notizen und Packfotos weg,
// DHL-Einwilligung widerrufen, keine Mails mehr), laufende (bezahlt, nicht versandt bzw. unterwegs) bekommt „keine
// Aktion“ vorgeschlagen, Rechnungen unverändert, `deletion-log` mit `trigger = privacy_request`; M15 meldet nur, was
// wirklich gilt („eingeschränkt“ nur bei Einschränkung, DHL-Satz nur nach Widerruf); Berichtigung vor der Rechnung
// direkt, danach Gutschrift + neue Rechnung; DHL-Widerruf entfernt die E-Mail aus „Adresse kopieren“ und bestätigt
// mit M16. Prüfung P18.5: alle Entscheidungen werden vor der ersten Aktion geprüft (keine verlorenen Dateien); ein
// Widerruf nach der Zustellung hält den Vertrag offen; die Löschanfrage widerruft die DHL-Einwilligung auch ohne
// Einschränkung; der Nachlauf schränkt laufende Vorgänge nach Abschluss ein.

const NUMBERS = [990, 991, 992, 993, 994]
const EMAIL = 'lena.loesch@planetclaire.local'
const NAME = 'Lena Loesch'
/** Zweite Person für die M15-Prüfung ohne Einschränkung. */
const EMAIL2 = 'lena.zwei@planetclaire.local'
/** Dritte Person (Prüfung vor der ersten Aktion) und vierte (Widerruf nach Zustellung, Nachlauf). */
const EMAIL3 = 'lena.drei@planetclaire.local'
const EMAIL4 = 'lena.vier@planetclaire.local'
const PEOPLE = [EMAIL, EMAIL2, EMAIL3, EMAIL4]
const NOW = new Date('2026-10-12T10:00:00.000Z')
const PHOTO = path.resolve('tests/fixtures/images/landscape-small.jpg')

let payload: Payload
let restoreBusiness: () => Promise<void>
let items: ItemInput[] = []
let seq = 0
const db = () => dbOf(payload)
const req = (now = NOW) => createLocalReq({ context: { now: now.toISOString() } }, payload)

async function order(i: number, overrides: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(
    payload,
    orderData(990 + ++seq, [items[i]!], {
      customer: { name: NAME, email: EMAIL },
      shippingAddress: {
        name: NAME,
        addressLine1: 'Löschweg 1',
        postalCode: '10999',
        city: 'Berlin',
        country: 'DE',
      },
      timestamps: { placedAt: '2026-09-01T10:00:00.000Z', paidAt: '2026-09-01T10:05:00.000Z' },
      ...overrides,
    }),
  )) as Order
}

async function invoiceFor(o: Order): Promise<Invoice> {
  const r = await createLocalReq({ context: { system: true } }, payload)
  const res = await inTransaction(r, () =>
    createInvoiceForOrder(r, o, { paidAt: new Date('2026-09-01T10:05:00.000Z'), now: NOW }),
  )
  await runInvoicePdfJob(payload, res.jobId)
  return (await payload.findByID({
    collection: 'invoices',
    id: res.invoice.id,
    depth: 0,
    overrideAccess: true,
  })) as Invoice
}

async function newRequest(types: string[], email = EMAIL): Promise<PrivacyRequest> {
  const r = await req()
  const pr = await inTransaction(r, () =>
    createPrivacyRequest(r, { types, receivedAt: '2026-10-12', contactEmail: email }, NOW),
  )
  const r2 = await req()
  await inTransaction(r2, () =>
    savePrivacyRequest(r2, pr.id, { identityVerified: true, identityMethod: 'stored_email' }, NOW),
  )
  const r3 = await req()
  return (await inTransaction(r3, () => searchForRequest(r3, pr.id, { email }, NOW))).request
}

async function logs(collection: string, id: number) {
  const res = await db().execute(sql`SELECT * FROM deletion_log
    WHERE entity_collection = ${collection} AND entity_id = ${String(id)} ORDER BY id`)
  return res.rows
}

async function cleanup() {
  const people = sql.raw(PEOPLE.map((e) => `'${e}'`).join(', '))
  await db().execute(sql`DELETE FROM email_log WHERE lower("to") IN (${people})
    OR template IN ('privacy_erasure_response', 'consent_withdrawal_confirmation')`)
  await db().execute(sql`DELETE FROM consent_log WHERE lower(email) IN (${people})`)
  await db().execute(sql`DELETE FROM privacy_requests WHERE contact_email IN (${people})`)
  await db().execute(sql`DELETE FROM inquiries WHERE email = ${EMAIL}`)
}

async function packingPhoto(orderId: number): Promise<PrivateUpload> {
  const png = await readFile(PHOTO)
  return (await payload.create({
    collection: 'private-uploads',
    data: { purpose: 'packing_photo', relatedOrder: orderId } as never,
    file: { data: png, name: `pack-${Date.now()}.jpg`, mimetype: 'image/jpeg', size: png.length },
    overrideAccess: true,
  })) as PrivateUpload
}

/** Frist abgelaufen (zugestellt 2019, Aufbewahrung bis 01.01.2026). */
async function expire(o: Order) {
  await db().execute(sql`UPDATE orders SET status = 'delivered',
    timestamps_final_status_at = '2019-06-01T10:00:00Z', retain_until = '2026-01-01T00:00:00Z'
    WHERE id = ${o.id}`)
}

/** Abgeschlossen (zugestellt am 05.09.2026), Aufbewahrung bis 01.01.2033 (Berlin). */
async function finish(o: Order) {
  await db().execute(sql`UPDATE orders SET status = 'delivered',
    timestamps_delivered_at = '2026-09-05T10:00:00Z', timestamps_final_status_at = '2026-09-05T10:00:00Z',
    retain_until = '2032-12-31T23:00:00Z' WHERE id = ${o.id}`)
}

beforeAll(async () => {
  payload = await getTestPayload()
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
  await cleanup()
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  items = []
  for (const nr of NUMBERS) {
    const p = await createProduct(payload, completeProduct('keramik', nr, fx))
    items.push({ id: p.id as number, itemNumber: nr })
  }
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await cleanup()
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await restoreBusiness()
})

describe('DSGVO: Löschen/Einschränken (P6.18)', () => {
  it('R-151 alte Bestellung (Frist abgelaufen) gelöscht, neue eingeschränkt, Rechnung unverändert, Log-Einträge vorhanden', async () => {
    const oldOrder = await order(0, { gift: { isGift: true, message: 'Alter Gruß' } })
    const oldInvoice = await invoiceFor(oldOrder)
    await db().execute(sql`UPDATE orders SET status = 'delivered',
      timestamps_final_status_at = '2019-06-01T10:00:00Z', retain_until = '2026-01-01T00:00:00Z'
      WHERE id = ${oldOrder.id}`)
    const fresh = await order(1, {
      notes: 'Bitte Geschenkpapier – Nachbarin Frau Dritte nimmt an',
      carrierEmailConsent: true,
      gift: { isGift: true, message: 'Für Frau Dritte, alles Gute!' },
    })
    const freshInvoice = await invoiceFor(fresh)
    await finish(fresh)
    // laufende Verträge: bezahlt und noch nicht versandt bzw. versandt und noch unterwegs (Endstatus erst in 30 Tagen)
    const running = await order(2)
    const inTransit = await order(3)
    await db().execute(sql`UPDATE orders SET status = 'shipped',
      timestamps_shipped_at = '2026-10-10T10:00:00Z', timestamps_final_status_at = '2026-11-09T10:00:00Z'
      WHERE id = ${inTransit.id}`)
    const png = await readFile(PHOTO)
    const packing = (await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'packing_photo', relatedOrder: fresh.id } as never,
      file: { data: png, name: `pack-${Date.now()}.jpg`, mimetype: 'image/jpeg', size: png.length },
      overrideAccess: true,
    })) as PrivateUpload
    await payload.create({
      collection: 'consent-log',
      data: {
        purpose: 'carrier_email_forwarding',
        granted: true,
        textSnapshot: 'Ich bin einverstanden, dass meine E-Mail-Adresse an DHL weitergegeben wird.',
        snippetKey: 'checkout.dhlEmailConsent',
        snippetVersion: 'draft-1',
        locale: 'de',
        email: EMAIL,
        order: fresh.id,
      } as never,
      overrideAccess: true,
      context: { system: true },
    })
    const inquiry = await payload.create({
      collection: 'inquiries',
      data: {
        reference: 'AA-2026-0990',
        name: NAME,
        email: EMAIL,
        idea: 'Eine Tasse mit Wolken, gern in Hellblau.',
        objectType: 'tasse',
        locale: 'de',
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const invoicesBefore = await db().execute(
      sql`SELECT id, number, data, sha256, pdf_id, status FROM invoices WHERE id IN (${oldInvoice.id}, ${freshInvoice.id}) ORDER BY id`,
    )

    const pr = await newRequest(['erasure'])
    const r = await req()
    const plan = await buildErasurePlan(r, pr, { email: EMAIL }, NOW)
    const row = (c: string, id: number) => plan.find((p) => p.collection === c && p.id === id)!
    expect(row('orders', oldOrder.id).suggested).toBe('delete')
    expect(row('orders', fresh.id).suggested).toBe('restrict')
    expect(row('orders', fresh.id).until).toBe('2032-12-31T23:00:00.000Z')
    for (const o of [running, inTransit]) {
      expect(row('orders', o.id).suggested, o.orderNumber).toBe('none')
      expect(row('orders', o.id).actions, o.orderNumber).toEqual(['none', 'restrict', 'keep'])
      expect(row('orders', o.id).note, o.orderNumber).toContain('Vertrag läuft noch')
    }
    expect(row('invoices', oldInvoice.id).actions).toEqual(['none'])
    expect(row('inquiries', inquiry.id as number).suggested).toBe('delete')

    clearMemoryOutbox()
    const r2 = await req()
    const res = await inTransaction(r2, () =>
      applyErasure(
        r2,
        pr.id,
        {
          decisions: plan.map((p) => ({ collection: p.collection, id: p.id, action: p.suggested })),
        },
        NOW,
      ),
    )
    await runEmailJobNow(payload, res.jobId, { now: NOW })

    // alte Bestellung: Personendaten entfernt (Stufe D), Beleg bleibt
    const o1 = (await payload.findByID({
      collection: 'orders',
      id: oldOrder.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(o1.privacy?.anonymizedAt).toBeTruthy()
    expect(o1.customer.email).toBe(ANONYMIZED_EMAIL)
    expect(o1.shippingAddress?.name ?? null).toBeNull()
    expect(o1.gift?.message ?? null).toBeNull()
    // neue Bestellung: eingeschränkt, Notiz und Packfoto weg, DHL-Einwilligung widerrufen
    const o2 = (await payload.findByID({
      collection: 'orders',
      id: fresh.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(o2.privacy?.processingRestricted).toBe(true)
    expect(o2.privacy?.restrictedAt).toBeTruthy()
    expect(o2.notes ?? null).toBeNull()
    // V-18 b: der Gruß für die Geschenkkarte unterliegt keiner Aufbewahrungspflicht – mit der Einschränkung weg
    expect(o2.gift).toMatchObject({ isGift: true, message: null })
    expect(o2.customer.email).toBe(EMAIL)
    expect(o2.carrierEmailConsentRevokedAt).toBeTruthy()
    expect(res.carrierConsentWithdrawn).toBe(true)
    // laufende Verträge bleiben unberührt (Versand-, Zahlungs- und Erstattungsmails gehen weiter)
    for (const id of [running.id, inTransit.id]) {
      const o = (await payload.findByID({
        collection: 'orders',
        id,
        depth: 0,
        overrideAccess: true,
      })) as Order
      expect(o.privacy?.processingRestricted ?? false).toBe(false)
      expect(res.outcomes.find((x) => x.collection === 'orders' && x.id === id)).toMatchObject({
        action: 'none',
        state: 'inUse',
        until: null,
      })
    }
    // … und werden nach Abschluss automatisch eingeschränkt (Nachlauf, Prüfung P18.5)
    expect(res.followUps.map((f) => [f.collection, f.id])).toEqual([
      ['orders', running.id],
      ['orders', inTransit.id],
    ])
    expect(followUpsOf(res.request.remindersSent)).toEqual(res.followUps)
    expect(
      (await db().execute(sql`SELECT id FROM private_uploads WHERE id = ${packing.id}`)).rows,
    ).toHaveLength(0)
    // Anfrage gelöscht
    expect(
      (await db().execute(sql`SELECT id FROM inquiries WHERE id = ${inquiry.id}`)).rows,
    ).toHaveLength(0)
    // Belege unverändert
    const invoicesAfter = await db().execute(
      sql`SELECT id, number, data, sha256, pdf_id, status FROM invoices WHERE id IN (${oldInvoice.id}, ${freshInvoice.id}) ORDER BY id`,
    )
    expect(invoicesAfter.rows).toEqual(invoicesBefore.rows)
    // Löschprotokoll: DSGVO-Einträge mit Anfragenummer, ohne Inhalte
    const l1 = await logs('orders', oldOrder.id)
    expect(l1.map((l) => [l.action, l.trigger, l.rule_id, l.privacy_request_ref])).toContainEqual([
      'anonymized',
      'privacy_request',
      'DSGVO',
      pr.reference,
    ])
    const l2 = await logs('orders', fresh.id)
    expect(l2.map((l) => [l.action, l.trigger, l.rule_id])).toContainEqual([
      'restricted',
      'privacy_request',
      'DSGVO',
    ])
    expect((await logs('private-uploads', packing.id)).map((l) => l.action)).toContain(
      'files_deleted',
    )
    expect((await logs('inquiries', inquiry.id as number)).map((l) => l.action)).toEqual([
      'deleted',
    ])
    const all = await db().execute(
      sql`SELECT * FROM deletion_log WHERE privacy_request_ref = ${pr.reference}`,
    )
    const dump = JSON.stringify(all.rows)
    expect(dump).not.toContain(EMAIL)
    expect(dump).not.toContain('Lena')
    // Antwort M15 an die gespeicherte Adresse
    const m15 = getMemoryOutbox().filter((m) => m.type === 'privacy_erasure_response')
    expect(m15).toHaveLength(1)
    expect(m15[0]!.to).toEqual([EMAIL])
    expect(m15[0]!.text).toContain('Bestellungen: eingeschränkt bis 01.01.2033')
    expect(m15[0]!.text).toContain(
      'Bestellungen: brauche ich noch, um deine Bestellung abzuwickeln',
    )
    expect(m15[0]!.text).toContain('Anfragen zu Auftragsarbeiten: gelöscht')
    expect(m15[0]!.text).toContain('Rechnungen und Gutschriften: unverändert')
    expect(m15[0]!.text).toContain('an DHL ist widerrufen')
  })

  it('R-151 M15 meldet den tatsächlichen Zustand: „keine Aktion“ ist keine Einschränkung, DHL-Satz nur nach Widerruf', async () => {
    const lena2 = { customer: { name: 'Lena Zwei', email: EMAIL2 } }
    // ohne DHL-Einwilligung: dann gibt es auch nichts zu widerrufen
    const finished = await order(3, lena2)
    await finish(finished)
    const old = await order(4, lena2)
    await db().execute(sql`UPDATE orders SET status = 'delivered',
      timestamps_final_status_at = '2019-06-01T10:00:00Z', retain_until = '2026-01-01T00:00:00Z'
      WHERE id = ${old.id}`)
    const pr = await newRequest(['erasure'], EMAIL2)
    const plan = await buildErasurePlan(await req(), pr, { email: EMAIL2 }, NOW)
    expect(plan.map((p) => [p.collection, p.id, p.suggested])).toEqual([
      ['orders', finished.id, 'restrict'],
      ['orders', old.id, 'delete'],
    ])
    const decide = (oldAction: string) =>
      plan.map((p) => ({
        collection: p.collection,
        id: p.id,
        action: p.id === old.id ? oldAction : 'none',
      }))
    // Frist abgelaufen + „keine Aktion“ ergäbe keine wahre Antwort → Jutta muss löschen oder (begründet) behalten
    const r1 = await req()
    await expect(
      inTransaction(r1, () => applyErasure(r1, pr.id, { decisions: decide('none') }, NOW)),
    ).rejects.toMatchObject({ status: 400 })

    clearMemoryOutbox()
    const r2 = await req()
    const res = await inTransaction(r2, () =>
      applyErasure(r2, pr.id, { decisions: decide('delete') }, NOW),
    )
    await runEmailJobNow(payload, res.jobId, { now: NOW })
    expect(res.carrierConsentWithdrawn).toBe(false)
    expect(res.outcomes.find((x) => x.id === finished.id)).toMatchObject({
      action: 'none',
      state: 'inUse',
      until: '2032-12-31T23:00:00.000Z',
    })
    const o = (await payload.findByID({
      collection: 'orders',
      id: finished.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(o.privacy?.processingRestricted ?? false).toBe(false)
    expect(o.carrierEmailConsentRevokedAt ?? null).toBeNull()
    const m15 = getMemoryOutbox().filter((m) => m.type === 'privacy_erasure_response')
    expect(m15).toHaveLength(1)
    expect(m15[0]!.to).toEqual([EMAIL2])
    const text = m15[0]!.text ?? ''
    expect(text).toContain(
      'Bestellungen: aufbewahrt bis 01.01.2033 wegen gesetzlicher Aufbewahrungspflichten',
    )
    expect(text).toContain('Bestellungen: gelöscht')
    expect(text).not.toMatch(/eingeschränkt/i)
    expect(text).not.toContain('DHL')
  })

  it('Prüfung P18.5 alle Entscheidungen werden vor der ersten Aktion geprüft: abgelehnter Plan löscht keine Dateien', async () => {
    const lena3 = { customer: { name: 'Lena Drei', email: EMAIL3 } }
    const first = await order(0, lena3)
    const second = await order(1, lena3)
    await expire(first)
    await expire(second)
    const pack = await packingPhoto(first.id)
    const pr = await newRequest(['erasure'], EMAIL3)
    const plan = await buildErasurePlan(await req(), pr, { email: EMAIL3 }, NOW)
    expect(plan.map((p) => [p.id, p.state])).toEqual([
      [first.id, 'due'],
      [second.id, 'due'],
    ])
    // Verwaltung bietet bei abgelaufener Frist „keine Aktion“ gar nicht an
    expect(erasureChoices(plan[0]!)).toEqual(['delete', 'keep'])

    // erste Bestellung löschen, zweite „keine Aktion“ → abgelehnt, bevor das Packfoto der ersten gelöscht wird
    const r1 = await req()
    await expect(
      inTransaction(r1, () =>
        applyErasure(
          r1,
          pr.id,
          {
            decisions: [
              { collection: 'orders', id: first.id, action: 'delete' },
              { collection: 'orders', id: second.id, action: 'none' },
            ],
          },
          NOW,
        ),
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(
      (await db().execute(sql`SELECT id FROM private_uploads WHERE id = ${pack.id}`)).rows,
    ).toHaveLength(1)
    expect(await readStoredFile('private', pack.filename ?? '', pack.prefix)).not.toBeNull()
    expect(await logs('private-uploads', pack.id)).toHaveLength(0)
    // ebenso eine fehlende Begründung bei „behalten“ in einer späteren Zeile
    const r2 = await req()
    await expect(
      inTransaction(r2, () =>
        applyErasure(
          r2,
          pr.id,
          {
            decisions: [
              { collection: 'orders', id: first.id, action: 'delete' },
              { collection: 'orders', id: second.id, action: 'keep', reason: 'kurz' },
            ],
          },
          NOW,
        ),
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(await readStoredFile('private', pack.filename ?? '', pack.prefix)).not.toBeNull()

    // gültiger Plan: beide anonymisiert, Packfoto weg
    const r3 = await req()
    await inTransaction(r3, () =>
      applyErasure(
        r3,
        pr.id,
        {
          decisions: plan.map((p) => ({ collection: p.collection, id: p.id, action: 'delete' })),
          notify: false,
        },
        NOW,
      ),
    )
    expect(await readStoredFile('private', pack.filename ?? '', pack.prefix)).toBeNull()
    expect((await logs('private-uploads', pack.id)).map((l) => l.privacy_request_ref)).toEqual([
      pr.reference,
    ])
  })

  it('Prüfung P18.5 Widerruf nach Zustellung: Vertrag läuft, DHL-Einwilligung widerrufen, Nachlauf schränkt nach Abschluss ein', async () => {
    const o = await order(2, {
      customer: { name: 'Lena Vier', email: EMAIL4 },
      carrierEmailConsent: true,
    })
    // zugestellt am 05.09. (Endstatus), Widerruf am 08.10. – `finalStatusAt` bleibt stehen
    await db().execute(sql`UPDATE orders SET status = 'withdrawal_received',
      status_before_withdrawal = 'delivered', timestamps_delivered_at = '2026-09-05T10:00:00Z',
      timestamps_final_status_at = '2026-09-05T10:00:00Z',
      timestamps_withdrawal_received_at = '2026-10-08T10:00:00Z', retain_until = '2032-12-31T23:00:00Z'
      WHERE id = ${o.id}`)
    const w = await payload.create({
      collection: 'withdrawals',
      data: {
        reference: 'WR-2026-00990',
        receivedAt: '2026-10-08T10:00:00.000Z',
        status: 'received',
        channel: 'online_form',
        locale: 'de',
        name: 'Lena Vier',
        email: EMAIL4,
        contractIdentification: o.orderNumber,
        matchStatus: 'manually_matched',
        order: o.id,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.create({
      collection: 'consent-log',
      data: {
        purpose: 'carrier_email_forwarding',
        granted: true,
        textSnapshot: 'Ich bin einverstanden, dass meine E-Mail-Adresse an DHL weitergegeben wird.',
        snippetKey: 'checkout.dhlEmailConsent',
        snippetVersion: 'draft-1',
        locale: 'de',
        email: EMAIL4,
        order: o.id,
      } as never,
      overrideAccess: true,
      context: { system: true },
    })
    const pr = await newRequest(['erasure'], EMAIL4)
    const plan = await buildErasurePlan(await req(), pr, { email: EMAIL4 }, NOW)
    const row = (c: string, id: number) => plan.find((p) => p.collection === c && p.id === id)!
    expect(row('orders', o.id)).toMatchObject({ state: 'running', suggested: 'none' })
    expect(row('withdrawals', w.id as number)).toMatchObject({
      state: 'running',
      suggested: 'none',
      actions: ['none', 'restrict', 'keep'],
    })

    clearMemoryOutbox()
    const r1 = await req()
    const res = await inTransaction(r1, () =>
      applyErasure(
        r1,
        pr.id,
        {
          decisions: plan.map((p) => ({ collection: p.collection, id: p.id, action: p.suggested })),
        },
        NOW,
      ),
    )
    await runEmailJobNow(payload, res.jobId, { now: NOW })
    const kept = (await payload.findByID({
      collection: 'orders',
      id: o.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    // nicht eingeschränkt (Erstattungsmail M09 muss noch raus), aber DHL bekommt die Adresse nicht mehr
    expect(kept.privacy?.processingRestricted ?? false).toBe(false)
    expect(kept.carrierEmailConsentRevokedAt).toBeTruthy()
    expect(kept.copyAddressText ?? '').not.toContain(EMAIL4)
    expect(res.carrierConsentWithdrawn).toBe(true)
    expect(res.followUps.map((f) => [f.collection, f.id])).toEqual([
      ['orders', o.id],
      ['withdrawals', w.id],
    ])
    const text = getMemoryOutbox().find((m) => m.type === 'privacy_erasure_response')?.text ?? ''
    expect(text).toContain('Bestellungen: brauche ich noch, um deine Bestellung abzuwickeln')
    expect(text).toContain('Widerrufe: brauche ich noch, um deine Bestellung abzuwickeln')
    expect(text).toContain('an DHL ist widerrufen')
    expect(text).not.toMatch(/eingeschränkt/i)

    const pending = async () =>
      followUpsOf(
        (await db().execute(sql`SELECT reminders_sent FROM privacy_requests WHERE id = ${pr.id}`))
          .rows[0]?.reminders_sent,
      ).map((f) => [f.collection, f.id])
    const restrictedLogs = async () =>
      (
        await db()
          .execute(sql`SELECT entity_collection, entity_id, trigger, rule_id FROM deletion_log
          WHERE privacy_request_ref = ${pr.reference} AND action = 'restricted' ORDER BY id`)
      ).rows.map((l) => [l.entity_collection, Number(l.entity_id), l.trigger, l.rule_id])

    // Nachlauf, solange Rücksendung und Erstattung laufen: nichts
    await runErasureFollowUps(payload, NOW)
    expect(await pending()).toEqual([
      ['orders', o.id],
      ['withdrawals', w.id],
    ])
    expect(await restrictedLogs()).toEqual([])

    // Erstattet; eine Mail zur Bestellung wartet noch → Bestellung bleibt offen, der Widerruf wird eingeschränkt
    await db().execute(sql`UPDATE orders SET status = 'refunded',
      timestamps_refunded_at = '2026-10-12T09:00:00Z', timestamps_final_status_at = '2026-10-12T09:00:00Z'
      WHERE id = ${o.id}`)
    await db().execute(
      sql`UPDATE withdrawals SET status = 'refunded', refunded_at = '2026-10-12T09:00:00Z' WHERE id = ${w.id}`,
    )
    const r2 = await createLocalReq({ context: { system: true } }, payload)
    const mail = await inTransaction(r2, () =>
      enqueueEmail(r2, {
        template: 'prepayment_reminder',
        to: EMAIL4,
        locale: 'de',
        data: { ...REMINDER_FIXTURE, orderId: o.id },
        idempotencyKey: `prepayment_reminder:${o.id}:nachlauf`,
        relations: { order: o.id },
      }),
    )
    expect(mail.status).toBe('queued')
    await runErasureFollowUps(payload, NOW)
    expect(await pending()).toEqual([['orders', o.id]])
    expect(await restrictedLogs()).toEqual([['withdrawals', w.id, 'privacy_request', 'DSGVO']])

    // Mail verschickt → Bestellung eingeschränkt (Löschprotokoll mit Anfragenummer), danach idempotent
    await runEmailJobNow(payload, mail.jobId, { now: NOW })
    expect(getMemoryOutbox().filter((m) => m.type === 'prepayment_reminder')).toHaveLength(1)
    await runErasureFollowUps(payload, NOW)
    expect(await pending()).toEqual([])
    const done = (await payload.findByID({
      collection: 'orders',
      id: o.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(done.privacy?.processingRestricted).toBe(true)
    expect(await restrictedLogs()).toEqual([
      ['withdrawals', w.id, 'privacy_request', 'DSGVO'],
      ['orders', o.id, 'privacy_request', 'DSGVO'],
    ])
    await runErasureFollowUps(payload, NOW)
    expect(await restrictedLogs()).toHaveLength(2)
  })

  it('R-151 eingeschränkte Bestellung erhält keine Mail mehr (Outbox suppressed)', async () => {
    const o = await order(2)
    await db().execute(
      sql`UPDATE orders SET privacy_processing_restricted = true WHERE id = ${o.id}`,
    )
    const r = await createLocalReq({ context: { system: true } }, payload)
    const res = await inTransaction(r, () =>
      enqueueEmail(r, {
        template: 'prepayment_reminder',
        to: EMAIL,
        locale: 'de',
        data: { ...REMINDER_FIXTURE, orderId: o.id },
        idempotencyKey: `prepayment_reminder:${o.id}:test`,
        relations: { order: o.id },
      }),
    )
    expect(res.status).toBe('suppressed')
    expect(res.jobId).toBeNull()
    const log = await payload.findByID({
      collection: 'email-log',
      id: res.emailLogId,
      overrideAccess: true,
    })
    expect(log.status).toBe('suppressed')
  })

  it('Prüfung P18.5 L-13 i Mail-Jobs der Person: in Auskunft und Suche; gescheiterte und verwaiste werden gelöscht, wartende zu aufbewahrten Vorgängen bleiben', async () => {
    const o = await order(3)
    const queue = async (key: string, relations?: { order: number }) => {
      const r = await createLocalReq({ context: { system: true } }, payload)
      return inTransaction(r, () =>
        enqueueEmail(r, {
          template: 'prepayment_reminder',
          to: EMAIL,
          locale: 'de',
          data: { ...REMINDER_FIXTURE, orderId: o.id, customerName: NAME },
          idempotencyKey: `prepayment_reminder:${o.id}:${key}`,
          ...(relations ? { relations } : {}),
        }),
      )
    }
    const loose = await queue('ohne-bezug')
    const failed = await queue('gescheitert', { order: o.id })
    const waiting = await queue('wartet', { order: o.id })
    const jobIds = [loose.jobId, failed.jobId, waiting.jobId].map(Number)
    // Absturz während des Versands: Payload markiert den Job als gescheitert und behält ihn samt Eingabe
    await db().execute(
      sql`UPDATE payload_jobs SET has_error = true, processing = false WHERE id = ${jobIds[1]!}`,
    )
    const stored = await db().execute(sql`SELECT input FROM payload_jobs WHERE id = ${jobIds[1]!}`)
    expect(JSON.stringify(stored.rows[0]!.input)).toContain(NAME)

    // Auskunft: die Jobs (mit ihrer Kopie der Mail-Daten) gehören zur Person
    const r0 = await req()
    expect((await searchPerson(r0, { email: EMAIL })).matches.mailJobs).toEqual(
      expect.arrayContaining(jobIds),
    )
    const pr = await newRequest(['access', 'erasure'])
    const r1 = await req()
    const built = await buildPrivacyExportZip(r1, pr, { email: EMAIL }, NOW)
    expect(built.data.counts.mailJobs).toBeGreaterThanOrEqual(3)
    const exported = built.data.data.mailJobs.find((j) => j.id === jobIds[1])!
    expect(JSON.stringify(exported.input)).toContain(NAME)
    expect(exported).not.toHaveProperty('log')
    expect(exported).not.toHaveProperty('error')

    // Löschung: Protokoll ohne Bezug gelöscht → Job verwaist; gescheiterter Job weg; wartende Mail bleibt
    const r2 = await req()
    const plan = await buildErasurePlan(r2, pr, { email: EMAIL }, NOW)
    expect(
      plan.find((p) => p.collection === 'email-log' && p.id === loose.emailLogId)?.suggested,
    ).toBe('delete')
    const r3 = await req()
    await inTransaction(r3, () =>
      applyErasure(
        r3,
        pr.id,
        {
          decisions: [
            { collection: 'orders', id: o.id, action: 'restrict' },
            { collection: 'email-log', id: loose.emailLogId, action: 'delete' },
          ],
          notify: false,
        },
        NOW,
      ),
    )
    const left = await db().execute(
      sql`SELECT id FROM payload_jobs WHERE id IN (${sql.raw(jobIds.join(','))})`,
    )
    expect(left.rows.map((r) => Number(r.id))).toEqual([jobIds[2]])
    for (const id of jobIds.slice(0, 2)) {
      expect(
        (await logs('payload-jobs', id)).map((l) => [l.action, l.rule_id, l.privacy_request_ref]),
      ).toEqual([['deleted', 'DSGVO', pr.reference]])
    }
    // die wartende Mail zur eingeschränkten Bestellung wird beim Lauf unterdrückt, danach ist auch ihr Job weg
    await runEmailJobNow(payload, jobIds[2]!, { now: NOW })
    expect(
      (await db().execute(sql`SELECT id FROM payload_jobs WHERE id = ${jobIds[2]!}`)).rows,
    ).toHaveLength(0)
  })
})

describe('DSGVO: Berichtigung und Einwilligungswiderruf (P6.18)', () => {
  it('R-152 Berichtigung vor der Rechnung ändert direkt; nach der Rechnung entstehen GS und neue RE', async () => {
    const pre = await order(3, { status: 'awaiting_prepayment', paymentMethod: 'prepayment' })
    const paid = await order(4)
    const oldInvoice = await invoiceFor(paid)
    await db().execute(
      sql`UPDATE orders SET status = 'shipped', timestamps_shipped_at = '2026-09-03T10:00:00Z' WHERE id = ${paid.id}`,
    )
    const pr = await newRequest(['rectification'])

    // vor der Rechnung: direkt, mit Vermerk im Verlauf, kein Beleg
    const r1 = await req()
    const a = await inTransaction(r1, () =>
      rectifyOrder(r1, pr.id, { orderId: pre.id, customerName: 'Lena Löschmann' }, NOW),
    )
    expect(a.reissued).toBe(false)
    expect(a.order.customer.name).toBe('Lena Löschmann')
    const note = a.order.statusHistory?.at(-1)
    expect(note).toMatchObject({ from: 'awaiting_prepayment', to: 'awaiting_prepayment' })
    expect(note?.note).toContain(pr.reference)
    expect(
      (await db().execute(sql`SELECT id FROM invoices WHERE order_id = ${pre.id}`)).rows,
    ).toHaveLength(0)

    // nach der Rechnung (und dem Versand): Gutschrift über den vollen Betrag + neue Rechnung
    const r2 = await req()
    const b = await inTransaction(r2, () =>
      rectifyOrder(
        r2,
        pr.id,
        {
          orderId: paid.id,
          customerName: 'Lena Löschmann',
          shippingAddress: { name: 'Lena Löschmann', addressLine1: 'Neuer Weg 2' },
        },
        NOW,
      ),
    )
    expect(b.reissued).toBe(true)
    for (const job of b.jobs) await payload.jobs.runByID({ id: job })
    const docs = (
      await payload.find({
        collection: 'invoices',
        where: { order: { equals: paid.id } },
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      })
    ).docs as Invoice[]
    expect(docs.map((d) => d.type)).toEqual(['invoice', 'credit_note', 'invoice'])
    const [first, credit, second] = docs as [Invoice, Invoice, Invoice]
    expect(first.id).toBe(oldInvoice.id)
    expect(first.data).toEqual(oldInvoice.data)
    expect(first.sha256).toBe(oldInvoice.sha256)
    expect(credit.reason).toBe('correction')
    expect(credit.totalGrossCents).toBe(first.totalGrossCents)
    expect(credit.number).toMatch(/^GS-\d{4}-\d{5}$/)
    expect(second.number).toMatch(/^RE-\d{4}-\d{5}$/)
    expect(second.replacesInvoice).toBe(first.id)
    expect(second.totalGrossCents).toBe(first.totalGrossCents)
    expect((second.data as { buyer: { name: string; addressLine1: string } }).buyer).toMatchObject({
      name: 'Lena Löschmann',
      addressLine1: 'Neuer Weg 2',
    })
    expect((second.data as { relatedInvoiceNumber: string }).relatedInvoiceNumber).toBe(
      first.number,
    )
    expect(second.status).toBe('issued')
    const o = (await payload.findByID({
      collection: 'orders',
      id: paid.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(o.invoice).toBe(second.id)
    expect(o.status).toBe('shipped')
    expect(o.statusHistory?.at(-1)?.note).toContain('Gutschrift und neue Rechnung')
  })

  it('R-152 DHL-Widerruf entfernt die E-Mail aus „Adresse kopieren“ und bestätigt mit M16', async () => {
    const o = await order(2, { carrierEmailConsent: true })
    const before = (await payload.findByID({
      collection: 'orders',
      id: o.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(before.copyAddressText ?? '').toContain(EMAIL)
    clearMemoryOutbox()
    const r = await req()
    const res = await inTransaction(r, () =>
      withdrawCarrierConsent(r, o, NOW, { confirmationMail: true }),
    )
    await runEmailJobNow(payload, res.mailJobId, { now: NOW })
    const after = (await payload.findByID({
      collection: 'orders',
      id: o.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(after.copyAddressText ?? '').not.toContain(EMAIL)
    const m16 = getMemoryOutbox().filter((m) => m.type === 'consent_withdrawal_confirmation')
    expect(m16).toHaveLength(1)
    expect(m16[0]!.to).toEqual([EMAIL])
    expect(m16[0]!.text).toContain('an DHL weitergebe')
    expect(m16[0]!.text).toContain(String(o.orderNumber))
  })
})
