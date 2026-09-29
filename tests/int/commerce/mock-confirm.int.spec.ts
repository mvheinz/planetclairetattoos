import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startCheckout } from '@/lib/commerce/checkout'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import {
  mockConfirmOutcome,
  mockConfirmSuccess,
  mockPaymentMethodOf,
} from '@/lib/commerce/mockConfirm'
import { __setEmailAdapterForTests, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'
import type { Order } from '@/payload-types'

import {
  cartOf,
  checkoutById,
  piece as makePiece,
  productRow,
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

// P4.16a – Mock-Zahlung „Erfolg“ (KONZEPT §4.7): Mock-Zustand complete/paid, Ereignis checkout.session.completed über
// dieselbe Verarbeitung wie der Webhook, Ziel der 303-Weiterleitung `/de/danke/<Kassen-Token>`. P4.10b: „Abgelehnt“
// (Kasse wieder `open`, Reservierung unverändert, erneutes Absenden möglich – S8), „Abbruch“ (Session bleibt `open`, S9)
// und „Verzögert“ (Mock `complete`/`unpaid` ohne Ereignis, S10); keiner dieser Wege erzeugt eine Bestellung.

let payload: Payload
let fx: ProductFixtures
let clock: TestClock
let mock: ReturnType<typeof useMockPayments>
let legal: Record<string, number>
let restoreBusiness: () => Promise<void>
const NUMBERS = [992, 993, 994]
const T0 = '2026-10-07T10:00:00.000Z'

async function submitted(nr: number, locale: 'de' | 'en' = 'de') {
  const id = await makePiece(payload, fx, nr)
  const r = await startCheckout(
    { cart: cartOf([{ id }]), locale, existingToken: null, now: clock.now() },
    { payload },
  )
  if (!r.ok) throw new Error('Kassenstart abgelehnt')
  await submitForTest(payload, r.checkoutId, { now: clock.now(), confirming: true, legal })
  return { id, r }
}

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
  legal = await ensureLegalTextFixturesWithPdfs(payload)
  restoreBusiness = await withBusiness(payload)
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
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

describe('Mock „Erfolg“', () => {
  it('Weiterleitungsziel /de/danke/<Kassen-Token>, Bestellung paid, Stück sold – über ein Ereignis in webhook-events', async () => {
    const { id, r } = await submitted(992)
    const res = await mockConfirmSuccess({ token: r.token, now: clock.now() }, { payload })
    expect(res).toMatchObject({ ok: true, redirectTo: `/de/danke/${r.token}`, status: 'processed' })
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('completed')
    const order = (await payload.findByID({
      collection: 'orders',
      id: c.order as number,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(order.status).toBe('paid')
    expect((await productRow(payload, id)).status).toBe('sold')
    // DATENMODELL §8.8 Nr. 5: Bestand und Bestellung ändern sich nur über den Ereignisweg
    const ev = await dbOf(payload).execute(
      sql`SELECT status, type FROM webhook_events WHERE related_order_id = ${order.id}`,
    )
    expect(ev.rows).toEqual([{ status: 'processed', type: 'checkout.session.completed' }])
  })

  it('EN-Kasse → /en/thank-you/<Token>; Wallet Google Pay wird übernommen', async () => {
    const { r } = await submitted(993, 'en')
    const res = await mockConfirmSuccess(
      { token: r.token, now: clock.now(), method: { type: 'card', wallet: 'google_pay' } },
      { payload },
    )
    expect(res).toMatchObject({ ok: true, redirectTo: `/en/thank-you/${r.token}` })
    const c = await checkoutById(payload, r.checkoutId)
    const order = (await payload.findByID({
      collection: 'orders',
      id: c.order as number,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(order.stripe?.paymentMethodType).toBe('google_pay')
  })

  it('unbekannter Token → not_found; Kasse schon abgeschlossen → not_open, keine zweite Bestellung', async () => {
    expect(
      await mockConfirmSuccess({ token: 'x'.repeat(43), now: clock.now() }, { payload }),
    ).toEqual({
      ok: false,
      code: 'not_found',
    })
    const { r } = await submitted(994)
    await mockConfirmSuccess({ token: r.token, now: clock.now() }, { payload })
    expect(await mockConfirmSuccess({ token: r.token, now: clock.now() }, { payload })).toEqual({
      ok: false,
      code: 'not_open',
    })
    expect((await payload.count({ collection: 'orders', overrideAccess: true })).totalDocs).toBe(1)
  })
})

describe('Mock „Abgelehnt“, „Abbruch“, „Verzögert“ (P4.10b)', () => {
  const webhookRows = async () =>
    Number(
      (await dbOf(payload).execute(sql`SELECT count(*)::int AS n FROM webhook_events`)).rows[0]
        ?.n ?? 0,
    )
  const orders = async () =>
    (await payload.count({ collection: 'orders', overrideAccess: true })).totalDocs

  it('S8 „Abgelehnt“: Kasse wieder open, Reservierung und expiresAt unverändert, Meldung; erneutes Absenden möglich; keine Bestellung', async () => {
    const { id, r } = await submitted(992)
    const before = await checkoutById(payload, r.checkoutId)
    expect(before.status).toBe('confirming')
    const res = await mockConfirmOutcome(
      {
        token: r.token,
        outcome: 'declined',
        method: mockPaymentMethodOf('card'),
        now: clock.now(),
      },
      { payload },
    )
    expect(res).toEqual({ ok: false, code: 'declined' })
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('open')
    expect(c.reservationRef).toBe(before.reservationRef)
    expect(c.expiresAt).toBe(before.expiresAt)
    const p = await productRow(payload, id)
    expect(p.status).toBe('reserved')
    expect(p.reservation_ref).toBe(before.reservationRef)
    expect((await mock.getCheckoutSession(c.stripe!.checkoutSessionId!)).status).toBe('open')
    expect(await orders()).toBe(0)
    expect(await webhookRows()).toBe(0)

    const again = await submitCheckout(
      {
        token: r.token,
        raw: {
          email: 'kundin@planetclaire.local',
          fulfillmentMethod: 'shipping',
          name: 'Erika Beispiel',
          shippingLine1: 'Musterstraße 1',
          shippingPostalCode: '10115',
          shippingCity: 'Berlin',
          paymentChoice: 'stripe',
        },
        now: clock.now(),
      },
      { payload, payments: mock },
    )
    expect(again.ok).toBe(true)
    expect((await checkoutById(payload, r.checkoutId)).status).toBe('confirming')
  })

  it('S9 „Abbruch“: 303-Ziel /de/danke/<Token>, Session bleibt open, keine Bestellung, kein Ereignis', async () => {
    const { r } = await submitted(993)
    const res = await mockConfirmOutcome(
      {
        token: r.token,
        outcome: 'cancelled',
        method: mockPaymentMethodOf('paypal'),
        now: clock.now(),
      },
      { payload },
    )
    expect(res).toMatchObject({ ok: true, redirectTo: `/de/danke/${r.token}`, orderId: null })
    const c = await checkoutById(payload, r.checkoutId)
    expect((await mock.getCheckoutSession(c.stripe!.checkoutSessionId!)).status).toBe('open')
    expect(await orders()).toBe(0)
    expect(await webhookRows()).toBe(0)
  })

  it('S10 „Verzögert“: 303-Ziel /en/thank-you/<Token>, Mock complete/unpaid ohne Ereignis in webhook-events, Kasse bleibt confirming, keine Bestellung', async () => {
    const { r } = await submitted(994, 'en')
    const res = await mockConfirmOutcome(
      {
        token: r.token,
        outcome: 'delayed',
        method: mockPaymentMethodOf('apple_pay'),
        now: clock.now(),
      },
      { payload },
    )
    expect(res).toMatchObject({ ok: true, redirectTo: `/en/thank-you/${r.token}`, orderId: null })
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('confirming')
    const state = await mock.getCheckoutSession(c.stripe!.checkoutSessionId!)
    expect(state).toMatchObject({
      status: 'complete',
      paymentStatus: 'unpaid',
      paymentMethod: { type: 'card', wallet: 'apple_pay' },
    })
    expect(await mock.listEventsSince(new Date(0))).toEqual([])
    expect(await orders()).toBe(0)
    expect(await webhookRows()).toBe(0)
  })
})
