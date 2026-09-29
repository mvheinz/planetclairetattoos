import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  cancelCheckout,
  cartNoticeSearch,
  checkoutCookieAttributes,
  parseCartNotice,
  startCheckout,
  type StartCheckoutResult,
} from '@/lib/commerce/checkout'
import { releaseReservation } from '@/lib/commerce/reservation'
import { jobAlarm } from '@/lib/jobs/alarm'
import { __setPaymentsAdapterForTests, type PaymentsAdapter } from '@/lib/payments'
import type { MockPaymentsAdapter } from '@/lib/payments/mock'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'
import { hashToken } from '@/lib/security/tokens'

import {
  cartOf,
  checkoutById,
  countCheckouts,
  piece as makePiece,
  productRow,
  reservationsOf,
  setShop,
  testClock,
  useMemorySystemFiles,
  useMockPayments,
  type TestClock,
} from '../helpers/checkout'
import { deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from '../helpers/products'

// P4.6 Kassenstart (KONZEPT §4.2/§4.6/§4.11, DATENMODELL §8.1/§8.2): S1, S13, S14, lazy release inkl. „bereits
// bezahlt“, Stück-Limit, Shop geschlossen, Gleichheit der Referenzen und Zeiten, Job-Wecker (AK-A-9-02). Uhr injiziert
// (A-08), Zahlungen über den Mock mit derselben Uhr. Fixture-Nummern 980–999.

let payload: Payload
let fx: ProductFixtures
let clock: TestClock
let mock: MockPaymentsAdapter
const NUMBERS = Array.from({ length: 20 }, (_, i) => 980 + i)
const T0 = '2026-09-28T10:00:00.000Z'
const MIN = 60_000

const piece = (nr: number, extra: Record<string, unknown> = {}) =>
  makePiece(payload, fx, nr, extra)

const start = (
  items: number[],
  over: { token?: string | null; now?: Date; delivery?: 'shipping' | 'pickup' } = {},
  deps: { payments?: PaymentsAdapter } = {},
) =>
  startCheckout(
    {
      cart: cartOf(
        items.map((id) => ({ id })),
        over.delivery,
      ),
      locale: 'de',
      existingToken: over.token ?? null,
      now: over.now ?? clock.now(),
    },
    { payload, ...deps },
  )

type Ok = Extract<StartCheckoutResult, { ok: true }>
function ok(r: StartCheckoutResult): Ok {
  if (!r.ok) throw new Error(`Kassenstart abgelehnt: ${JSON.stringify(r)}`)
  return r
}

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
})

beforeEach(async () => {
  clock = testClock(T0)
  mock = useMockPayments(clock)
  useMemorySystemFiles()
  await jobAlarm.markFullRun(new Date(T0), null)
})

afterEach(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
})

afterAll(() => {
  __setPaymentsAdapterForTests(undefined)
  __setSystemFilesForTests(undefined)
})

describe('Erfolg: Kasse, Reservierung, Session', () => {
  it('DM-RES-01 Referenzen und Zeiten gleich; Snapshot aus der DB; Session sessionSeq 1; AK-A-9-02 Wecker ≤ expiresAt', async () => {
    const a = await piece(980, { priceCents: 5200 })
    const b = await piece(981, { priceCents: 3900 })
    const r = ok(await start([a, b]))
    expect(r.reused).toBe(false)
    expect(r.paymentSession).toBe(true)
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('open')
    expect(c.tokenHash).toBe(hashToken(r.token))
    expect(c.reservationRef).toBe(r.reservationRef)
    // T0 + 30 min Countdown, Stripe T0 + 31 min, Reservierung + 5 min (DATENMODELL §8.1)
    expect(c.displayExpiresAt).toBe(new Date(Date.parse(T0) + 30 * MIN).toISOString())
    expect(c.expiresAt).toBe(new Date(Date.parse(T0) + 36 * MIN).toISOString())
    expect(c.stripe?.sessionExpiresAt).toBe(new Date(Date.parse(T0) + 31 * MIN).toISOString())
    expect(c.stripe?.sessionSeq).toBe(1)
    expect(c.stripe?.checkoutSessionId).toMatch(/^cs_mock_/)
    expect(c.stripe?.livemode).toBe(false)
    expect(c.fulfillmentMethod).toBe('shipping')
    expect(c.subtotalCents).toBe(9100)
    expect(c.totalCents).toBe(c.subtotalCents + c.shippingCents)
    expect(c.items.map((i) => [i.itemNumber, i.priceCents])).toEqual([
      [980, 5200],
      [981, 3900],
    ])
    expect(c.items[0]!.titleDe).toBe('Teststück 980')
    expect(c.items[0]!.characteristicsDe).toContain('Keramik')

    for (const id of [a, b]) {
      const p = await productRow(payload, id)
      expect(p.status).toBe('reserved')
      expect(p.reservation_ref).toBe(c.reservationRef)
      expect(new Date(p.reserved_until!).toISOString()).toBe(c.expiresAt)
      const [res] = await reservationsOf(payload, id)
      expect(res).toMatchObject({
        ref: c.reservationRef,
        status: 'active',
        source: 'checkout_session',
        checkout_id: c.id,
      })
      expect(new Date(res!.expires_at).toISOString()).toBe(c.expiresAt)
    }

    const alarm = await jobAlarm.read()
    expect(Date.parse(alarm.nextDueAt!)).toBeLessThanOrEqual(Date.parse(c.expiresAt))
  })

  it('nur_abholung erzwingt pickup (0 € Versand), auch wenn der Korb shipping sagt', async () => {
    const a = await piece(982, { shippingClass: 'nur_abholung' })
    const r = ok(await start([a]))
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.fulfillmentMethod).toBe('pickup')
    expect(c.shippingCents).toBe(0)
  })

  it('Cookie pc_checkout: HttpOnly, SameSite=Lax, Path=/, Max-Age=3600, Secure außer localhost', () => {
    expect(checkoutCookieAttributes('planetclairetattoos.com')).toEqual({
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: 3600,
      httpOnly: true,
    })
    expect(checkoutCookieAttributes('localhost:3000').secure).toBe(false)
  })
})

