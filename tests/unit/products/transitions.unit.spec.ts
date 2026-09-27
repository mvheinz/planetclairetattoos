import { describe, expect, it } from 'vitest'

import {
  evaluateProductTransition,
  PRODUCT_TRANSITION_NAMES,
  PRODUCT_TRANSITIONS,
  productTransitionId,
  type ProductTransitionFacts,
  type ProductTransitionInput,
} from '@/lib/commerce/productTransitions'
import { PRODUCT_STATUSES, type ProductStatus } from '@/lib/enums'

// AK-5-01 (Produkt), DM-PROD-10: Statusautomat laut DATENMODELL §6.6.7 / KONZEPT §5.1 (P2–P14; P1 Anlage, P15
// Löschen prüft der Hook).

/** Erlaubte Statuspaare mit Übergangs-IDs. */
const ALLOWED: Record<string, string[]> = {
  'draft>available': ['P2'],
  'available>draft': ['P3'],
  'available>reserved': ['P4'],
  'reserved>available': ['P5'],
  'reserved>reserved': ['P6'],
  'reserved>sold': ['P7', 'P10'],
  'available>sold': ['P8', 'P9'],
  'sold>available': ['P11'],
  'draft>archived': ['P12'],
  'available>archived': ['P12'],
  'sold>archived': ['P13'],
  'archived>draft': ['P14'],
}

const REF = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
/** Fakten und Eingaben, bei denen jede Vorbedingung erfüllt ist. */
function happy(id: string): { facts: ProductTransitionFacts; input: ProductTransitionInput } {
  const system = ['P4', 'P5', 'P6', 'P7', 'P8'].includes(id)
  const facts: ProductTransitionFacts = {
    actor: system ? 'system' : 'admin',
    reservationRef: REF,
    soldChannel: 'offline',
    reservation: { ref: REF, source: 'checkout_session', checkoutStatus: 'open' },
    order: {
      itemStatus: 'refunded',
      returnReceivedAt: '2026-10-10T10:00:00Z',
      refunds: [{ reason: 'withdrawal', status: 'succeeded' }],
    },
  }
  const input: ProductTransitionInput = {
    reservationRef: REF,
    reservedUntil: '2026-10-01T10:00:00Z',
    orderId: 1,
    channel: 'online',
    confirmReservedCheckout: true,
  }
  return { facts, input }
}

