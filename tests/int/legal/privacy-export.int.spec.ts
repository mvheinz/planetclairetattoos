import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { strFromU8, unzipSync } from 'fflate'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { runEmailJobNow } from '@/lib/email/outbox'
import { parseEnv } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { inTransaction } from '@/lib/payload/transaction'
import { handlePrivacyExport } from '@/lib/privacy/download'
import {
  createPrivacyExport,
  sendAccessResponse,
  type PrivacyExportData,
} from '@/lib/privacy/export'
import { verifyPrivacyExportToken } from '@/lib/privacy/exportToken'
import { createPrivacyRequest, savePrivacyRequest } from '@/lib/privacy/requests'
import { searchPerson } from '@/lib/privacy/search'
import { readStoredFile } from '@/lib/storage/read'
import type { Order, PrivacyRequest, PrivateUpload } from '@/payload-types'

import { checkoutData, createOrder, dbOf, deleteCommerce, orderData } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.17 – Personensuche und Auskunft-Export (R-150, R-137, KONZEPT §7.15, LOESCHKONZEPT §5.4): eine Fixture-Person
// (gleichartig zur Seed-Kundin „Mara“, SEED-SPEC §6) mit Daten in allen Collections – Bestellungen, Kasse, Beleg (mit
// PDF), Widerruf, Reklamation (mit Foto), Anfrage (mit Bild), Mail- und Einwilligungs-Protokoll, frühere Datenschutz-
// Anfrage. Der Export enthält jeden Datensatz (Zählvergleich gegen eigene Abfragen), `daten.json` ist valides JSON,
// Bilder und PDFs liegen bei, Daten anderer Personen und interne Notizen fehlen. M14 nur an die gespeicherte Adresse;
// Download-Link ohne Personendaten, nach 7 Tagen 410.

const NUMBERS = [988, 989]
const EMAIL = 'mara.auskunft@planetclaire.local'
const NAME = 'Mara Auskunft'
const OTHER = 'jonas.dritter@planetclaire.local'
const NOW = new Date('2026-10-10T10:00:00.000Z')
const PHOTO = path.resolve('tests/fixtures/images/landscape-small.jpg')

let payload: Payload
let restoreBusiness: () => Promise<void>
let orderA: Order
let orderB: Order
let request: PrivacyRequest
const db = () => dbOf(payload)

async function photo(purpose: string, extra: Record<string, unknown> = {}): Promise<PrivateUpload> {
  const data = await readFile(PHOTO)
  return (await payload.create({
    collection: 'private-uploads',
    data: { purpose, ...extra } as never,
    file: {
      data,
      name: `${purpose}-${Math.random().toString(36).slice(2, 8)}.jpg`,
      mimetype: 'image/jpeg',
      size: data.length,
    },
    overrideAccess: true,
  })) as PrivateUpload
}

async function count(query: ReturnType<typeof sql>): Promise<number> {
  const res = await db().execute(query)
  return Number(res.rows[0]?.n ?? 0)
}

async function cleanup() {
  await db().execute(
    sql`DELETE FROM email_log WHERE lower("to") IN (${EMAIL}, ${OTHER}) OR template = 'privacy_access_response'`,
  )
  await db().execute(sql`DELETE FROM consent_log WHERE lower(email) IN (${EMAIL}, ${OTHER})`)
  await db().execute(sql`DELETE FROM privacy_requests WHERE contact_email IN (${EMAIL}, ${OTHER})`)
  await db().execute(sql`DELETE FROM inquiries WHERE email IN (${EMAIL}, ${OTHER})`)
}

async function req(now = NOW) {
  return createLocalReq({ context: { now: now.toISOString() } }, payload)
}

