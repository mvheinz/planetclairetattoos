import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getEnv, seedPreviewModeActive } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runTaskNow } from '@/lib/jobs/runTask'
import { getRevenueStatus, runRevenueGuardCheck } from '@/lib/revenue/check'
import type { RevenueSource } from '@/lib/enums'
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

// P5.23 – Task `revenueGuardCheck` (KONZEPT §8.4, R-125, AK-8-04): A09 genau einmal je Stufe und Jahr
// (`settings.revenueGuard.lastNotified` + Idempotenz-Schlüssel), Neujahrsprüfung U0, Beispielbelege zählen in
// Produktion nie, Einreihen nach Beleg- bzw. Monatssummen-Änderung.

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let orderNr = 900

const NOW = '2026-10-14T08:00:00.000Z' // Mi 14.10.2026 10:00 Berlin
const NEW_YEAR = '2027-01-01T06:00:00.000Z' // Fr 01.01.2027 07:00 Berlin

const db = () => dbOf(payload)

async function resetGuard(): Promise<void> {
  await db().execute(sql`DELETE FROM revenue_entries`)
  await db().execute(sql`UPDATE settings SET revenue_guard_last_notified = '{}'::jsonb`)
  await db().execute(sql`DELETE FROM email_log WHERE template = 'admin_revenue_guard'`)
  await payload.jobs.cancel({ where: { taskSlug: { equals: 'revenueGuardCheck' } } })
}

async function setEntry(
  month: string,
  source: RevenueSource,
  amountCents: number,
  now = NOW,
): Promise<void> {
  const existing = await payload.find({
    collection: 'revenue-entries',
    where: { and: [{ month: { equals: month } }, { source: { equals: source } }] },
    overrideAccess: true,
    depth: 0,
  })
  const context = { system: true, now }
  if (existing.docs[0]) {
    await payload.update({
      collection: 'revenue-entries',
      id: existing.docs[0].id,
      data: { amountCents },
      overrideAccess: true,
      context,
    })
  } else {
    await payload.create({
      collection: 'revenue-entries',
      data: { month, source, amountCents } as never,
      overrideAccess: true,
      context,
    })
  }
}

const run = (iso: string) => runTaskNow(payload, 'revenueGuardCheck', { now: new Date(iso) })

async function mails(year: number): Promise<string[]> {
  const res = await db().execute(sql`
    SELECT idempotency_key AS k FROM email_log
     WHERE template = 'admin_revenue_guard' AND idempotency_key LIKE ${`admin_revenue_guard:${year}:%`}
     ORDER BY id
  `)
  return res.rows.map((r) => String(r.k).split(':')[2]!)
}

async function lastNotified(): Promise<unknown> {
  const res = await db().execute(sql`SELECT revenue_guard_last_notified AS v FROM settings LIMIT 1`)
  return res.rows[0]?.v
}

async function openGuardJobs(): Promise<number> {
  const res = await payload.count({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: 'revenueGuardCheck' } },
        { completedAt: { exists: false } },
        { hasError: { not_equals: true } },
      ],
    },
    overrideAccess: true,
  })
  return res.totalDocs
}

async function invoiceFor(seed: boolean) {
  const order = (await createOrder(
    payload,
    orderData(++orderNr, [item], seed ? { seed: true } : {}),
  )) as Order
  const req = await createLocalReq({}, payload)
  const now = new Date(NOW)
  const created = await createInvoiceForOrder(req, order, { paidAt: now, now })
  if (created.jobId !== null) await payload.jobs.cancelByID({ id: created.jobId })
  return created.invoice
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  await resetGuard()
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 984, fx))
  item = { id: p.id as number, itemNumber: 984 }
})

