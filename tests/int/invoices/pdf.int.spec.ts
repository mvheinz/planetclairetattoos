import { createHash } from 'node:crypto'

import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createCreditNote, createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import type { Invoice, Order } from '@/payload-types'

import { createOrder, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { pdfText, readPrivateUpload, withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P4.11 – Beleg-PDF (R-120, DM-INV-04, DM-INV-05, Wasserzeichen R-121/SEED-SPEC §9).

let payload: Payload
let restoreBusiness: () => Promise<void>
let items: ItemInput[]
let orderNr = 980

const PAID = new Date('2026-10-14T09:30:00.000Z')

async function newOrder(overrides: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(payload, orderData(++orderNr, items, overrides))) as Order
}

async function invoiceFor(order: Order, now = PAID): Promise<Invoice> {
  const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
  const { invoice, jobId } = await createInvoiceForOrder(req, order, { paidAt: now, now })
  expect(jobId).not.toBeNull()
  await runInvoicePdfJob(payload, jobId, { now })
  return payload.findByID({
    collection: 'invoices',
    id: invoice.id,
    depth: 0,
    overrideAccess: true,
  })
}

async function textOf(invoice: Invoice): Promise<{ text: string; file: Buffer }> {
  const file = await readPrivateUpload(payload, invoice.pdf as number)
  return { text: await pdfText(file), file }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  const a = await createProduct(payload, completeProduct('keramik', 981, fx))
  const b = await createProduct(payload, completeProduct('keramik', 982, fx))
  items = [
    { id: a.id as number, itemNumber: 981, priceCents: 4500 },
    { id: b.id as number, itemNumber: 17, priceCents: 3200 },
  ]
})

