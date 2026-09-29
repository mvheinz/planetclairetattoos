import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import Stripe from 'stripe'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { POST } from '@/app/(api)/api/stripe/webhook/route'
import { transitionCheckout } from '@/lib/commerce/checkoutTransitions'
import { createOrderFromCheckout } from '@/lib/commerce/createOrderFromCheckout'
import { startCheckout, type StartCheckoutResult } from '@/lib/commerce/checkout'
import { jobAlarm } from '@/lib/jobs/alarm'
import { __setPaymentsAdapterForTests, type PaymentsAdapter } from '@/lib/payments'
import { stripeEventTemplate } from '@/lib/payments/fixtures'
import type { MockPaymentsAdapter } from '@/lib/payments/mock'
import type { StripeEventType } from '@/lib/payments/normalize'
import {
  getPaidCheckoutHandler,
  setPaidCheckoutHandler,
  type PaidCheckoutHandler,
} from '@/lib/payments/processPaymentEvent'
import { createStripeAdapter } from '@/lib/payments/stripe'
import { handleWebhookRequest } from '@/lib/payments/webhook'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'

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
  webhookRow,
  type TestClock,
} from '../helpers/checkout'
import { dbOf, deleteCommerce } from '../helpers/commerce'
import { ensureLegalTextFixtures } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from '../helpers/products'

// P4.16 – Webhook-Route und Ereignisverarbeitung (DATENMODELL §8.8, KONZEPT §4.10/§4.11, T-02-Teil, R-065): signierte
// Fixtures je Treiber (Stripe: `generateTestHeaderString` mit `whsec_test_local`; Mock: HMAC), Idempotenz, Fehler und
// Wiederholung, Freigabe nur der Kassen-Reservierungen dieser Session.

let payload: Payload
let fx: ProductFixtures
let clock: TestClock
let mock: MockPaymentsAdapter
let legal: Record<string, number>
const NUMBERS = Array.from({ length: 12 }, (_, i) => 980 + i)
const T0 = '2026-10-05T10:00:00.000Z'
const WHSEC = 'whsec_test_local'

const piece = (nr: number) => makePiece(payload, fx, nr)
const now = () => clock.now()

function stripeAdapter(): PaymentsAdapter {
  return createStripeAdapter(
    { STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: WHSEC },
    { clock },
  )
}
const signer = new Stripe('sk_test_local')

/** Stripe-förmiges, mit `whsec_test_local` signiertes Ereignis aus den Fixtures (Kasse/Session eingesetzt). */
function stripeSigned(
  type: StripeEventType | 'customer.created',
  session: { id: string; ref: string; status?: string; paymentStatus?: string; amount?: number },
): { rawBody: string; headers: Headers; eventId: string } {
  const eventId = `evt_test_${randomUUID().replace(/-/g, '')}`
  const created = Math.floor(now().getTime() / 1000)
  const body =
    type === 'customer.created'
      ? {
          id: eventId,
          object: 'event',
          api_version: '2026-08-26.dahlia',
          created,
          livemode: false,
          type,
          data: { object: { id: 'cus_test_1', object: 'customer' } },
        }
      : (() => {
          const e = stripeEventTemplate(type)
          const o = e.data.object
          Object.assign(o, {
            id: session.id,
            client_reference_id: session.ref,
            metadata: { appEnv: 'test', checkoutRef: session.ref },
            ...(session.status ? { status: session.status } : {}),
            ...(session.paymentStatus ? { payment_status: session.paymentStatus } : {}),
            ...(session.amount ? { amount_total: session.amount } : {}),
          })
          return { ...e, id: eventId, created }
        })()
  const rawBody = JSON.stringify(body)
  const header = signer.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret: WHSEC,
    timestamp: created,
  })
  return {
    rawBody,
    eventId,
    headers: new Headers({ 'content-type': 'application/json', 'stripe-signature': header }),
  }
}

type Ok = Extract<StartCheckoutResult, { ok: true }>
async function started(ids: number[]): Promise<Ok> {
  const r = await startCheckout(
    { cart: cartOf(ids.map((id) => ({ id }))), locale: 'de', existingToken: null, now: now() },
    { payload },
  )
  if (!r.ok) throw new Error(`Kassenstart abgelehnt: ${JSON.stringify(r)}`)
  return r
}

async function sessionOf(checkoutId: number): Promise<string> {
  return (await checkoutById(payload, checkoutId)).stripe!.checkoutSessionId!
}

const deliver = (
  rawBody: string,
  headers: Headers,
  payments: PaymentsAdapter = mock,
): Promise<Response> => handleWebhookRequest(rawBody, headers, { payload, payments, now: now() })

