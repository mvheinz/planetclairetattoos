import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { runTaskNow } from '@/lib/jobs/runTask'
import { ANONYMIZED_EMAIL, runRetentionTask, type RetentionTaskSlug } from '@/lib/retention/jobs'
import { runRetentionSteps, type RetentionStep } from '@/lib/retention/runner'
import {
  L_02_RESERVATIONS,
  L_03_CHECKOUTS,
  L_10_INQUIRIES,
  L_13D_WEBHOOK_EVENTS,
  L_04_CANCELLED_PREPAYMENT_STAGE_1,
  L_05_ORDERS_STAGE_B,
  L_05_ORDERS_STAGE_C,
  retainUntil,
} from '@/lib/retention/policy'
import { readStoredFile } from '@/lib/storage/read'
import { runLegalHoldReview } from '@/lib/retention/jobs'
import type { Invoice, Order } from '@/payload-types'

import { checkoutData, createOrder, dbOf, deleteCommerce, orderData } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  createTestImage,
  deleteProducts,
} from '../helpers/products'

// P6.14 – Löschjobs Teil 1 (LOESCHKONZEPT §2–§4, DATENMODELL §11/§12, R-154, R-123): je Regel „Tag vorher vorhanden,
// Tag danach gelöscht bzw. anonymisiert“, Speicherobjekte weg, keine Versions-Tabellen, `deletion-log` ohne Inhalte,
// Legal Hold wird übersprungen; Belege vor Fristende unlöschbar.

const NUMBERS = [985, 986, 987]
const DAY = 86_400_000
const PHOTO = path.resolve('tests/fixtures/images/landscape-small.jpg')
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
let payload: Payload
let restoreBusiness: () => Promise<void>
let item: { id: number; itemNumber: number }
let orderNo = 700

const iso = (d: Date) => d.toISOString()
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms)
const run = (task: RetentionTaskSlug, now: Date) => runRetentionTask(payload, task, { now })

async function logsFor(collection: string, id: number) {
  const res = await payload.find({
    collection: 'deletion-log',
    where: {
      and: [{ entityCollection: { equals: collection } }, { entityId: { equals: String(id) } }],
    },
    overrideAccess: true,
    limit: 20,
  })
  return res.docs
}

async function orderRow(id: number) {
  const res = await dbOf(payload).execute(sql`SELECT * FROM orders WHERE id = ${id}`)
  return res.rows[0] ?? null
}

/** Bestellung mit gesetzten Zeitstempeln (Seed-Kontext umgeht die Statusautomatik; `seed` bleibt false). */
async function order(overrides: Record<string, unknown>): Promise<Order> {
  return (await createOrder(
    payload,
    orderData(++orderNo, [item], {
      customer: { name: 'Erika Beispiel', email: 'erika@planetclaire.local' },
      statusTokenHash: createHash('sha256').update(`token-${orderNo}`).digest('hex'),
      statusTokenSealed: 'versiegelt',
      carrierEmailConsent: true,
      ...overrides,
    }),
    { seed: true },
  )) as Order
}

async function photo(orderId: number, purpose: 'packing_photo' | 'return_photo' = 'packing_photo') {
  const data = await readFile(PHOTO)
  const doc = await payload.create({
    collection: 'private-uploads',
    data: { purpose, relatedOrder: orderId } as never,
    file: {
      data,
      name: `foto-${orderId}-${purpose}.jpg`,
      mimetype: 'image/jpeg',
      size: data.length,
    },
    overrideAccess: true,
  })
  return doc
}

const fileExists = async (doc: { filename?: string | null; prefix?: string | null }) =>
  (await readStoredFile('private', doc.filename ?? '', doc.prefix)) !== null

const exists = async (table: string, id: number) =>
  (await dbOf(payload).execute(sql.raw(`SELECT 1 FROM "${table}" WHERE id = ${Number(id)}`))).rows
    .length > 0

beforeAll(async () => {
  payload = await getTestPayload()
  const db = dbOf(payload)
  await db.execute(sql`DELETE FROM email_log`)
  await db.execute(sql`DELETE FROM consent_log`)
  await db.execute(sql`DELETE FROM retention_failures`)
  await db.execute(
    sql`DELETE FROM private_uploads WHERE purpose IN ('packing_photo', 'return_photo', 'monthly_export')`,
  )
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 985, fx))
  item = { id: p.id as number, itemNumber: 985 }
})

afterAll(async () => {
  const db = dbOf(payload)
  await db.execute(sql`DELETE FROM email_log`)
  await db.execute(sql`DELETE FROM consent_log`)
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await restoreBusiness()
})

