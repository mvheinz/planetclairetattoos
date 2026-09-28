import net from 'node:net'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { createLogger } from '@/lib/monitoring/logger'
import {
  __setPaymentsAdapterForTests,
  createPaymentsAdapter,
  InvalidCheckoutSessionInputError,
  InvalidSignatureError,
  mockPayments,
  PaymentSessionNotFoundError,
} from '@/lib/payments'
import { STRIPE_EVENT_FIXTURES } from '@/lib/payments/fixtures'
import {
  createMockPaymentsAdapter,
  MOCK_SIGNATURE_HEADER,
  MockCheckoutNotFoundError,
  MockTestApiDisabledError,
  MockTransitionError,
  signMockWebhook,
  type MockEmission,
  type MockPaymentsAdapter,
  type MockPaymentsOptions,
} from '@/lib/payments/mock'
import type { MockDb } from '@/lib/payments/mock/store'
import {
  STRIPE_EVENT_NAMES,
  STRIPE_EVENT_TYPES,
  type StripeEventType,
} from '@/lib/payments/normalize'
import type { CreateCheckoutSessionInput, PaymentsAdapter } from '@/lib/payments/types'
import { createToken } from '@/lib/security/tokens'
import { fixedClock } from '@/lib/time'

import { checkoutData, dbOf, deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P4.4 – Kontrakttest Zahlung (ARCHITEKTUR §3.1 Nr. 3, §3.5): dieselbe Reihe für jeden Treiber (hier `mock`, ab P4.5
// zusätzlich Stripe gegen stripe-mock), dazu Mock-Eigenheiten: Zustand in `checkouts.mock.state` (zwei Prozesse),
// Ereignisse aus den Fixtures, Test-API nur development/test. Netzwerk-Wächter aktiv (nur 127.0.0.1).

const NOW = '2026-10-15T08:00:00.000Z'
const clock = fixedClock(NOW)
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const EMAIL = 'erika@example.com'
const FOREIGN_REF = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const ITEM = 987

let payload: Payload
let item: { id: number; itemNumber: number }
const extraPools: pg.Pool[] = []

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload, [ITEM])
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', ITEM, fx))
  item = { id: p.id as number, itemNumber: ITEM }
})

afterEach(() => __setPaymentsAdapterForTests(undefined))

afterAll(async () => {
  for (const pool of extraPools) await pool.end()
  await deleteCommerce(payload)
  await deleteProducts(payload, [ITEM])
})

/** Kasse wie nach „Zur Kasse“ (DATENMODELL §8.1): existiert vor der Session; liefert die Kassen-Referenz. */
async function newCheckout(): Promise<{ ref: string; id: number }> {
  const { data } = checkoutData([item])
  const doc = await payload.create({
    collection: 'checkouts',
    data: data as never,
    overrideAccess: true,
    context: { system: true },
  })
  return { ref: data.reservationRef as string, id: doc.id as number }
}

const input = (
  ref: string,
  token = createToken(),
  over: Partial<CreateCheckoutSessionInput> = {},
): CreateCheckoutSessionInput => ({
  checkoutRef: ref,
  locale: 'de',
  lineItems: [
    { productId: 981, name: 'Nr. 981 · Schale', amountCents: 4500 },
    { productId: 982, name: 'Nr. 982 · Becher', amountCents: 2800 },
  ],
  shipping: { label: 'DHL Paket (Keramik)', amountCents: 690 },
  expiresAt: new Date(Date.parse(NOW) + 31 * 60_000),
  returnUrl: `http://localhost:3000/de/danke/${token}`,
  customerEmail: EMAIL,
  metadata: { checkoutRef: ref, appEnv: 'test' },
  ...over,
})

async function mockStateOf(ref: string): Promise<unknown> {
  const res = await dbOf(payload).execute(
    sql`SELECT mock_state FROM checkouts WHERE reservation_ref = ${ref}`,
  )
  return res.rows[0]?.mock_state ?? null
}

