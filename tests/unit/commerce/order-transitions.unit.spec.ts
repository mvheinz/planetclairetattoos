import { describe, expect, it } from 'vitest'

import {
  assertOrderTransition,
  evaluateOrderTransition,
  ORDER_INITIAL,
  ORDER_TRANSITIONS,
} from '@/lib/commerce/orderTransitions'
import { ORDER_STATUSES, type OrderStatus } from '@/lib/enums'

// DM-ORD-01 (Tabelle): DATENMODELL §6.8.5, KONZEPT §5.3 (O3–O18, O20, O21).

/** Erlaubte Paare mit Übergangs-ID (ohne O17/O20, die vom gemerkten Vorstatus abhängen). */
const ALLOWED: Record<string, string> = {
  'awaiting_prepayment>paid': 'O3',
  'awaiting_prepayment>cancelled': 'O4',
  'cancelled>paid': 'O5',
  'paid>packed': 'O6',
  'paid>shipped': 'O7',
  'packed>shipped': 'O7',
  'paid>ready_for_pickup': 'O8',
  'ready_for_pickup>picked_up': 'O9',
  'shipped>delivered': 'O10',
  'paid>withdrawal_received': 'O11',
  'packed>withdrawal_received': 'O11',
  'shipped>withdrawal_received': 'O11',
  'delivered>withdrawal_received': 'O11',
  'ready_for_pickup>withdrawal_received': 'O11',
  'picked_up>withdrawal_received': 'O11',
  'withdrawal_received>return_received': 'O12',
  'withdrawal_received>refunded': 'O13',
  'return_received>refunded': 'O13',
  'withdrawal_received>partially_refunded': 'O14',
  'return_received>partially_refunded': 'O14',
  'paid>refunded': 'O15',
  'packed>refunded': 'O15',
  'shipped>refunded': 'O15',
  'delivered>refunded': 'O15',
  'ready_for_pickup>refunded': 'O15',
  'picked_up>refunded': 'O15',
  'paid>partially_refunded': 'O15',
  'packed>partially_refunded': 'O15',
  'shipped>partially_refunded': 'O15',
  'delivered>partially_refunded': 'O15',
  'ready_for_pickup>partially_refunded': 'O15',
  'picked_up>partially_refunded': 'O15',
  'paid>disputed': 'O16',
  'packed>disputed': 'O16',
  'shipped>disputed': 'O16',
  'delivered>disputed': 'O16',
  'ready_for_pickup>disputed': 'O16',
  'picked_up>disputed': 'O16',
  'withdrawal_received>disputed': 'O16',
  'return_received>disputed': 'O16',
  'partially_refunded>disputed': 'O16',
  'disputed>refunded': 'O18',
  'partially_refunded>refunded': 'O21',
}

const pairs = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const))

describe('orderTransitions (DM-ORD-01)', () => {
  it('DM-ORD-01 ORDER_STATUSES ist exakt das Enum aus DATENMODELL §4', () => {
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
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort())
    expect(ORDER_INITIAL).toEqual({ paid: 'O1', awaiting_prepayment: 'O2', refunded: 'O19' })
  })

  it.each(Object.entries(ALLOWED))('DM-ORD-01 erlaubt: %s = %s', (pair, id) => {
    const [from, to] = pair.split('>') as [OrderStatus, OrderStatus]
    expect(assertOrderTransition(from, to, { cancelReason: 'payment_timeout' })).toBe(id)
  })

  it('DM-ORD-01 jeder andere Übergang (Matrix aller Paare) wirft einen Fehler', () => {
    let rejected = 0
    for (const [from, to] of pairs) {
      if (ALLOWED[`${from}>${to}`]) continue
      expect(() => assertOrderTransition(from, to, { cancelReason: 'payment_timeout' })).toThrow()
      rejected++
    }
    expect(rejected).toBe(pairs.length - Object.keys(ALLOWED).length)
  })

  it('DM-ORD-01 O5 nur bei cancelReason = payment_timeout', () => {
    expect(evaluateOrderTransition('cancelled', 'paid', { cancelReason: 'admin' }).ok).toBe(false)
    expect(evaluateOrderTransition('cancelled', 'paid', { cancelReason: 'withdrawn' }).ok).toBe(
      false,
    )
    expect(() => assertOrderTransition('cancelled', 'paid', {})).toThrow(/Nachträglich bezahlt/)
  })

  it('DM-ORD-01 O17 zurück auf statusBeforeDispute, O20 auf statusBeforeWithdrawal – nur dorthin', () => {
    for (const before of ['paid', 'shipped', 'partially_refunded'] as const) {
      expect(assertOrderTransition('disputed', before, { statusBeforeDispute: before })).toBe('O17')
      expect(evaluateOrderTransition('disputed', before, {}).ok).toBe(false)
    }
    expect(
      evaluateOrderTransition('disputed', 'delivered', { statusBeforeDispute: 'paid' }).ok,
    ).toBe(false)
    for (const before of ['paid', 'delivered', 'picked_up'] as const) {
      expect(
        assertOrderTransition('withdrawal_received', before, { statusBeforeWithdrawal: before }),
      ).toBe('O20')
      expect(evaluateOrderTransition('withdrawal_received', before, {}).ok).toBe(false)
    }
  })

  it('DM-ORD-01 Paare mit disputed (P4.22): O16 aus genau neun Status, von disputed nur O18 bzw. O17 zum Vorstatus', () => {
    const into = ORDER_STATUSES.filter((from) => evaluateOrderTransition(from, 'disputed').ok)
    expect(into.sort()).toEqual(
      [
        'paid',
        'packed',
        'shipped',
        'delivered',
        'ready_for_pickup',
        'picked_up',
        'withdrawal_received',
        'return_received',
        'partially_refunded',
      ].sort(),
    )
    for (const from of ['awaiting_prepayment', 'cancelled', 'refunded', 'disputed'] as const) {
      expect(evaluateOrderTransition(from, 'disputed').ok).toBe(false)
    }
    for (const before of into) {
      expect(assertOrderTransition('disputed', 'refunded', { statusBeforeDispute: before })).toBe(
        'O18',
      )
      expect(assertOrderTransition('disputed', before, { statusBeforeDispute: before })).toBe('O17')
    }
  })
})
