import net from 'node:net'

import { describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { createLogger } from '@/lib/monitoring/logger'
import { createPaymentsAdapter, InvalidSignatureError } from '@/lib/payments'
import {
  MOCK_SIGNATURE_HEADER,
  createMockPaymentsAdapter,
  signMockWebhook,
} from '@/lib/payments/mock'
import { createMemoryMockStore } from '@/lib/payments/mock/store'
import type { CreateCheckoutSessionInput } from '@/lib/payments/types'
import { fixedClock } from '@/lib/time'

// P1.10 – Kontrakttest Zahlung (ARCHITEKTUR §3.1 Nr. 3, §3.5): Mock immer (ohne Netzwerk, Wächter aktiv); das
// Stripe-Gerüst gegen stripe-mock nur, wenn erreichbar. Die volle Reihe (Fixtures, DB-Zustand) folgt in P4.4.

const NOW = '2026-10-15T08:00:00.000Z'
const clock = fixedClock(NOW)
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const REF = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

const input = (over: Partial<CreateCheckoutSessionInput> = {}): CreateCheckoutSessionInput => ({
  checkoutRef: REF,
  locale: 'de',
  lineItems: [
    { productId: 981, name: 'Nr. 981 · Schale', amountCents: 4500 },
    { productId: 982, name: 'Nr. 982 · Becher', amountCents: 2800 },
  ],
  shipping: { label: 'Paket', amountCents: 690 },
  expiresAt: new Date(Date.parse(NOW) + 35 * 60_000),
  returnUrl: 'http://localhost:3000/de/danke/TOKEN-NUR-HIER',
  customerEmail: 'erika@example.com',
  metadata: { checkoutRef: REF, appEnv: 'test' },
  ...over,
})

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

describe('Zahlung – Mock-Treiber', () => {
  it('Session anlegen und abrufen: IDs cs_mock_/mock_secret_, Betrag in Cent, clientSecret nur bei open', async () => {
    const store = createMemoryMockStore()
    const mock = createMockPaymentsAdapter({ store, clock })
    expect(mock).toMatchObject({ driver: 'mock', mode: 'mock' })
    const handle = await mock.createCheckoutSession(input())
    expect(handle.sessionId).toMatch(new RegExp(`^cs_mock_${UUID.source}`))
    expect(handle.clientSecret).toMatch(new RegExp(`^mock_secret_${UUID.source}`))
    const state = await mock.getCheckoutSession(handle.sessionId)
    expect(state).toMatchObject({
      status: 'open',
      paymentStatus: 'unpaid',
      clientSecret: handle.clientSecret,
      amountTotalCents: 4500 + 2800 + 690,
    })
    // Datensparsamkeit (§3.1 Nr. 6): gespeichert wird nur checkoutRef – kein Token, keine E-Mail.
    const record = JSON.stringify(await store.getSession(handle.sessionId))
    expect(record).toContain(REF)
    expect(record).not.toContain('TOKEN-NUR-HIER')
    expect(record).not.toContain('erika@')
  })

  it('Regeln: Ablauf ≥ 30 min, metadata.checkoutRef = checkoutRef', async () => {
    const mock = createMockPaymentsAdapter({ clock })
    await expect(
      mock.createCheckoutSession(input({ expiresAt: new Date(Date.parse(NOW) + 29 * 60_000) })),
    ).rejects.toThrow(/30 Minuten/)
    await expect(
      mock.createCheckoutSession(input({ metadata: { checkoutRef: 'anders', appEnv: 'test' } })),
    ).rejects.toThrow(/checkoutRef/)
  })

  it('Versand aktualisieren: offen → updated, sonst recreate_required', async () => {
    const mock = createMockPaymentsAdapter({ clock })
    const { sessionId } = await mock.createCheckoutSession(input())
    expect(await mock.updateShipping(sessionId, { label: 'Abholung', amountCents: 0 })).toBe(
      'updated',
    )
    expect((await mock.getCheckoutSession(sessionId)).amountTotalCents).toBe(4500 + 2800)
    await mock.expireCheckoutSession(sessionId)
    expect(await mock.updateShipping(sessionId, { label: 'Paket', amountCents: 690 })).toBe(
      'recreate_required',
    )
  })

  it('Beenden: expired, already_expired, already_complete_paid, already_complete_unpaid', async () => {
    const store = createMemoryMockStore()
    const mock = createMockPaymentsAdapter({ store, clock })
    const a = await mock.createCheckoutSession(input())
    expect(await mock.expireCheckoutSession(a.sessionId)).toBe('expired')
    expect(await mock.expireCheckoutSession(a.sessionId)).toBe('already_expired')
    const state = await mock.getCheckoutSession(a.sessionId)
    expect(state.status).toBe('expired')
    expect(state.clientSecret).toBeUndefined()

    const b = await mock.createCheckoutSession(input())
    const event = await mock.emit(b.sessionId, 'checkout.completed')
    expect(event).toMatchObject({ provider: 'mock', livemode: false, type: 'checkout.completed' })
    expect(event.id).toMatch(/^evt_mock_/)
    expect(event.data).toMatchObject({ checkoutRef: REF, paymentStatus: 'paid' })
    expect(String(event.data.paymentIntentId)).toMatch(/^pi_mock_/)
    expect(await mock.expireCheckoutSession(b.sessionId)).toBe('already_complete_paid')

    const c = await mock.createCheckoutSession(input())
    const rec = (await store.getSession(c.sessionId))!
    await store.putSession({ ...rec, status: 'complete', paymentStatus: 'unpaid' })
    expect(await mock.expireCheckoutSession(c.sessionId)).toBe('already_complete_unpaid')

    expect((await mock.listEventsSince(new Date(NOW))).map((e) => e.id)).toEqual([event.id])
    await expect(mock.getCheckoutSession('cs_mock_unbekannt')).rejects.toThrow(/unbekannt/)
  })

  it('Erstattung: re_mock_, idempotent je Schlüssel, nur positive Cent-Beträge', async () => {
    const mock = createMockPaymentsAdapter({ clock })
    const i = {
      paymentIntentId: 'pi_mock_x',
      amountCents: 1500,
      reason: 'withdrawal',
      idempotencyKey: 'refund:981:1',
    }
    const first = await mock.refund(i)
    expect(first).toMatchObject({ status: 'succeeded' })
    expect(first.refundId).toMatch(/^re_mock_/)
    expect(await mock.refund(i)).toEqual(first)
    await expect(mock.refund({ ...i, idempotencyKey: 'k2', amountCents: 12.5 })).rejects.toThrow(
      /Cent/,
    )
    expect(await mock.listBalanceTransactions({ from: new Date(NOW), to: new Date(NOW) })).toEqual(
      [],
    )
  })

  it('Webhook prüfen: gültige Signatur → PaymentEvent, falsche → InvalidSignatureError', () => {
    const mock = createMockPaymentsAdapter({ clock })
    const raw = JSON.stringify({
      id: 'evt_mock_1',
      type: 'checkout.completed',
      created: NOW,
      data: { checkoutRef: REF },
    })
    const ok = mock.parseWebhook(
      raw,
      new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(raw) }),
    )
    expect(ok).toMatchObject({
      id: 'evt_mock_1',
      provider: 'mock',
      type: 'checkout.completed',
      livemode: false,
      data: { checkoutRef: REF },
    })
    expect(ok.createdAt.toISOString()).toBe(NOW)
    expect(() =>
      mock.parseWebhook(raw, new Headers({ [MOCK_SIGNATURE_HEADER]: 'falsch' })),
    ).toThrow(InvalidSignatureError)
    expect(() =>
      mock.parseWebhook(`${raw} `, new Headers({ [MOCK_SIGNATURE_HEADER]: signMockWebhook(raw) })),
    ).toThrow(InvalidSignatureError)
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

  it('stripe mit Testschlüssel: Gerüst (mode test), Umsetzung folgt in P4', async () => {
    const a = createPaymentsAdapter(
      env({ APP_ENV: 'test', PAYMENTS_DRIVER: 'stripe', STRIPE_SECRET_KEY: 'sk_test_123' }),
    )
    expect(a).toMatchObject({ driver: 'stripe', mode: 'test' })
    await expect(a.createCheckoutSession(input())).rejects.toThrow(/folgt in P4/)
  })
})

describe.skipIf(!stripeMockAvailable)(
  'Zahlung – stripe-mock (docker compose --profile payments)',
  () => {
    it('stripe-mock antwortet lokal; der Stripe-Treiber bleibt bis P4 ein Gerüst', async () => {
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
