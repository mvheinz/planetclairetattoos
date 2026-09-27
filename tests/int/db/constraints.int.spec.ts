import { randomUUID } from 'node:crypto'

import { createLocalReq, type Payload } from 'payload'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { formatSequenceNumber, nextSequenceNumber } from '@/lib/db/sequences'

import { checkoutData, createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P1.26: Postgres-Objekte greifen auch bei direktem SQL (DATENMODELL §9) – partielle UNIQUE-Indizes (DM-RES-03),
// GoBD-Trigger (DM-INV-03), CHECK-Constraints und die Nummernvergabe aus den Sequenzen (§8.7).

let payload: Payload
let client: pg.Client
let productId: number
let checkoutId: number
let orderId: number
let invoiceId: number

/** Führt `text` in einem Savepoint aus und liefert den Postgres-Fehler (oder null). */
async function sqlError(text: string, values: unknown[] = []) {
  await client.query('SAVEPOINT t')
  try {
    await client.query(text, values)
    await client.query('RELEASE SAVEPOINT t')
    return null
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT t')
    return e as { code?: string; constraint?: string; message: string }
  }
}

/** Jede Prüfung läuft in einer eigenen, am Ende zurückgerollten Transaktion. */
async function inTx(fn: () => Promise<void>) {
  await client.query('BEGIN')
  try {
    await fn()
  } finally {
    await client.query('ROLLBACK')
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload, [985])
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 985, fx))
  productId = p.id as number
  const item = { id: productId, itemNumber: 985 }
  const checkout = await payload.create({
    collection: 'checkouts',
    data: checkoutData([item]).data as never,
    overrideAccess: true,
    context: { system: true, now: '2026-09-27T10:00:00.000Z' },
  })
  checkoutId = checkout.id as number
  const order = await createOrder(payload, orderData(985, [item]))
  orderId = order.id as number
  const invoice = await payload.create({
    collection: 'invoices',
    data: {
      type: 'invoice',
      order: orderId,
      deliveryDate: '2026-09-27T10:00:00.000Z',
      totalGrossCents: 5390,
      data: { version: 1 },
    } as never,
    overrideAccess: true,
    context: { system: true, now: '2026-09-27T10:00:00.000Z' },
  })
  invoiceId = invoice.id as number
  client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST })
  await client.connect()
})

afterAll(async () => {
  await client.end()
  await deleteCommerce(payload)
  await deleteProducts(payload, [985])
})

describe('Partielle UNIQUE-Indizes (§9.3)', () => {
  it('DM-RES-03 ein zweites direktes INSERT einer aktiven Reservierung für dasselbe Produkt verletzt den Index', async () => {
    await inTx(async () => {
      const insert = (status: string) =>
        sqlError(
          `INSERT INTO reservations (ref, checkout_id, product_id, status, expires_at)
           VALUES ($1, $2, $3, $4, now() + interval '30 minutes')`,
          [randomUUID(), checkoutId, productId, status],
        )
      expect(await insert('active')).toBeNull()
      const err = await insert('active')
      expect(err?.code).toBe('23505')
      expect(err?.constraint).toBe('reservations_one_active_per_product')
      // freigegebene/umgewandelte Reservierungen desselben Produkts sind erlaubt
      expect(await insert('released')).toBeNull()
      expect(await insert('converted')).toBeNull()
    })
  })

  it('eine zweite Rechnung (nicht Gutschrift) zur selben Bestellung verletzt invoices_one_invoice_per_order', async () => {
    await inTx(async () => {
      const err = await sqlError(
        `INSERT INTO invoices (number, type, series, year, sequence_number, order_id, issue_date, delivery_date,
           tax_mode, total_gross_cents, total_net_cents, total_tax_cents, data, retain_until)
         SELECT 'RE-2026-99999', type, series, year, 99999, order_id, issue_date, delivery_date, tax_mode,
           total_gross_cents, total_net_cents, total_tax_cents, data, retain_until FROM invoices WHERE id = $1`,
        [invoiceId],
      )
      expect(err?.constraint).toBe('invoices_one_invoice_per_order')
    })
  })

  it('seed_key ist eindeutig, wenn gesetzt; mehrfach NULL ist erlaubt', async () => {
    await inTx(async () => {
      expect(
        await sqlError(`UPDATE products SET seed_key = 'SE-X' WHERE id = $1`, [productId]),
      ).toBeNull()
      // je Tabelle ein eigener Index: derselbe Schlüssel in einer anderen Tabelle ist erlaubt
      expect(
        await sqlError(`UPDATE checkouts SET seed_key = 'SE-X' WHERE id = $1`, [checkoutId]),
      ).toBeNull()
      const dup = await sqlError(
        `INSERT INTO revenue_entries (month, source, amount_cents, seed_key)
         VALUES ('2026-01', 'sonstiges', 0, 'SE-DUP'), ('2026-02', 'sonstiges', 0, 'SE-DUP')`,
      )
      expect(dup?.constraint).toBe('revenue_entries_seed_key_unique')
    })
  })
})

