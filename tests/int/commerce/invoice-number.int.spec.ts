import { createLocalReq, initTransaction, killTransaction, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dbOf, createOrder, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { sql } from '@payloadcms/db-postgres'

// P1.21: Belegnummern über Zählerzeile mit Row-Lock (DATENMODELL §8.6), Belege unveränderlich (§6.9).

let payload: Payload
let item: ItemInput
let orderNr = 900

const invoiceData = (order: number, overrides: Record<string, unknown> = {}) => ({
  type: 'invoice',
  order,
  deliveryDate: '2026-09-27T10:00:00.000Z',
  totalGrossCents: 5390,
  data: { version: 1 },
  ...overrides,
})

async function newOrder(): Promise<number> {
  const doc = await createOrder(payload, orderData(++orderNr, [item]))
  return doc.id as number
}

type Err = { message?: string; data?: { errors?: { message: string }[] } }
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, 'erwartet Ablehnung').not.toBeNull()
  expect([err!.message, ...(err!.data?.errors ?? []).map((e) => e.message)].join(' | ')).toMatch(re)
}

const counter = async (series: string) =>
  (
    await dbOf(payload).execute(
      sql`SELECT last_number FROM invoice_counters WHERE series = ${series}`,
    )
  ).rows[0]?.last_number

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 980, fx))
  item = { id: p.id as number, itemNumber: 980 }
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Belegnummern (DATENMODELL §8.6)', () => {
  it('DM-INV-01 20 parallele Nummernvergaben (20 Verbindungen): RE-2026-00001 … 00020 ohne Lücke und Dopplung', async () => {
    const orders = await Promise.all(Array.from({ length: 20 }, () => newOrder()))
    const invoices = await Promise.all(
      orders.map((order) =>
        payload.create({
          collection: 'invoices',
          data: invoiceData(order) as never,
          overrideAccess: true,
          context: { system: true, now: '2026-09-27T10:00:00.000Z' },
        }),
      ),
    )
    const numbers = invoices.map((i) => i.number).sort()
    expect(numbers).toEqual(
      Array.from({ length: 20 }, (_, i) => `RE-2026-${String(i + 1).padStart(5, '0')}`),
    )
    expect(new Set(invoices.map((i) => i.sequenceNumber)).size).toBe(20)
    expect(Number(await counter('RE'))).toBe(20)
    const first = invoices.find((i) => i.sequenceNumber === 1)!
    expect(first).toMatchObject({
      series: 'RE',
      year: 2026,
      status: 'pending_pdf',
      taxMode: 'kleinunternehmer',
      isKleinunternehmer: true,
      totalNetCents: 5390,
      totalTaxCents: 0,
      retainUntil: '2036-12-31T23:00:00.000Z',
    })
  })

  it('DM-INV-02 ein künstlicher Fehler nach der Vergabe verbraucht keine Nummer', async () => {
    const before = Number(await counter('RE'))
    const order = await newOrder()
    // a) Fehler in derselben Transaktion nach der Anlage → Rollback
    const req = await createLocalReq({ context: { system: true } }, payload)
    await initTransaction(req)
    const doc = await payload.create({
      collection: 'invoices',
      data: invoiceData(order) as never,
      overrideAccess: true,
      req,
    })
    expect(doc.sequenceNumber).toBe(before + 1)
    await killTransaction(req)
    // b) Validierungsfehler nach dem Ziehen der Nummer (Feldprüfung läuft nach dem Hook)
    await rejects(
      payload.create({
        collection: 'invoices',
        data: invoiceData(order, { deliveryDate: null }) as never,
        overrideAccess: true,
        context: { system: true },
      }),
      /.+/,
    )
    expect(Number(await counter('RE'))).toBe(before)
    const next = await payload.create({
      collection: 'invoices',
      data: invoiceData(order) as never,
      overrideAccess: true,
      context: { system: true, now: '2026-09-27T10:00:00.000Z' },
    })
    expect(next.number).toBe(`RE-2026-${String(before + 1).padStart(5, '0')}`)
  })

  it('Gutschrift: Serie GS, nur mit Rechnung derselben Bestellung und Grund', async () => {
    const order = await newOrder()
    const other = await newOrder()
    const invoice = await payload.create({
      collection: 'invoices',
      data: invoiceData(order) as never,
      overrideAccess: true,
      context: { system: true },
    })
    await rejects(
      payload.create({
        collection: 'invoices',
        data: invoiceData(other, {
          type: 'credit_note',
          relatedInvoice: invoice.id,
          reason: 'withdrawal',
        }) as never,
        overrideAccess: true,
        context: { system: true },
      }),
      /derselben Bestellung/,
    )
    await rejects(
      payload.create({
        collection: 'invoices',
        data: invoiceData(order, { type: 'credit_note', relatedInvoice: invoice.id }) as never,
        overrideAccess: true,
        context: { system: true },
      }),
      /Grund/,
    )
    const credit = await payload.create({
      collection: 'invoices',
      data: invoiceData(order, {
        type: 'credit_note',
        relatedInvoice: invoice.id,
        reason: 'withdrawal',
      }) as never,
      overrideAccess: true,
      context: { system: true, now: '2027-01-02T10:00:00.000Z' },
    })
    expect(credit.number).toBe('GS-2027-00001')
  })

  it('Belege sind unveränderlich; ausgestellt genau einmal mit PDF; Löschen abgelehnt', async () => {
    const order = await newOrder()
    const invoice = await payload.create({
      collection: 'invoices',
      data: invoiceData(order) as never,
      overrideAccess: true,
      context: { system: true },
    })
    for (const [field, value] of [
      ['totalGrossCents', 1],
      ['number', 'RE-2026-09999'],
      ['taxMode', 'regelbesteuert'],
      ['data', { version: 1, changed: true }],
    ] as const) {
      await rejects(
        payload.update({
          collection: 'invoices',
          id: invoice.id,
          data: { [field]: value } as never,
          overrideAccess: true,
          context: { system: true },
        }),
        /unveränderlich/,
      )
    }
    await rejects(
      payload.update({
        collection: 'invoices',
        id: invoice.id,
        data: { status: 'issued' } as never,
        overrideAccess: true,
        context: { system: true },
      }),
      /PDF/,
    )
    await rejects(
      payload.delete({
        collection: 'invoices',
        id: invoice.id,
        overrideAccess: true,
        context: { system: true },
      }),
      /GoBD/,
    )
  })

  it('DM-INV-04 ein Moduswechsel ab X ändert alte Belege nicht; neue Belege ab X tragen den neuen Modus', async () => {
    const order = await newOrder()
    const old = await payload.create({
      collection: 'invoices',
      data: invoiceData(order) as never,
      overrideAccess: true,
      context: { system: true, now: '2026-10-01T10:00:00.000Z' },
    })
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
      await rejects(
        payload.create({
          collection: 'invoices',
          data: invoiceData(order) as never,
          overrideAccess: true,
          context: { system: true, now: '2030-01-02T10:00:00.000Z' },
        }),
        /Netto \+ Steuer/,
      )
      const later = await payload.create({
        collection: 'invoices',
        data: invoiceData(await newOrder(), { totalNetCents: 4529, totalTaxCents: 861 }) as never,
        overrideAccess: true,
        context: { system: true, now: '2030-01-02T10:00:00.000Z' },
      })
      expect(later).toMatchObject({
        taxMode: 'regelbesteuert',
        isKleinunternehmer: false,
        year: 2030,
      })
      const reread = await payload.findByID({
        collection: 'invoices',
        id: old.id,
        overrideAccess: true,
      })
      expect(reread).toMatchObject({
        taxMode: 'kleinunternehmer',
        isKleinunternehmer: true,
        totalTaxCents: 0,
      })
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { tax: { modes } } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    }
  })
})
