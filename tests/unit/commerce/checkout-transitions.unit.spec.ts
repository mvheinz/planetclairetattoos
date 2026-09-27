import { describe, expect, it } from 'vitest'

import {
  assertCheckoutTransition,
  canTransitionCheckout,
  CHECKOUT_CLOSE_REASON_REQUIRED,
  CHECKOUT_TIMESTAMP_FIELD,
} from '@/lib/commerce/checkoutTransitions'
import { CHECKOUT_STATUSES } from '@/lib/enums'

// DM-CHK-02 (Tabelle): genau die Kassen-Übergänge aus DATENMODELL §6.25.3 gelingen.
const ALLOWED = new Set([
  'open>confirming',
  'confirming>open',
  'open>completed',
  'confirming>completed',
  'open>expired',
  'confirming>expired',
  'open>cancelled',
  'confirming>failed',
])

describe('checkoutTransitions (DM-CHK-02)', () => {
  it('DM-CHK-02 Matrix über alle Statuspaare', () => {
    for (const from of CHECKOUT_STATUSES) {
      for (const to of CHECKOUT_STATUSES) {
        const allowed = ALLOWED.has(`${from}>${to}`)
        expect(canTransitionCheckout(from, to), `${from} → ${to}`).toBe(allowed)
        if (allowed) expect(() => assertCheckoutTransition(from, to)).not.toThrow()
        else expect(() => assertCheckoutTransition(from, to)).toThrow(/Kasse/)
      }
    }
  })

  it('DM-CHK-02 Endzustände mit Grund und je Zielstatus ein Zeitstempel', () => {
    expect([...CHECKOUT_CLOSE_REASON_REQUIRED].sort()).toEqual(['cancelled', 'expired', 'failed'])
    expect(CHECKOUT_TIMESTAMP_FIELD).toEqual({
      confirming: 'confirmingAt',
      completed: 'completedAt',
      expired: 'expiredAt',
      cancelled: 'cancelledAt',
      failed: 'failedAt',
    })
  })
})
