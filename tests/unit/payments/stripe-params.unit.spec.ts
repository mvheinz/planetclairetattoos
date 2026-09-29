import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ConfigError } from '@/lib/errors'
import { createLogger } from '@/lib/monitoring/logger'
import { checkoutReturnUrl } from '@/lib/payments/checkoutSession'
import { STRIPE_EVENT_FIXTURES } from '@/lib/payments/fixtures'
import { STRIPE_EVENT_NAMES } from '@/lib/payments/normalize'
import {
  createStripeAdapter,
  STRIPE_SIGNATURE_HEADER,
  StripeLivemodeError,
  StripeResponseError,
} from '@/lib/payments/stripe'
import {
  SDK_API_VERSION,
  Stripe,
  stripeClientConfig,
  stripeFetchHttpClient,
} from '@/lib/payments/stripe/client'
import {
  STRIPE_API_VERSION,
  stripeHostOptions,
  UPDATE_SHIPPING_STRATEGY,
} from '@/lib/payments/stripe/config'
import {
  InvalidCheckoutSessionInputError,
  InvalidSignatureError,
  PaymentSessionNotFoundError,
  type CreateCheckoutSessionInput,
} from '@/lib/payments/types'
import { createToken } from '@/lib/security/tokens'
import { fixedClock } from '@/lib/time'

// P4.5 – Stripe-Treiber ohne Netz (ARCHITEKTUR §3.5, R-062, KONZEPT §4.7): Das SDK bekommt einen `fetch`-Ersatz, der
// jede Anfrage mitschneidet und feste Antworten liefert. Geprüft werden Parameterbau, Kopfzeilen (API-Version,
// Idempotenz), Fehlerabbildung (Spike B-07 inkl. Rückfall), Modus-Wächter und Webhook-Signatur.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const NOW = '2026-10-15T08:00:00.000Z'
const NOW_S = Date.parse(NOW) / 1000
const REF = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const EMAIL = 'erika@example.com'
const WHSEC = 'whsec_unit_test_only'

interface Call {
  method: string
  url: URL
  headers: Headers
  body: URLSearchParams
  rawBody: string
}
type Reply = { status?: number; body: unknown }

function fakeStripe(reply: (c: Call) => Reply) {
  const calls: Call[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const rawBody = typeof init?.body === 'string' ? init.body : ''
    const call: Call = {
      method: init?.method ?? 'GET',
      url: new URL(String(input)),
      headers: new Headers(init?.headers),
      body: new URLSearchParams(rawBody),
      rawBody,
    }
    calls.push(call)
    const { status = 200, body } = reply(call)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'request-id': 'req_unit' },
    })
  }) as typeof fetch
  return { calls, httpClient: stripeFetchHttpClient(fetchFn) }
}

const session = (over: Record<string, unknown> = {}) => ({
  id: 'cs_test_unit1',
  object: 'checkout.session',
  livemode: false,
  status: 'open',
  payment_status: 'unpaid',
  client_secret: 'cs_test_unit1_secret_abc',
  expires_at: NOW_S + 31 * 60,
  amount_total: 7990,
  payment_intent: null,
  ...over,
})
const stripeError = (status: number, code: string, message = 'unit') => ({
  status,
  body: { error: { type: 'invalid_request_error', code, message } },
})

function adapter(reply: (c: Call) => Reply, env: Record<string, string> = {}) {
  const fake = fakeStripe(reply)
  const lines: string[] = []
  const a = createStripeAdapter(
    { STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: WHSEC, ...env },
    {
      clock: fixedClock(NOW),
      httpClient: fake.httpClient,
      logger: createLogger({ level: 'debug', sink: (l) => lines.push(l) }),
    },
  )
  return { a, calls: fake.calls, lines }
}

const token = createToken()
const input = (over: Partial<CreateCheckoutSessionInput> = {}): CreateCheckoutSessionInput => ({
  checkoutRef: REF,
  sessionSeq: 1,
  locale: 'de',
  lineItems: [
    { productId: 981, name: 'Nr. 981 · Schale', amountCents: 4500 },
    { productId: 982, name: 'Nr. 982 · Becher', amountCents: 2800 },
  ],
  shipping: { label: 'DHL Paket (Keramik)', amountCents: 690 },
  expiresAt: new Date(Date.parse(NOW) + 31 * 60_000),
  returnUrl: checkoutReturnUrl('http://localhost:3000', 'de', token),
  customerEmail: EMAIL,
  metadata: { checkoutRef: REF, appEnv: 'test' },
  ...over,
})