async function orderCount(): Promise<number> {
  const r = await dbOf(payload).execute(sql`SELECT count(*)::int AS n FROM orders`)
  return Number(r.rows[0]?.n ?? 0)
}
async function mailCount(template: string): Promise<number> {
  const r = await dbOf(payload).execute(
    sql`SELECT count(*)::int AS n FROM email_log WHERE template = ${template}`,
  )
  return Number(r.rows[0]?.n ?? 0)
}

let originalHandler: PaidCheckoutHandler

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
  legal = await ensureLegalTextFixtures(payload)
  originalHandler = getPaidCheckoutHandler()
})

beforeEach(async () => {
  clock = testClock(T0)
  mock = useMockPayments(clock)
  useMemorySystemFiles()
  await jobAlarm.markFullRun(new Date(T0), null)
})

afterEach(async () => {
  setPaidCheckoutHandler(originalHandler)
  await dbOf(payload).execute(sql`DELETE FROM email_log WHERE template = 'admin_alert'`)
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
})

afterAll(() => {
  __setPaymentsAdapterForTests(undefined)
  __setSystemFilesForTests(undefined)
})

describe('Signaturen je Treiber (T-02)', () => {
  it('Mock: gültige HMAC-Signatur → 200; falsche Signatur → 400 (auch über die Route)', async () => {
    const a = await piece(980)
    const r = await started([a])
    const emission = await mock.emit(await sessionOf(r.checkoutId), 'checkout.session.expired')
    const bad = new Headers(emission.headers)
    bad.set('x-pc-mock-signature', '0'.repeat(64))
    expect((await deliver(emission.rawBody, bad)).status).toBe(400)
    expect(await webhookRow(payload, emission.event.id)).toBeUndefined()

    // Route: Rohkörper per req.text(), aktiver Treiber (Mock) – falsche Signatur → 400
    const viaRoute = await POST(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: emission.rawBody,
        headers: bad,
      }),
    )
    expect(viaRoute.status).toBe(400)

    const ok = await deliver(emission.rawBody, emission.headers)
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ received: true, status: 'processed' })
  })

  it('Stripe: generateTestHeaderString mit whsec_test_local → 200; manipulierter Körper → 400', async () => {
    const a = await piece(981)
    const r = await started([a])
    const s = stripeSigned('checkout.session.expired', {
      id: await sessionOf(r.checkoutId),
      ref: r.reservationRef,
      status: 'expired',
      paymentStatus: 'unpaid',
    })
    const tampered = s.rawBody.replace('"expired"', '"open"')
    expect((await deliver(tampered, s.headers, stripeAdapter())).status).toBe(400)
    const res = await deliver(s.rawBody, s.headers, stripeAdapter())
    expect(res.status).toBe(200)
    expect(await webhookRow(payload, s.eventId)).toMatchObject({
      status: 'processed',
      provider: 'stripe',
      type: 'checkout.session.expired',
      related_checkout_id: r.checkoutId,
    })
  })

  it('unbekannter Typ → 200 ignored', async () => {
    const s = stripeSigned('customer.created', { id: 'cs_x', ref: randomUUID() })
    const res = await deliver(s.rawBody, s.headers, stripeAdapter())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, status: 'ignored' })
    expect((await webhookRow(payload, s.eventId))?.status).toBe('ignored')
  })
})