describe('Löschjobs Teil 1 (R-154)', () => {
  it('R-154 L-03 Kassen: 30 Tage nach Anlage gelöscht, orders.checkout geleert', async () => {
    const created = new Date('2026-09-01T10:00:00.000Z')
    const { data } = checkoutData([item])
    const checkout = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    await dbOf(payload).execute(
      sql`UPDATE checkouts SET created_at = ${iso(created)}::timestamptz WHERE id = ${checkout.id}`,
    )
    const o = await order({ status: 'paid', checkout: checkout.id })
    const due = retainUntil(L_03_CHECKOUTS, created)
    expect((await run('retentionAbandonedCheckouts', plus(due, -DAY))).processed).toBe(0)
    expect(await exists('checkouts', checkout.id as number)).toBe(true)
    const res = await run('retentionAbandonedCheckouts', plus(due, DAY))
    expect(res.processed).toBe(1)
    expect(await exists('checkouts', checkout.id as number)).toBe(false)
    expect((await orderRow(o.id))?.checkout_id).toBeNull()
    const logs = await logsFor('checkouts', checkout.id as number)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      ruleId: 'L-03',
      action: 'deleted',
      trigger: 'job',
      taskSlug: 'retentionAbandonedCheckouts',
    })
    // idempotent
    expect((await run('retentionAbandonedCheckouts', plus(due, 2 * DAY))).processed).toBe(0)
  })

  it('R-154 L-04 Stufe 1: stornierte Vorkasse nach 30 Tagen ohne Adressen und DHL-Einwilligung; Legal Hold bleibt', async () => {
    const cancelledAt = new Date('2026-10-05T09:00:00.000Z')
    const base = {
      status: 'cancelled',
      cancelReason: 'payment_timeout',
      paymentMethod: 'prepayment',
      paymentProvider: 'bank_transfer',
      timestamps: { placedAt: '2026-09-28T09:00:00.000Z', cancelledAt: iso(cancelledAt) },
    }
    const o = await order(base)
    const held = await order({
      ...base,
      privacy: {
        legalHold: true,
        legalHoldReason: 'Streit um Zahlung',
        legalHoldSince: iso(cancelledAt),
      },
    })
    const due = retainUntil(L_04_CANCELLED_PREPAYMENT_STAGE_1, cancelledAt)
    await run('retentionOrderMinimize', plus(due, -DAY))
    expect((await orderRow(o.id))?.shipping_address_name).toBe('Erika Beispiel')
    await run('retentionOrderMinimize', plus(due, DAY))
    const row = await orderRow(o.id)
    expect(row).toMatchObject({
      shipping_address_name: null,
      shipping_address_address_line1: null,
      shipping_address_city: null,
      carrier_email_consent: false,
    })
    expect(row?.order_number).toBe(o.orderNumber)
    expect((await logsFor('orders', o.id)).map((l) => l.ruleId)).toEqual(['L-04 Stufe 1'])
    expect((await orderRow(held.id))?.shipping_address_name).toBe('Erika Beispiel')
    expect(await logsFor('orders', held.id)).toHaveLength(0)
  })

  it('R-154 L-05 Stufe B: Status-Token (Hash und Siegel) 180 Tage nach finalStatusAt entfernt', async () => {
    const final = new Date('2026-04-02T10:00:00.000Z')
    const o = await order({
      status: 'delivered',
      timestamps: { placedAt: '2026-03-20T10:00:00.000Z', finalStatusAt: iso(final) },
    })
    const due = retainUntil(L_05_ORDERS_STAGE_B, final)
    await run('retentionOrderMinimize', plus(due, -DAY))
    expect((await orderRow(o.id))?.status_token_hash).toMatch(/^[0-9a-f]{64}$/)
    await run('retentionOrderMinimize', plus(due, DAY))
    expect(await orderRow(o.id)).toMatchObject({
      status_token_hash: null,
      status_token_sealed: null,
    })
    expect((await logsFor('orders', o.id)).map((l) => l.ruleId)).toContain('L-05 Stufe B')
  })

  it('R-154 L-05 Stufe C: Pack- und Rückgabefotos 12 Monate nach Versand bzw. Rückgabe gelöscht (Datei weg); Legal Hold bleibt', async () => {
    const shipped = new Date('2025-08-10T10:00:00.000Z')
    const returned = new Date('2025-09-01T10:00:00.000Z')
    const ts = {
      placedAt: '2025-08-01T10:00:00.000Z',
      shippedAt: iso(shipped),
      returnReceivedAt: iso(returned),
    }
    const o = await order({ status: 'return_received', timestamps: ts })
    const held = await order({
      status: 'return_received',
      timestamps: ts,
      privacy: {
        legalHold: true,
        legalHoldReason: 'Transportschaden',
        legalHoldSince: iso(shipped),
      },
    })
    const pack = await photo(o.id)
    const back = await photo(o.id, 'return_photo')
    const heldPack = await photo(held.id)
    expect(await fileExists(pack)).toBe(true)
    const duePack = retainUntil(L_05_ORDERS_STAGE_C, shipped)
    const dueBack = retainUntil(L_05_ORDERS_STAGE_C, returned)
    await run('retentionOrderMinimize', plus(duePack, -DAY))
    expect(await exists('private_uploads', pack.id as number)).toBe(true)
    await run('retentionOrderMinimize', plus(duePack, DAY))
    expect(await exists('private_uploads', pack.id as number)).toBe(false)
    expect(await fileExists(pack)).toBe(false)
    expect(await exists('private_uploads', back.id as number)).toBe(true)
    await run('retentionOrderMinimize', plus(dueBack, DAY))
    expect(await exists('private_uploads', back.id as number)).toBe(false)
    const logs = await logsFor('private-uploads', pack.id as number)
    expect(logs[0]).toMatchObject({ ruleId: 'L-05 Stufe C', storageObjectsCount: 1 })
    expect(await exists('private_uploads', heldPack.id as number)).toBe(true)
    expect(await fileExists(heldPack)).toBe(true)
  })

  it('R-154 L-05 Stufe D: Bestellung anonymisiert, Fotos, Mail- und Einwilligungsnachweise gelöscht; Legal Hold bleibt', async () => {
    const until = new Date('2032-12-31T23:00:00.000Z')
    const ts = { placedAt: '2026-05-01T10:00:00.000Z', finalStatusAt: '2026-05-20T10:00:00.000Z' }
    const o = await order({
      status: 'delivered',
      timestamps: ts,
      retainUntil: iso(until),
      notes: 'Kundin wünscht Geschenkverpackung',
      statusHistory: [
        {
          from: null,
          to: 'paid',
          at: ts.placedAt,
          actorType: 'system',
          transition: 'O1',
          note: 'Erika rief an',
        },
      ],
    })
    const held = await order({
      status: 'delivered',
      timestamps: ts,
      retainUntil: iso(until),
      privacy: {
        legalHold: true,
        legalHoldReason: 'Gerichtsverfahren',
        legalHoldSince: ts.placedAt,
      },
    })
    const pack = await photo(o.id)
    await dbOf(payload).execute(sql`
      INSERT INTO email_log (template, "to", locale, subject, status, attempts, retain_until, order_id, seed, updated_at, created_at)
      VALUES ('order_shipped', 'erika@planetclaire.local', 'de', 'Dein Paket', 'sent', 1, ${iso(until)}::timestamptz,
              ${o.id}, false, now(), now())`)
    await dbOf(payload).execute(sql`
      INSERT INTO consent_log (purpose, granted, text_snapshot, text_sha256, locale, email, retain_until, order_id, seed, updated_at, created_at)
      VALUES ('carrier_email_forwarding', true, 'Text', ${'b'.repeat(64)}, 'de', 'erika@planetclaire.local',
              ${iso(until)}::timestamptz, ${o.id}, false, now(), now())`)

    await run('retentionOrders', plus(until, -DAY))
    expect((await orderRow(o.id))?.customer_name).toBe('Erika Beispiel')
    const res = await run('retentionOrders', plus(until, DAY))
    expect(res.processed).toBe(1)
    const row = await orderRow(o.id)
    expect(row).toMatchObject({
      customer_name: null,
      customer_email: ANONYMIZED_EMAIL,
      shipping_address_name: null,
      shipping_address_address_line1: null,
      notes: null,
      carrier_email_consent: false,
      status_token_hash: null,
      order_number: o.orderNumber,
      status: 'delivered',
    })
    expect(row?.privacy_anonymized_at).not.toBeNull()
    expect(Number(row?.total_cents)).toBe(o.totalCents)
    const history = await dbOf(payload).execute(
      sql`SELECT note FROM orders_status_history WHERE _parent_id = ${o.id}`,
    )
    expect(history.rows.every((h) => h.note === null)).toBe(true)
    const items = await dbOf(payload).execute(
      sql`SELECT item_number, price_cents FROM orders_items WHERE _parent_id = ${o.id}`,
    )
    expect(items.rows).toHaveLength(1)
    expect(await exists('private_uploads', pack.id as number)).toBe(false)
    expect(
      (await dbOf(payload).execute(sql`SELECT 1 FROM email_log WHERE order_id = ${o.id}`)).rows,
    ).toHaveLength(0)
    expect(
      (await dbOf(payload).execute(sql`SELECT 1 FROM consent_log WHERE order_id = ${o.id}`)).rows,
    ).toHaveLength(0)
    expect((await logsFor('orders', o.id)).map((l) => l.ruleId)).toContain('L-05 Stufe D')
    expect((await orderRow(held.id))?.customer_name).toBe('Erika Beispiel')
    // idempotent
    expect((await run('retentionOrders', plus(until, 2 * DAY))).processed).toBe(0)
  })

  it('DM-CMP-02 Stufe D: Reklamationen der Bestellung und deren Fotos gelöscht, je Datensatz ein deletion-log-Eintrag', async () => {
    const until = new Date('2032-12-31T23:00:00.000Z')
    const ts = {
      placedAt: '2026-05-01T10:00:00.000Z',
      paidAt: '2026-05-01T10:05:00.000Z',
      deliveredAt: '2026-05-10T10:00:00.000Z',
      finalStatusAt: '2026-05-20T10:00:00.000Z',
    }
    const o = await order({ status: 'delivered', timestamps: ts, retainUntil: iso(until) })
    const complaint = await payload.create({
      collection: 'complaints',
      data: {
        order: o.id,
        kind: 'defect',
        receivedAt: '2026-05-12T09:00:00.000Z',
        description: 'Haarriss in der Glasur',
      } as never,
      overrideAccess: true,
      context: { now: '2026-05-12T10:00:00.000Z' },
    })
    const data = await readFile(PHOTO)
    const cp = await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'complaint_photo', relatedComplaint: complaint.id } as never,
      file: {
        data,
        name: `reklamation-${complaint.id}.jpg`,
        mimetype: 'image/jpeg',
        size: data.length,
      },
      overrideAccess: true,
    })
    await run('retentionOrders', plus(until, DAY))
    expect(await exists('complaints', complaint.id)).toBe(false)
    expect(await exists('private_uploads', cp.id as number)).toBe(false)
    expect((await logsFor('complaints', complaint.id)).map((l) => l.ruleId)).toContain('L-09')
    expect((await logsFor('orders', o.id)).map((l) => l.ruleId)).toContain('L-05 Stufe D')
  })

  it('R-154 DM-PRIV-03 L-06 Beleg nach Fristende: PDF gelöscht, Registerzeile anonymisiert (pc.now); L-07 Monatsexport gelöscht', async () => {
    const issuedAt = new Date('2026-10-14T09:30:00.000Z')
    const o = (await createOrder(payload, orderData(++orderNo, [item]))) as Order
    const req = await createLocalReq({}, payload)
    const { invoice, jobId } = await createInvoiceForOrder(req, o, {
      paidAt: issuedAt,
      now: issuedAt,
    })
    await runInvoicePdfJob(payload, jobId, { now: issuedAt })
    const inv = (await payload.findByID({
      collection: 'invoices',
      id: invoice.id,
      depth: 0,
      overrideAccess: true,
    })) as Invoice
    const until = new Date(inv.retainUntil as string)
    expect(iso(until)).toBe('2036-12-31T23:00:00.000Z')
    const pdf = await payload.findByID({
      collection: 'private-uploads',
      id: inv.pdf as number,
      overrideAccess: true,
    })
    expect(await fileExists(pdf)).toBe(true)

    await run('retentionInvoices', plus(until, -DAY))
    expect(
      (await payload.findByID({ collection: 'invoices', id: inv.id, overrideAccess: true }))
        .anonymizedAt ?? null,
    ).toBeNull()
    await run('retentionInvoices', plus(until, DAY))
    const after = (await payload.findByID({
      collection: 'invoices',
      id: inv.id,
      depth: 0,
      overrideAccess: true,
    })) as Invoice
    expect(after.anonymizedAt).toBe(iso(plus(until, DAY)))
    expect(after.pdf ?? null).toBeNull()
    expect(after.number).toBe(inv.number)
    expect(after.totalGrossCents).toBe(inv.totalGrossCents)
    const buyer = (after.data as { buyer: Record<string, unknown> }).buyer
    expect(buyer).toMatchObject({ name: null, email: null, addressLine1: null, city: null })
    expect(await exists('private_uploads', pdf.id as number)).toBe(false)
    expect(await fileExists(pdf)).toBe(false)
    expect((await logsFor('invoices', inv.id)).map((l) => l.ruleId)).toEqual(['L-06'])

    // L-07 Monatsexport (10 Jahre ab Ende des Exportjahres)
    const exp = await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'monthly_export' } as never,
      file: {
        data: PDF,
        name: 'export-2026-10.pdf',
        mimetype: 'application/pdf',
        size: PDF.length,
      },
      overrideAccess: true,
      context: { now: '2026-11-01T03:00:00.000Z' },
    })
    const expUntil = new Date(exp.retainUntil as string)
    await run('retentionInvoices', plus(expUntil, -DAY))
    expect(await exists('private_uploads', exp.id as number)).toBe(true)
    await run('retentionInvoices', plus(expUntil, DAY))
    expect(await exists('private_uploads', exp.id as number)).toBe(false)
    expect((await logsFor('private-uploads', exp.id as number))[0]?.ruleId).toBe('L-07')
  })

  it('R-123 Löschversuch an einem Beleg vor Fristende scheitert (Local API, SQL, Anonymisieren ohne bzw. mit zu frühem pc.now)', async () => {
    const issuedAt = new Date('2026-10-14T09:30:00.000Z')
    const o = (await createOrder(payload, orderData(++orderNo, [item]))) as Order
    const req = await createLocalReq({}, payload)
    const { invoice, jobId } = await createInvoiceForOrder(req, o, {
      paidAt: issuedAt,
      now: issuedAt,
    })
    await runInvoicePdfJob(payload, jobId, { now: issuedAt })
    await expect(
      payload.delete({ collection: 'invoices', id: invoice.id, overrideAccess: true }),
    ).rejects.toThrow()
    const db = dbOf(payload)
    await expect(db.execute(sql`DELETE FROM invoices WHERE id = ${invoice.id}`)).rejects.toThrow()
    await expect(
      db.execute(
        sql`UPDATE invoices SET anonymized_at = now(), pdf_id = NULL WHERE id = ${invoice.id}`,
      ),
    ).rejects.toThrow()
    await expect(
      db.execute(
        sql.raw(`DO $$ BEGIN
        PERFORM set_config('pc.now', '2036-12-30T00:00:00Z', true);
        UPDATE invoices SET anonymized_at = '2036-12-30T00:00:00Z', pdf_id = NULL WHERE id = ${Number(invoice.id)};
      END $$`),
      ),
    ).rejects.toThrow()
    // der Job selbst rührt den Beleg vor Fristende nicht an
    expect((await run('retentionInvoices', new Date('2036-12-30T00:00:00.000Z'))).processed).toBe(0)
    expect(await exists('invoices', invoice.id as number)).toBe(true)
  })

  it('R-154 L-08 Widerrufe: nach retainUntil samt Eingangsbestätigung gelöscht; Legal Hold bleibt', async () => {
    const fixture = (reference: string, extra: Record<string, unknown> = {}) =>
      payload.create({
        collection: 'withdrawals',
        data: {
          reference,
          channel: 'online_form',
          locale: 'de',
          receivedAt: '2026-06-01T10:00:00.000Z',
          name: 'Rudi Beispiel',
          contractIdentification: 'Tasse vom Flohmarkt',
          email: 'rudi@planetclaire.local',
          matchStatus: 'needs_manual_match',
          status: 'received',
          refundDueAt: '2026-06-15T10:00:00.000Z',
          submissionSnapshot: { name: 'Rudi Beispiel' },
          ...extra,
        } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    const w = await fixture('WR-2026-00701')
    const held = await fixture('WR-2026-00702', {
      privacy: {
        legalHold: true,
        legalHoldReason: 'Streit um Erstattung',
        legalHoldSince: '2026-06-02T10:00:00.000Z',
      },
    })
    const until = new Date(w.retainUntil as string)
    expect(iso(until)).toBe('2032-12-31T23:00:00.000Z')
    await dbOf(payload).execute(sql`
      INSERT INTO email_log (template, "to", locale, subject, status, attempts, retain_until, withdrawal_id, seed, updated_at, created_at)
      VALUES ('withdrawal_receipt', 'rudi@planetclaire.local', 'de', 'Eingang', 'sent', 1, ${iso(until)}::timestamptz,
              ${w.id}, false, now(), now())`)
    await run('retentionWithdrawals', plus(until, -DAY))
    expect(await exists('withdrawals', w.id as number)).toBe(true)
    await run('retentionWithdrawals', plus(until, DAY))
    expect(await exists('withdrawals', w.id as number)).toBe(false)
    expect(
      (await dbOf(payload).execute(sql`SELECT 1 FROM email_log WHERE withdrawal_id = ${w.id}`))
        .rows,
    ).toHaveLength(0)
    expect((await logsFor('withdrawals', w.id as number))[0]).toMatchObject({ ruleId: 'L-08' })
    expect(await exists('withdrawals', held.id as number)).toBe(true)
  })

  it('R-154 DM-DEL-01 deletion-log ohne Inhalte, keine Versions-Tabellen der betroffenen Collections; Task über die Jobs-Queue', async () => {
    const all = await payload.find({ collection: 'deletion-log', overrideAccess: true, limit: 500 })
    expect(all.docs.length).toBeGreaterThan(5)
    const text = JSON.stringify(all.docs)
    for (const pattern of [/@/, /Erika/, /Rudi/, /Beispiel/, /DE\d{20}/, /Musterstraße/]) {
      expect(text).not.toMatch(pattern)
    }
    const versions = await dbOf(payload).execute(sql`
      SELECT table_name FROM information_schema.tables
       WHERE table_name IN ('_orders_v', '_checkouts_v', '_invoices_v', '_withdrawals_v', '_complaints_v',
                            '_private_uploads_v', '_email_log_v', '_consent_log_v')`)
    expect(versions.rows).toEqual([])
    // registrierter Task: läuft einmal je Berliner Tag ab 03:05
    const early = await runTaskNow(payload, 'retentionAbandonedCheckouts', {
      now: new Date('2027-03-01T01:00:00.000Z'), // 02:00 Berlin
    })
    expect(early.ran).toBe(1)
    const runs = await dbOf(payload).execute(sql`
      SELECT status FROM job_runs WHERE task = 'retentionAbandonedCheckouts' ORDER BY id DESC LIMIT 1`)
    expect(runs.rows[0]?.status).toBe('skipped')
    await runTaskNow(payload, 'retentionAbandonedCheckouts', {
      now: new Date('2027-03-01T02:10:00.000Z'), // 03:10 Berlin
    })
    const after = await dbOf(payload).execute(sql`
      SELECT status FROM job_runs WHERE task = 'retentionAbandonedCheckouts' ORDER BY id DESC LIMIT 1`)
    expect(after.rows[0]?.status).toBe('ok')
  })

  it('R-154 Runner: Fehlschlag lässt den Datensatz stehen, nach 3 Fehlschlägen A12; Trockenlauf ändert nichts', async () => {
    const failing: RetentionStep = {
      ruleId: 'L-03',
      collection: 'checkouts',
      action: 'deleted',
      candidates: async () => [{ id: 424242, dueAt: new Date('2026-01-01T00:00:00.000Z') }],
      apply: async () => {
        throw new Error('Speicher nicht erreichbar')
      },
    }
    const alerts = async () =>
      (
        await dbOf(payload).execute(
          sql`SELECT 1 FROM email_log WHERE idempotency_key LIKE 'admin_alert:retention_failed.test_task@%'`,
        )
      ).rows.length
    for (let i = 0; i < 2; i++) {
      const r = await runRetentionSteps(payload, 'testTask', [failing], {
        now: new Date(Date.UTC(2027, 0, 10 + i, 3)),
      })
      expect(r.failed).toBe(1)
    }
    expect(await alerts()).toBe(0)
    await runRetentionSteps(payload, 'testTask', [failing], {
      now: new Date('2027-01-12T03:00:00.000Z'),
    })
    expect(await alerts()).toBe(1)
    await runRetentionSteps(payload, 'testTask', [failing], {
      now: new Date('2027-01-13T03:00:00.000Z'),
    })
    expect(await alerts()).toBe(1)
    const dry = await runRetentionSteps(payload, 'testTask', [failing], {
      now: new Date('2027-01-13T03:00:00.000Z'),
      dryRun: true,
      horizonMs: 30 * DAY,
    })
    expect(dry.steps[0]).toMatchObject({ count: 1, ids: [424242], failed: 0 })
    expect(await logsFor('checkouts', 424242)).toHaveLength(0)
  })
})