describe('Stripe-Treiber: Version und Client (ARCHITEKTUR §1.2, §3.5)', () => {
  it('STRIPE_API_VERSION = Version des gepinnten SDK; stripe und @stripe/stripe-js exakt gepinnt', () => {
    expect(STRIPE_API_VERSION).toBe(SDK_API_VERSION)
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies.stripe).toMatch(/^22\.\d+\.\d+$/)
    expect(pkg.dependencies['@stripe/stripe-js']).toMatch(/^9\.\d+\.\d+$/)
    expect(Stripe.PACKAGE_VERSION).toBe(pkg.dependencies.stripe)
  })

  it('Client: apiVersion, maxNetworkRetries 2, timeout 10 000, appInfo; STRIPE_API_BASE_URL → stripe-mock', () => {
    expect(stripeClientConfig({})).toEqual({
      apiVersion: STRIPE_API_VERSION,
      maxNetworkRetries: 2,
      timeout: 10_000,
      appInfo: { name: 'planetclaire' },
      telemetry: false,
    })
    expect(stripeClientConfig({ baseUrl: 'http://127.0.0.1:12111' })).toMatchObject({
      host: '127.0.0.1',
      port: '12111',
      protocol: 'http',
    })
    expect(stripeHostOptions('')).toBeUndefined()
    for (const bad of ['127.0.0.1:12111', 'ftp://x', 'http://127.0.0.1:12111/v1', 'nix']) {
      expect(() => stripeHostOptions(bad), bad).toThrow(ConfigError)
    }
  })

  it('Schlüsselregeln: ohne Schlüssel ConfigError; Live-Schlüssel nie mit STRIPE_API_BASE_URL; Modus aus dem Präfix', () => {
    expect(() => createStripeAdapter({ STRIPE_SECRET_KEY: '' })).toThrow(/STRIPE_SECRET_KEY fehlt/)
    expect(() => createStripeAdapter({ STRIPE_SECRET_KEY: 'pk_test_x' })).toThrow(ConfigError)
    expect(() =>
      createStripeAdapter({
        STRIPE_SECRET_KEY: 'sk_live_UNITONLY',
        STRIPE_API_BASE_URL: 'http://127.0.0.1:12111',
      }),
    ).toThrow(/Live-Schlüssel verboten/)
    expect(createStripeAdapter({ STRIPE_SECRET_KEY: 'rk_test_x' }).mode).toBe('test')
    expect(createStripeAdapter({ STRIPE_SECRET_KEY: 'rk_live_UNITONLY' }).mode).toBe('live')
  })
})

