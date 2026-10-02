import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'

import { startCheckout } from '../../../src/lib/commerce/checkout'
import {
  createOrderFromCheckout,
  type CreateOrderTransition,
} from '../../../src/lib/commerce/createOrderFromCheckout'
import { transitionOrder } from '../../../src/lib/commerce/transitionOrder'
import type { OrderStatus } from '../../../src/lib/enums'
import { getPaymentsAdapter } from '../../../src/lib/payments'
import { isMockPaymentsAdapter, type MockPaymentsAdapter } from '../../../src/lib/payments/mock'
import {
  FORBIDDEN_CONTENT_PATTERNS,
  FORBIDDEN_SOURCE_PATTERNS,
} from '../../helpers/forbiddenPatterns'
import { cartOf, checkoutById, submitForTest } from '../../int/helpers/checkout'
import { dbOf } from '../../int/helpers/commerce'
import { ensureLegalTextFixturesWithPdfs } from '../../int/helpers/legal'
import type { Order } from '../../../src/payload-types'

// Fixtures für Danke-Seite (P4.17) und Bestellstatus (P4.23) bis zum Beispielbestand in P8: Kassen über
// `startCheckout` + Absenden (P4.10a-Ersatz `submitForTest`), Bestellungen über `createOrderFromCheckout` (O1, O2, O19),
// Folgestatus per `transitionOrder()`. Status-Token aus `createToken()` (Rückgabe von `createOrderFromCheckout`).
// Stücke aus dem Fixture-Block 980–999; `seed = true` zeigt „Beispiel“. Aufräumen je Test (`cleanup`).

export function mockPayments(): MockPaymentsAdapter {
  const adapter = getPaymentsAdapter()
  if (!isMockPaymentsAdapter(adapter)) throw new Error('E2E braucht PAYMENTS_DRIVER=mock.')
  return adapter
}

export interface FixtureCheckout {
  checkoutId: number
  token: string
  session: string | null
}

export async function submittedCheckout(
  payload: Payload,
  productIds: number[],
  o: {
    locale?: 'de' | 'en'
    seed?: boolean
    confirming?: boolean
    delivery?: 'shipping' | 'pickup'
  } = {},
): Promise<FixtureCheckout> {
  const now = new Date()
  const r = await startCheckout(
    {
      cart: cartOf(
        productIds.map((id) => ({ id })),
        o.delivery ?? 'shipping',
      ),
      locale: o.locale ?? 'de',
      existingToken: null,
      now,
    },
    { payload },
  )
  if (!r.ok) throw new Error(`Kassenstart abgelehnt: ${r.code}`)
  const legal = await ensureLegalTextFixturesWithPdfs(payload)
  const checkout = await submitForTest(payload, r.checkoutId, {
    now,
    confirming: o.confirming ?? false,
    legal,
    email: 'erika.beispiel@example.com',
  })
  if (o.seed)
    await dbOf(payload).execute(sql`UPDATE checkouts SET seed = true WHERE id = ${r.checkoutId}`)
  return {
    checkoutId: r.checkoutId,
    token: r.token,
    session: checkout.stripe?.checkoutSessionId ?? null,
  }
}

export async function fixtureOrder(
  payload: Payload,
  checkoutId: number,
  transition: CreateOrderTransition,
  then: { to: OrderStatus; data?: Record<string, unknown> }[] = [],
): Promise<{ order: Order; statusToken: string }> {
  const now = new Date()
  const req = await createLocalReq({ context: { system: true } }, payload)
  const created = await createOrderFromCheckout(req, checkoutId, {
    transition,
    now,
    ...(transition === 'O2'
      ? {}
      : { payment: { method: 'card', provider: 'mock', paidAt: now } as const }),
  })
  if (transition === 'O19') {
    const items = created.order.items.map((i) => ({
      ...i,
      status: 'refunded',
      refundedCents: i.priceCents,
    }))
    await payload.update({
      collection: 'orders',
      id: created.order.id,
      data: {
        items,
        refunds: [
          {
            amountCents: created.order.totalCents,
            reason: 'item_unavailable',
            itemIds: created.order.items.map((i) => i.id),
            includesShipping: true,
            status: 'succeeded',
            createdAt: now.toISOString(),
          },
        ],
      } as never,
      overrideAccess: true,
      context: { system: true, now: now.toISOString() },
    })
  }
  for (const step of then) {
    const r = await createLocalReq({ context: { system: true } }, payload)
    await transitionOrder(r, created.order.id, step.to, { now: new Date(), data: step.data })
  }
  const order = (await payload.findByID({
    collection: 'orders',
    id: created.order.id,
    depth: 0,
    overrideAccess: true,
  })) as Order
  return { order, statusToken: created.statusToken }
}

/** Entfernt Bestellungen, Belege, Mails, Reservierungen und Kassen der Fixtures (echte Daten bleiben unberührt). */
export async function cleanup(payload: Payload, checkoutIds: number[]): Promise<void> {
  const db = dbOf(payload)
  for (const checkoutId of checkoutIds) {
    const c = await checkoutById(payload, checkoutId).catch(() => null)
    const orderId = c?.order ? (typeof c.order === 'object' ? c.order.id : c.order) : null
    if (orderId) {
      await db.execute(
        sql`UPDATE products SET current_order_id = NULL WHERE current_order_id = ${orderId}`,
      )
      await db.execute(sql`UPDATE orders SET invoice_id = NULL WHERE id = ${orderId}`)
      await db.execute(
        sql.raw(`DO $$ BEGIN
          ALTER TABLE invoices DISABLE TRIGGER USER;
          DELETE FROM invoices WHERE order_id = ${Number(orderId)};
          ALTER TABLE invoices ENABLE TRIGGER USER;
        END $$`),
      )
      await db.execute(sql`DELETE FROM email_log WHERE order_id = ${orderId}`)
      await db.execute(sql`UPDATE checkouts SET order_id = NULL WHERE id = ${checkoutId}`)
      // Bestellungen sind über die API nicht löschbar (Aufbewahrung) – nur hier im Test direkt per SQL.
      await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}`)
    }
    await db.execute(sql`DELETE FROM reservations WHERE checkout_id = ${checkoutId}`)
    await db.execute(sql`DELETE FROM webhook_events WHERE related_checkout_id = ${checkoutId}`)
    await db.execute(sql`DELETE FROM checkouts WHERE id = ${checkoutId}`)
  }
}

/** Verbotsmuster im gerenderten HTML (wie `tests/e2e/legal/forbidden.e2e.spec.ts`). */
export function forbiddenFindings(html: string): string[] {
  const patterns = [
    ...FORBIDDEN_CONTENT_PATTERNS,
    ...FORBIDDEN_SOURCE_PATTERNS.filter((p) => ['V-05', 'V-06', 'V-07'].includes(p.id)),
    {
      id: 'V-03',
      re: /<input\b(?=[^>]*\btype="checkbox")(?=[^>]*\schecked(?:=""|\s|\/?>))[^>]*>/iu,
    },
  ]
  return patterns.flatMap(({ id, re }) =>
    [
      ...html.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)),
    ].map((m) => `${id} ${m[0]}`),
  )
}

export const TOKEN_HEADERS = {
  'referrer-policy': 'no-referrer',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
}