// --- Kontrakt-Reihe (für jeden Treiber gleich) ---

interface ContractDriver {
  name: string
  adapter(): PaymentsAdapter
  /** Neue Kasse, zu der eine Session angelegt werden darf. */
  newRef(): Promise<string>
  /** Signatur-Header für einen Rohkörper. */
  sign(rawBody: string): Headers
  /** Session in den Zustand „abgeschlossen“ bringen (treiberspezifisch). */
  complete(sessionId: string, paymentStatus: 'paid' | 'unpaid'): Promise<void>
  /** Protokollierte bzw. gesendete Session-Parameter (neueste zuletzt). */
  sessionParams(): Record<string, unknown>[]
}

function paymentsContract(d: ContractDriver) {
  describe(`Zahlung – Kontrakt (${d.name})`, () => {
    it('anlegen und abfragen: Handle, open/unpaid, clientSecret bei jedem Abruf, Betrag in Cent', async () => {
      const a = d.adapter()
      const handle = await a.createCheckoutSession(input(await d.newRef()))
      expect(handle.expiresAt.toISOString()).toBe('2026-10-15T08:31:00.000Z')
      const state = await a.getCheckoutSession(handle.sessionId)
      expect(state).toMatchObject({
        sessionId: handle.sessionId,
        status: 'open',
        paymentStatus: 'unpaid',
        clientSecret: handle.clientSecret,
        amountTotalCents: 4500 + 2800 + 690,
      })
      expect((await a.getCheckoutSession(handle.sessionId)).clientSecret).toBe(handle.clientSecret)
      await expect(a.getCheckoutSession(`${handle.sessionId}x`)).rejects.toThrow(
        PaymentSessionNotFoundError,
      )
    })

    it('Eingaberegeln: Referenz statt Token, metadata genau { checkoutRef, appEnv }, Ablauf 30 min–24 h, Cent', async () => {
      const a = d.adapter()
      const ref = await d.newRef()
      const token = createToken()
      const bad: Partial<CreateCheckoutSessionInput>[] = [
        { checkoutRef: token, metadata: { checkoutRef: token, appEnv: 'test' } },
        { metadata: { checkoutRef: ref, appEnv: 'test', token } as never },
        { metadata: { checkoutRef: FOREIGN_REF, appEnv: 'test' } },
        { expiresAt: new Date(Date.parse(NOW) + 29 * 60_000) },
        { expiresAt: new Date(Date.parse(NOW) + 25 * 3_600_000) },
        { lineItems: [{ productId: 981, name: 'Nr. 981', amountCents: 12.5 }] },
        { lineItems: [] },
        { shipping: { label: 'Paket', amountCents: -1 } },
      ]
      for (const over of bad) {
        await expect(a.createCheckoutSession(input(ref, token, over))).rejects.toThrow(
          InvalidCheckoutSessionInputError,
        )
      }
    })

    it('Versand aktualisieren: offen → updated (neuer Betrag), sonst recreate_required', async () => {
      const a = d.adapter()
      const { sessionId } = await a.createCheckoutSession(input(await d.newRef()))
      expect(
        await a.updateShipping(sessionId, { label: 'Abholung in Berlin', amountCents: 0 }),
      ).toBe('updated')
      expect((await a.getCheckoutSession(sessionId)).amountTotalCents).toBe(4500 + 2800)
      await a.expireCheckoutSession(sessionId)
      expect(await a.updateShipping(sessionId, { label: 'Paket', amountCents: 690 })).toBe(
        'recreate_required',
      )
    })

    it('beenden: expired, already_expired, already_complete_paid, already_complete_unpaid', async () => {
      const a = d.adapter()
      const s1 = await a.createCheckoutSession(input(await d.newRef()))
      expect(await a.expireCheckoutSession(s1.sessionId)).toBe('expired')
      expect(await a.expireCheckoutSession(s1.sessionId)).toBe('already_expired')
      const expired = await a.getCheckoutSession(s1.sessionId)
      expect(expired.status).toBe('expired')
      expect(expired.clientSecret).toBeUndefined()

      const s2 = await a.createCheckoutSession(input(await d.newRef()))
      await d.complete(s2.sessionId, 'paid')
      expect(await a.expireCheckoutSession(s2.sessionId)).toBe('already_complete_paid')
      const paid = await a.getCheckoutSession(s2.sessionId)
      expect(paid).toMatchObject({ status: 'complete', paymentStatus: 'paid' })
      expect(paid.clientSecret).toBeUndefined()
      expect(paid.paymentIntentId).toMatch(/^pi_/)

      const s3 = await a.createCheckoutSession(input(await d.newRef()))
      await d.complete(s3.sessionId, 'unpaid')
      expect(await a.expireCheckoutSession(s3.sessionId)).toBe('already_complete_unpaid')
    })

    it('Erstattung: succeeded, idempotent je Schlüssel, nur positive ganze Cent', async () => {
      const a = d.adapter()
      const { sessionId } = await a.createCheckoutSession(input(await d.newRef()))
      await d.complete(sessionId, 'paid')
      const { paymentIntentId } = await a.getCheckoutSession(sessionId)
      const i = {
        paymentIntentId: paymentIntentId!,
        amountCents: 1500,
        reason: 'withdrawal',
        idempotencyKey: `refund:${ITEM}:1`,
      }
      const first = await a.refund(i)
      expect(first.status).toBe('succeeded')
      expect(first.refundId).toMatch(/^re_/)
      expect(await a.refund(i)).toEqual(first)
      await expect(a.refund({ ...i, idempotencyKey: 'k2', amountCents: 12.5 })).rejects.toThrow(
        /Cent/,
      )
      await expect(a.refund({ ...i, idempotencyKey: 'k3', amountCents: 0 })).rejects.toThrow(/Cent/)
    })

    it('Webhook-Parsing aller zehn Fixtures → PaymentEvent (eigener Typ, ohne Personendaten)', () => {
      const a = d.adapter()
      expect(STRIPE_EVENT_NAMES).toHaveLength(10)
      for (const name of STRIPE_EVENT_NAMES) {
        const raw = JSON.stringify(STRIPE_EVENT_FIXTURES[name])
        const event = a.parseWebhook(raw, d.sign(raw))
        expect(event).toMatchObject({
          id: STRIPE_EVENT_FIXTURES[name].id,
          provider: a.driver,
          livemode: false,
          type: STRIPE_EVENT_TYPES[name],
          data: { providerType: name },
        })
        expect(event.createdAt.getTime()).toBe(STRIPE_EVENT_FIXTURES[name].created * 1000)
        expect(JSON.stringify(event.data)).not.toMatch(/@|Kundin|Beispielstraße/)
      }
      const unknown = JSON.stringify({
        ...STRIPE_EVENT_FIXTURES['refund.created'],
        type: 'payout.paid',
      })
      expect(a.parseWebhook(unknown, d.sign(unknown)).type).toBe('ignored')
    })

    it('falsche Signatur → InvalidSignatureError (auch bei verändertem Körper)', () => {
      const a = d.adapter()
      const raw = JSON.stringify(STRIPE_EVENT_FIXTURES['checkout.session.completed'])
      expect(() => a.parseWebhook(raw, new Headers())).toThrow(InvalidSignatureError)
      expect(() => a.parseWebhook(raw, new Headers({ [MOCK_SIGNATURE_HEADER]: 'falsch' }))).toThrow(
        InvalidSignatureError,
      )
      expect(() => a.parseWebhook(raw.replace('7990', '1'), d.sign(raw))).toThrow(
        InvalidSignatureError,
      )
    })

    it('R-062 (int): Session-Parameter nur card und paypal; Kennung nur checkoutRef – kein Token, keine Personendaten', async () => {
      const a = d.adapter()
      const ref = await d.newRef()
      const token = createToken()
      await a.createCheckoutSession(input(ref, token))
      const params = d.sessionParams().at(-1)!
      expect(params).toMatchObject({
        ui_mode: 'elements',
        mode: 'payment',
        currency: 'eur',
        payment_method_types: ['card', 'paypal'],
        client_reference_id: ref,
        metadata: { checkoutRef: ref, appEnv: 'test' },
      })
      expect(Object.keys(params.metadata as object).sort()).toEqual(['appEnv', 'checkoutRef'])
      for (const key of [
        'payment_method_configuration',
        'success_url',
        'cancel_url',
        'submit_type',
        'after_expiration',
      ]) {
        expect(params).not.toHaveProperty(key)
      }
      const logged = JSON.stringify(params)
      expect(logged).not.toContain(token)
      expect(logged).not.toContain(EMAIL)
      expect(logged).not.toContain('return_url')
    })
  })
}