describe('Stripe-Treiber: Session anlegen (KONZEPT §4.7, R-062)', () => {
  it('R-062 Parameter-Test: nur card/paypal, elements/payment/eur, eine feste Versandoption, keine verbotenen Felder', async () => {
    const { a, calls } = adapter(() => ({ body: session() }))
    const handle = await a.createCheckoutSession(input())
    expect(handle).toEqual({
      sessionId: 'cs_test_unit1',
      clientSecret: 'cs_test_unit1_secret_abc',
      expiresAt: new Date(Date.parse(NOW) + 31 * 60_000),
    })
    expect(calls).toHaveLength(1)
    const [c] = calls
    expect(c!.method).toBe('POST')
    expect(c!.url.pathname).toBe('/v1/checkout/sessions')
    expect(c!.url.host).toBe('api.stripe.com')
    const b = Object.fromEntries(c!.body)
    expect(b).toMatchObject({
      ui_mode: 'elements',
      mode: 'payment',
      currency: 'eur',
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'paypal',
      client_reference_id: REF,
      'metadata[checkoutRef]': REF,
      'metadata[appEnv]': 'test',
      locale: 'de',
      return_url: `http://localhost:3000/de/danke/${token}`,
      customer_email: EMAIL,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': '4500',
      'line_items[1][price_data][unit_amount]': '2800',
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
      'shipping_options[0][shipping_rate_data][display_name]': 'DHL Paket (Keramik)',
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': '690',
      'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'eur',
    })
    const keys = Object.keys(b)
    // Nur zwei Zahlarten, genau eine Versandoption, Metadaten nur checkoutRef und appEnv.
    expect(keys.filter((k) => k.startsWith('payment_method_types'))).toHaveLength(2)
    expect(
      keys
        .filter((k) => k.startsWith('shipping_options['))
        .every((k) => k.startsWith('shipping_options[0]')),
    ).toBe(true)
    expect(keys.filter((k) => k.startsWith('metadata')).sort()).toEqual([
      'metadata[appEnv]',
      'metadata[checkoutRef]',
    ])
    for (const forbidden of [
      'payment_method_configuration',
      'success_url',
      'cancel_url',
      'submit_type',
      'after_expiration',
      'automatic_tax',
      'tax_id_collection',
      'payment_method_options',
      'customer_creation',
      'consent_collection',
    ]) {
      expect(
        keys.some((k) => k === forbidden || k.startsWith(`${forbidden}[`)),
        forbidden,
      ).toBe(false)
    }
    expect(c!.rawBody).not.toMatch(/link/)
  })

  it('expires_at ≥ 30 min nach Erstellung; Kassen-Token nur in return_url (nicht in Metadaten, Kopfzeilen, Protokoll)', async () => {
    const { a, calls, lines } = adapter(() => ({ body: session() }))
    await a.createCheckoutSession(input())
    const [c] = calls
    expect(Number(c!.body.get('expires_at'))).toBeGreaterThanOrEqual(NOW_S + 30 * 60)
    const withoutReturnUrl = new URLSearchParams(c!.body)
    withoutReturnUrl.delete('return_url')
    expect(withoutReturnUrl.toString()).not.toContain(token)
    expect(c!.rawBody.split(token)).toHaveLength(2)
    expect(JSON.stringify([...c!.headers])).not.toContain(token)
    const logged = lines.join('\n')
    expect(logged).toContain('payments.stripe.session_created')
    expect(logged).not.toContain(token)
    expect(logged).not.toContain(EMAIL)
    expect(logged).not.toContain('cs_test_unit1_secret')
    // Zu früher Ablauf oder Token als Referenz: kein Aufruf bei Stripe.
    await expect(
      a.createCheckoutSession(input({ expiresAt: new Date(Date.parse(NOW) + 29 * 60_000) })),
    ).rejects.toThrow(InvalidCheckoutSessionInputError)
    await expect(
      a.createCheckoutSession(
        input({ metadata: { checkoutRef: REF, appEnv: 'test', token } as never }),
      ),
    ).rejects.toThrow(InvalidCheckoutSessionInputError)
    expect(calls).toHaveLength(1)
  })

  it('Kopfzeilen: Stripe-Version = gepinnte Version, Idempotenz checkout:<checkoutRef>:<sessionSeq>', async () => {
    const { a, calls } = adapter(() => ({ body: session() }))
    await a.createCheckoutSession(input())
    await a.createCheckoutSession(input({ sessionSeq: 2 }))
    expect(calls.map((c) => c.headers.get('idempotency-key'))).toEqual([
      `checkout:${REF}:1`,
      `checkout:${REF}:2`,
    ])
    for (const c of calls) {
      expect(c.headers.get('stripe-version')).toBe(STRIPE_API_VERSION)
      expect(c.headers.get('authorization')).toBe('Bearer sk_test_unit')
      expect(c.headers.get('user-agent')).toContain('planetclaire')
    }
  })

  it('Antwort ohne client_secret → StripeResponseError', async () => {
    const { a } = adapter(() => ({ body: session({ client_secret: null }) }))
    await expect(a.createCheckoutSession(input())).rejects.toThrow(StripeResponseError)
  })

  it('Modus-Wächter: livemode true mit Testschlüssel stoppt den Treiber dauerhaft (ohne weitere Anfragen)', async () => {
    const { a, calls, lines } = adapter(() => ({ body: session({ livemode: true }) }))
    await expect(a.createCheckoutSession(input())).rejects.toThrow(StripeLivemodeError)
    await expect(a.getCheckoutSession('cs_test_unit1')).rejects.toThrow(StripeLivemodeError)
    expect(calls).toHaveLength(1)
    expect(lines.join()).toContain('payments.stripe.livemode_mismatch')
  })

  it('STRIPE_API_BASE_URL lenkt alle Anfragen auf stripe-mock um', async () => {
    const { a, calls } = adapter(() => ({ body: session() }), {
      STRIPE_API_BASE_URL: 'http://127.0.0.1:12111',
    })
    await a.createCheckoutSession(input())
    expect(calls[0]!.url.origin).toBe('http://127.0.0.1:12111')
  })
})