describe('AK-4-08 / DM-RES-02 / S1: keine Teilreservierung', () => {
  it('ein freies und ein reserviertes Stück → „gerade reserviert“ mit Nummer, freies bleibt available, keine Kasse', async () => {
    const free = await piece(983)
    const taken = await piece(984)
    ok(await start([taken]))
    const before = await countCheckouts(payload)

    const r = await start([free, taken])
    expect(r).toEqual({ ok: false, code: 'reserved', itemNumbers: [984] })
    expect(await countCheckouts(payload)).toBe(before)
    expect((await productRow(payload, free)).status).toBe('available')
    expect(await reservationsOf(payload, free)).toEqual([])
    expect(cartNoticeSearch('reserved', { itemNumbers: [984] })).toBe('?hinweis=reserved&nr=984')
    expect(parseCartNotice(new URLSearchParams('hinweis=reserved&nr=984'))).toEqual({
      code: 'reserved',
      itemNumbers: [984],
      max: null,
    })
  })

  it('verkauftes oder nicht öffentliches Stück → „unavailable“, nichts reserviert', async () => {
    const free = await piece(985)
    const draft = await piece(986, { status: 'draft' })
    const r = await start([free, draft])
    expect(r).toEqual({ ok: false, code: 'unavailable', itemNumbers: [986] })
    expect((await productRow(payload, free)).status).toBe('available')
  })
})

describe('Grenzen und Shop-Pause', () => {
  it('mehr als maxItemsPerCheckout → too_many mit n', async () => {
    const restore = await setShop(payload, { maxItemsPerCheckout: 2 })
    try {
      const ids = [await piece(987), await piece(988), await piece(989)]
      expect(await start(ids)).toEqual({ ok: false, code: 'too_many', max: 2 })
      expect(await countCheckouts(payload)).toBe(0)
    } finally {
      await restore()
    }
  })

  it('AK-4-16 geschlossener Shop → kein Kassenstart, Meldung closedMessage', async () => {
    const restore = await setShop(payload, { isOpen: false, closedMessage: 'Kurz im Urlaub.' })
    try {
      const a = await piece(990)
      expect(await start([a])).toEqual({ ok: false, code: 'shop_closed', message: 'Kurz im Urlaub.' })
      expect((await productRow(payload, a)).status).toBe('available')
      expect(await countCheckouts(payload)).toBe(0)
    } finally {
      await restore()
    }
  })

  it('leerer Korb → empty', async () => {
    expect(await start([])).toEqual({ ok: false, code: 'empty' })
  })
})

describe('S13: Anbieter beim Start nicht erreichbar', () => {
  it('Kasse bleibt open ohne Session (nur Vorkasse), Reservierung steht', async () => {
    const a = await piece(991)
    const failing: PaymentsAdapter = {
      ...mock,
      createCheckoutSession: async () => {
        throw new Error('ECONNREFUSED')
      },
    }
    const r = ok(await start([a], {}, { payments: failing }))
    expect(r.paymentSession).toBe(false)
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('open')
    expect(c.stripe?.checkoutSessionId ?? null).toBeNull()
    expect(c.stripe?.sessionSeq ?? 0).toBe(0)
    expect((await productRow(payload, a)).status).toBe('reserved')
  })
})