describe('GoBD-Trigger invoices_guard (§9.4)', () => {
  it('DM-INV-03 UPDATE total_gross_cents und DELETE per SQL schlagen fehl; updated_at darf sich ändern', async () => {
    await inTx(async () => {
      const upd = await sqlError(`UPDATE invoices SET total_gross_cents = 1 WHERE id = $1`, [
        invoiceId,
      ])
      expect(upd?.message).toMatch(/GoBD: Beleg RE-\d{4}-\d{5} ist unveränderbar/)
      const del = await sqlError(`DELETE FROM invoices WHERE id = $1`, [invoiceId])
      expect(del?.message).toMatch(/darf nicht gelöscht werden/)
      for (const set of [
        `number = 'RE-2026-77777'`,
        `issue_date = issue_date + interval '1 day'`,
        `retain_until = retain_until - interval '1 year'`,
        `data = '{"version":2}'::jsonb`,
        `seed = true`,
      ]) {
        expect(
          (await sqlError(`UPDATE invoices SET ${set} WHERE id = $1`, [invoiceId]))?.message,
          set,
        ).toMatch(/GoBD/)
      }
      expect(
        await sqlError(`UPDATE invoices SET updated_at = now() WHERE id = $1`, [invoiceId]),
      ).toBeNull()
    })
  })

  it('DM-INV-03 PDF nur einmal festschreiben; Anonymisierung nur mit pc.now nach retain_until', async () => {
    await inTx(async () => {
      // pending_pdf → issued mit PDF ist erlaubt (renderInvoicePdf, P4.11)
      expect(
        await sqlError(
          `UPDATE invoices SET status = 'issued', sha256 = $2, rendered_at = now() WHERE id = $1`,
          [invoiceId, 'a'.repeat(64)],
        ),
      ).toBeNull()
      expect(
        (
          await sqlError(`UPDATE invoices SET sha256 = $2 WHERE id = $1`, [
            invoiceId,
            'b'.repeat(64),
          ])
        )?.message,
      ).toMatch(/festgeschrieben/)
      // ohne injizierte Zeit bzw. vor Fristende: verboten
      const anonymize = `UPDATE invoices SET anonymized_at = now(), data = '{"version":1,"anonymized":true}'::jsonb WHERE id = $1`
      expect((await sqlError(anonymize, [invoiceId]))?.message).toMatch(/aufzubewahren/)
      await client.query(`SELECT set_config('pc.now', '2030-06-01T00:00:00Z', true)`)
      expect((await sqlError(anonymize, [invoiceId]))?.message).toMatch(/aufzubewahren/)
      // nach Fristende (01.01.2037 Berlin) erlaubt – danach unveränderbar
      await client.query(`SELECT set_config('pc.now', '2037-01-02T00:00:00Z', true)`)
      expect(await sqlError(anonymize, [invoiceId])).toBeNull()
      expect(
        (await sqlError(`UPDATE invoices SET updated_at = now() WHERE id = $1`, [invoiceId]))
          ?.message,
      ).toMatch(/anonymisiert/)
    })
  })

  it('DM-INV-03 Beispielbelege (seed) dürfen gelöscht werden', async () => {
    await inTx(async () => {
      await client.query(`ALTER TABLE invoices DISABLE TRIGGER invoices_guard`)
      await client.query(`UPDATE invoices SET seed = true WHERE id = $1`, [invoiceId])
      await client.query(`ALTER TABLE invoices ENABLE TRIGGER invoices_guard`)
      expect(await sqlError(`DELETE FROM invoices WHERE id = $1`, [invoiceId])).toBeNull()
    })
  })
})