// --- Mock-Treiber ---

const logLines: string[] = []
const capturingLogger = createLogger({ level: 'debug', sink: (l) => logLines.push(l) })
const mockOptions: MockPaymentsOptions = { clock, appEnv: 'test', logger: capturingLogger }

function mockAdapter(over: MockPaymentsOptions = {}): MockPaymentsAdapter {
  return createMockPaymentsAdapter({ ...mockOptions, ...over })
}

paymentsContract({
  name: 'mock',
  adapter: () => mockAdapter(),
  newRef: async () => (await newCheckout()).ref,
  sign: (raw) => new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(raw) }),
  async complete(sessionId, paymentStatus) {
    const m = mockAdapter()
    if (paymentStatus === 'unpaid') await m.setNextOutcome(sessionId, { result: 'delayed' })
    await m.emit(sessionId, 'checkout.session.completed')
  },
  sessionParams: () =>
    logLines
      .map((l) => JSON.parse(l) as { event: string; params?: Record<string, unknown> })
      .filter((l) => l.event === 'payments.mock.session_created')
      .map((l) => l.params!),
})

/** Zweiter „Prozess“: eigener Postgres-Pool statt dem von Payload. */
function secondProcess(): MockPaymentsAdapter {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  extraPools.push(pool)
  return mockAdapter({ db: async () => pool as unknown as MockDb })
}