describe('PRODUCT_TRANSITIONS (AK-5-01, DM-PROD-10)', () => {
  it('DM-PROD-10 Matrix über alle Statuspaare: genau P2–P14 führen von → nach', () => {
    for (const from of PRODUCT_STATUSES) {
      for (const to of PRODUCT_STATUSES) {
        const ids = PRODUCT_TRANSITION_NAMES.map((t) => productTransitionId(t, from, to)).filter(
          (x): x is string => x !== null,
        )
        expect(ids.sort(), `${from} → ${to}`).toEqual((ALLOWED[`${from}>${to}`] ?? []).sort())
      }
    }
  })

  it('AK-5-01 jeder erlaubte Übergang gelingt mit seinen Bedingungen, jeder andere wird abgelehnt', () => {
    let ok = 0
    for (const from of PRODUCT_STATUSES) {
      for (const transition of PRODUCT_TRANSITION_NAMES) {
        const id = PRODUCT_TRANSITIONS[transition].from[from]
        const { facts, input } = happy(id ?? 'P2')
        const result = evaluateProductTransition(from, transition, facts, input)
        if (id) {
          expect(result, `${transition} aus ${from}`).toMatchObject({
            ok: true,
            id,
            to: PRODUCT_TRANSITIONS[transition].to,
          })
          ok++
        } else {
          expect(result.ok, `${transition} aus ${from}`).toBe(false)
        }
      }
    }
    expect(ok).toBe(14) // P2–P14 = 13 IDs, P12 aus zwei Ausgangsstatus
  })

  it('u. a. abgelehnt: reserved → archived, sold → reserved, archived → available', () => {
    const pairs: [ProductStatus, ProductStatus][] = [
      ['reserved', 'archived'],
      ['sold', 'reserved'],
      ['archived', 'available'],
      ['draft', 'sold'],
      ['draft', 'reserved'],
      ['archived', 'sold'],
    ]
    for (const [from, to] of pairs) {
      for (const t of PRODUCT_TRANSITION_NAMES) expect(productTransitionId(t, from, to)).toBeNull()
    }
  })

  it('Systemübergänge P4–P6 nie durch die Verwaltung; P9–P14 nicht durch das System', () => {
    const { facts, input } = happy('P4')
    for (const [from, t] of [
      ['available', 'reserve'],
      ['reserved', 'release'],
      ['reserved', 'convertToPrepayment'],
    ] as const) {
      expect(evaluateProductTransition(from, t, { ...facts, actor: 'admin' }, input).ok).toBe(false)
    }
    for (const [from, t] of [
      ['available', 'sellOffline'],
      ['draft', 'archive'],
      ['sold', 'archiveAfterReturn'],
      ['archived', 'restore'],
    ] as const) {
      expect(evaluateProductTransition(from, t, { ...facts, actor: 'system' }, input).ok).toBe(
        false,
      )
    }
  })

  it('P5–P7: nur mit der Reservierung des Vorgangs', () => {
    const { facts, input } = happy('P5')
    const other = { ...input, reservationRef: '00000000-0000-4000-8000-000000000000' }
    expect(evaluateProductTransition('reserved', 'release', facts, other).ok).toBe(false)
    expect(evaluateProductTransition('reserved', 'sell', facts, other).ok).toBe(false)
    expect(
      evaluateProductTransition('available', 'sell', facts, { ...input, orderId: undefined }).ok,
    ).toBe(false)
  })

  it('P10: nur Kasse (nicht Vorkasse), nur mit Bestätigung, gesperrt während „confirming“', () => {
    const { facts, input } = happy('P10')
    const run = (f: Partial<ProductTransitionFacts>, i: Partial<ProductTransitionInput> = {}) =>
      evaluateProductTransition('reserved', 'sellOffline', { ...facts, ...f }, { ...input, ...i })
    expect(run({})).toMatchObject({ ok: true, id: 'P10' })
    expect(
      run({ reservation: { ref: REF, source: 'prepayment', checkoutStatus: 'completed' } }),
    ).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Vorkasse/),
    })
    expect(run({}, { confirmReservedCheckout: false })).toMatchObject({ ok: false })
    expect(
      run({ reservation: { ref: REF, source: 'checkout_session', checkoutStatus: 'confirming' } }),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/Zahlung läuft gerade/) })
  })

  it('P11 „Wieder verkaufen“: offline verkauft, erstattet + zurück, oder Storno vor dem Versand', () => {
    const base: ProductTransitionFacts = { actor: 'admin', soldChannel: 'online' }
    const run = (order: ProductTransitionFacts['order'], soldChannel = 'online' as const) =>
      evaluateProductTransition('sold', 'returnToStock', { ...base, soldChannel, order }).ok
    expect(run(null, 'offline' as never)).toBe(true)
    expect(run({ itemStatus: 'refunded', returnReceivedAt: '2026-10-01' })).toBe(true)
    expect(run({ itemStatus: 'refunded', returnReceivedAt: null })).toBe(false)
    expect(
      run({
        itemStatus: 'active',
        refunds: [{ reason: 'admin_cancellation', status: 'succeeded' }],
      }),
    ).toBe(true)
    expect(
      run({
        itemStatus: 'active',
        shippedAt: '2026-10-01',
        refunds: [{ reason: 'admin_cancellation', status: 'succeeded' }],
      }),
    ).toBe(false)
    expect(run({ refunds: [{ reason: 'admin_cancellation', status: 'pending' }] })).toBe(false)
    expect(run({ refunds: [{ reason: 'breakage', status: 'succeeded' }] })).toBe(false)
    expect(
      evaluateProductTransition('sold', 'returnToStock', { ...base, order: null }),
    ).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Wieder verkaufen/),
    })
  })

  it('P13 „Ausblenden“ nach Verkauf: erstattet + zurück oder Erstattung wegen Bruch', () => {
    const run = (order: ProductTransitionFacts['order']) =>
      evaluateProductTransition('sold', 'archiveAfterReturn', {
        actor: 'admin',
        soldChannel: 'online',
        order,
      })
    expect(run({ itemStatus: 'refunded', returnReceivedAt: '2026-10-01' }).ok).toBe(true)
    expect(run({ refunds: [{ reason: 'breakage', status: 'succeeded' }] }).ok).toBe(true)
    expect(run({ refunds: [{ reason: 'goodwill', status: 'succeeded' }] })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Ausblenden/),
    })
    expect(run(null).ok).toBe(false)
  })
})