describe('Löschjobs Teil 2 (R-154, R-134)', () => {
  it('R-154 L-10 Anfrage: 6 Monate nach Eingang gelöscht – auch bei frischer Aktivität – samt Referenzbild', async () => {
    const created = new Date('2026-03-31T08:00:00.000Z')
    const png = await readFile(PHOTO)
    const image = await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'commission_reference' } as never,
      file: { data: png, name: 'idee.jpg', mimetype: 'image/jpeg', size: png.length },
      overrideAccess: true,
    })
    const q = await payload.create({
      collection: 'inquiries',
      data: {
        reference: 'AA-2026-0981',
        name: 'Erika Beispiel',
        email: 'erika@planetclaire.local',
        idea: 'Eine Tasse mit meinem Hund im Planet-Claire-Stil, gern in Blau.',
        objectType: 'tasse',
        locale: 'de',
        referenceImages: [image.id],
        createdAt: iso(created),
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const due = retainUntil(L_10_INQUIRIES, created)
    // frische Aktivität kurz vor Fristende ändert nichts
    await dbOf(payload).execute(
      sql`UPDATE inquiries SET created_at = ${iso(created)}::timestamptz,
                               last_activity_at = ${iso(plus(due, -2 * DAY))}::timestamptz WHERE id = ${q.id}`,
    )
    await run('retentionCommissionInquiries', plus(due, -DAY))
    expect(await exists('inquiries', q.id as number)).toBe(true)
    await run('retentionCommissionInquiries', plus(due, DAY))
    expect(await exists('inquiries', q.id as number)).toBe(false)
    expect(await exists('private_uploads', image.id as number)).toBe(false)
    expect(await fileExists(image)).toBe(false)
    expect((await logsFor('inquiries', q.id as number))[0]).toMatchObject({
      ruleId: 'L-10',
      storageObjectsCount: 1,
    })
  })

  it('R-154 L-12 Mail-Protokoll nach retainUntil gelöscht; L-19 a Einwilligungsnachweis ebenso', async () => {
    const until = new Date('2027-01-05T10:00:00.000Z')
    const mail = await dbOf(payload).execute(sql`
      INSERT INTO email_log (template, "to", locale, subject, status, attempts, retain_until, seed, updated_at, created_at)
      VALUES ('admin_alert', 'jutta@planetclaire.local', 'de', 'Test', 'sent', 1, ${iso(until)}::timestamptz, false,
              now(), now()) RETURNING id`)
    const consent = await dbOf(payload).execute(sql`
      INSERT INTO consent_log (purpose, granted, text_snapshot, text_sha256, locale, email, retain_until, seed, updated_at, created_at)
      VALUES ('carrier_email_forwarding', true, 'Text', ${'c'.repeat(64)}, 'de', 'erika@planetclaire.local',
              ${iso(until)}::timestamptz, false, now(), now()) RETURNING id`)
    const mailId = Number(mail.rows[0]!.id)
    const consentId = Number(consent.rows[0]!.id)
    await run('retentionEmailLog', plus(until, -DAY))
    await run('retentionConsentEvidence', plus(until, -DAY))
    expect(await exists('email_log', mailId)).toBe(true)
    expect(await exists('consent_log', consentId)).toBe(true)
    await run('retentionEmailLog', plus(until, DAY))
    await run('retentionConsentEvidence', plus(until, DAY))
    expect(await exists('email_log', mailId)).toBe(false)
    expect(await exists('consent_log', consentId)).toBe(false)
    expect((await logsFor('email-log', mailId))[0]?.ruleId).toBe('L-12')
    expect((await logsFor('consent-log', consentId))[0]?.ruleId).toBe('L-19 a')
  })

  it('R-154 DM-PRQ-03 L-17 Datenschutz-Anfrage: Exportdatei 30 Tage nach Antwort, Datensatz nach retainUntil', async () => {
    const answered = new Date('2026-10-01T10:00:00.000Z')
    const until = new Date('2029-12-31T23:00:00.000Z')
    const exportFile = await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'data_export' } as never,
      file: { data: PDF, name: 'auskunft.pdf', mimetype: 'application/pdf', size: PDF.length },
      overrideAccess: true,
    })
    const req = await payload.create({
      collection: 'privacy-requests',
      data: {
        reference: 'DS-2026-0981',
        types: ['access'],
        contactEmail: 'erika@planetclaire.local',
      } as never,
      overrideAccess: true,
      context: { now: '2026-09-20T10:00:00.000Z' },
    })
    await dbOf(payload).execute(sql`
      UPDATE privacy_requests SET answered_at = ${iso(answered)}::timestamptz, retain_until = ${iso(until)}::timestamptz,
             export_file_id = ${exportFile.id} WHERE id = ${req.id}`)
    const fileDue = plus(answered, 30 * DAY)
    await run('retentionPrivacyRequests', plus(fileDue, -DAY))
    expect(await exists('private_uploads', exportFile.id as number)).toBe(true)
    await run('retentionPrivacyRequests', plus(fileDue, 2 * DAY))
    expect(await exists('private_uploads', exportFile.id as number)).toBe(false)
    expect(await exists('privacy_requests', req.id as number)).toBe(true)
    await run('retentionPrivacyRequests', plus(until, -DAY))
    expect(await exists('privacy_requests', req.id as number)).toBe(true)
    await run('retentionPrivacyRequests', plus(until, DAY))
    expect(await exists('privacy_requests', req.id as number)).toBe(false)
    expect((await logsFor('privacy-requests', req.id as number))[0]?.ruleId).toBe('L-17')
  })

  it('R-154 L-20 Portfolio-Foto: Dateien 24 h nach Widerruf der Einwilligung gelöscht, Eintrag bleibt als Nachweis', async () => {
    const mediaId = await createTestImage(payload, 'Tattoo am Unterarm')
    const withdrawn = new Date('2026-10-10T12:00:00.000Z')
    const g = await payload.create({
      collection: 'tattoo-gallery',
      data: {
        image: mediaId,
        kind: 'fresh',
        showsCustomer: true,
        consentGiven: true,
        consentDate: '2026-05-01T00:00:00.000Z',
        consentNote: 'per DM bestätigt',
        published: false,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    await dbOf(payload).execute(sql`
      UPDATE tattoo_gallery SET consent_withdrawn_at = ${iso(withdrawn)}::timestamptz WHERE id = ${g.id}`)
    const media = await payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true })
    const original = () => readStoredFile('media', media.filename ?? '', media.prefix)
    expect(await original()).not.toBeNull()
    await run('retentionConsentEvidence', plus(withdrawn, 23 * 3_600_000))
    expect(await original()).not.toBeNull()
    await run('retentionConsentEvidence', plus(withdrawn, 25 * 3_600_000))
    expect(await original()).toBeNull()
    const thumb = (media.sizes as { thumb?: { filename?: string | null } } | undefined)?.thumb
      ?.filename
    if (thumb) expect(await readStoredFile('media', thumb, media.prefix)).toBeNull()
    expect(await exists('tattoo_gallery', g.id as number)).toBe(true)
    const after = await dbOf(payload).execute(
      sql`SELECT restricted FROM media WHERE id = ${mediaId}`,
    )
    expect(after.rows[0]?.restricted).toBe(true)
    const logs = await logsFor('media', mediaId)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ ruleId: 'L-20', action: 'files_deleted' })
    // idempotent
    await run('retentionConsentEvidence', plus(withdrawn, 26 * 3_600_000))
    expect(await logsFor('media', mediaId)).toHaveLength(1)
    await dbOf(payload).execute(sql`DELETE FROM tattoo_gallery WHERE id = ${g.id}`)
  })

  it('R-154 L-18 Löschprotokoll nach 3 Jahren gelöscht, ohne eigenen Eintrag', async () => {
    const old = await dbOf(payload).execute(sql`
      INSERT INTO deletion_log (entity_collection, entity_id, rule_id, action, trigger, task_slug, storage_objects_count,
                                executed_at, retain_until, updated_at, created_at)
      VALUES ('checkouts', '9999981', 'L-03', 'deleted', 'job', 'retentionAbandonedCheckouts', 0,
              '2023-01-01T00:00:00Z', '2026-01-01T00:00:00Z', now(), now()) RETURNING id`)
    const id = Number(old.rows[0]!.id)
    const count = async () =>
      Number(
        (await dbOf(payload).execute(sql`SELECT count(*)::int AS n FROM deletion_log`)).rows[0]!.n,
      )
    await run('retentionDeletionLog', new Date('2025-12-30T00:00:00.000Z'))
    expect(await exists('deletion_log', id)).toBe(true)
    const before = await count()
    await run('retentionDeletionLog', new Date('2026-01-02T00:00:00.000Z'))
    expect(await exists('deletion_log', id)).toBe(false)
    expect(await count()).toBe(before - 1)
  })

  it('R-134 rate_limit_hits nach 24 h weg; L-02, L-13 d/f/g/h im stündlichen retentionTechnical', async () => {
    const now = new Date('2027-02-10T12:00:00.000Z')
    const db = dbOf(payload)
    await db.execute(sql`DELETE FROM rate_limit_hits`)
    await db.execute(sql`
      INSERT INTO rate_limit_hits (bucket, key_hash, window_start, count) VALUES
        ('withdrawal_submit', ${'d'.repeat(64)}, ${iso(plus(now, -25 * 3_600_000))}::timestamptz, 3),
        ('withdrawal_submit', ${'e'.repeat(64)}, ${iso(plus(now, -23 * 3_600_000))}::timestamptz, 1)`)
    const released = plus(now, -8 * DAY)
    const holder = await payload.create({
      collection: 'checkouts',
      data: checkoutData([item]).data as never,
      overrideAccess: true,
    })
    const reservation = await db.execute(sql`
      INSERT INTO reservations (ref, checkout_id, product_id, source, status, expires_at, display_expires_at, released_at, release_reason, seed, updated_at, created_at)
      VALUES (gen_random_uuid()::text, ${holder.id}, ${item.id}, 'checkout_session', 'released', ${iso(released)}::timestamptz,
              ${iso(released)}::timestamptz, ${iso(released)}::timestamptz, 'session_expired', false, now(), now()) RETURNING id`)
    const fresh = await db.execute(sql`
      INSERT INTO reservations (ref, checkout_id, product_id, source, status, expires_at, display_expires_at, released_at, release_reason, seed, updated_at, created_at)
      VALUES (gen_random_uuid()::text, ${holder.id}, ${item.id}, 'checkout_session', 'released', ${iso(plus(now, -6 * DAY))}::timestamptz,
              ${iso(plus(now, -6 * DAY))}::timestamptz, ${iso(plus(now, -6 * DAY))}::timestamptz, 'session_expired', false, now(), now()) RETURNING id`)
    const hook = await db.execute(sql`
      INSERT INTO webhook_events (provider, event_id, type, livemode, status, attempts, received_at, updated_at, created_at)
      VALUES ('stripe', 'evt_retention_981', 'checkout.session.completed', false, 'processed', 1,
              ${iso(plus(now, -91 * DAY))}::timestamptz, now(), now()) RETURNING id`)
    const run91 = await db.execute(sql`
      INSERT INTO job_runs (task, started_at, finished_at, status)
      VALUES ('markDelivered', ${iso(plus(now, -91 * DAY))}::timestamptz, ${iso(plus(now, -91 * DAY))}::timestamptz, 'ok')
      RETURNING id`)
    const audit = await db.execute(sql`
      INSERT INTO audit_log (action, actor_type, entity_collection, entity_id, summary, retain_until, seed, updated_at, created_at)
      VALUES ('settings_changed', 'admin', 'settings', '1', 'Test', ${iso(plus(now, -DAY))}::timestamptz, false, now(), now())
      RETURNING id`)
    const pending = await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'commission_reference', status: 'pending' } as never,
      file: { data: await readFile(PHOTO), name: 'offen.jpg', mimetype: 'image/jpeg', size: 1 },
      overrideAccess: true,
      context: { now: iso(plus(now, -25 * 3_600_000)) },
    })
    await db.execute(sql`
      UPDATE private_uploads SET status = 'pending', created_at = ${iso(plus(now, -25 * 3_600_000))}::timestamptz
       WHERE id = ${pending.id}`)

    const res = await run('retentionTechnical', now)
    expect(res.failed).toBe(0)
    const hits = await db.execute(sql`SELECT key_hash FROM rate_limit_hits`)
    expect(hits.rows.map((r) => r.key_hash)).toEqual(['e'.repeat(64)])
    expect(await exists('reservations', Number(reservation.rows[0]!.id))).toBe(false)
    expect(await exists('reservations', Number(fresh.rows[0]!.id))).toBe(true)
    expect(await exists('webhook_events', Number(hook.rows[0]!.id))).toBe(false)
    expect(await exists('job_runs', Number(run91.rows[0]!.id))).toBe(false)
    expect(await exists('audit_log', Number(audit.rows[0]!.id))).toBe(false)
    expect(await exists('private_uploads', pending.id as number)).toBe(false)
    expect(
      res.steps
        .filter((s) => s.count > 0)
        .map((s) => s.ruleId)
        .sort(),
    ).toEqual(['L-02', 'L-13 a', 'L-13 d', 'L-13 f', 'L-13 g', 'L-13 h'])
    expect(retainUntil(L_02_RESERVATIONS, released).getTime()).toBeLessThan(now.getTime())
    expect(retainUntil(L_13D_WEBHOOK_EVENTS, plus(now, -91 * DAY)).getTime()).toBeLessThan(
      now.getTime(),
    )
    await db.execute(sql`DELETE FROM reservations WHERE id = ${Number(fresh.rows[0]!.id)}`)
  })

  it('legalHoldReview: Sperre ≥ 6 Monate ohne Prüfung → A15 und legalHoldReviewedAt; Beispieldaten ohne Mail', async () => {
    const since = '2026-01-10T10:00:00.000Z'
    const o = await order({
      status: 'delivered',
      privacy: {
        legalHold: true,
        legalHoldReason: 'Streit über Bruchschaden',
        legalHoldSince: since,
      },
    })
    const seedOrder = await order({
      status: 'delivered',
      seed: true,
      privacy: {
        legalHold: true,
        legalHoldReason: 'Beispiel für die Sperre',
        legalHoldSince: since,
      },
    })
    await dbOf(payload).execute(sql`
      UPDATE orders SET privacy_legal_hold_since = ${since}::timestamptz, privacy_legal_hold_reviewed_at = NULL
       WHERE id IN (${o.id}, ${seedOrder.id})`)
    const now = new Date('2026-07-15T06:00:00.000Z')
    const req = await createLocalReq({ context: { system: true, now: iso(now) } }, payload)
    const res = await runLegalHoldReview(req, now)
    expect(res.sent).toBe(true)
    const a15 = await payload.find({
      collection: 'email-log',
      where: { template: { equals: 'admin_legal_hold_review' } },
      overrideAccess: true,
    })
    expect(a15.totalDocs).toBe(1)
    expect((await orderRow(o.id))?.privacy_legal_hold_reviewed_at).not.toBeNull()
    expect((await orderRow(seedOrder.id))?.privacy_legal_hold_reviewed_at).toBeNull()
    const again = await runLegalHoldReview(req, plus(now, DAY))
    expect(again.sent).toBe(false)
  })
})
