import { describe, expect, it } from 'vitest'

import {
  PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF,
  pickupEnabledIn,
  pickupOnlyOrderable,
  pickupSelectable,
} from '@/lib/shop/pickupPolicy'

// P18.5 – Schalter „Abholung möglich“ wirkt wirklich (KONZEPT §4.3 Regel 7): eine Stelle für Korb, Kasse und Seiten.

describe('pickupEnabledIn', () => {
  it('Standard an; nur ein ausdrückliches false schaltet ab', () => {
    expect(pickupEnabledIn({})).toBe(true)
    expect(pickupEnabledIn(null)).toBe(true)
    expect(pickupEnabledIn({ shipping: null })).toBe(true)
    expect(pickupEnabledIn({ shipping: { pickupEnabled: null } })).toBe(true)
    expect(pickupEnabledIn({ shipping: { pickupEnabled: true } })).toBe(true)
    expect(pickupEnabledIn({ shipping: { pickupEnabled: false } })).toBe(false)
  })
})

describe('Regeln bei ausgeschalteter Abholung', () => {
  it('konservativer Standard: nur_abholung ist dann nicht bestellbar, Abholung nie wählbar', () => {
    expect(PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF).toBe(true)
    expect(pickupOnlyOrderable(true)).toBe(true)
    expect(pickupOnlyOrderable(false)).toBe(false)
    expect(pickupSelectable(true, false)).toBe(true)
    expect(pickupSelectable(true, true)).toBe(true)
    expect(pickupSelectable(false, false)).toBe(false)
    expect(pickupSelectable(false, true)).toBe(false)
  })

  it('umgestellt (nur_abholung bleibt bestellbar): Abholung nur für Körbe mit einem solchen Stück', () => {
    expect(pickupOnlyOrderable(false, false)).toBe(true)
    expect(pickupSelectable(false, false, false)).toBe(false)
    expect(pickupSelectable(false, true, false)).toBe(true)
  })
})
