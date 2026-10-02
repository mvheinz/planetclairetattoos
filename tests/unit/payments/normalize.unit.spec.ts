import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { STRIPE_EVENT_FIXTURES } from '@/lib/payments/fixtures'
import {
  normalizeStripeEvent,
  paymentEventData,
  STRIPE_EVENT_NAMES,
  STRIPE_EVENT_TYPES,
} from '@/lib/payments/normalize'
import { STRIPE_API_VERSION } from '@/lib/payments/stripe/config'
import { PaymentEventShapeError, type PaymentEvent } from '@/lib/payments/types'

import {
  checkFixture,
  FIXTURE_NAMES,
  FIXTURE_REF,
  fixtureFile,
  generateFixture,
} from '../../../scripts/lib/stripe-fixtures'

// P4.4 – Normalisierung Fixture → PaymentEvent (ARCHITEKTUR §3.1 Nr. 4, §3.5) und Prüfung der Fixtures
// (`pnpm stripe:fixture`): Form der gepinnten API-Version, bereinigt, ohne Personendaten.

const fixture = (name: keyof typeof STRIPE_EVENT_FIXTURES) =>
  structuredClone(STRIPE_EVENT_FIXTURES[name]) as unknown as Record<string, unknown> & {
    data: { object: Record<string, unknown> }
  }
const normalize = (
  name: keyof typeof STRIPE_EVENT_FIXTURES,
  provider: 'stripe' | 'mock' = 'stripe',
) => normalizeStripeEvent(fixture(name), provider)

describe('Normalisierung: Fixture → PaymentEvent', () => {
  it('checkout.session.completed → checkout.completed mit Referenz, Betrag, Zahlungs-ID', () => {
    const e = normalize('checkout.session.completed')
    expect(e).toEqual({
      id: 'evt_fixture_checkout_session_completed',
      provider: 'stripe',
      livemode: false,
      createdAt: new Date('2026-10-15T08:05:00.000Z'),
      type: 'checkout.completed',
      data: {
        providerType: 'checkout.session.completed',
        sessionId: 'cs_test_fixture_session_0001',
        checkoutRef: FIXTURE_REF,
        appEnv: 'test',
        status: 'complete',
        paymentStatus: 'paid',
        paymentIntentId: 'pi_fixture_0001',
        amountTotalCents: 7990,
        currency: 'eur',
        expiresAt: '2026-10-15T08:31:00.000Z',
      },
    } satisfies PaymentEvent)
  })

  it('checkout.session.expired / async_payment_succeeded / async_payment_failed', () => {
    expect(normalize('checkout.session.expired')).toMatchObject({
      type: 'checkout.expired',
      data: { status: 'expired', paymentStatus: 'unpaid', paymentIntentId: null },
    })
    expect(normalize('checkout.session.async_payment_succeeded')).toMatchObject({
      type: 'checkout.async_succeeded',
      data: { status: 'complete', paymentStatus: 'paid' },
    })
    expect(normalize('checkout.session.async_payment_failed')).toMatchObject({
      type: 'checkout.async_failed',
      data: { status: 'complete', paymentStatus: 'unpaid' },
    })
  })

  it('charge.refunded → Zahlung mit erstattetem Betrag', () => {
    expect(normalize('charge.refunded').data).toEqual({
      providerType: 'charge.refunded',
      chargeId: 'ch_fixture_0001',
      paymentIntentId: 'pi_fixture_0001',
      amountCents: 7990,
      amountRefundedCents: 4500,
      fullyRefunded: false,
      currency: 'eur',
    })
  })

  it('refund.created/updated/failed → Status pending/succeeded/failed mit Grund', () => {
    expect(normalize('refund.created').data).toMatchObject({
      refundId: 're_fixture_0001',
      chargeId: 'ch_fixture_0001',
      paymentIntentId: 'pi_fixture_0001',
      amountCents: 4500,
      status: 'pending',
      failureReason: null,
    })
    expect(normalize('refund.updated').data).toMatchObject({ status: 'succeeded' })
    expect(normalize('refund.failed').data).toMatchObject({
      status: 'failed',
      providerStatus: 'failed',
      failureReason: 'expired_or_canceled_card',
    })
    const canceled = fixture('refund.updated')
    canceled.data.object.status = 'canceled'
    expect(normalizeStripeEvent(canceled, 'stripe').data).toMatchObject({ status: 'failed' })
    const action = fixture('refund.updated')
    action.data.object.status = 'requires_action'
    expect(normalizeStripeEvent(action, 'stripe').data).toMatchObject({ status: 'pending' })
  })

  it('charge.dispute.created/closed → dispute.created/closed', () => {
    expect(normalize('charge.dispute.created')).toMatchObject({
      type: 'dispute.created',
      data: {
        disputeId: 'du_fixture_0001',
        chargeId: 'ch_fixture_0001',
        amountCents: 7990,
        reason: 'product_not_received',
        status: 'needs_response',
      },
    })
    expect(normalize('charge.dispute.closed').data).toMatchObject({ status: 'lost' })
  })

  it('alle zehn Fixtures: Typ laut Tabelle, Daten je Typ gültig, keine Personendaten', () => {
    expect(STRIPE_EVENT_NAMES).toHaveLength(10)
    for (const name of STRIPE_EVENT_NAMES) {
      const e = normalize(name, 'mock')
      expect(e.type).toBe(STRIPE_EVENT_TYPES[name])
      expect(e.provider).toBe('mock')
      expect(paymentEventData(e)).toEqual(e.data)
      expect(JSON.stringify(e.data)).not.toMatch(/@|Kundin|Beispielstraße|10115/)
    }
  })

  it('unbekannter Typ → ignored (mit Anbieter-Typ); Referenz aus metadata, wenn client_reference_id fehlt', () => {
    const other = { ...fixture('refund.created'), type: 'payout.paid' }
    expect(normalizeStripeEvent(other, 'stripe')).toMatchObject({
      type: 'ignored',
      data: { providerType: 'payout.paid' },
    })
    const noClientRef = fixture('checkout.session.completed')
    noClientRef.data.object.client_reference_id = null
    expect(normalizeStripeEvent(noClientRef, 'stripe').data).toMatchObject({
      checkoutRef: FIXTURE_REF,
    })
  })

  it('falsche Form → PaymentEventShapeError', () => {
    const broken: ((e: ReturnType<typeof fixture>) => void)[] = [
      (e) => delete e.id,
      (e) => (e.created = 'gestern'),
      (e) => (e.data.object.amount_total = 79.9),
      (e) => delete e.data.object.status,
      (e) => (e.data.object.id = 'pi_falscher_typ'),
      (e) => ((e.data.object.metadata as Record<string, string>).checkoutRef = 'andere-ref'),
    ]
    for (const mutate of broken) {
      const e = fixture('checkout.session.completed')
      mutate(e)
      expect(() => normalizeStripeEvent(e, 'stripe')).toThrow(PaymentEventShapeError)
    }
    expect(() =>
      paymentEventData({ ...normalize('refund.created'), data: { providerType: 'x' } }),
    ).toThrow(PaymentEventShapeError)
  })
})