describe('DSGVO: Personensuche und Auskunft-Export (P6.17)', () => {
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
    const items = []
    for (const nr of NUMBERS) {
      const p = await createProduct(payload, completeProduct('keramik', nr, fx))
      items.push({ id: p.id as number, itemNumber: nr })
    }
    // Person: zwei Bestellungen (E-Mail in anderer Schreibweise), eine fremde Bestellung
    orderA = (await createOrder(
      payload,
      orderData(981, [items[0]!], {
        customer: { name: NAME, email: 'Mara.Auskunft@PlanetClaire.Local' },
        shippingAddress: {
          name: NAME,
          addressLine1: 'Wiesenweg 3',
          postalCode: '10999',
          city: 'Berlin',
          country: 'DE',
        },
        notes: 'Interne Notiz: Nachbarin Frau Dritte nimmt an',
        timestamps: { placedAt: '2026-09-20T10:00:00.000Z', paidAt: '2026-09-20T10:05:00.000Z' },
      }),
    )) as Order
    orderB = (await createOrder(
      payload,
      orderData(982, [items[1]!], {
        customer: { name: NAME, email: EMAIL },
        status: 'awaiting_prepayment',
        paymentMethod: 'prepayment',
      }),
    )) as Order
    await createOrder(
      payload,
      orderData(983, [items[1]!], {
        customer: { name: 'Jonas Dritter', email: OTHER },
        shippingAddress: {
          name: 'Jonas Dritter',
          addressLine1: 'Hof 1',
          postalCode: '10115',
          city: 'Berlin',
          country: 'DE',
        },
      }),
    )
    // Beleg mit PDF
    const r = await createLocalReq({ context: { system: true } }, payload)
    const inv = await inTransaction(r, () =>
      createInvoiceForOrder(r, orderA, { paidAt: new Date('2026-09-20T10:05:00.000Z'), now: NOW }),
    )
    await runInvoicePdfJob(payload, inv.jobId)
    // Kasse der Bestellung A
    const co = checkoutData([items[0]!], { customer: { email: EMAIL }, order: orderA.id })
    await payload.create({
      collection: 'checkouts',
      data: co.data as never,
      overrideAccess: true,
      context: { system: true },
    })
    // Widerruf zur Bestellung A
    await payload.create({
      collection: 'withdrawals',
      data: {
        reference: 'WR-2026-00981',
        channel: 'online_form',
        locale: 'de',
        receivedAt: '2026-09-25T10:00:00.000Z',
        name: NAME,
        contractIdentification: 'Bestellung PC-2026-00981',
        email: EMAIL,
        matchStatus: 'manually_matched',
        order: orderA.id,
        status: 'received',
        refundDueAt: '2026-10-09T10:00:00.000Z',
        submissionSnapshot: { name: NAME },
        adminNotes: 'Notiz über eine andere Person',
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    // Reklamation mit Foto
    await db().execute(
      sql`UPDATE orders SET timestamps_delivered_at = '2026-09-22T10:00:00Z' WHERE id = ${orderA.id}`,
    )
    const complaint = await payload.create({
      collection: 'complaints',
      data: {
        order: orderA.id,
        kind: 'defect',
        receivedAt: '2026-09-28T09:00:00.000Z',
        description: 'Haarriss in der Glasur',
      } as never,
      overrideAccess: true,
      context: { now: NOW.toISOString() },
    })
    const cp = await photo('complaint_photo', { relatedComplaint: complaint.id })
    await payload.update({
      collection: 'complaints',
      id: complaint.id,
      data: { photos: [cp.id] } as never,
      overrideAccess: true,
      context: { now: NOW.toISOString() },
    })
    // Anfrage mit Bild
    const img = await photo('commission_reference')
    await payload.create({
      collection: 'inquiries',
      data: {
        reference: 'AA-2026-0988',
        name: NAME,
        email: EMAIL,
        idea: 'Eine Schale mit meinem Kater, gern in Grün.',
        objectType: 'schale',
        locale: 'de',
        referenceImages: [img.id],
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    // Mail-Protokoll: an die Person, Verwaltungs-Mail zur Bestellung (gehört nicht in die Auskunft), fremde Mail
    for (const [template, to, order] of [
      ['order_confirmation', EMAIL, orderA.id],
      ['prepayment_instructions', EMAIL, orderB.id],
      ['admin_order_placed', 'jutta@planetclaire.local', orderA.id],
      ['order_confirmation', OTHER, null],
    ] as const) {
      await payload.create({
        collection: 'email-log',
        data: {
          template,
          to,
          locale: 'de',
          subject: 'Betreff',
          idempotencyKey: `${template}:${Math.random().toString(36).slice(2)}:test`,
          status: 'sent',
          attempts: 1,
          order: order ?? undefined,
        } as never,
        overrideAccess: true,
        context: { system: true, skipAudit: true },
      })
    }
    // Einwilligungs-Protokoll
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
        order: orderA.id,
      } as never,
      overrideAccess: true,
      context: { system: true },
    })
    // frühere, abgeschlossene Datenschutz-Anfrage
    const lr = await req(new Date('2026-05-02T10:00:00.000Z'))
    const old = await inTransaction(lr, () =>
      createPrivacyRequest(
        lr,
        { types: ['access'], receivedAt: '2026-05-02', contactEmail: EMAIL },
        new Date('2026-05-02T10:00:00.000Z'),
      ),
    )
    await db().execute(sql`UPDATE privacy_requests SET status = 'answered',
      answered_at = '2026-05-10T10:00:00Z' WHERE id = ${old.id}`)
    // aktuelle Anfrage (von der gespeicherten Adresse)
    const cr = await req()
    request = await inTransaction(cr, () =>
      createPrivacyRequest(
        cr,
        {
          types: ['access', 'portability'],
          receivedAt: '2026-10-09',
          contactEmail: EMAIL,
          contactName: NAME,
        },
        NOW,
      ),
    )
  })

  afterAll(async () => {
    __setEmailAdapterForTests(undefined)
    await cleanup()
    await deleteCommerce(payload)
    await deleteProducts(payload, NUMBERS)
    await restoreBusiness()
  })

  it('R-150 Suche nach E-Mail (ohne Groß-/Kleinschreibung), Bestellnummer oder Name findet dieselben Bestellungen', async () => {
    const r = await req()
    const byMail = await searchPerson(r, { email: '  MARA.auskunft@planetclaire.LOCAL ' })
    expect(byMail.orders).toEqual([orderA.id, orderB.id].sort((a, b) => a - b))
    const byName = await searchPerson(r, { name: 'mara   AUSKUNFT' })
    expect(byName.orders).toEqual(byMail.orders)
    const byNumber = await searchPerson(r, {
      orderNumber: String(orderA.orderNumber).toLowerCase(),
    })
    expect(byNumber.orders).toEqual([orderA.id])
    expect(byNumber.invoices).toHaveLength(1)
    await expect(searchPerson(r, {})).rejects.toMatchObject({ status: 400 })
  })

  it('R-150 Export enthält jeden Datensatz der Person (Zählvergleich), JSON valide, Bilder und PDFs dabei, nichts Fremdes', async () => {
    const r = await req()
    const created = await inTransaction(r, () =>
      createPrivacyExport(r, request.id, { email: EMAIL }, NOW),
    )
    expect(created.upload.purpose).toBe('data_export')
    const bytes = await readStoredFile('private', created.upload.filename!, created.upload.prefix)
    expect(bytes).not.toBeNull()
    const zip = unzipSync(new Uint8Array(bytes!))
    const data = JSON.parse(strFromU8(zip['daten.json']!)) as PrivacyExportData

    const ids = sql.raw(`${orderA.id}, ${orderB.id}`)
    const expected = {
      orders: await count(
        sql`SELECT count(*) AS n FROM orders WHERE lower(customer_email) = ${EMAIL}`,
      ),
      checkouts: await count(
        sql`SELECT count(*) AS n FROM checkouts WHERE customer_email = ${EMAIL}`,
      ),
      invoices: await count(sql`SELECT count(*) AS n FROM invoices WHERE order_id IN (${ids})`),
      withdrawals: await count(sql`SELECT count(*) AS n FROM withdrawals WHERE email = ${EMAIL}`),
      inquiries: await count(sql`SELECT count(*) AS n FROM inquiries WHERE email = ${EMAIL}`),
      complaints: await count(sql`SELECT count(*) AS n FROM complaints WHERE order_id IN (${ids})`),
      emailLog: await count(sql`SELECT count(*) AS n FROM email_log WHERE "to" = ${EMAIL}`),
      consentLog: await count(sql`SELECT count(*) AS n FROM consent_log WHERE email = ${EMAIL}`),
      privacyRequests:
        (await count(
          sql`SELECT count(*) AS n FROM privacy_requests WHERE contact_email = ${EMAIL}`,
        )) - 1,
    }
    expect(expected).toEqual({
      orders: 2,
      checkouts: 1,
      invoices: 1,
      withdrawals: 1,
      inquiries: 1,
      complaints: 1,
      emailLog: 2,
      consentLog: 1,
      privacyRequests: 1,
    })
    for (const [area, n] of Object.entries(expected)) {
      expect(data.data[area as keyof typeof expected], area).toHaveLength(n)
      expect(data.counts[area as keyof typeof expected], area).toBe(n)
    }
    // Dateien: Beleg-PDF, Reklamationsfoto, Anfrage-Bild
    const purposes = data.files.map((f) => f.purpose).sort()
    expect(purposes).toEqual(['commission_reference', 'complaint_photo', 'invoice_pdf'])
    for (const f of data.files) {
      expect(zip[f.path], f.path).toBeDefined()
      expect(zip[f.path]!.length).toBe(f.sizeBytes)
    }
    // keine Daten Dritter, keine internen Notizen, keine Token-Merkmale
    const json = strFromU8(zip['daten.json']!)
    expect(json).not.toContain(OTHER)
    expect(json).not.toContain('Jonas')
    expect(json).not.toContain('jutta@planetclaire.local')
    expect(json).not.toContain('Frau Dritte')
    expect(json).not.toContain('andere Person')
    expect(json).not.toMatch(/tokenHash|statusTokenSealed|adminNotes|"seed"/)
    // auskunft.html: Art. 15 a–h, Empfänger, Beschwerderecht
    const html = strFromU8(zip['auskunft.html']!)
    expect(html).toContain(request.reference)
    expect(html).toContain('Berliner Beauftragten für Datenschutz und Informationsfreiheit')
    expect(html).toContain('Alt-Moabit 59–61, 10555 Berlin')
    expect(html).toContain('Stripe')
    expect(html).toMatch(/h\) Automatisierte Entscheidungen/)
    expect(html).not.toMatch(/<script|https?:\/\/(?!planetclaire)/i)
    // Treffer an der Anfrage, Audit ohne Inhalte
    expect(created.request.matchedOrders).toHaveLength(2)
    const audit = await db().execute(
      sql`SELECT summary FROM audit_log WHERE action = 'data_exported' AND entity_id = ${String(request.id)}`,
    )
    expect(audit.rows).toHaveLength(1)
    expect(String(audit.rows[0]!.summary)).not.toContain(EMAIL)
  })

  it('R-150 R-137 M14 nur an die gespeicherte Adresse, Link ohne Personendaten, nach 7 Tagen 410', async () => {
    const r1 = await req()
    await expect(
      inTransaction(r1, () => sendAccessResponse(r1, request.id, NOW)),
    ).rejects.toMatchObject({
      status: 409,
    })
    const r2 = await req()
    await inTransaction(r2, () =>
      savePrivacyRequest(
        r2,
        request.id,
        { identityVerified: true, identityMethod: 'stored_email' },
        NOW,
      ),
    )
    clearMemoryOutbox()
    const r3 = await req()
    const sent = await inTransaction(r3, () => sendAccessResponse(r3, request.id, NOW))
    await runEmailJobNow(payload, sent.jobId, { now: NOW })
    const mails = getMemoryOutbox().filter((m) => m.type === 'privacy_access_response')
    expect(mails).toHaveLength(1)
    expect(mails[0]!.to).toEqual([EMAIL])
    expect(mails[0]!.subject).toBe(`Deine Datenschutz-Anfrage ${request.reference}: Auskunft`)
    const m = /\/api\/privacy-export\/([A-Za-z0-9_.-]+)/.exec(mails[0]!.text ?? '')
    expect(m).not.toBeNull()
    const token = m![1]!
    const url = m![0]
    for (const forbidden of [
      EMAIL,
      'mara',
      'Auskunft',
      request.reference,
      String(orderA.orderNumber),
    ]) {
      expect(url.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
    expect(verifyPrivacyExportToken(token, NOW)).toMatchObject({ ok: true, requestId: request.id })
    // der Token steht nie im Protokoll
    const log = await db().execute(
      sql`SELECT * FROM email_log WHERE template = 'privacy_access_response'`,
    )
    expect(JSON.stringify(log.rows)).not.toContain(token)

    const get = (at: Date, t = token) =>
      handlePrivacyExport(
        new Request(`http://localhost/api/privacy-export/${t}`, {
          headers: { 'x-forwarded-for': `198.51.100.${at.getUTCMinutes() + 1}` },
        }),
        t,
        at,
        { payload },
      )
    const ok = await get(new Date(NOW.getTime() + 60_000))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('application/zip')
    expect(ok.headers.get('content-disposition')).toMatch(/^attachment;/)
    expect(ok.headers.get('cache-control')).toBe('private, no-store')
    expect(ok.headers.get('referrer-policy')).toBe('no-referrer')
    const zip = unzipSync(new Uint8Array(await ok.arrayBuffer()))
    expect(Object.keys(zip)).toContain('daten.json')

    const late = await get(new Date(NOW.getTime() + 7 * 86_400_000 + 60_000))
    expect(late.status).toBe(410)
    const forged = await get(new Date(NOW.getTime() + 120_000), `${token.slice(0, -2)}xx`)
    expect(forged.status).toBe(404)

    // answeredAt gesetzt → Exportdatei wird 30 Tage danach gelöscht (L-17)
    const pr = (await payload.findByID({
      collection: 'privacy-requests',
      id: request.id,
      depth: 1,
      overrideAccess: true,
    })) as PrivacyRequest
    expect(pr.answeredAt).toBe(NOW.toISOString())
    const file = pr.exportFile as PrivateUpload
    // 30 Berliner Kalendertage (Uhrzeit bleibt lokal gleich, Zeitumstellung am 25.10.)
    expect(file.deleteAfter).toBe('2026-11-09T11:00:00.000Z')
  })
})
