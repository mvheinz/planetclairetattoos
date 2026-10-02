import { describe, expect, it } from 'vitest'

import { createMockPaymentsAdapter, MockTestApiDisabledError } from '@/lib/payments/mock'
import { parseMockState, type MockState, type MockStoredEvent } from '@/lib/payments/mock/state'
import type { MockLocator, MockRow, MockStore } from '@/lib/payments/mock/store'
import type { CreateCheckoutSessionInput } from '@/lib/payments/types'
import { createToken } from '@/lib/security/tokens'
import { fixedClock } from '@/lib/time'

// P4.4/P4.25 – Mock-Zahlungstreiber ohne Datenbank (Speicher im Test, `MockStore`): Eingabeprüfungen der Test-API
// (`setNextOutcome`), Grenzfälle bei Versand, Ablauf, Erstattung, Anfechtung und verzögerter Zahlung sowie das Lesen
// alter/fremder Zustände (`parseMockState`). Die Kontrakt-Reihe gegen Postgres steht in
// `tests/int/adapters/payments.contract.int.spec.ts`.

const NOW = new Date('2026-10-15T08:00:00.000Z')
const REF = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

function memoryStore(refs: string[]): MockStore & { states: Map<string, MockState | null> } {
  const states = new Map<string, MockState | null>(refs.map((r) => [r, null]))
  const find = (where: MockLocator): string | null => {
    for (const [ref, state] of states) {
      if (where.by === 'checkoutRef' && ref === where.value) return ref
      if (
        state?.sessions.some((s) =>
          where.by === 'sessionId'
            ? s.sessionId === where.value
            : s.paymentIntentId === where.value,
        )
      )
        return ref
    }
    return null
  }
  return {
    states,
    async mutate(where, fn) {
      const ref = find(where)
      const row: MockRow | null =
        ref === null ? null : { checkoutId: 1, state: structuredClone(states.get(ref) ?? null) }
      const { next, result } = fn(row)
      if (ref !== null && next) states.set(ref, structuredClone(next))
      return result
    },
    async eventsSince(): Promise<MockStoredEvent[]> {
      return [...states.values()].flatMap((s) => s?.events ?? [])
    },
  }
}

const input = (over: Partial<CreateCheckoutSessionInput> = {}): CreateCheckoutSessionInput => ({
  checkoutRef: REF,
  sessionSeq: 1,
  locale: 'de',
  lineItems: [{ productId: 17, name: 'Nr. 017 · Schale', amountCents: 4500 }],
  shipping: { label: 'DHL Paket (Keramik)', amountCents: 690 },
  expiresAt: new Date(NOW.getTime() + 31 * 60_000),
  returnUrl: `https://planetclairetattoos.com/de/danke/${createToken()}`,
  customerEmail: 'erika@example.com',
  metadata: { checkoutRef: REF, appEnv: 'test' },
  ...over,
})

function adapter(appEnv: 'test' | 'production' = 'test') {
  const store = memoryStore([REF])
  const clock = fixedClock(NOW)
  const a = createMockPaymentsAdapter({ store, clock, appEnv, secret: 'x'.repeat(64) })
  return { a, store, clock }
}

