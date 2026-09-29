import { describe, expect, it } from 'vitest'

import { availableOrderActions, daysUntilCancel } from '@/admin/components/orderActionsModel'

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
    expect(availableOrderActions({ status: 'cancelled', cancelReason: 'admin' })).toEqual([])
    for (const status of ['paid', 'shipped', 'refunded', 'disputed']) {
      expect(availableOrderActions({ status })).toEqual([])
    }
  })

  it('Resttage bis Storno in Berliner Kalendertagen (Frist Do 01.10.2026 23:59:59 Berlin)', () => {
    const due = '2026-10-01T21:59:59.000Z'
    expect(daysUntilCancel(due, new Date('2026-09-26T08:00:00.000Z'))).toBe(5)
    expect(daysUntilCancel(due, new Date('2026-09-30T22:30:00.000Z'))).toBe(0) // Do 00:30 Berlin
    expect(daysUntilCancel(due, new Date('2026-09-30T21:30:00.000Z'))).toBe(1) // Mi 23:30 Berlin
    expect(daysUntilCancel(due, new Date('2026-10-01T22:00:00.000Z'))).toBe(-1)
  })
})