describe('Stripe-Fixtures (pnpm stripe:fixture)', () => {
  it('alle elf Dateien bestehen die Prüfung und tragen die gepinnte API-Version', () => {
    expect(FIXTURE_NAMES).toHaveLength(11)
    for (const name of FIXTURE_NAMES) {
      const json = JSON.parse(readFileSync(fixtureFile(name), 'utf8')) as Record<string, unknown>
      expect(checkFixture(name, json), name).toEqual([])
      if (name !== 'balance_transactions') expect(json.api_version).toBe(STRIPE_API_VERSION)
    }
  })

  it('Vorlagen sind gültig und deterministisch', () => {
    for (const name of FIXTURE_NAMES) {
      expect(checkFixture(name, generateFixture(name)), name).toEqual([])
      expect(generateFixture(name)).toEqual(generateFixture(name))
    }
  })

  it('erkennt unbereinigte Werte: echte IDs, Schlüssel, E-Mails, fremde URLs, livemode, Version, Referenz', () => {
    const base = () => generateFixture('checkout.session.completed') as ReturnType<typeof fixture>
    const cases: [string, (e: ReturnType<typeof fixture>) => void, RegExp][] = [
      ['ID', (e) => (e.data.object.payment_intent = 'pi_3PqRsTuVwXyZ01'), /nicht bereinigt/],
      ['Schlüssel', (e) => (e.data.object.metadata = { k: 'sk_test_abc' }), /Schlüssel/],
      ['E-Mail', (e) => (e.data.object.customer_email = 'jutta@gmail.com'), /E-Mail/],
      ['URL', (e) => (e.data.object.url = 'https://checkout.stripe.com/c/pay/x'), /URL/],
      ['livemode', (e) => (e.livemode = true), /livemode/],
      ['Version', (e) => (e.api_version = '2024-06-20'), /api_version/],
      ['Referenz', (e) => (e.data.object.client_reference_id = createRef()), /client_reference_id/],
      ['Client-Secret', (e) => (e.data.object.client_secret = 'cs_x_secret_y'), /client_secret/],
    ]
    for (const [what, mutate, message] of cases) {
      const e = base()
      mutate(e)
      expect(checkFixture('checkout.session.completed', e).join('\n'), what).toMatch(message)
    }
    const txn = generateFixture('balance_transactions') as { data: Record<string, unknown>[] }
    txn.data[0]!.net = 1
    expect(checkFixture('balance_transactions', txn).join('\n')).toMatch(/net/)
  })
})

function createRef(): string {
  return '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
}
