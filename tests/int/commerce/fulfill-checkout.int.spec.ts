import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startCheckout, type StartCheckoutResult } from '@/lib/commerce/checkout'
import { fulfillCheckout } from '@/lib/commerce/fulfillCheckout'
import { __setEmailAdapterForTests, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { ORDER_STATUSES } from '@/lib/enums'
import { jobAlarm } from '@/lib/jobs/alarm'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import type { MockPaymentsAdapter } from '@/lib/payments/mock'
import { processPaymentEvent } from '@/lib/payments/processPaymentEvent'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'
import type { Order } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import {
  cartOf,
  checkoutById,
  piece as makePiece,
  productRow,
  reservationsOf,
  submitForTest,
  testClock,
  useMemorySystemFiles,
  useMockPayments,
  type TestClock,
} from '../helpers/checkout'
import { dbOf, deleteCommerce } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { ensureLegalTextFixturesWithPdfs } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from '../helpers/products'

// P4.16a – Bestellabschluss `fulfillCheckout` (DATENMODELL §8.3, KONZEPT §4.10): Kasse `open`/`confirming`, abgelaufene
// Reservierung mit freiem Stück, Idempotenz (Kasse schon `completed`), Betragsabweichung, Rechnung/Mail genau einmal,
// M01 mit den drei Anhängen im Datei-Treiber (R-081), R-065 (keine Bestellung vor der bestätigten Zahlung).

let payload: Payload
let fx: ProductFixtures
let clock: TestClock
let mock: MockPaymentsAdapter
let legal: Record<string, number>
let restoreBusiness: () => Promise<void>
let outboxDir: string
let mailNr = 0
const NUMBERS = Array.from({ length: 10 }, (_, i) => 980 + i)
const T0 = '2026-10-06T10:00:00.000Z'

const now = () => clock.now()
const piece = (nr: number) => makePiece(payload, fx, nr)

type Ok = Extract<StartCheckoutResult, { ok: true }>

/** Kasse starten und absenden (wie nach „Zahlungspflichtig bestellen“). */
async function submitted(ids: number[], o: { confirming?: boolean; email?: string } = {}) {
  const r = await startCheckout(
    { cart: cartOf(ids.map((id) => ({ id }))), locale: 'de', existingToken: null, now: now() },
    { payload },
  )
  if (!r.ok) throw new Error(`Kassenstart abgelehnt: ${JSON.stringify(r)}`)
  const email = o.email ?? `kundin${++mailNr}@planetclaire.local`
  const checkout = await submitForTest(payload, r.checkoutId, {
    now: now(),
    confirming: o.confirming ?? true,
    legal,
    email,
  })
  return { r: r as Ok, checkout, email, session: checkout.stripe!.checkoutSessionId! }
}

/** Mock-Ereignis „bezahlt“ erzeugen und wie der Webhook verarbeiten. */
async function paid(session: string) {
  const emission = await mock.emit(session, 'checkout.session.completed')
  return processPaymentEvent(emission.event, { payload, payments: mock, now: now() })
}

/** Zeilen zählen; Mail-Zeilen früherer Tests verlieren beim Aufräumen ihren Bestellbezug (`order_id` → NULL). */
async function count(table: string, where = sql`true`): Promise<number> {
  const r = await dbOf(payload).execute(
    sql`SELECT count(*)::int AS n FROM ${sql.raw(`"${table}"`)} WHERE ${where}`,
  )
  return Number(r.rows[0]?.n ?? 0)
}

async function orderOf(checkoutId: number): Promise<Order> {
  const c = await checkoutById(payload, checkoutId)
  return (await payload.findByID({
    collection: 'orders',
    id: c.order as number,
    depth: 0,
    overrideAccess: true,
  })) as Order
}

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
  legal = await ensureLegalTextFixturesWithPdfs(payload)
  restoreBusiness = await withBusiness(payload)
  outboxDir = await mkdtemp(path.join(tmpdir(), 'pc-fulfill-'))
  __setEmailAdapterForTests(
    createEmailAdapter(
      parseEnv({ ...process.env, EMAIL_DRIVER: 'file', EMAIL_FILE_DIR: outboxDir }),
    ),
  )
})

beforeEach(async () => {
  clock = testClock(T0)
  mock = useMockPayments(clock)
  useMemorySystemFiles()
  await jobAlarm.markFullRun(new Date(T0), null)
})