describe('CHECK-Constraints (§9.2)', () => {
  const cases: [name: string, sql: string, constraint: string][] = [
    [
      'Stücknummer > 99999',
      `UPDATE products SET item_number = 100000 WHERE id = $1`,
      'products_item_number_int',
    ],
    [
      'Stücknummer 0',
      `UPDATE products SET item_number = 0 WHERE id = $1`,
      'products_item_number_int',
    ],
    [
      'Preis < 1 €',
      `UPDATE products SET price_cents = 99 WHERE id = $1`,
      'products_price_positive',
    ],
    [
      'Preis mit Bruchteil',
      `UPDATE products SET price_cents = 1000.5 WHERE id = $1`,
      'products_price_positive',
    ],
    [
      'reserviert ohne Frist',
      `UPDATE products SET status = 'reserved' WHERE id = $1`,
      'products_reserved_consistent',
    ],
    [
      'verkauft ohne Kanal',
      `UPDATE products SET status = 'sold' WHERE id = $1`,
      'products_sold_consistent',
    ],
    [
      'Auftragsarbeit als Stück',
      `UPDATE products SET is_custom_commission = true WHERE id = $1`,
      'products_no_commission',
    ],
  ]
  for (const [name, sql, constraint] of cases) {
    it(`products: ${name} → ${constraint}`, async () => {
      await inTx(async () => {
        expect((await sqlError(sql, [productId]))?.constraint).toBe(constraint)
      })
    })
  }

  it('Summen von Bestellung und Kasse; Storno mit Grund; Cent ganzzahlig und ≥ 0', async () => {
    await inTx(async () => {
      expect(
        (await sqlError(`UPDATE orders SET total_cents = total_cents + 1 WHERE id = $1`, [orderId]))
          ?.constraint,
      ).toBe('orders_totals_consistent')
      expect(
        (
          await sqlError(
            `UPDATE orders SET status = 'cancelled', cancel_reason = NULL WHERE id = $1`,
            [orderId],
          )
        )?.constraint,
      ).toBe('orders_cancel_reason')
      expect(
        (
          await sqlError(`UPDATE checkouts SET shipping_cents = shipping_cents + 1 WHERE id = $1`, [
            checkoutId,
          ])
        )?.constraint,
      ).toBe('checkouts_totals_consistent')
      expect(
        (await sqlError(`UPDATE orders SET stripe_fee_cents = -1 WHERE id = $1`, [orderId]))
          ?.constraint,
      ).toBe('orders_stripe_fee_cents_ck')
      expect(
        (
          await sqlError(`UPDATE orders_items SET refunded_cents = 0.5 WHERE _parent_id = $1`, [
            orderId,
          ])
        )?.constraint,
      ).toBe('orders_items_refunded_cents_ck')
      expect((await sqlError(`UPDATE invoice_counters SET last_number = -1`))?.constraint).toBe(
        'invoice_counters_non_negative',
      )
      expect(
        (
          await sqlError(
            `INSERT INTO revenue_entries (month, source, amount_cents) VALUES ('2026-03', 'sonstiges', -5)`,
          )
        )?.code,
      ).toBe('23514')
    })
  })
})

describe('Nummern aus Sequenzen (§8.7)', () => {
  it('Format je Art, Jahr in Europe/Berlin, keine Kürzung über die Mindeststellen hinaus', () => {
    const silvester = new Date('2026-12-31T23:30:00.000Z') // Berlin: 01.01.2027
    expect(formatSequenceNumber('order', 42, silvester)).toBe('PC-2027-00042')
    expect(formatSequenceNumber('withdrawal', 7, silvester)).toBe('WR-2027-00007')
    expect(formatSequenceNumber('inquiry', 7, silvester)).toBe('AA-2027-0007')
    expect(formatSequenceNumber('privacyRequest', 12345, silvester)).toBe('DS-2027-12345')
  })

  it('20 parallele Ziehungen liefern verschiedene, fortlaufende Werte', async () => {
    const req = await createLocalReq({}, payload)
    const at = new Date('2026-10-01T10:00:00.000Z')
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => nextSequenceNumber(req, 'inquiry', at)),
    )
    expect(new Set(numbers).size).toBe(20)
    for (const n of numbers) expect(n).toMatch(/^AA-2026-\d{4,}$/)
    const values = numbers.map((n) => Number(n.split('-')[2])).sort((a, b) => a - b)
    expect(values[19]! - values[0]!).toBe(19)
  })
})
