import { describe, expect, it } from 'vitest'

import { cartNoticeSearch, parseCartNotice } from '@/lib/commerce/checkout'
import {
  evaluateProductTransition,
  isProductTransition,
  productTransitionId,
} from '@/lib/commerce/productTransitions'

// P4.25 Abdeckung (`src/lib/commerce/**`): Vorbedingungen des Stück-Statusautomaten für die Kassen-Übergänge P4–P10
// (DATENMODELL §6.6.7, KONZEPT §5.1) und der Korb-Hinweis nach einer abgelehnten Kasse (KONZEPT §4.3, P4.9).

const REF = 'ref-1'

describe('Statusautomat der Stücke: Vorbedingungen P4–P10 (DM-PROD-10)', () => {
  it('Namen und Übergangs-IDs; unbekannter Übergang → null', () => {
    expect(isProductTransition('reserve')).toBe(true)
    expect(isProductTransition('fly')).toBe(false)
    expect(isProductTransition(5)).toBe(false)
    expect(productTransitionId('fly', 'available', 'reserved')).toBeNull()
    expect(productTransitionId('reserve', 'available', 'reserved')).toBe('P4')
    expect(productTransitionId('reserve', 'available', 'sold')).toBeNull()
  })

  it('P4 reservieren nur mit Referenz und Ende; P5–P7 nur mit derselben Reservierung; P6/P7/P8 brauchen die Bestellung', () => {
    const sys = { actor: 'system' as const, reservationRef: REF }
    expect(evaluateProductTransition('available', 'reserve', sys, {})).toMatchObject({ ok: false })
    expect(
      evaluateProductTransition('available', 'reserve', sys, {
        reservationRef: REF,
        reservedUntil: new Date(),
      }),
    ).toMatchObject({ ok: true, id: 'P4' })
    expect(
      evaluateProductTransition('reserved', 'release', sys, { reservationRef: 'andere' }),
    ).toMatchObject({ ok: false })
    expect(
      evaluateProductTransition('reserved', 'convertToPrepayment', sys, { reservationRef: REF }),
    ).toMatchObject({ ok: false, message: 'Bestellung fehlt.' })
    expect(
      evaluateProductTransition('reserved', 'sell', sys, { reservationRef: REF, orderId: 1 }),
    ).toMatchObject({ ok: false, message: 'Bestellung fehlt.' })
    expect(
      evaluateProductTransition('reserved', 'sell', sys, {
        reservationRef: REF,
        orderId: 1,
        channel: 'pickup',
      }),
    ).toMatchObject({ ok: true, id: 'P7' })
    expect(evaluateProductTransition('available', 'sell', sys, { orderId: 1 })).toMatchObject({
      ok: false,
    })
    expect(
      evaluateProductTransition('available', 'sell', sys, { orderId: 1, channel: 'online' }),
    ).toMatchObject({ ok: true, id: 'P8' })
    // Nur die Verwaltung verkauft offline; im falschen Status nie.
    expect(evaluateProductTransition('available', 'sellOffline', sys, {})).toMatchObject({
      ok: false,
    })
    expect(evaluateProductTransition('draft', 'sell', sys, {})).toMatchObject({ ok: false })
  })

  it('P10 „Offline verkauft“ bei reserviertem Stück: nie bei Vorkasse, nur mit Bestätigung, nicht während der Zahlung, nur bei offener Kasse', () => {
    const admin = (checkoutStatus: string | null, source = 'checkout_session') => ({
      actor: 'admin' as const,
      reservation: { ref: REF, source, checkoutStatus } as never,
    })
    expect(
      evaluateProductTransition('reserved', 'sellOffline', admin('open', 'prepayment'), {
        confirmReservedCheckout: true,
      }),
    ).toMatchObject({ ok: false })
    expect(evaluateProductTransition('reserved', 'sellOffline', admin('open'), {})).toMatchObject({
      ok: false,
    })
    expect(
      evaluateProductTransition('reserved', 'sellOffline', admin('confirming'), {
        confirmReservedCheckout: true,
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('Zahlung läuft') })
    expect(
      evaluateProductTransition('reserved', 'sellOffline', admin('expired'), {
        confirmReservedCheckout: true,
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('nicht mehr offen') })
    expect(
      evaluateProductTransition('reserved', 'sellOffline', admin('open'), {
        confirmReservedCheckout: true,
      }),
    ).toMatchObject({ ok: true, id: 'P10' })
  })
})

describe('Korb-Hinweis nach abgelehnter Kasse (KONZEPT §4.3)', () => {
  it('Hin und zurück: Code, Nummern (1–99999, höchstens 20), Höchstzahl; Unbekanntes → null', () => {
    const search = cartNoticeSearch('too_many', { itemNumbers: [17, 23], max: 10 })
    expect(parseCartNotice(new URLSearchParams(search))).toEqual({
      code: 'too_many',
      itemNumbers: [17, 23],
      max: 10,
    })
    expect(parseCartNotice(new URLSearchParams('hinweis=reserved'))).toEqual({
      code: 'reserved',
      itemNumbers: [],
      max: null,
    })
    expect(
      parseCartNotice(new URLSearchParams('hinweis=reserved&nr=0,abc,123456,5&max=100')),
    ).toEqual({ code: 'reserved', itemNumbers: [5], max: null })
    expect(parseCartNotice(new URLSearchParams('hinweis=boom'))).toBeNull()
    expect(parseCartNotice(new URLSearchParams(''))).toBeNull()
    const many = Array.from({ length: 25 }, (_, i) => i + 1).join(',')
    expect(
      parseCartNotice(new URLSearchParams(`hinweis=unavailable&nr=${many}`))!.itemNumbers,
    ).toHaveLength(20)
  })
})