describe('Mock-Treiber: Test-API und Grenzfälle', () => {
  it('setNextOutcome lehnt unbekannte Ergebnisse, Zahlarten, Wallets, Erstattungs- und Anfechtungsausgänge ab', async () => {
    const { a } = adapter()
    const { sessionId } = await a.createCheckoutSession(input())
    const bad: Record<string, unknown>[] = [
      { result: 'boom' },
      { paymentMethod: { type: 'sepa' } },
      { paymentMethod: { type: 'paypal', wallet: 'apple_pay' } },
      { paymentMethod: { type: 'card', wallet: 'samsung_pay' } },
      { refund: 'maybe' },
      { dispute: 'draw' },
    ]
    for (const next of bad)
      await expect(
        a.setNextOutcome(sessionId, next as never),
        JSON.stringify(next),
      ).rejects.toThrow()
    await a.setNextOutcome(sessionId, {
      result: 'success',
      paymentMethod: { type: 'card', wallet: 'google_pay' },
      refund: 'failed',
      dispute: 'won',
    })
  })

  it('Test-API nur in development/test; unbekannte Kasse und Session werden abgelehnt', async () => {
    const { a } = adapter('production')
    const { sessionId } = await a.createCheckoutSession(input())
    await expect(a.emit(sessionId, 'checkout.session.completed')).rejects.toBeInstanceOf(
      MockTestApiDisabledError,
    )
    const other = adapter()
    await expect(
      other.a.createCheckoutSession(
        input({
          checkoutRef: '11111111-1111-4111-8111-111111111111',
          metadata: { checkoutRef: '11111111-1111-4111-8111-111111111111', appEnv: 'test' },
        }),
      ),
    ).rejects.toThrow()
    await expect(other.a.getCheckoutSession('cs_mock_unbekannt')).rejects.toThrow()
  })

  it('Versand: ungültiger Betrag abgelehnt; nach Abschluss recreate_required', async () => {
    const { a } = adapter()
    const { sessionId } = await a.createCheckoutSession(input())
    await expect(a.updateShipping(sessionId, { label: 'x', amountCents: -1 })).rejects.toThrow()
    await expect(a.updateShipping(sessionId, { label: 'x', amountCents: 1.5 })).rejects.toThrow()
    expect(await a.updateShipping(sessionId, { label: 'Abholung', amountCents: 0 })).toBe('updated')
    await a.emit(sessionId, 'checkout.session.completed')
    expect(await a.updateShipping(sessionId, { label: 'Paket', amountCents: 690 })).toBe(
      'recreate_required',
    )
  })

  it('Verzögert: nur aus offener Session; danach async_payment_failed erlaubt, erneutes Verzögern nicht', async () => {
    const { a } = adapter()
    const { sessionId } = await a.createCheckoutSession(input())
    await a.setNextOutcome(sessionId, { paymentMethod: { type: 'paypal' } })
    await a.completeUnpaidWithoutEvent(sessionId)
    const state = await a.getCheckoutSession(sessionId)
    expect(state).toMatchObject({ status: 'complete', paymentStatus: 'unpaid' })
    expect(state.paymentMethod).toEqual({ type: 'paypal' })
    await expect(a.completeUnpaidWithoutEvent(sessionId)).rejects.toThrow()
    await a.emit(sessionId, 'checkout.session.async_payment_failed')
    await expect(a.emit(sessionId, 'checkout.session.expired')).rejects.toThrow()
  })

  it('Erstattung: Schlüssel Pflicht, Betrag positiv, nicht über dem offenen Betrag; unbezahlte Session abgelehnt; Wiederholung liefert dieselbe', async () => {
    const { a } = adapter()
    const { sessionId } = await a.createCheckoutSession(input())
    await a.emit(sessionId, 'checkout.session.completed')
    const pi = (await a.getCheckoutSession(sessionId)).paymentIntentId!
    await expect(
      a.refund({
        paymentIntentId: pi,
        amountCents: 100,
        idempotencyKey: '',
        reason: 'requested_by_customer',
      }),
    ).rejects.toThrow()
    await expect(
      a.refund({
        paymentIntentId: pi,
        amountCents: 0,
        idempotencyKey: 'k0',
        reason: 'requested_by_customer',
      }),
    ).rejects.toThrow()
    await expect(
      a.refund({
        paymentIntentId: pi,
        amountCents: 999_999,
        idempotencyKey: 'k1',
        reason: 'requested_by_customer',
      }),
    ).rejects.toThrow()
    const first = await a.refund({
      paymentIntentId: pi,
      amountCents: 1000,
      idempotencyKey: 'k2',
      reason: 'requested_by_customer',
    })
    expect(
      await a.refund({
        paymentIntentId: pi,
        amountCents: 1000,
        idempotencyKey: 'k2',
        reason: 'requested_by_customer',
      }),
    ).toEqual(first)
    // Zahlung ohne Mock-Kasse (Beispiel-Bestellung): stabile ID je Schlüssel, „erstattet“
    const seed = await a.refund({
      paymentIntentId: 'pi_seed',
      amountCents: 500,
      idempotencyKey: 's1',
      reason: 'requested_by_customer',
    })
    expect(seed.status).toBe('succeeded')
    expect(
      await a.refund({
        paymentIntentId: 'pi_seed',
        amountCents: 500,
        idempotencyKey: 's1',
        reason: 'requested_by_customer',
      }),
    ).toEqual(seed)

    const open = await a.createCheckoutSession(input({ sessionSeq: 2 }))
    await expect(a.emit(open.sessionId, 'charge.refunded')).rejects.toThrow()
  })

  it('Ereignisse: Erstattung und Anfechtung mit vorgegebenem Ausgang, vollständige Erstattung, PayPal-Zahlart', async () => {
    const { a } = adapter()
    const { sessionId } = await a.createCheckoutSession(input())
    await a.setNextOutcome(sessionId, { paymentMethod: { type: 'paypal' } })
    await a.emit(sessionId, 'checkout.session.completed')
    // refund.updated ohne vorherige Erstattung legt eine an; gewünschter Ausgang „pending“ zählt als „succeeded“.
    await a.setNextOutcome(sessionId, { refund: 'pending' })
    const upd = await a.emit(sessionId, 'refund.updated')
    expect(upd.event.type).toBe('refund.updated')
    await expect(a.emit(sessionId, 'refund.created')).rejects.toThrow(/vollständig erstattet/)
    const refunded = await a.emit(sessionId, 'charge.refunded')
    expect(refunded.event.type).toBe('charge.refunded')
    await a.setNextOutcome(sessionId, { dispute: 'won' })
    const closed = await a.emit(sessionId, 'charge.dispute.closed')
    expect(closed.event.type).toBe('dispute.closed')
    const events = await a.listEventsSince(new Date(0))
    expect(events.length).toBeGreaterThan(3)
  })
})

describe('parseMockState', () => {
  it('fremde oder alte Formen gelten als leer; fehlende Listen werden ergänzt', () => {
    expect(parseMockState(null)).toBeNull()
    expect(parseMockState('x')).toBeNull()
    expect(parseMockState({ v: 0, checkoutRef: REF })).toBeNull()
    expect(parseMockState({ v: 1, checkoutRef: 5 })).toBeNull()
    const s = parseMockState({ v: 1, checkoutRef: REF, sessions: 'kaputt' })
    expect(s).toEqual({
      v: 1,
      checkoutRef: REF,
      appEnv: 'development',
      sessions: [],
      refunds: [],
      disputes: [],
      events: [],
    })
  })
})
