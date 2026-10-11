import { describe, expect, it } from 'vitest'

import { availableOrderActions, daysUntilCancel } from '@/admin/components/orderActionsModel'
import { paidAfterCancelMessage } from '@/lib/commerce/prepaymentMessages'

// P4.20 – Knöpfe je Status und „noch X Tage bis Storno“ (Berliner Kalendertage) der Admin-Komponente OrderActions.

describe('OrderActions (P4.20)', () => {
  it('Knöpfe je Status: Vorkasse offen → Zahlung erhalten/Stornieren; Storno wegen Frist → Nachträglich bezahlt/Rücküberweisung; sonst keine', () => {
    expect(availableOrderActions({ status: 'awaiting_prepayment' })).toEqual([
      'prepaymentReceived',
      'cancel',
    ])
    expect(availableOrderActions({ status: 'cancelled', cancelReason: 'payment_timeout' })).toEqual(
      ['reactivate', 'refundTransferDone'],
    )
    for (const status of ['paid', 'shipped', 'refunded', 'disputed']) {
      expect(availableOrderActions({ status })).toEqual([])
    }
  })

  it('P18.5 nach Widerruf bzw. Storno durch Jutta: nur „Rücküberweisung erledigt“, nie „Nachträglich bezahlt“', () => {
    for (const cancelReason of ['withdrawn', 'admin']) {
      expect(availableOrderActions({ status: 'cancelled', cancelReason })).toEqual([
        'refundTransferDone',
      ])
    }
    expect(availableOrderActions({ status: 'cancelled', cancelReason: null })).toEqual([])
  })

  it('P18.5 „Zahlung erhalten“ bei stornierter Bestellung: Meldung sagt, was stattdessen zu tun ist', () => {
    expect(paidAfterCancelMessage('withdrawn')).toBe(
      'Die Bestellung wurde widerrufen – bitte das Geld zurücküberweisen und dann „Rücküberweisung erledigt“ klicken.',
    )
    expect(paidAfterCancelMessage('admin')).toMatch(/storniert – bitte das Geld zurücküberweisen/)
    expect(paidAfterCancelMessage('payment_timeout')).toMatch(/„Nachträglich bezahlt“/)
  })

  it('Resttage bis Storno in Berliner Kalendertagen (Frist Do 01.10.2026 23:59:59 Berlin)', () => {
    const due = '2026-10-01T21:59:59.000Z'
    expect(daysUntilCancel(due, new Date('2026-09-26T08:00:00.000Z'))).toBe(5)
    expect(daysUntilCancel(due, new Date('2026-09-30T22:30:00.000Z'))).toBe(0) // Do 00:30 Berlin
    expect(daysUntilCancel(due, new Date('2026-09-30T21:30:00.000Z'))).toBe(1) // Mi 23:30 Berlin
    expect(daysUntilCancel(due, new Date('2026-10-01T22:00:00.000Z'))).toBe(-1)
  })
})
