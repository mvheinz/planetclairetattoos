import { createHash } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import type { Invoice, Order } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { readPrivateUpload, withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P4.11 – Belege sind unveränderlich (AK-4-14, DM-INV-03, DM-INV-05, GoBD): Verwaltung, REST und SQL.

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let token: string
let orderNr = 900

const NOW = new Date('2026-10-14T09:30:00.000Z')

async function issued(overrides: Record<string, unknown> = {}): Promise<Invoice> {
  const order = (await createOrder(payload, orderData(++orderNr, [item], overrides))) as Order
  const req = await createLocalReq({}, payload)
  const { invoice, jobId } = await createInvoiceForOrder(req, order, { paidAt: NOW, now: NOW })
  await runInvoicePdfJob(payload, jobId, { now: NOW })
  return payload.findByID({ collection: 'invoices', id: invoice.id, depth: 0 })
}

async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; cause?: { message?: string }; data?: unknown },
  )
  expect(err, 'erwartet Ablehnung').not.toBeNull()
  expect(`${err!.message} ${err!.cause?.message ?? ''} ${JSON.stringify(err!.data ?? '')}`).toMatch(
    re,
  )
}

const auth = () => ({ authorization: `JWT ${token}` })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  token = (await resetAdmin(payload, '198.51.100.61')).token
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 984, fx))
  item = { id: p.id as number, itemNumber: 984 }
})

afterAll(async () => {
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Belege unveränderlich (GoBD)', () => {
  it('AK-4-14/DM-INV-03 Verwaltung/REST: Ändern und Löschen werden abgelehnt', async () => {
    const invoice = await issued()
    const patch = await rest('PATCH', `/invoices/${invoice.id}`, { totalGrossCents: 1 }, auth())
    expect(patch.status).toBe(403)
    const del = await rest('DELETE', `/invoices/${invoice.id}`, undefined, auth())
    expect(del.status).toBe(403)
    const create = await rest('POST', '/invoices', { type: 'invoice' }, auth())
    expect(create.status).toBe(403)
    // Auch der Systemweg über die Local API ändert keinen ausgestellten Beleg
    for (const data of [{ totalGrossCents: 1 }, { sha256: 'f'.repeat(64) }, { pdf: null }]) {
      await rejects(
        payload.update({
          collection: 'invoices',
          id: invoice.id,
          data: data as never,
          overrideAccess: true,
          context: { system: true },
        }),
        /unveränderlich|festgeschrieben/,
      )
    }
    await rejects(
      payload.delete({ collection: 'invoices', id: invoice.id, overrideAccess: true }),
      /GoBD/,
    )
  })

  it('AK-4-14/DM-INV-03 SQL: UPDATE und DELETE scheitern am Trigger; die PDF-Datei ist nicht löschbar', async () => {
    const invoice = await issued()
    const db = dbOf(payload)
    await rejects(
      db.execute(sql`UPDATE invoices SET total_gross_cents = 1 WHERE id = ${invoice.id}`),
      /unveränderbar/,
    )
    await rejects(
      db.execute(sql`UPDATE invoices SET sha256 = ${'0'.repeat(64)} WHERE id = ${invoice.id}`),
      /festgeschrieben/,
    )
    await rejects(db.execute(sql`DELETE FROM invoices WHERE id = ${invoice.id}`), /GoBD/)
    await rejects(
      payload.delete({
        collection: 'private-uploads',
        id: invoice.pdf as number,
        overrideAccess: true,
      }),
      /aufbewahrt/,
    )
  })

  it('AK-4-14 Ausnahme seed: Beispielbelege dürfen gelöscht werden', async () => {
    const invoice = await issued({ seed: true })
    expect(invoice.number).toMatch(/^BSP-RE-/)
    await payload.delete({
      collection: 'invoices',
      id: invoice.id,
      overrideAccess: true,
      context: { seed: true },
    })
    const left = await payload.count({
      collection: 'invoices',
      where: { id: { equals: invoice.id } },
      overrideAccess: true,
    })
    expect(left.totalDocs).toBe(0)
  })

  it('DM-INV-05 gespeicherter Hash = SHA-256 der gespeicherten Datei', async () => {
    const invoice = await issued()
    const file = await readPrivateUpload(payload, invoice.pdf as number)
    expect(invoice.status).toBe('issued')
    expect(invoice.sha256).toBe(createHash('sha256').update(file).digest('hex'))
  })
})