describe('Zahlung – Mock-Treiber: Zustand in der DB (checkouts.mock.state)', () => {
  it('zwei Prozesse (zwei Adapter-Instanzen) sehen denselben Mock-Zustand', async () => {
    const { ref } = await newCheckout()
    const a = mockAdapter()
    const b = secondProcess()
    const { sessionId, clientSecret } = await a.createCheckoutSession(input(ref))
    expect(sessionId).toMatch(new RegExp(`^cs_mock_${UUID}$`))
    expect(clientSecret).toMatch(new RegExp(`^mock_secret_${UUID}$`))
    expect(await b.getCheckoutSession(sessionId)).toMatchObject({ status: 'open', clientSecret })

    const { event } = await b.emit(sessionId, 'checkout.session.completed')
    const seenByA = await a.getCheckoutSession(sessionId)
    expect(seenByA).toMatchObject({ status: 'complete', paymentStatus: 'paid' })
    expect(seenByA.paymentIntentId).toMatch(new RegExp(`^pi_mock_${UUID}$`))
    expect((await a.listEventsSince(new Date(NOW))).map((e) => e.id)).toContain(event.id)

    // Gespeichert: Session unter der Kasse, ohne Client-Secret, Token oder Personendaten.
    const stored = JSON.stringify(await mockStateOf(ref))
    expect(stored).toContain(sessionId)
    expect(stored).toContain(ref)
    expect(stored).not.toContain('mock_secret_')
    expect(stored).not.toContain(EMAIL)
    expect(stored).not.toContain('danke')
  })

  it('Kasse muss vor der Session existieren; unbekannte Session → PaymentSessionNotFoundError', async () => {
    const a = mockAdapter()
    await expect(a.createCheckoutSession(input(FOREIGN_REF))).rejects.toThrow(
      MockCheckoutNotFoundError,
    )
    await expect(a.expireCheckoutSession('cs_mock_unbekannt')).rejects.toThrow(
      PaymentSessionNotFoundError,
    )
  })

  it('Neuanlage mit derselben Reservierung: zweite Session an derselben Kasse, beide abrufbar', async () => {
    const { ref } = await newCheckout()
    const a = mockAdapter()
    const first = await a.createCheckoutSession(input(ref))
    await a.expireCheckoutSession(first.sessionId)
    const second = await a.createCheckoutSession(input(ref))
    expect(second.sessionId).not.toBe(first.sessionId)
    expect((await a.getCheckoutSession(first.sessionId)).status).toBe('expired')
    expect((await a.getCheckoutSession(second.sessionId)).status).toBe('open')
    expect((await mockStateOf(ref)) as { sessions: unknown[] }).toMatchObject({
      sessions: [{ sessionId: first.sessionId }, { sessionId: second.sessionId }],
    })
  })

  it('offene Session läuft von selbst ab (Uhr nach expires_at) und protokolliert checkout.expired', async () => {
    const { ref } = await newCheckout()
    const { sessionId } = await mockAdapter().createCheckoutSession(input(ref))
    const later = mockAdapter({ clock: fixedClock('2026-10-15T08:32:00.000Z') })
    const state = await later.getCheckoutSession(sessionId)
    expect(state.status).toBe('expired')
    expect(state.clientSecret).toBeUndefined()
    const events = await later.listEventsSince(new Date('2026-10-15T08:31:00.000Z'))
    expect(events.find((e) => e.data.sessionId === sessionId)?.type).toBe('checkout.expired')
  })

  it('Payload-Updates der Kasse überschreiben den Mock-Zustand nicht (Trigger checkouts_keep_mock_state)', async () => {
    const { ref, id } = await newCheckout()
    const { sessionId } = await mockAdapter().createCheckoutSession(input(ref))
    await payload.update({
      collection: 'checkouts',
      id,
      data: { carrierEmailConsent: true, mock: { state: null } } as never,
      overrideAccess: true,
      context: { system: true },
    })
    await dbOf(payload).execute(sql`UPDATE checkouts SET mock_state = NULL WHERE id = ${id}`)
    expect(JSON.stringify(await mockStateOf(ref))).toContain(sessionId)
    expect((await mockAdapter().getCheckoutSession(sessionId)).status).toBe('open')
  })
})