afterAll(async () => {
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Rechnungs-PDF (R-120)', () => {
  it('R-120 PDF-Text enthält alle Pflichtangaben; im KU-Modus kein Steuerbetrag (V-02)', async () => {
    const order = await newOrder()
    const invoice = await invoiceFor(order)
    expect(invoice).toMatchObject({ status: 'issued', series: 'RE', taxMode: 'kleinunternehmer' })
    const { text } = await textOf(invoice)
    for (const needle of [
      'Rechnung',
      invoice.number,
      '14.10.2026', // Ausstellungsdatum
      'Jutta Beispiel',
      'Planet Claire',
      'Werkstattweg 7',
      '10999 Berlin',
      'Steuernummer: 12/345/67890',
      'Erika Beispiel',
      'Musterstraße 1',
      '10115 Berlin',
      'Nr. 981 · Teststück 981 · Keramik',
      'Nr. 017 · Teststück 17 · Keramik',
      'Versand',
      '8,90 €',
      '85,90 €', // 45 + 32 + 8,90
      'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
      'Oktober 2026', // Leistungszeitpunkt als Monat
      'Bezahlt am 14.10.2026 per Karte / Apple Pay / Google Pay.',
      order.orderNumber,
    ]) {
      expect(text, needle).toContain(needle)
    }
    // V-02: keine Steuerbeträge, kein „inkl. MwSt.“
    expect(text).not.toMatch(/inkl\.?\s*(MwSt|USt|Mehrwertsteuer|Umsatzsteuer)|\bMwSt\b/)
    expect(text).not.toMatch(/Umsatzsteuer \d+ %|Nettobetrag/)
    expect(text).not.toContain('BEISPIELBELEG')
  })

  it('R-120/R-061 Abholung: Empfänger ist immer die Rechnungsadresse', async () => {
    const order = await newOrder({
      fulfillmentMethod: 'pickup',
      shippingAddress: undefined,
      shippingZone: undefined,
      shippingClass: undefined,
      shippingCents: 0,
      totalCents: 7700,
      billingAddress: {
        name: 'Rita Rechnung',
        addressLine1: 'Belegallee 3',
        postalCode: '20095',
        city: 'Hamburg',
        country: 'DE',
      },
    })
    const invoice = await invoiceFor(order)
    const { text } = await textOf(invoice)
    expect(text).toContain('Rita Rechnung')
    expect(text).toContain('20095 Hamburg')
    expect(text).not.toContain('Versand')
    expect((invoice.data as { buyer: { name: string } }).buyer.name).toBe('Rita Rechnung')
  })

  it('DM-INV-05 gespeicherter Hash = Hash der Datei; zweiter Lauf ändert nichts (genau einmal)', async () => {
    const invoice = await invoiceFor(await newOrder())
    const { file } = await textOf(invoice)
    expect(invoice.sha256).toBe(createHash('sha256').update(file).digest('hex'))
    expect(invoice.renderedAt).toBe(PAID.toISOString())
    const upload = await payload.findByID({
      collection: 'private-uploads',
      id: invoice.pdf as number,
      overrideAccess: true,
    })
    expect(upload).toMatchObject({
      purpose: 'invoice_pdf',
      prefix: `private/invoices/2026`,
      mimeType: 'application/pdf',
    })
    // Dateiname `{Nummer}.pdf`; liegt lokal schon eine verwaiste Datei gleichen Namens mit anderem Inhalt (frühere
    // Testläufe), wird sie nie überschrieben – dann `{Nummer}-{sha256[0..8]}.pdf` (R-122, `storePrivateFile`).
    expect(upload.filename).toBe(
      upload.filename === `${invoice.number}.pdf`
        ? `${invoice.number}.pdf`
        : `${invoice.number}-${invoice.sha256!.slice(0, 8)}.pdf`,
    )
    expect(upload.retainUntil).toBe(invoice.retainUntil)

    const again = await payload.jobs.queue({
      task: 'renderInvoicePdf',
      input: { invoiceId: invoice.id },
      queue: 'documents',
    })
    await payload.jobs.runByID({ id: again.id })
    const after = await payload.findByID({ collection: 'invoices', id: invoice.id, depth: 0 })
    expect(after.pdf).toBe(invoice.pdf)
    expect(after.sha256).toBe(invoice.sha256)
    const uploads = await payload.count({
      collection: 'private-uploads',
      where: { relatedInvoice: { equals: invoice.id } },
      overrideAccess: true,
    })
    expect(uploads.totalDocs).toBe(1)
  })

  it('Gutschrift (GS) mit Verweis auf die Rechnung und eigenem PDF', async () => {
    const order = await newOrder()
    const invoice = await invoiceFor(order)
    const req = await createLocalReq({}, payload)
    const refundAt = new Date('2026-10-20T08:00:00.000Z')
    const { invoice: credit, jobId } = await createCreditNote(req, invoice, {
      amountCents: 4500,
      reason: 'withdrawal',
      lines: [{ description: 'Nr. 981 · Teststück 981 · Keramik', totalCents: 4500 }],
      now: refundAt,
    })
    await runInvoicePdfJob(payload, jobId)
    const issued = await payload.findByID({ collection: 'invoices', id: credit.id, depth: 0 })
    expect(issued).toMatchObject({
      type: 'credit_note',
      series: 'GS',
      status: 'issued',
      totalGrossCents: 4500,
      relatedInvoice: invoice.id,
    })
    const { text } = await textOf(issued)
    expect(text).toContain('Gutschrift')
    expect(text).toContain(issued.number)
    expect(text).toContain(invoice.number)
    expect(text).toContain('45,00 €')
    expect(text).toContain('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.')
    const upload = await payload.findByID({
      collection: 'private-uploads',
      id: issued.pdf as number,
      overrideAccess: true,
    })
    expect(upload.purpose).toBe('credit_note_pdf')
  })

  it('DM-INV-04/AK-4-15 Regelbesteuerung ab validFrom: Steuerzeilen; ältere Belege unverändert', async () => {
    const old = await invoiceFor(await newOrder())
    const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })
    const modes = settings.tax?.modes ?? []
    await payload.updateGlobal({
      slug: 'settings',
      data: {
        tax: {
          modes: [
            ...modes,
            {
              mode: 'regelbesteuert',
              validFrom: '2030-01-01T00:00:00.000Z',
              reason: 'Umsatzgrenze überschritten (Test)',
              confirmedWithTaxAdvisor: true,
            },
          ],
        },
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    try {
      const later = await invoiceFor(await newOrder(), new Date('2030-01-02T10:00:00.000Z'))
      expect(later).toMatchObject({ taxMode: 'regelbesteuert', totalGrossCents: 8590 })
      // 85,90 € brutto zu 19 % → netto round(8590 / 1,19) = 7218, Steuer 1372
      expect(later).toMatchObject({ totalNetCents: 7218, totalTaxCents: 1372 })
      const { text } = await textOf(later)
      expect(text).toContain('Nettobetrag 19 %')
      expect(text).toContain('72,18 €')
      expect(text).toContain('Umsatzsteuer 19 %')
      expect(text).toContain('13,72 €')
      expect(text).not.toContain('§ 19 UStG')
      expect(text).toContain('Januar 2030')

      const reread = await payload.findByID({ collection: 'invoices', id: old.id, depth: 0 })
      expect(reread).toMatchObject({ taxMode: 'kleinunternehmer', totalTaxCents: 0 })
      expect(reread.sha256).toBe(old.sha256)
      const { text: oldText } = await textOf(reread)
      expect(oldText).toContain('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.')
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { tax: { modes } } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    }
  })

  it('R-121 Beispielbeleg (seed = true): Serie BSP-RE mit Wasserzeichen „BEISPIELBELEG – kein echter Beleg“', async () => {
    const order = await newOrder({ seed: true })
    const invoice = await invoiceFor(order)
    expect(invoice.number).toMatch(/^BSP-RE-2026-\d{5}$/)
    const { text } = await textOf(invoice)
    expect(text).toContain('BEISPIELBELEG – kein echter Beleg')
  })
})
