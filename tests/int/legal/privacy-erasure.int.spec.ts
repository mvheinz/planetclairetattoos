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
import { applyErasure, buildErasurePlan } from '@/lib/privacy/erasure'
import { searchForRequest } from '@/lib/privacy/export'
import { rectifyOrder } from '@/lib/privacy/rectify'
import { createPrivacyRequest, savePrivacyRequest } from '@/lib/privacy/requests'
import { ANONYMIZED_EMAIL } from '@/lib/retention/jobs'
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
// alte Bestellung (Frist abgelaufen) wird gelöscht (Stufe D), neue eingeschränkt (Notizen und Packfotos weg, DHL-
// Einwilligung widerrufen, keine Mails mehr), Rechnungen unverändert, `deletion-log` mit `trigger = privacy_request`;
// Berichtigung vor der Rechnung direkt, danach Gutschrift + neue Rechnung; DHL-Widerruf entfernt die E-Mail aus
// „Adresse kopieren“ und bestätigt mit M16.

const NUMBERS = [990, 991, 992, 993, 994]
const EMAIL = 'lena.loesch@planetclaire.local'
const NAME = 'Lena Loesch'
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

async function newRequest(types: string[]): Promise<PrivacyRequest> {
  const r = await req()
  const pr = await inTransaction(r, () =>
    createPrivacyRequest(r, { types, receivedAt: '2026-10-12', contactEmail: EMAIL }, NOW),
  )
  const r2 = await req()
  await inTransaction(r2, () =>
    savePrivacyRequest(r2, pr.id, { identityVerified: true, identityMethod: 'stored_email' }, NOW),
  )
  const r3 = await req()
  return (await inTransaction(r3, () => searchForRequest(r3, pr.id, { email: EMAIL }, NOW))).request
}

async function logs(collection: string, id: number) {
  const res = await db().execute(sql`SELECT * FROM deletion_log
    WHERE entity_collection = ${collection} AND entity_id = ${String(id)} ORDER BY id`)
  return res.rows
}

async function cleanup() {
  await db().execute(sql`DELETE FROM email_log WHERE lower("to") = ${EMAIL}
    OR template IN ('privacy_erasure_response', 'consent_withdrawal_confirmation')`)
  await db().execute(sql`DELETE FROM consent_log WHERE lower(email) = ${EMAIL}`)
  await db().execute(sql`DELETE FROM privacy_requests WHERE contact_email = ${EMAIL}`)
  await db().execute(sql`DELETE FROM inquiries WHERE email = ${EMAIL}`)
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
    const oldOrder = await order(0)
    const oldInvoice = await invoiceFor(oldOrder)
    await db().execute(sql`UPDATE orders SET status = 'delivered',
      timestamps_final_status_at = '2019-06-01T10:00:00Z', retain_until = '2026-01-01T00:00:00Z'
      WHERE id = ${oldOrder.id}`)
    const fresh = await order(1, {
      notes: 'Bitte Geschenkpapier – Nachbarin Frau Dritte nimmt an',
      carrierEmailConsent: true,
    })
    const freshInvoice = await invoiceFor(fresh)
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
    expect(row('orders', fresh.id).until).toBeTruthy()
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
    expect(o2.customer.email).toBe(EMAIL)
    expect(o2.carrierEmailConsentRevokedAt).toBeTruthy()
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
    expect(m15[0]!.text).toContain('Bestellungen: eingeschränkt bis')
    expect(m15[0]!.text).toContain('Anfragen zu Auftragsarbeiten: gelöscht')
    expect(m15[0]!.text).toContain('Rechnungen und Gutschriften: unverändert')
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