afterEach(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
})

afterAll(async () => {
  await restoreBusiness()
  __setEmailAdapterForTests(undefined)
  __setPaymentsAdapterForTests(undefined)
  __setSystemFilesForTests(undefined)
})

describe('fulfillCheckout (DATENMODELL §8.3)', () => {
  it('R-065 vor der bestätigten Zahlung keine Bestellung; danach genau eine Bestellung paid mit placedAt = submittedAt und genau eine M01', async () => {
    const a = await piece(980)
    const { r, checkout, email } = await submitted([a])
    expect(await count('orders')).toBe(0)
    expect(
      await count('email_log', sql`template = 'order_confirmation' AND order_id IS NOT NULL`),
    ).toBe(0)

    const result = await paid(checkout.stripe!.checkoutSessionId!)
    expect(result).toMatchObject({ status: 'processed', action: 'fulfilled' })
    const order = await orderOf(r.checkoutId)
    expect(order.status).toBe('paid')
    expect(order.timestamps.placedAt).toBe(checkout.submittedAt)
    expect(order.paymentProvider).toBe('mock')
    expect(order.paymentMethod).toBe('card')
    expect(order.stripe).toMatchObject({
      checkoutSessionId: checkout.stripe!.checkoutSessionId,
      paymentMethodType: 'card',
      amountReceivedCents: order.totalCents,
      livemode: false,
    })
    expect(order.stripe?.paymentIntentId).toMatch(/^pi_mock_/)
    expect(order.stripe?.chargeId).toMatch(/^ch_mock_/)
    expect(order.adminAttention?.flag).toBeFalsy()

    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('completed')
    expect(c.timestamps?.completedAt).toBeTruthy()
    const p = await dbOf(payload).execute(
      sql`SELECT status, sold_channel, current_order_id, reservation_ref FROM products WHERE id = ${a}`,
    )
    expect(p.rows[0]).toMatchObject({
      status: 'sold',
      sold_channel: 'online',
      current_order_id: order.id,
      reservation_ref: null,
    })
    expect((await reservationsOf(payload, a))[0]!.status).toBe('converted')
    expect(await count('invoices', sql`order_id = ${order.id}`)).toBe(1)
    expect(
      await count('email_log', sql`template = 'order_confirmation' AND order_id IS NOT NULL`),
    ).toBe(1)
    expect(
      await count('email_log', sql`template = 'admin_order_placed' AND order_id IS NOT NULL`),
    ).toBe(1)
    expect(await readOutbox({ to: email, type: 'order_confirmation' }, outboxDir)).toHaveLength(1)
  })

  it('Kasse open (ohne confirming) und Abholung → soldChannel pickup', async () => {
    const a = await piece(981)
    const r = await startCheckout(
      {
        cart: cartOf([{ id: a }], 'pickup'),
        locale: 'de',
        existingToken: null,
        now: now(),
      },
      { payload },
    )
    if (!r.ok) throw new Error('Start abgelehnt')
    const c = await submitForTest(payload, r.checkoutId, { now: now(), legal })
    expect(c.status).toBe('open')
    await paid(c.stripe!.checkoutSessionId!)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('completed')
    const p = await dbOf(payload).execute(sql`SELECT sold_channel FROM products WHERE id = ${a}`)
    expect(p.rows[0]!.sold_channel).toBe('pickup')
  })

  it('Reservierung abgelaufen, Stück aber noch available → trotzdem verkauft', async () => {
    const a = await piece(982)
    const { r, session } = await submitted([a])
    await dbOf(payload).execute(
      sql`UPDATE products SET status = 'available', reservation_ref = NULL, reserved_until = NULL WHERE id = ${a}`,
    )
    await dbOf(payload).execute(
      sql`UPDATE reservations SET status = 'released', release_reason = 'session_expired' WHERE ref = ${r.reservationRef}`,
    )
    await paid(session)
    expect((await productRow(payload, a)).status).toBe('sold')
    expect((await orderOf(r.checkoutId)).status).toBe('paid')
  })

  it('AK-4-11/DM-ORD-03 Kasse schon completed: zweites Ereignis derselben Session → keine zweite Bestellung, Rechnung, M01', async () => {
    const a = await piece(983)
    const { session } = await submitted([a])
    await paid(session)
    const again = await mock.emit(session, 'checkout.session.async_payment_succeeded')
    const second = await processPaymentEvent(again.event, { payload, payments: mock, now: now() })
    expect(second).toMatchObject({ status: 'processed', action: 'already_fulfilled' })
    expect(await count('orders')).toBe(1)
    expect(await count('invoices')).toBe(1)
    expect(
      await count('email_log', sql`template = 'order_confirmation' AND order_id IS NOT NULL`),
    ).toBe(1)
  })

  it('stripe.amountReceivedCents ≠ totalCents → adminAttention payment_amount_mismatch', async () => {
    const a = await piece(984)
    const { r, session } = await submitted([a])
    const state = await mock.emit(session, 'checkout.session.completed')
    const req = await createLocalReq({ context: { system: true } }, payload)
    const result = await fulfillCheckout(r.checkoutId, req, {
      now: now(),
      payment: {
        sessionId: session,
        provider: 'mock',
        paymentIntentId: String(state.event.data.paymentIntentId),
        paymentMethod: { type: 'card', wallet: 'apple_pay' },
        amountReceivedCents: 100,
        livemode: false,
        paidAt: now(),
      },
    })
    await result.afterCommit()
    const order = await orderOf(r.checkoutId)
    expect(order.adminAttention).toMatchObject({ flag: true, reason: 'payment_amount_mismatch' })
    expect(order.stripe?.paymentMethodType).toBe('apple_pay')
    expect(order.stripe?.amountReceivedCents).toBe(100)
  })

  it('PayPal über den Mock → paymentMethod paypal', async () => {
    const a = await piece(985)
    const { r, session } = await submitted([a])
    await mock.setNextOutcome(session, { paymentMethod: { type: 'paypal' } })
    await paid(session)
    const order = await orderOf(r.checkoutId)
    expect(order.paymentMethod).toBe('paypal')
    expect(order.stripe?.paymentMethodType).toBe('paypal')
  })
})