describe('Zahlung – Mock-Treiber: Ereignisse, Test-Ergebnisse, Test-API', () => {
  async function paidSession(a: MockPaymentsAdapter) {
    const { ref } = await newCheckout()
    const { sessionId } = await a.createCheckoutSession(input(ref))
    await a.emit(sessionId, 'checkout.session.completed')
    return { ref, sessionId }
  }

  function expectEmission(a: MockPaymentsAdapter, e: MockEmission, type: StripeEventType) {
    expect(e.event).toMatchObject({
      provider: 'mock',
      livemode: false,
      type: STRIPE_EVENT_TYPES[type],
    })
    expect(e.event.id).toMatch(new RegExp(`^evt_mock_${UUID}$`))
    expect(e.headers.get(MOCK_SIGNATURE_HEADER)).toBe(signMockWebhook(e.rawBody))
    // Dieselbe Normalisierung wie beim Webhook; Fixture-Werte ersetzt, keine Personendaten.
    expect(a.parseWebhook(e.rawBody, e.headers)).toEqual(e.event)
    expect(JSON.parse(e.rawBody)).toMatchObject({
      type,
      livemode: false,
      api_version: STRIPE_EVENT_FIXTURES[type].api_version,
    })
    expect(e.rawBody).not.toMatch(/fixture|example\.com|Kundin|Beispielstraße|danke/)
  }

  it('emit: alle zehn Ereignistypen aus den Fixtures, signiert und protokolliert (listEventsSince)', async () => {
    const a = mockAdapter()
    const { ref, sessionId } = await paidSession(a)
    const emitted: string[] = []
    for (const type of [
      'checkout.session.completed',
      'refund.created',
      'charge.refunded',
      'refund.updated',
      'refund.failed',
      'charge.dispute.created',
      'charge.dispute.closed',
    ] as const) {
      const e = await a.emit(sessionId, type)
      expectEmission(a, e, type)
      emitted.push(e.event.id)
    }
    const logged = await a.listEventsSince(new Date(NOW))
    expect(logged.find((e) => e.id === emitted[0])?.data).toMatchObject({
      checkoutRef: ref,
      sessionId,
      paymentStatus: 'paid',
    })

    const expiring = await a.createCheckoutSession(input((await newCheckout()).ref))
    expectEmission(
      a,
      await a.emit(expiring.sessionId, 'checkout.session.expired'),
      'checkout.session.expired',
    )
    expect((await a.getCheckoutSession(expiring.sessionId)).status).toBe('expired')

    for (const type of [
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
    ] as const) {
      const s = await a.createCheckoutSession(input((await newCheckout()).ref))
      await a.setNextOutcome(s.sessionId, { result: 'delayed' })
      const done = await a.emit(s.sessionId, 'checkout.session.completed')
      expect(done.event.data).toMatchObject({ paymentStatus: 'unpaid' })
      expectEmission(a, await a.emit(s.sessionId, type), type)
      expect((await a.getCheckoutSession(s.sessionId)).paymentStatus).toBe(
        type === 'checkout.session.async_payment_succeeded' ? 'paid' : 'unpaid',
      )
    }

    const ids = (await a.listEventsSince(new Date(NOW))).map((e) => e.id)
    for (const id of emitted) expect(ids).toContain(id)
  })

  it('Zustandsprüfung: kein completed für abgelaufene Sessions, kein Ablauf nach Abschluss', async () => {
    const a = mockAdapter()
    const s = await a.createCheckoutSession(input((await newCheckout()).ref))
    await a.expireCheckoutSession(s.sessionId)
    await expect(a.emit(s.sessionId, 'checkout.session.completed')).rejects.toThrow(
      MockTransitionError,
    )
    const { sessionId } = await paidSession(a)
    await expect(a.emit(sessionId, 'checkout.session.expired')).rejects.toThrow(MockTransitionError)
    await expect(a.emit(sessionId, 'checkout.session.async_payment_failed')).rejects.toThrow(
      MockTransitionError,
    )
  })

  it('setNextOutcome: Zahlart card/paypal mit Wallet, Abgelehnt/Abbruch ohne completed, Erstattung und Anfechtung', async () => {
    const a = mockAdapter()
    for (const pm of [
      { type: 'paypal' },
      { type: 'card', wallet: 'apple_pay' },
      { type: 'card', wallet: 'google_pay' },
    ] as const) {
      const s = await a.createCheckoutSession(input((await newCheckout()).ref))
      await a.setNextOutcome(s.sessionId, { paymentMethod: pm })
      await a.emit(s.sessionId, 'checkout.session.completed')
      expect((await a.getCheckoutSession(s.sessionId)).paymentMethod).toEqual(pm)
    }
    await expect(
      a.setNextOutcome('cs_mock_x', { paymentMethod: { type: 'paypal', wallet: 'apple_pay' } }),
    ).rejects.toThrow(/Wallet/)

    for (const result of ['declined', 'cancelled'] as const) {
      const s = await a.createCheckoutSession(input((await newCheckout()).ref))
      await a.setNextOutcome(s.sessionId, { result })
      await expect(a.emit(s.sessionId, 'checkout.session.completed')).rejects.toThrow(result)
      expect((await a.getCheckoutSession(s.sessionId)).status).toBe('open')
    }

    const { sessionId } = await paidSession(a)
    const pi = (await a.getCheckoutSession(sessionId)).paymentIntentId!
    await a.setNextOutcome(sessionId, { refund: 'failed', dispute: 'won' })
    const refund = (amountCents: number, idempotencyKey: string) =>
      a.refund({ paymentIntentId: pi, amountCents, reason: 'withdrawal', idempotencyKey })
    expect((await refund(1000, 'refund:1:1')).status).toBe('failed')
    expect((await refund(1000, 'refund:1:2')).status).toBe('succeeded')
    await expect(refund(8000, 'refund:1:3')).rejects.toThrow(/übersteigt/)
    const closed = await a.emit(sessionId, 'charge.dispute.closed')
    expect(closed.event.data).toMatchObject({ status: 'won' })
  })

  it('Erstattung ohne Mock-Kasse (z. B. Beispiel-Bestellung): stabile ID je Schlüssel, succeeded', async () => {
    const a = mockAdapter()
    const i = {
      paymentIntentId: 'pi_mock_ohne_kasse',
      amountCents: 500,
      reason: 'withdrawal',
      idempotencyKey: 'refund:9:1',
    }
    const first = await a.refund(i)
    expect(first).toMatchObject({ status: 'succeeded' })
    expect(first.refundId).toMatch(new RegExp(`^re_mock_${UUID}$`))
    expect(await a.refund(i)).toEqual(first)
    expect((await a.refund({ ...i, idempotencyKey: 'refund:9:2' })).refundId).not.toBe(
      first.refundId,
    )
  })

  it('listBalanceTransactions aus der Fixture (Gebühr, Netto, Auszahlung), nach Zeitraum gefiltert', async () => {
    const a = mockAdapter()
    const payout = { payoutId: 'po_fixture_0001', payoutDate: new Date('2026-10-18T08:00:00.000Z') }
    expect(
      await a.listBalanceTransactions({
        from: new Date('2026-10-01T00:00:00.000Z'),
        to: new Date('2026-11-01T00:00:00.000Z'),
      }),
    ).toEqual([
      {
        id: 'txn_fixture_0001',
        sourceId: 'ch_fixture_0001',
        feeCents: 145,
        netCents: 7845,
        ...payout,
      },
      {
        id: 'txn_fixture_0002',
        sourceId: 're_fixture_0001',
        feeCents: 0,
        netCents: -4500,
        ...payout,
      },
    ])
    expect(
      await a.listBalanceTransactions({
        from: new Date('2026-11-01T00:00:00.000Z'),
        to: new Date('2026-12-01T00:00:00.000Z'),
      }),
    ).toEqual([])
  })

  it('Test-API nur bei APP_ENV development/test (mockPayments und Adapter)', async () => {
    const { ref } = await newCheckout()
    const preview = mockAdapter({ appEnv: 'preview' })
    const { sessionId } = await preview.createCheckoutSession(input(ref))
    await expect(preview.emit(sessionId, 'checkout.session.completed')).rejects.toThrow(
      MockTestApiDisabledError,
    )
    await expect(preview.setNextOutcome(sessionId, { result: 'delayed' })).rejects.toThrow(
      MockTestApiDisabledError,
    )
    expect((await preview.getCheckoutSession(sessionId)).status).toBe('open')

    __setPaymentsAdapterForTests(preview)
    await expect(mockPayments.emit(sessionId, 'checkout.session.completed')).rejects.toThrow(
      MockTestApiDisabledError,
    )
    __setPaymentsAdapterForTests({ ...preview, driver: 'stripe', mode: 'test' } as PaymentsAdapter)
    await expect(mockPayments.setNextOutcome(sessionId, {})).rejects.toThrow(
      MockTestApiDisabledError,
    )

    __setPaymentsAdapterForTests(mockAdapter())
    const { event } = await mockPayments.emit(sessionId, 'checkout.session.completed')
    expect(event.type).toBe('checkout.completed')
  })
})