describe('Stripe-Treiber: Versand, Beenden, Abfragen, Erstattung', () => {
  it('Spike B-07: updateShipping sendet genau eine neue fixed_amount-Option → updated', async () => {
    expect(UPDATE_SHIPPING_STRATEGY).toBe('update')
    const { a, calls } = adapter(() => ({ body: session({ amount_total: 7300 }) }))
    expect(
      await a.updateShipping('cs_test_unit1', { label: 'Abholung in Berlin', amountCents: 0 }),
    ).toBe('updated')
    const [c] = calls
    expect(c!.method).toBe('POST')
    expect(c!.url.pathname).toBe('/v1/checkout/sessions/cs_test_unit1')
    expect(Object.fromEntries(c!.body)).toEqual({
      'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
      'shipping_options[0][shipping_rate_data][display_name]': 'Abholung in Berlin',
      'shipping_options[0][shipping_rate_data][fixed_amount][amount]': '0',
      'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'eur',
    })
    await expect(
      a.updateShipping('cs_test_unit1', { label: 'x', amountCents: 1.5 }),
    ).rejects.toThrow(/Cent/)
  })

  it('Spike B-07 Rückfall: Stripe lehnt ab bzw. Session nicht offen → recreate_required; unbekannt → NotFound', async () => {
    const rejected = adapter(() => stripeError(400, 'checkout_session_not_updatable'))
    expect(
      await rejected.a.updateShipping('cs_test_unit1', { label: 'Paket', amountCents: 690 }),
    ).toBe('recreate_required')
    expect(rejected.lines.join()).toContain('payments.stripe.update_shipping_rejected')
    const closed = adapter(() => ({ body: session({ status: 'expired' }) }))
    expect(
      await closed.a.updateShipping('cs_test_unit1', { label: 'Paket', amountCents: 690 }),
    ).toBe('recreate_required')
    const missing = adapter(() => stripeError(404, 'resource_missing'))
    await expect(
      missing.a.updateShipping('cs_test_nope', { label: 'Paket', amountCents: 690 }),
    ).rejects.toThrow(PaymentSessionNotFoundError)
  })

  it('expireCheckoutSession: expired bzw. Zustand nach Ablehnung (already_expired, already_complete_paid/unpaid)', async () => {
    const ok = adapter(() => ({ body: session({ status: 'expired' }) }))
    expect(await ok.a.expireCheckoutSession('cs_test_unit1')).toBe('expired')
    expect(ok.calls[0]!.url.pathname).toBe('/v1/checkout/sessions/cs_test_unit1/expire')

    const cases = [
      [{ status: 'expired' }, 'already_expired'],
      [{ status: 'complete', payment_status: 'paid' }, 'already_complete_paid'],
      [{ status: 'complete', payment_status: 'no_payment_required' }, 'already_complete_paid'],
      [{ status: 'complete', payment_status: 'unpaid' }, 'already_complete_unpaid'],
    ] as const
    for (const [state, expected] of cases) {
      const { a, calls } = adapter((c) =>
        c.url.pathname.endsWith('/expire')
          ? stripeError(400, 'checkout_session_not_expirable')
          : { body: session({ ...state, client_secret: null }) },
      )
      expect(await a.expireCheckoutSession('cs_test_unit1'), expected).toBe(expected)
      expect(calls.map((c) => c.method)).toEqual(['POST', 'GET'])
    }
    const missing = adapter(() => stripeError(404, 'resource_missing'))
    await expect(missing.a.expireCheckoutSession('cs_test_nope')).rejects.toThrow(
      PaymentSessionNotFoundError,
    )
  })

  it('getCheckoutSession: Zustand, Client-Secret nur bei open, Zahlart aus der letzten Belastung', async () => {
    const open = adapter(() => ({ body: session() }))
    expect(await open.a.getCheckoutSession('cs_test_unit1')).toEqual({
      sessionId: 'cs_test_unit1',
      status: 'open',
      paymentStatus: 'unpaid',
      clientSecret: 'cs_test_unit1_secret_abc',
      amountTotalCents: 7990,
    })
    expect(open.calls[0]!.url.searchParams.get('expand[0]')).toBe('payment_intent.latest_charge')

    const pi = (details: unknown) => ({
      id: 'pi_test_1',
      object: 'payment_intent',
      latest_charge: { id: 'ch_test_1', object: 'charge', payment_method_details: details },
    })
    const cases = [
      [{ type: 'paypal', paypal: {} }, { type: 'paypal' }],
      [
        { type: 'card', card: { wallet: { type: 'apple_pay' } } },
        { type: 'card', wallet: 'apple_pay' },
      ],
      [
        { type: 'card', card: { wallet: { type: 'google_pay' } } },
        { type: 'card', wallet: 'google_pay' },
      ],
      [{ type: 'card', card: { wallet: null } }, { type: 'card' }],
    ] as const
    for (const [details, paymentMethod] of cases) {
      const { a } = adapter(() => ({
        body: session({ status: 'complete', payment_status: 'paid', payment_intent: pi(details) }),
      }))
      expect(await a.getCheckoutSession('cs_test_unit1')).toEqual({
        sessionId: 'cs_test_unit1',
        status: 'complete',
        paymentStatus: 'paid',
        paymentIntentId: 'pi_test_1',
        amountTotalCents: 7990,
        paymentMethod,
      })
    }
    const missing = adapter(() => stripeError(404, 'resource_missing'))
    await expect(missing.a.getCheckoutSession('cs_test_nope')).rejects.toThrow(
      PaymentSessionNotFoundError,
    )
  })

  it('refund: Idempotenz refund:<orderId>:<refundSeq>, Betrag in Cent, Grund nur als Code', async () => {
    const { a, calls } = adapter(() => ({
      body: { id: 're_test_1', object: 'refund', status: 'pending', amount: 1500 },
    }))
    expect(
      await a.refund({
        paymentIntentId: 'pi_test_1',
        amountCents: 1500,
        reason: 'withdrawal',
        idempotencyKey: 'refund:42:1',
      }),
    ).toEqual({ refundId: 're_test_1', status: 'pending' })
    const [c] = calls
    expect(c!.url.pathname).toBe('/v1/refunds')
    expect(c!.headers.get('idempotency-key')).toBe('refund:42:1')
    expect(Object.fromEntries(c!.body)).toEqual({
      payment_intent: 'pi_test_1',
      amount: '1500',
      'metadata[reason]': 'withdrawal',
    })
    await expect(
      a.refund({ paymentIntentId: 'pi_test_1', amountCents: 0, reason: 'x', idempotencyKey: 'k' }),
    ).rejects.toThrow(/Cent/)
  })
})

