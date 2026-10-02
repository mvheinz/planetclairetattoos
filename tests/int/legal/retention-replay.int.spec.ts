import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ANONYMIZED_EMAIL, runRetentionTask } from '@/lib/retention/jobs'
import { replayDeletionLog } from '@/lib/retention/replay'
import type { Order } from '@/payload-types'

import { checkoutData, createOrder, dbOf, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.15 – `retention:replay` (LOESCHKONZEPT §3.6, ARCHITEKTUR §10.5, DATENMODELL §6.27): nach dem Wiederherstellen
// eines älteren Stands werden die protokollierten IDs erneut gelöscht bzw. anonymisiert; ein zweiter Lauf ändert nichts
// (DM-DEL-02, AK-A-10-04).

const NOW = new Date('2033-02-01T10:00:00.000Z')
let payload: Payload
let item: { id: number; itemNumber: number }

type Row = Record<string, unknown>
const db = () => dbOf(payload)
const snapshot = async (table: string, id: number): Promise<Row> =>
  (await db().execute(sql.raw(`SELECT row_to_json(t) AS j FROM "${table}" t WHERE id = ${id}`)))
    .rows[0]!.j as Row
const restoreRow = (table: string, row: Row) =>
  db().execute(
    sql`INSERT INTO ${sql.raw(`"${table}"`)} SELECT * FROM json_populate_record(NULL::${sql.raw(`"${table}"`)}, ${JSON.stringify(row)}::json)`,
  )
const exists = async (table: string, id: number) =>
  (await db().execute(sql.raw(`SELECT 1 FROM "${table}" WHERE id = ${id}`))).rows.length > 0
const logCount = async () =>
  Number((await db().execute(sql`SELECT count(*)::int AS n FROM deletion_log`)).rows[0]!.n)

beforeAll(async () => {
  payload = await getTestPayload()
  await db().execute(sql`DELETE FROM email_log`)
  await db().execute(sql`DELETE FROM deletion_log`)
  await deleteCommerce(payload)
  await deleteProducts(payload, [988])
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 988, fx))
  item = { id: p.id as number, itemNumber: 988 }
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, [988])
})

describe('retention:replay (DM-DEL-02)', () => {
  it('AK-A-10-04 DM-DEL-02 nach Wiederherstellen eines älteren Stands werden protokollierte IDs erneut gelöscht/anonymisiert; zweiter Lauf ändert nichts', async () => {
    // Ausgangsstand: Widerruf, Bestellung und Kasse mit abgelaufenen Fristen
    const w = await payload.create({
      collection: 'withdrawals',
      data: {
        reference: 'WR-2026-00881',
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
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const o = (await createOrder(
      payload,
      orderData(881, [item], {
        status: 'delivered',
        customer: { name: 'Erika Beispiel', email: 'erika@planetclaire.local' },
        timestamps: {
          placedAt: '2026-05-01T10:00:00.000Z',
          finalStatusAt: '2026-05-20T10:00:00.000Z',
        },
        retainUntil: '2032-12-31T23:00:00.000Z',
      }),
      { seed: true },
    )) as Order
    const { data } = checkoutData([item])
    const c = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    await db().execute(
      sql`UPDATE checkouts SET created_at = '2032-01-01T00:00:00Z'::timestamptz WHERE id = ${c.id}`,
    )

    // Backup „vor der Löschung“
    const wRow = await snapshot('withdrawals', w.id as number)
    const oRow = await snapshot('orders', o.id)
    const cRow = await snapshot('checkouts', c.id as number)

    // Löschjobs laufen
    for (const task of [
      'retentionWithdrawals',
      'retentionOrders',
      'retentionAbandonedCheckouts',
    ] as const) {
      await runRetentionTask(payload, task, { now: NOW })
    }
    expect(await exists('withdrawals', w.id as number)).toBe(false)
    expect(await exists('checkouts', c.id as number)).toBe(false)
    expect((await snapshot('orders', o.id)).customer_email).toBe(ANONYMIZED_EMAIL)

    // Wiederherstellung des älteren Stands (Datensätze wieder da, Löschprotokoll bleibt)
    await restoreRow('withdrawals', wRow)
    await restoreRow('checkouts', cRow)
    await db().execute(sql`
      UPDATE orders o SET customer_name = s.customer_name, customer_email = s.customer_email,
             shipping_address_name = s.shipping_address_name,
             shipping_address_address_line1 = s.shipping_address_address_line1,
             privacy_anonymized_at = NULL
        FROM json_populate_record(NULL::orders, ${JSON.stringify(oRow)}::json) s WHERE o.id = s.id`)
    expect(await exists('withdrawals', w.id as number)).toBe(true)
    expect((await snapshot('orders', o.id)).customer_email).toBe('erika@planetclaire.local')

    const first = await replayDeletionLog(payload, { now: NOW })
    expect(first.failed).toBe(0)
    expect(first.reapplied).toBe(3)
    expect(await exists('withdrawals', w.id as number)).toBe(false)
    expect(await exists('checkouts', c.id as number)).toBe(false)
    const anon = await snapshot('orders', o.id)
    expect(anon).toMatchObject({ customer_email: ANONYMIZED_EMAIL, customer_name: null })
    expect(anon.privacy_anonymized_at).not.toBeNull()

    // zweiter Lauf ändert nichts
    const logs = await logCount()
    const second = await replayDeletionLog(payload, { now: NOW })
    expect(second).toMatchObject({ reapplied: 0, failed: 0 })
    expect(Object.values(second.jobs).every((n) => n === 0)).toBe(true)
    expect(await logCount()).toBe(logs)
  })
})