describe('Zahlung – Treiberwahl (ARCHITEKTUR §3.1 Nr. 1)', () => {
  const env = (over: Record<string, string>) =>
    parseEnv({ ...process.env, STRIPE_SECRET_KEY: '', ...over })

  it('stripe ohne Schlüssel → ConfigError mit deutscher Meldung', () => {
    expect(() =>
      createPaymentsAdapter(env({ APP_ENV: 'test', PAYMENTS_DRIVER: 'stripe' })),
    ).toThrow(ConfigError)
    expect(() =>
      createPaymentsAdapter(env({ APP_ENV: 'test', PAYMENTS_DRIVER: 'stripe' })),
    ).toThrow(/STRIPE_SECRET_KEY fehlt/)
  })

  it('development: Warnung und Mock statt Abbruch', () => {
    const lines: string[] = []
    const a = createPaymentsAdapter(
      env({ APP_ENV: 'development', PAYMENTS_DRIVER: 'stripe' }),
      createLogger({ sink: (l) => lines.push(l) }),
    )
    expect(a.driver).toBe('mock')
    expect(lines.some((l) => l.includes('payments.fallback_to_mock'))).toBe(true)
  })

  it('Mock in Produktion verboten', () => {
    expect(() =>
      createPaymentsAdapter(env({ APP_ENV: 'production', PAYMENTS_DRIVER: 'mock' })),
    ).toThrow(/Produktion verboten/)
  })

  it('stripe mit Testschlüssel: Gerüst (mode test), Umsetzung folgt in P4.5', async () => {
    const a = createPaymentsAdapter(
      env({ APP_ENV: 'test', PAYMENTS_DRIVER: 'stripe', STRIPE_SECRET_KEY: 'sk_test_123' }),
    )
    expect(a).toMatchObject({ driver: 'stripe', mode: 'test' })
    await expect(a.createCheckoutSession(input(FOREIGN_REF))).rejects.toThrow(/folgt in P4/)
  })
})

