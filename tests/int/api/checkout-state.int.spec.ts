import { randomInt } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { createOrderFromCheckout } from '@/lib/commerce/createOrderFromCheckout'
import { handleCheckoutState } from '@/lib/commerce/tokenPages'
import { RATE_LIMITS } from '@/lib/security/rateLimit'
import { createToken } from '@/lib/security/tokens'

import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.17 – `GET /api/checkout/[token]/state` (ARCHITEKTUR §2.5, KONZEPT §2.7): Header (`no-store`, `no-referrer`,
// `noindex`), nur Zustandscodes (waiting, paid, prepayment, gone, unpaid), keine Personendaten, 404, 429 über
// `token_pages`.

const NUMBERS = [990, 991, 992, 993, 994]
const h = shopHarness({ start: '2026-10-08T10:00:00.000Z', numbers: NUMBERS, tag: 'state' })

const ip = () => `203.0.113.${randomInt(1, 250)}`
const call = (token: string, from = ip()) =>
  handleCheckoutState(
    new Request(`http://localhost/api/checkout/${token}/state`, {
      headers: { 'x-forwarded-for': from },
    }),
    token,
    h.now(),
    { payload: h.payload, payments: h.mock },
  )

async function expectState(token: string, state: string) {
  const res = await call(token)
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(JSON.parse(text)).toEqual({ state })
  return text
}

describe('GET /api/checkout/[token]/state (P4.17)', () => {
  it('Header: private, no-store; no-referrer; noindex – auch bei 404', async () => {
    const id = await h.piece(990)
    const s = await h.submitted([id], { confirming: false })
    for (const res of [await call(s.r.token), await call(createToken())]) {
      expect(res.headers.get('cache-control')).toBe('private, no-store')
      expect(res.headers.get('referrer-policy')).toBe('no-referrer')
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(res.headers.get('set-cookie')).toBeNull()
    }
  })

  it('Zustandscodes unpaid, waiting, paid ohne Bestellnummer und ohne Personendaten', async () => {
    const id = await h.piece(991)
    const s = await h.submitted([id], { confirming: false })
    await expectState(s.r.token, 'unpaid')

    const id2 = await h.piece(992)
    const w = await h.submitted([id2])
    await h.mock.setNextOutcome(w.session!, { result: 'delayed' })
    await h.emit(w.session!, 'checkout.session.completed')
    await expectState(w.r.token, 'waiting')
    await h.emit(w.session!, 'checkout.session.async_payment_succeeded')
    const text = await expectState(w.r.token, 'paid')
    const order = await h.orderOfCheckout(w.checkoutId)
    expect(text).not.toContain(order.orderNumber)
    expect(text).not.toContain(w.email)
    expect(text).not.toContain('Erika')
  })

  it('Zustandscodes prepayment (O2) und gone (O19)', async () => {
    const id = await h.piece(993)
    const s = await h.submitted([id], { confirming: false })
    const req = await createLocalReq({ context: { system: true } }, h.payload)
    await createOrderFromCheckout(req, s.checkoutId, { transition: 'O2', now: h.now() })
    await expectState(s.r.token, 'prepayment')

    const id2 = await h.piece(994)
    const g = await h.submitted([id2])
    await dbOf(h.payload).execute(sql`
      UPDATE products SET status = 'sold', sold_channel = 'offline', reservation_ref = NULL, reserved_until = NULL
       WHERE id = ${id2}
    `)
    await h.deliver(g.session!, 'checkout.session.completed')
    await expectState(g.r.token, 'gone')
  })

  it('unbekannter oder ungültiger Token → 404', async () => {
    expect((await call(createToken())).status).toBe(404)
    expect((await call('nicht-gueltig')).status).toBe(404)
  })

  it('über dem Rate-Limit token_pages (60/min je IP-Hash) → 429 mit Retry-After', async () => {
    expect(RATE_LIMITS.token_pages).toEqual({ limit: 60, windowMs: 60_000 })
    const from = '192.0.2.77'
    const token = createToken()
    for (let i = 0; i < 60; i++) expect((await call(token, from)).status).toBe(404)
    const res = await call(token, from)
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    // andere IP ist nicht betroffen
    expect((await call(token, '192.0.2.78')).status).toBe(404)
  })
})