describe('R-081 Versandweg (AK-6-02)', () => {
  it('R-081 nach einer Mock-Zahlung genau eine M01 im Datei-Treiber mit Rechnung, AGB_v{n}.pdf und Widerrufsbelehrung-und-Formular_v{n}.pdf der Bestellfassung', async () => {
    const a = await piece(986)
    const { r, session, email } = await submitted([a])
    await paid(session)
    const order = await orderOf(r.checkoutId)
    const mails = await readOutbox({ to: email, type: 'order_confirmation' }, outboxDir)
    expect(mails).toHaveLength(1)
    const invoice = await payload.findByID({
      collection: 'invoices',
      id: order.invoice as number,
      depth: 0,
      overrideAccess: true,
    })
    const agb = await payload.findByID({ collection: 'legal-texts', id: legal.agb!, depth: 0 })
    const bel = await payload.findByID({
      collection: 'legal-texts',
      id: legal.widerrufsbelehrung!,
      depth: 0,
    })
    const pdfs = mails[0]!.attachments.filter((f) => f.contentType === 'application/pdf')
    expect(pdfs.map((f) => f.filename)).toEqual([
      `${invoice.number}.pdf`,
      `AGB_v${agb.version}.pdf`,
      `Widerrufsbelehrung-und-Formular_v${bel.version}.pdf`,
    ])
    expect(mails[0]!.subject).toBe(`Danke! Deine Bestellung ${order.orderNumber}`)
    expect(mails[0]!.text).toContain(`(AGB_v${agb.version}.pdf)`)
    const log = await payload.find({
      collection: 'email-log',
      where: { order: { equals: order.id }, template: { equals: 'order_confirmation' } },
      depth: 0,
      overrideAccess: true,
    })
    expect(log.docs).toHaveLength(1)
    expect(log.docs[0]).toMatchObject({ status: 'sent', templateVersion: 'm01-v1' })
    expect(log.docs[0]!.bodySha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('Statuswerte', () => {
  it('ORDER_STATUSES enthält genau die 13 Werte aus DATENMODELL §4', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'awaiting_prepayment',
      'paid',
      'packed',
      'shipped',
      'ready_for_pickup',
      'picked_up',
      'delivered',
      'cancelled',
      'withdrawal_received',
      'return_received',
      'refunded',
      'partially_refunded',
      'disputed',
    ])
  })
})