afterAll(async () => {
  await resetGuard()
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Umsatz-Wächter revenueGuardCheck (AK-8-04, R-125)', () => {
  it('AK-8-04 19.999 € keine Meldung; 20.000 € genau eine A09 U1 im Jahr; Doppel-Lauf ohne zweite Mail; 100.001 € je Stufe genau eine A09', async () => {
    await setEntry('2026-09', 'tattoo', 1_999_900)
    await run(NOW)
    expect(await mails(2026)).toEqual([])
    expect(await lastNotified()).toEqual({})

    await setEntry('2026-09', 'tattoo', 2_000_000)
    await run(NOW)
    await run('2026-10-14T09:00:00.000Z')
    expect(await mails(2026)).toEqual(['U1'])
    expect(await lastNotified()).toEqual({ '2026': ['U1'] })
    const sent = await db().execute(
      sql`SELECT status FROM email_log WHERE idempotency_key = 'admin_revenue_guard:2026:U1'`,
    )
    expect(sent.rows[0]?.status).toBe('sent')

    // Auftragsarbeiten zählen mit (R-125): 20.000 € + 80.000,01 € = 100.000,01 € → U2, U3, U3a, U4, U5
    await setEntry('2026-10', 'auftragsarbeiten', 8_000_001)
    await run(NOW)
    await run(NOW)
    expect(await mails(2026)).toEqual(['U1', 'U2', 'U3', 'U3a', 'U4', 'U5'])
    expect(await lastNotified()).toEqual({ '2026': ['U1', 'U2', 'U3', 'U3a', 'U4', 'U5'] })
  })

  it('AK-8-04 Neujahrslauf mit Vorjahr > 25.000 € → U0 einmal; zweiter Lauf ohne zweite Mail', async () => {
    await run(NEW_YEAR)
    await run('2027-01-01T07:00:00.000Z')
    expect(await mails(2027)).toEqual(['U0'])
    expect(await lastNotified()).toMatchObject({ '2027': ['U0'] })
    const status = await getRevenueStatus(payload, new Date(NEW_YEAR), { includeSeed: false })
    expect(status.previousYearTotalCents).toBe(10_000_001)
    expect(status.totalCents).toBe(0)
    expect(status.current).toBeNull()
  })

  it('AK-8-04 Beispielbelege (seed = true, Serie BSP-RE) zählen mit APP_ENV=production nie; echte Belege zählen', async () => {
    await resetGuard()
    await setEntry('2026-09', 'tattoo', 1_999_000)
    const sample = await invoiceFor(true)
    expect(sample.number).toMatch(/^BSP-RE-2026-/)

    const production = seedPreviewModeActive({
      ...getEnv(),
      APP_ENV: 'production',
      SEED_PREVIEW_MODE: true,
    })
    expect(production).toBe(false)
    const prod = await getRevenueStatus(payload, new Date(NOW), { includeSeed: production })
    expect(prod.shopCents).toBe(0)
    expect(prod.totalCents).toBe(1_999_000)
    const res = await runRevenueGuardCheck(payload, new Date(NOW), { includeSeed: production })
    expect(res.notified).toEqual([])
    expect(await mails(2026)).toEqual([])

    const preview = seedPreviewModeActive({
      ...getEnv(),
      APP_ENV: 'preview',
      SEED_PREVIEW_MODE: true,
    })
    const withSamples = await getRevenueStatus(payload, new Date(NOW), { includeSeed: preview })
    expect(withSamples.shopCents).toBe(sample.totalGrossCents)

    const real = await invoiceFor(false)
    expect(real.number).toMatch(/^RE-2026-/)
    const after = await getRevenueStatus(payload, new Date(NOW), { includeSeed: false })
    expect(after.shopCents).toBe(real.totalGrossCents)
    const oct = after.months.find((m) => m.month === '2026-10')!
    expect(oct.cents.shop).toBe(real.totalGrossCents)
  })

  it('R-125 Beleg- und Monatssummen-Änderung reihen genau einen offenen revenueGuardCheck ein', async () => {
    await payload.jobs.cancel({ where: { taskSlug: { equals: 'revenueGuardCheck' } } })
    expect(await openGuardJobs()).toBe(0)
    await setEntry('2026-08', 'flohmarkt', 12_000)
    expect(await openGuardJobs()).toBe(1)
    await setEntry('2026-08', 'flohmarkt', 13_000)
    await invoiceFor(false)
    expect(await openGuardJobs()).toBe(1)
    await payload.jobs.cancel({ where: { taskSlug: { equals: 'revenueGuardCheck' } } })
  })
})