describe('Stripe-Treiber: Webhooks und Abgleich', () => {
  const sign = (payload: string, secret = WHSEC, timestamp = NOW_S) =>
    new Headers({
      [STRIPE_SIGNATURE_HEADER]: Stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
        timestamp,
      }),
    })

  it('parseWebhook: Signatur mit STRIPE_WEBHOOK_SECRET → PaymentEvent (provider stripe)', () => {
    const { a } = adapter(() => ({ body: {} }))
    const raw = JSON.stringify(STRIPE_EVENT_FIXTURES['checkout.session.completed'])
    expect(a.parseWebhook(raw, sign(raw))).toMatchObject({
      id: STRIPE_EVENT_FIXTURES['checkout.session.completed'].id,
      provider: 'stripe',
      livemode: false,
      type: 'checkout.completed',
    })
  })

  it('parseWebhook: fremdes Geheimnis, veränderter Körper, fehlende Kopfzeile, zu alt → InvalidSignatureError', () => {
    const { a } = adapter(() => ({ body: {} }))
    const raw = JSON.stringify(STRIPE_EVENT_FIXTURES['refund.created'])
    expect(() => a.parseWebhook(raw, sign(raw, 'whsec_other'))).toThrow(InvalidSignatureError)
    expect(() => a.parseWebhook(raw.replace('"refund"', '"refunt"'), sign(raw))).toThrow(
      InvalidSignatureError,
    )
    expect(() => a.parseWebhook(raw, new Headers())).toThrow(InvalidSignatureError)
    expect(() => a.parseWebhook(raw, sign(raw, WHSEC, NOW_S - 301))).toThrow(InvalidSignatureError)
  })

  it('parseWebhook ohne STRIPE_WEBHOOK_SECRET → ConfigError (Webhook antwortet 500, Stripe wiederholt)', () => {
    const { a } = adapter(() => ({ body: {} }), { STRIPE_WEBHOOK_SECRET: '' })
    const raw = JSON.stringify(STRIPE_EVENT_FIXTURES['refund.created'])
    expect(() => a.parseWebhook(raw, sign(raw))).toThrow(ConfigError)
  })

  it('listEventsSince: nur die behandelten Typen ab `since`, älteste zuerst', async () => {
    const newer = { ...STRIPE_EVENT_FIXTURES['refund.created'], created: NOW_S + 60 }
    const older = { ...STRIPE_EVENT_FIXTURES['checkout.session.completed'], created: NOW_S + 10 }
    const { a, calls } = adapter(() => ({
      body: { object: 'list', data: [newer, older], has_more: false, url: '/v1/events' },
    }))
    const events = await a.listEventsSince(new Date(NOW))
    expect(events.map((e) => e.type)).toEqual(['checkout.completed', 'refund.created'])
    const q = calls[0]!.url.searchParams
    expect(q.get('created[gte]')).toBe(String(NOW_S))
    const types = [...q.entries()].filter(([k]) => /^types\[\d+\]$/.test(k)).map(([, v]) => v)
    expect(types).toEqual(STRIPE_EVENT_NAMES)
  })

  it('listBalanceTransactions: Gebühr/Netto je Buchung, Auszahlung über automatische Payouts', async () => {
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-11-01T00:00:00.000Z')
    const list = (data: unknown[]) => ({
      body: { object: 'list', data, has_more: false, url: '/x' },
    })
    const { a } = adapter((c) => {
      if (c.url.pathname === '/v1/payouts') {
        return list([
          { id: 'po_test_1', object: 'payout', automatic: true, arrival_date: 1_792_000_000 },
          { id: 'po_test_manual', object: 'payout', automatic: false, arrival_date: 1_792_100_000 },
        ])
      }
      if (c.url.searchParams.get('payout') === 'po_test_1') {
        return list([{ id: 'txn_test_2', object: 'balance_transaction' }])
      }
      return list([
        {
          id: 'txn_test_2',
          object: 'balance_transaction',
          type: 'refund',
          source: 're_test_1',
          fee: 0,
          net: -4500,
          created: 1_791_000_100,
        },
        {
          id: 'txn_test_p',
          object: 'balance_transaction',
          type: 'payout',
          source: 'po_test_1',
          fee: 0,
          net: -3200,
          created: 1_791_000_200,
        },
        {
          id: 'txn_test_1',
          object: 'balance_transaction',
          type: 'charge',
          source: { id: 'ch_test_1' },
          fee: 145,
          net: 7845,
          created: 1_791_000_000,
        },
      ])
    })
    expect(await a.listBalanceTransactions({ from, to })).toEqual([
      { id: 'txn_test_1', sourceId: 'ch_test_1', feeCents: 145, netCents: 7845 },
      {
        id: 'txn_test_2',
        sourceId: 're_test_1',
        feeCents: 0,
        netCents: -4500,
        payoutId: 'po_test_1',
        payoutDate: new Date(1_792_000_000 * 1000),
      },
    ])
  })
})