describe('S14: zweiter Start mit demselben Cookie', () => {
  it('gleiche Stückliste → dieselbe Kasse, keine zweite Reservierung, keine Verlängerung', async () => {
    const a = await piece(992)
    const first = ok(await start([a]))
    clock.set(new Date(Date.parse(T0) + 10 * MIN))
    const second = ok(await start([a], { token: first.token }))
    expect(second).toMatchObject({
      reused: true,
      checkoutId: first.checkoutId,
      token: first.token,
      expiresAt: first.expiresAt,
    })
    expect(await reservationsOf(payload, a)).toHaveLength(1)
    expect((await checkoutById(payload, first.checkoutId)).expiresAt).toBe(
      first.expiresAt.toISOString(),
    )
    expect(await countCheckouts(payload)).toBe(1)
  })

  it('geänderte Stückliste → alte Kasse cancelled (replaced), Session beendet, neue Kasse', async () => {
    const a = await piece(993)
    const b = await piece(994)
    const first = ok(await start([a]))
    const oldSession = (await checkoutById(payload, first.checkoutId)).stripe!.checkoutSessionId!
    const second = ok(await start([a, b], { token: first.token }))
    expect(second.reused).toBe(false)
    expect(second.checkoutId).not.toBe(first.checkoutId)
    const old = await checkoutById(payload, first.checkoutId)
    expect(old.status).toBe('cancelled')
    expect(old.closeReason).toBe('replaced')
    expect(old.timestamps?.cancelledAt).toBe(T0)
    expect((await mock.getCheckoutSession(oldSession)).status).toBe('expired')
    const res = await reservationsOf(payload, a)
    expect(res.map((x) => [x.status, x.release_reason])).toEqual([
      ['released', 'customer_cancelled'],
      ['active', null],
    ])
    expect((await productRow(payload, a)).reservation_ref).toBe(second.reservationRef)
  })
})

describe('Lazy release (DATENMODELL §8.1)', () => {
  it('abgelaufene fremde Reservierung wird vorher freigegeben: Session beendet, Kasse expired', async () => {
    const a = await piece(995)
    const first = ok(await start([a]))
    const session = (await checkoutById(payload, first.checkoutId)).stripe!.checkoutSessionId!
    clock.set(new Date(Date.parse(T0) + 40 * MIN))
    const second = ok(await start([a]))
    const old = await checkoutById(payload, first.checkoutId)
    expect(old.status).toBe('expired')
    expect(old.closeReason).toBe('reservation_expired')
    expect((await mock.getCheckoutSession(session)).status).toBe('expired')
    expect((await productRow(payload, a)).reservation_ref).toBe(second.reservationRef)
    expect((await reservationsOf(payload, a))[0]).toMatchObject({
      status: 'released',
      release_reason: 'session_expired',
    })
  })

  it('„bereits bezahlt“ → keine Freigabe, Stück bleibt reserviert, Start meldet „gerade reserviert“', async () => {
    const a = await piece(996)
    const first = ok(await start([a]))
    const session = (await checkoutById(payload, first.checkoutId)).stripe!.checkoutSessionId!
    await mock.emit(session, 'checkout.session.completed')
    clock.set(new Date(Date.parse(T0) + 40 * MIN))
    expect(await start([a])).toEqual({ ok: false, code: 'reserved', itemNumbers: [996] })
    expect((await productRow(payload, a)).reservation_ref).toBe(first.reservationRef)
    expect((await checkoutById(payload, first.checkoutId)).status).toBe('open')
    expect((await reservationsOf(payload, a)).map((r) => r.status)).toEqual(['active'])
  })

  it('noch gültige fremde Reservierung wird nicht angetastet', async () => {
    const a = await piece(997)
    const first = ok(await start([a]))
    clock.set(new Date(Date.parse(T0) + 20 * MIN))
    expect(await start([a])).toMatchObject({ ok: false, code: 'reserved' })
    expect((await checkoutById(payload, first.checkoutId)).status).toBe('open')
  })
})

describe('cancelCheckout / releaseReservation', () => {
  it('cart_changed: Kasse cancelled, Reservierung released (customer_cancelled), Stück available', async () => {
    const a = await piece(998)
    const r = ok(await start([a]))
    const out = await cancelCheckout(r.checkoutId, 'cart_changed', clock.now(), { payload })
    expect(out).toMatchObject({ status: 'released', productIds: [a] })
    const c = await checkoutById(payload, r.checkoutId)
    expect(c.status).toBe('cancelled')
    expect(c.closeReason).toBe('cart_changed')
    expect((await productRow(payload, a))).toMatchObject({
      status: 'available',
      reserved_until: null,
      reservation_ref: null,
    })
    // zweiter Aufruf: Kasse nicht mehr offen
    expect(await cancelCheckout(r.checkoutId, 'cart_changed', clock.now(), { payload })).toEqual({
      status: 'not_open',
      checkoutId: r.checkoutId,
    })
  })

  it('Anbieter nicht erreichbar → vorsichtshalber keine Freigabe', async () => {
    const a = await piece(999)
    const r = ok(await start([a]))
    const failing: PaymentsAdapter = {
      ...mock,
      expireCheckoutSession: async () => {
        throw new Error('timeout')
      },
    }
    const out = await releaseReservation(r.reservationRef, 'customer_cancelled', clock.now(), {
      payload,
      payments: failing,
    })
    expect(out).toEqual({ status: 'provider_error', checkoutId: r.checkoutId })
    expect((await productRow(payload, a)).status).toBe('reserved')
  })
})
