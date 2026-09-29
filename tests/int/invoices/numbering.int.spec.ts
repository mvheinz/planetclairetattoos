import { sql } from '@payloadcms/db-postgres'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createInvoiceForOrder } from '@/lib/invoices/create'
import { removeSeedData } from '@/lib/seed/remove'
import { fixedClock } from '@/lib/time'
import type { Order } from '@/payload-types'

import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P4.11 – lückenlose Belegnummern über `createInvoiceForOrder` (DATENMODELL §8.6, R-121, AK-4-13, T-19).

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let orderNr = 0

const NOW = new Date('2026-10-14T09:30:00.000Z')

const counter = async (series: string) =>
  Number(
    (
      await dbOf(payload).execute(
        sql`SELECT last_number FROM invoice_counters WHERE series = ${series} AND year = 2026`,
      )
    ).rows[0]?.last_number ?? 0,
  )

async function newOrder(overrides: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(payload, orderData(++orderNr, [item], overrides))) as Order
}

async function invoiceIn(order: Order) {
  const req = await createLocalReq({}, payload)
  return createInvoiceForOrder(req, order, { paidAt: NOW, now: NOW })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 983, fx))
  item = { id: p.id as number, itemNumber: 983 }
})

afterAll(async () => {
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Belegnummern der Rechnungen (R-121)', () => {
  it('AK-4-13/T-19/DM-INV-01 50 parallele Rechnungsanlagen → RE-2026-00001 … 00050 ohne Lücke und ohne Dublette', async () => {
    const orders: Order[] = []
    for (let i = 0; i < 50; i++) orders.push(await newOrder())
    const created = await Promise.all(orders.map((o) => invoiceIn(o)))
    const numbers = created.map((c) => c.invoice.number).sort()
    expect(numbers).toEqual(
      Array.from({ length: 50 }, (_, i) => `RE-2026-${String(i + 1).padStart(5, '0')}`),
    )
    expect(new Set(numbers).size).toBe(50)
    expect(await counter('RE')).toBe(50)
    // je Rechnung ein Job `renderInvoicePdf` und der Verweis an der Bestellung
    expect(created.every((c) => c.jobId !== null)).toBe(true)
    const order = await payload.findByID({ collection: 'orders', id: orders[0]!.id, depth: 0 })
    expect(order.invoice).toBe(created[0]!.invoice.id)
    for (const c of created) await payload.jobs.cancelByID({ id: c.jobId! })
  })

  it('DM-INV-02 Rollback der auslösenden Transaktion verbraucht keine Nummer (auch kein Job)', async () => {
    const before = await counter('RE')
    const order = await newOrder()
    const req = await createLocalReq({}, payload)
    await initTransaction(req)
    const { invoice, jobId } = await createInvoiceForOrder(req, order, { paidAt: NOW, now: NOW })
    expect(invoice.sequenceNumber).toBe(before + 1)
    await killTransaction(req)
    expect(await counter('RE')).toBe(before)
    const jobs = await payload.count({
      collection: 'payload-jobs',
      where: { id: { equals: jobId } },
      overrideAccess: true,
    })
    expect(jobs.totalDocs).toBe(0)

    const commitReq = await createLocalReq({}, payload)
    await initTransaction(commitReq)
    const next = await createInvoiceForOrder(commitReq, order, { paidAt: NOW, now: NOW })
    await commitTransaction(commitReq)
    expect(next.invoice.number).toBe(`RE-2026-${String(before + 1).padStart(5, '0')}`)
    await payload.jobs.cancelByID({ id: next.jobId! })
  })

  it('R-121 Fixture-Beispielbestellung (seed = true): Serie BSP-RE mit eigenem Zähler; RE bleibt unberührt; nach seed:remove beginnt RE bei 00001', async () => {
    await deleteCommerce(payload)
    const seedOrder = await newOrder({ seed: true })
    const { invoice } = await invoiceIn(seedOrder)
    expect(invoice.number).toBe('BSP-RE-2026-00001')
    expect(await counter('BSP-RE')).toBe(1)
    expect(await counter('RE')).toBe(0)

    // `pnpm seed:remove --yes` (removeSeedData, DATENMODELL §13.5): Seed-Belege, BSP-Zähler und Bestellungen weg
    await payload.jobs.cancel({ where: { taskSlug: { equals: 'renderInvoicePdf' } } })
    await removeSeedData(payload, { clock: fixedClock('2026-10-15T08:00:00.000Z') })
    expect(await payload.count({ collection: 'invoices', overrideAccess: true })).toMatchObject({
      totalDocs: 0,
    })
    expect(await counter('BSP-RE')).toBe(0)
    const real = await invoiceIn(await newOrder())
    expect(real.invoice.number).toBe('RE-2026-00001')
    await payload.jobs.cancelByID({ id: real.jobId! })
  })
})
