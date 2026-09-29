import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import { changeCheckoutDelivery, reopenCheckout } from '@/lib/commerce/changeDelivery'
import { mockConfirmOutcome, mockConfirmSuccess } from '@/lib/commerce/mockConfirm'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import { getThanksState, thanksTokenHasOrder } from '@/lib/commerce/thanksState'
import type { PaymentsAdapter } from '@/lib/payments/types'
import { createToken } from '@/lib/security/tokens'

import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.25 Grenzfälle der Kassen-Dienste (Abdeckung `src/lib/commerce/**`; KONZEPT §4.7–§4.12): unbekannte Token, Kasse in
// falschem Zustand, Kasse ohne Zahlungs-Session (S13), Nicht-Mock-Treiber, Danke-Seite ohne Session, `thanksTokenHasOrder`.

const h = shopHarness({ start: '2026-10-10T10:00:00.000Z', numbers: [993, 994], tag: 'edges' })
const stripeLike = { driver: 'stripe', mode: 'test' } as unknown as PaymentsAdapter

async function dropSession(checkoutId: number) {
  await dbOf(h.payload).execute(
    sql`UPDATE checkouts SET stripe_checkout_session_id = NULL WHERE id = ${checkoutId}`,
  )
}

describe('Kassen-Dienste: Grenzfälle (P4.25)', () => {
  it('Mock-Bestätigung: fremder Treiber, unbekannter Token, beendete Kasse, Kasse ohne Session', async () => {
    const deps = { payload: h.payload, payments: h.mock }
    const unknown = createToken()
    const now = h.now()
    expect(
      await mockConfirmSuccess(
        { token: unknown, now },
        { payload: h.payload, payments: stripeLike },
      ),
    ).toEqual({ ok: false, code: 'not_mock' })
    expect(
      await mockConfirmOutcome(
        { token: unknown, outcome: 'declined', now },
        { payload: h.payload, payments: stripeLike },
      ),
    ).toEqual({ ok: false, code: 'not_mock' })
    expect(await mockConfirmSuccess({ token: unknown, now }, deps)).toEqual({
      ok: false,
      code: 'not_found',
    })
    expect(await mockConfirmOutcome({ token: unknown, outcome: 'delayed', now }, deps)).toEqual({
      ok: false,
      code: 'not_found',
    })

    const a = await h.piece(993)
    const r = await h.start([a])
    await dbOf(h.payload).execute(
      sql`UPDATE checkouts SET status = 'cancelled' WHERE id = ${r.checkoutId}`,
    )
    expect(await mockConfirmSuccess({ token: r.token, now }, deps)).toMatchObject({ ok: false })
    expect(
      await mockConfirmOutcome({ token: r.token, outcome: 'cancelled', now }, deps),
    ).toMatchObject({ ok: false })

    const b = await h.piece(994)
    const s = await h.start([b])
    await dropSession(s.checkoutId)
    expect(await mockConfirmSuccess({ token: s.token, now }, deps)).toEqual({
      ok: false,
      code: 'no_session',
    })
    expect(
      await mockConfirmOutcome({ token: s.token, outcome: 'declined', now }, deps),
    ).toMatchObject({ ok: false, code: 'no_session' })
  })

  it('Lieferart und Wiederöffnen: unbekannter Token, Kasse nicht in Bestätigung, abgelaufen', async () => {
    const deps = { payload: h.payload, payments: h.mock }
    const unknown = createToken()
    expect(
      await changeCheckoutDelivery({ token: unknown, method: 'pickup', now: h.now() }, deps),
    ).toMatchObject({ ok: false, code: 'not_found' })
    expect(await reopenCheckout({ token: unknown, now: h.now() }, deps)).toMatchObject({
      ok: false,
      code: 'not_found',
    })
    const a = await h.piece(993)
    const r = await h.start([a])
    expect(await reopenCheckout({ token: r.token, now: h.now() }, deps)).toMatchObject({
      ok: false,
      code: 'not_confirming',
    })
    // Lieferart ohne Zahlungs-Session (S13): nur Summen, keine Session
    await dropSession(r.checkoutId)
    expect(
      await changeCheckoutDelivery({ token: r.token, method: 'pickup', now: h.now() }, deps),
    ).toMatchObject({ ok: true })
    await dbOf(h.payload).execute(
      sql`UPDATE checkouts SET status = 'confirming', expires_at = now() - interval '1 hour' WHERE id = ${r.checkoutId}`,
    )
    expect(await reopenCheckout({ token: r.token, now: new Date() }, deps)).toMatchObject({
      ok: false,
    })
  })

  it('Danke-Seite: ungültiger/unbekannter Token, Kasse ohne Session wartet; thanksTokenHasOrder', async () => {
    const deps = { payload: h.payload, payments: h.mock }
    expect(await thanksTokenHasOrder('kurz', deps)).toBe(false)
    expect(await thanksTokenHasOrder(createToken(), deps)).toBe(false)
    const a = await h.piece(993)
    const { r, checkoutId } = await h.submitted([a])
    expect(await thanksTokenHasOrder(r.token, deps)).toBe(false)
    await dropSession(checkoutId)
    const state = await getThanksState(r.token, h.now(), deps)
    expect(state?.code).toBe('waiting')
  })

  it('Absenden: andere Lieferart als die Kasse, abgelaufene Session, Vorkasse ausgeschaltet → 409', async () => {
    const deps = { payload: h.payload, payments: h.mock }
    const raw = {
      email: 'erika@planetclaire.local',
      fulfillmentMethod: 'shipping',
      name: 'Erika Beispiel',
      shippingLine1: 'Musterstraße 1',
      shippingPostalCode: '10115',
      shippingCity: 'Berlin',
      paymentChoice: 'stripe',
    } as const
    const a = await h.piece(993)
    const r = await h.start([a])
    expect(
      await submitCheckout(
        {
          token: r.token,
          raw: {
            ...raw,
            fulfillmentMethod: 'pickup',
            billingLine1: 'Musterstraße 1',
            billingPostalCode: '10115',
            billingCity: 'Berlin',
          },
          cartItemIds: [a],
          now: h.now(),
        },
        deps,
      ),
    ).toMatchObject({ ok: false, code: 'delivery_changed' })
    await dbOf(h.payload).execute(
      sql`UPDATE checkouts SET stripe_session_expires_at = ${new Date(h.now().getTime() - 1000).toISOString()}::timestamptz WHERE id = ${r.checkoutId}`,
    )
    expect(
      await submitCheckout({ token: r.token, raw, cartItemIds: [a], now: h.now() }, deps),
    ).toMatchObject({ ok: false })

    const b = await h.piece(994)
    const s = await h.start([b])
    const settings = (await h.payload.findGlobal({ slug: 'settings', depth: 0 })) as {
      payment?: Record<string, unknown>
    }
    await h.payload.updateGlobal({
      slug: 'settings',
      data: { payment: { ...settings.payment, prepaymentEnabled: false } } as never,
      overrideAccess: true,
    })
    try {
      expect(
        await submitCheckout(
          {
            token: s.token,
            raw: { ...raw, paymentChoice: 'prepayment' },
            cartItemIds: [b],
            now: h.now(),
          },
          deps,
        ),
      ).toMatchObject({ ok: false, code: 'prepayment_disabled' })
    } finally {
      await h.payload.updateGlobal({
        slug: 'settings',
        data: { payment: settings.payment } as never,
        overrideAccess: true,
      })
    }
  })
})
