import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { transitionProduct } from '@/lib/commerce/productTransitions'

import { systemReq } from './admin'
import { checkoutData, createOrder, dbOf, orderData } from './commerce'

// Vorkasse-reserviertes Stück wie S14/O13 (PLAN P5.8): Kasse → Reservierung `prepayment` → P4 → Bestellung
// `awaiting_prepayment` → P6 (`currentOrder`, `reservedUntil = dueAt`). Für Int- und E2E-Tests; `removePrepayment`
// räumt genau diese Datensätze wieder weg (echte Bestellungen sind sonst unlöschbar).

export interface PrepaymentFixture {
  checkoutId: number
  orderId: number
  orderNumber: string
  reservationRef: string
  dueAt: Date
}

export async function prepaymentReserved(
  payload: Payload,
  product: { id: number; itemNumber: number },
  orderNo: number,
  { seed = false, now = new Date() }: { seed?: boolean; now?: Date } = {},
): Promise<PrepaymentFixture> {
  const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString()
  const dueAt = new Date(now.getTime() + 7 * 86_400_000)
  const { data } = checkoutData([product], {
    expiresAt,
    displayExpiresAt: expiresAt,
    ...(seed ? { seed: true } : {}),
  })
  const ref = data.reservationRef as string
  const checkout = await payload.create({
    collection: 'checkouts',
    data: data as never,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'reservations',
    data: {
      ref,
      checkout: checkout.id,
      product: product.id,
      source: 'prepayment',
      expiresAt,
    } as never,
    overrideAccess: true,
  })
  const sys = await systemReq(payload)
  await transitionProduct(sys, product.id, 'reserve', {
    reservationRef: ref,
    reservedUntil: expiresAt,
  })
  const order = await createOrder(
    payload,
    orderData(orderNo, [product], {
      status: 'awaiting_prepayment',
      paymentMethod: 'prepayment',
      paymentProvider: 'bank_transfer',
      prepayment: {
        dueAt: dueAt.toISOString(),
        reminderDueAt: new Date(now.getTime() + 5 * 86_400_000).toISOString(),
      },
      timestamps: { placedAt: now.toISOString() },
      ...(seed ? { seed: true } : {}),
    }),
    { system: true, transition: 'O2' },
  )
  await transitionProduct(await systemReq(payload), product.id, 'convertToPrepayment', {
    reservationRef: ref,
    reservedUntil: dueAt.toISOString(),
    orderId: order.id as number,
  })
  return {
    checkoutId: checkout.id as number,
    orderId: order.id as number,
    orderNumber: order.orderNumber as string,
    reservationRef: ref,
    dueAt,
  }
}

/** Entfernt Bestellung, Reservierung und Kasse der Vorkasse-Fixture. */
export async function removePrepayment(payload: Payload, fx: PrepaymentFixture): Promise<void> {
  const db = dbOf(payload)
  await db.execute(
    sql`UPDATE products SET current_order_id = NULL WHERE current_order_id = ${fx.orderId}`,
  )
  await db.execute(sql`DELETE FROM reservations WHERE ref = ${fx.reservationRef}`)
  await db.execute(sql`DELETE FROM email_log WHERE order_id = ${fx.orderId}`)
  await db.execute(sql`UPDATE orders SET invoice_id = NULL WHERE id = ${fx.orderId}`)
  await payload.delete({
    collection: 'orders',
    id: fx.orderId,
    overrideAccess: true,
    context: { seed: true },
  })
  await db.execute(sql`DELETE FROM checkouts WHERE id = ${fx.checkoutId}`)
}