describe('Wirkung je Ereignis', () => {
  it('checkout.session.expired: Kasse expired (reservation_expired), Stück available, Reservierung session_expired', async () => {
    const a = await piece(982)
    const r = await started([a])
    const emission = await mock.emit(await sessionOf(r.checkoutId), 'checkout.session.expired')
    expect((await deliver(emission.rawBody, emission.headers)).status).toBe(200)
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('expired')
    expect(c.closeReason).toBe('reservation_expired')
    expect((await productRow(payload, a)).status).toBe('available')
    expect((await reservationsOf(payload, a))[0]).toMatchObject({
      status: 'released',
      release_reason: 'session_expired',
    })
  })

  it('R-065 async_payment_failed (Stripe-Fixture): keine Bestellung, keine M01, Kasse failed, Stück available', async () => {
    const a = await piece(983)
    const r = await started([a])
    await submitForTest(payload, r.checkoutId, { now: now(), confirming: true, legal })
    const s = stripeSigned('checkout.session.async_payment_failed', {
      id: await sessionOf(r.checkoutId),
      ref: r.reservationRef,
    })
    expect((await deliver(s.rawBody, s.headers, stripeAdapter())).status).toBe(200)
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('failed')
    expect(c.closeReason).toBe('payment_failed')
    expect((await productRow(payload, a)).status).toBe('available')
    expect((await reservationsOf(payload, a))[0]!.release_reason).toBe('payment_failed')
    expect(await orderCount()).toBe(0)
    expect(await mailCount('order_confirmation')).toBe(0)
  })

  it('Mock: completed mit unpaid → nur protokolliert; danach async_payment_failed → failed', async () => {
    const a = await piece(984)
    const r = await started([a])
    await submitForTest(payload, r.checkoutId, { now: now(), confirming: true, legal })
    const session = await sessionOf(r.checkoutId)
    await mock.setNextOutcome(session, { result: 'delayed' })
    const completed = await mock.emit(session, 'checkout.session.completed')
    expect((await deliver(completed.rawBody, completed.headers)).status).toBe(200)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('confirming')
    expect((await productRow(payload, a)).status).toBe('reserved')
    expect((await webhookRow(payload, completed.event.id))?.status).toBe('processed')
    expect(await orderCount()).toBe(0)

    const failed = await mock.emit(session, 'checkout.session.async_payment_failed')
    expect((await deliver(failed.rawBody, failed.headers)).status).toBe(200)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('failed')
    expect((await productRow(payload, a)).status).toBe('available')
  })

  it('expired gibt nur Reservierungen checkout_session dieser Session frei; Kasse completed (Vorkasse O2) bleibt unberührt', async () => {
    const a = await piece(985)
    const r = await started([a])
    await submitForTest(payload, r.checkoutId, { now: now(), legal })
    const req = await createLocalReq({ context: { system: true } }, payload)
    await createOrderFromCheckout(req, r.checkoutId, { transition: 'O2', now: now() })
    await transitionCheckout(req, r.checkoutId, 'completed', { now: now() })
    await dbOf(payload).execute(
      sql`UPDATE reservations SET source = 'prepayment' WHERE ref = ${r.reservationRef}`,
    )
    const emission = await mock.emit(await sessionOf(r.checkoutId), 'checkout.session.expired')
    expect((await deliver(emission.rawBody, emission.headers)).status).toBe(200)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('completed')
    expect((await productRow(payload, a)).status).toBe('reserved')
    expect((await reservationsOf(payload, a))[0]!.status).toBe('active')
    expect((await webhookRow(payload, emission.event.id))?.status).toBe('processed')
  })

  it('expired einer älteren Session (Neuanlage) gibt nichts frei', async () => {
    const a = await piece(986)
    const r = await started([a])
    const s = stripeSigned('checkout.session.expired', {
      id: 'cs_test_old_session_1',
      ref: r.reservationRef,
      status: 'expired',
      paymentStatus: 'unpaid',
    })
    expect((await deliver(s.rawBody, s.headers, stripeAdapter())).status).toBe(200)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('open')
    expect((await productRow(payload, a)).status).toBe('reserved')
  })
})

describe('Idempotenz und Fehler (DATENMODELL §8.8)', () => {
  it('doppelte Zustellung wirkt nur einmal', async () => {
    const a = await piece(987)
    const r = await started([a])
    const emission = await mock.emit(await sessionOf(r.checkoutId), 'checkout.session.expired')
    const [first, second] = await Promise.all([
      deliver(emission.rawBody, emission.headers),
      deliver(emission.rawBody, emission.headers),
    ])
    expect([first.status, second.status]).toEqual([200, 200])
    const statuses = [
      ((await first.json()) as { status: string }).status,
      ((await second.json()) as { status: string }).status,
    ].sort()
    expect(statuses).toEqual(['duplicate', 'processed'])
    const third = await deliver(emission.rawBody, emission.headers)
    expect(await third.json()).toEqual({ received: true, status: 'duplicate' })
    expect(Number((await webhookRow(payload, emission.event.id))!.attempts)).toBe(1)
    expect(await reservationsOf(payload, a)).toHaveLength(1)
  })

  it('erzwungener Verarbeitungsfehler → 500 und failed mit lastError; ab dem 2. Fehlversuch A12; die Wiederholung gelingt', async () => {
    const a = await piece(988)
    const r = await started([a])
    await submitForTest(payload, r.checkoutId, { now: now(), confirming: true, legal })
    let calls = 0
    setPaidCheckoutHandler(async (_req, _event, _data, checkout) => {
      calls++
      if (calls <= 2) throw new Error('erzwungen')
      return { status: 'processed', action: 'test', checkoutId: checkout.id }
    })
    const emission = await mock.emit(await sessionOf(r.checkoutId), 'checkout.session.completed')

    const first = await deliver(emission.rawBody, emission.headers)
    expect(first.status).toBe(500)
    expect(await webhookRow(payload, emission.event.id)).toMatchObject({
      status: 'failed',
      last_error: 'Error: erzwungen',
    })
    expect(await mailCount('admin_alert')).toBe(0)

    clock.set('2026-10-05T10:05:00.000Z')
    expect((await deliver(emission.rawBody, emission.headers)).status).toBe(500)
    expect(await mailCount('admin_alert')).toBe(1)

    clock.set('2026-10-05T10:10:00.000Z')
    const third = await deliver(emission.rawBody, emission.headers)
    expect(third.status).toBe(200)
    const row = await webhookRow(payload, emission.event.id)
    expect(row).toMatchObject({ status: 'processed', last_error: null })
    expect(Number(row!.attempts)).toBe(3)
  })
})