// --- stripe-mock (optional; der Stripe-Treiber folgt in P4.5 und läuft dann durch paymentsContract) ---

async function reachable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port })
    s.setTimeout(1000)
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
    s.once('timeout', () => (s.destroy(), resolve(false)))
  })
}
const STRIPE_MOCK_PORT = 12111
const stripeMockAvailable = await reachable(STRIPE_MOCK_PORT)
if (!stripeMockAvailable) {
  console.warn(
    `[payments.contract] stripe-mock nicht erreichbar (127.0.0.1:${STRIPE_MOCK_PORT}) – Teil übersprungen (docker compose --profile payments up -d).`,
  )
}

describe.skipIf(!stripeMockAvailable)(
  'Zahlung – stripe-mock (docker compose --profile payments)',
  () => {
    it('stripe-mock antwortet lokal; der Stripe-Treiber bleibt bis P4.5 ein Gerüst', async () => {
      const res = await fetch(`http://127.0.0.1:${STRIPE_MOCK_PORT}/v1/balance`, {
        headers: { Authorization: 'Bearer sk_test_123' },
      })
      expect(res.status).toBe(200)
      const a = createPaymentsAdapter(
        parseEnv({
          ...process.env,
          APP_ENV: 'test',
          PAYMENTS_DRIVER: 'stripe',
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_API_BASE_URL: `http://127.0.0.1:${STRIPE_MOCK_PORT}`,
        }),
      )
      await expect(a.getCheckoutSession('cs_test_1')).rejects.toThrow(/folgt in P4/)
    })
  },
)
