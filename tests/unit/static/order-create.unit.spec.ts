import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkOrderCreates,
  findOrderCreates,
  isOrderCreateAllowed,
  orderCreateInput,
} from '../../../scripts/lib/static-checks/order-create'

// P4.1: Bestellungen entstehen nur in createOrderFromCheckout() (und im Seed) – Regel `order-create` in check:static.

const ROOT = path.resolve(import.meta.dirname, '../../..')

describe('Statischer Scan: Bestellanlage nur über createOrderFromCheckout (P4.1)', () => {
  it('der aktuelle Quellbaum hält die Regel ein; die erlaubte Stelle legt tatsächlich an', () => {
    const files = orderCreateInput(ROOT)
    expect(files.length).toBeGreaterThan(100)
    expect(checkOrderCreates(files).errors).toEqual([])
    const service = files.find((f) => f.path === 'src/lib/commerce/createOrderFromCheckout.ts')
    expect(service, 'createOrderFromCheckout.ts fehlt').toBeDefined()
    expect(findOrderCreates(service!.source).length).toBe(1)
  })

  it('erlaubt sind nur createOrderFromCheckout.ts und der Seed', () => {
    expect(isOrderCreateAllowed('src/lib/commerce/createOrderFromCheckout.ts')).toBe(true)
    expect(isOrderCreateAllowed('src/lib/seed/example.ts')).toBe(true)
    for (const p of [
      'src/lib/commerce/fulfillCheckout.ts',
      'src/lib/commerce/checkout.ts',
      'src/endpoints/orders/markPaid.ts',
      'src/app/(frontend)/[locale]/checkout/actions.ts',
      'scripts/import-orders.ts',
    ]) {
      expect(isOrderCreateAllowed(p), p).toBe(false)
    }
  })

  it('erkennt Local API (auch mehrzeilig, db.create, andere Anführungszeichen) und SQL-Inserts', () => {
    const bad = (source: string) => [{ path: 'src/lib/commerce/fulfillCheckout.ts', source }]
    for (const source of [
      "await payload.create({ collection: 'orders', data })",
      'await req.payload.create({\n  data: { status: "paid" },\n  collection: "orders",\n  req,\n})',
      'await payload.db.create({ collection: `orders`, data, req })',
      "await db.execute(sql`INSERT INTO orders (order_number) VALUES ('x')`)",
      'await db.execute(sql`insert into "public"."orders" ("status") values (1)`)',
      'await tx.insert(orders).values(row)',
    ]) {
      expect(checkOrderCreates(bad(source)).errors, source).toHaveLength(1)
    }
    const res = checkOrderCreates(
      bad("const a = 1\n\nawait payload.create({ collection: 'orders' })"),
    )
    expect(res.errors[0]).toMatch(/fulfillCheckout\.ts:3: .*createOrderFromCheckout/)
  })

  it('lesen, ändern, andere Collections und Kommentare zählen nicht', () => {
    for (const source of [
      "await payload.find({ collection: 'orders', where })",
      "await payload.update({ collection: 'orders', id, data })",
      "await payload.create({ collection: 'checkouts', data })",
      "await payload.create({ collection: 'audit-log', data: { entityCollection: 'orders' } })",
      "// payload.create({ collection: 'orders' })",
      '/* INSERT INTO orders */ const x = 1',
      'await db.execute(sql`INSERT INTO orders_items (id) VALUES (1)`)',
      'await db.execute(sql`INSERT INTO "orders_rels" (id) VALUES (1)`)',
    ]) {
      expect(findOrderCreates(source), source).toEqual([])
    }
  })

  it('der Seed darf Bestellungen anlegen', () => {
    const res = checkOrderCreates([
      {
        path: 'src/lib/seed/orders.ts',
        source: "await req.payload.create({ collection: 'orders' })",
      },
    ])
    expect(res.errors).toEqual([])
  })
})
