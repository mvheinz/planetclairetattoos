import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { runTaskNow } from '@/lib/jobs/runTask'
import { handleTick } from '@/lib/jobs/tick'

import { checkoutById, productRow, reservationsOf } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.18 (a)/(c) – Task `releaseExpiredReservations`: abgelaufene Kassen-Reservierungen freigeben (Session beenden, Kasse
// `expired`), „bezahlt in letzter Sekunde“ (S3) abschließen statt freigeben, Vorkasse nie anfassen, zwei Läufe ohne
// Doppelwirkung, Tick nach vorgestellter Uhr (AK-A-9-02).

const NUMBERS = Array.from({ length: 8 }, (_, i) => 980 + i)
const h = shopHarness({ start: '2026-10-06T10:00:00.000Z', numbers: NUMBERS, tag: 'release' })

const after = (iso: string | Date, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000)

async function runJob(now: Date) {
  h.clock.set(now)
  return runTaskNow(h.payload, 'releaseExpiredReservations', { now })
}

async function sessionStatus(sessionId: string) {
  return (await h.mock.getCheckoutSession(sessionId)).status
}

describe('releaseExpiredReservations (PLAN P4.18 a)', () => {
  it('AK-4-09/DM-CHK-04 nach vorgestellter Uhr und Joblauf: Stück available, Mock-Session beendet, Kasse expired, keine Bestellung', async () => {
    const a = await h.piece(980)
    const r = await h.start([a])
    const c = await checkoutById(h.payload, r.checkoutId)
    const session = c.stripe!.checkoutSessionId!
    // vor Ablauf: nichts
    await runJob(after(c.expiresAt, -1))
    expect((await productRow(h.payload, a)).status).toBe('reserved')

    await runJob(after(c.expiresAt, 1))
    expect((await productRow(h.payload, a)).status).toBe('available')
    expect(await sessionStatus(session)).toBe('expired')
    const after1 = await checkoutById(h.payload, r.checkoutId)
    expect(after1.status).toBe('expired')
    expect(after1.closeReason).toBe('reservation_expired')
    expect((await reservationsOf(h.payload, a))[0]).toMatchObject({
      status: 'released',
      release_reason: 'session_expired',
    })
    expect(await h.count('orders')).toBe(0)
  })

  it('AK-4-10 (S3-Teil): Zahlung in letzter Sekunde → der Job findet „bezahlt“, gibt nicht frei, genau eine Bestellung paid', async () => {
    const a = await h.piece(981)
    const { checkoutId, session } = await h.submitted([a])
    const c = await checkoutById(h.payload, checkoutId)
    // Kundin zahlt kurz vor Ablauf; der Webhook kommt (noch) nicht an.
    h.clock.set(after(c.stripe!.sessionExpiresAt!, -1))
    await h.emit(session!, 'checkout.session.completed')

    await runJob(after(c.expiresAt, 1))
    expect(await h.count('orders')).toBe(1)
    const order = await h.orderOfCheckout(checkoutId)
    expect(order.status).toBe('paid')
    expect((await productRow(h.payload, a)).status).toBe('sold')
    expect((await checkoutById(h.payload, checkoutId)).status).toBe('completed')
    expect((await reservationsOf(h.payload, a))[0]!.status).toBe('converted')
  })

  it('AK-8-01/T-18 zwei Läufe hintereinander ohne Doppelwirkung', async () => {
    const a = await h.piece(982)
    const b = await h.piece(983)
    const r1 = await h.start([a])
    const { checkoutId: paidCheckout, session } = await h.submitted([b])
    const c1 = await checkoutById(h.payload, r1.checkoutId)
    await h.emit(session!, 'checkout.session.completed')
    const t = after(c1.expiresAt, 2)
    await runJob(t)
    await runJob(after(t, 1))
    expect((await productRow(h.payload, a)).status).toBe('available')
    expect(await reservationsOf(h.payload, a)).toHaveLength(1)
    expect(await h.count('orders')).toBe(1)
    expect(await h.count('invoices')).toBe(1)
    expect(
      await h.count('email_log', sql`template = 'order_confirmation' AND order_id IS NOT NULL`),
    ).toBe(1)
    expect((await checkoutById(h.payload, paidCheckout)).status).toBe('completed')
    expect((await checkoutById(h.payload, r1.checkoutId)).status).toBe('expired')
  })

  it('eine Vorkasse-Reservierung bleibt vom Task unberührt', async () => {
    const a = await h.piece(984)
    const r = await h.start([a])
    await dbOf(h.payload).execute(
      sql`UPDATE reservations SET source = 'prepayment', expires_at = ${h.now().toISOString()}::timestamptz
           WHERE ref = ${r.reservationRef}`,
    )
    await runJob(after(h.now(), 60))
    expect((await productRow(h.payload, a)).status).toBe('reserved')
    expect((await reservationsOf(h.payload, a))[0]).toMatchObject({
      status: 'active',
      source: 'prepayment',
    })
  })

  it('Kasse ohne Session: direkt freigeben', async () => {
    const a = await h.piece(985)
    const failing = {
      ...h.mock,
      createCheckoutSession: async () => {
        throw new Error('ECONNREFUSED')
      },
    }
    const r = await h.start([a], { payments: failing })
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.stripe?.checkoutSessionId ?? null).toBeNull()
    await runJob(after(c.expiresAt, 1))
    expect((await productRow(h.payload, a)).status).toBe('available')
    expect((await checkoutById(h.payload, r.checkoutId)).status).toBe('expired')
  })

  it('(c) schreibt den nächsten Weckzeitpunkt (früheste noch aktive Reservierung)', async () => {
    const a = await h.piece(986)
    const b = await h.piece(987)
    const r1 = await h.start([a])
    const c1 = await checkoutById(h.payload, r1.checkoutId)
    h.clock.set(after(h.now(), 20))
    const r2 = await h.start([b])
    const c2 = await checkoutById(h.payload, r2.checkoutId)
    await jobAlarm.markFullRun(h.now(), null)
    await runJob(after(c1.expiresAt, 1))
    expect((await jobAlarm.read()).nextDueAt).toBe(new Date(c2.expiresAt).toISOString())
  })
})

describe('Job-Wecker (AK-A-9-02)', () => {
  it('AK-A-9-02 ein Tick nach vorgestellter Uhr gibt das Stück frei', async () => {
    const a = await h.piece(980)
    const r = await h.start([a])
    const c = await checkoutById(h.payload, r.checkoutId)
    // startCheckout hat den Wecker auf expiresAt gestellt
    expect((await jobAlarm.read()).nextDueAt).toBe(new Date(c.expiresAt).toISOString())
    const SECRET = 'tick-test-secret-0123456789abcdefghijkl'
    const env = parseEnv({ ...process.env, CRON_SECRET: SECRET })
    const request = () =>
      new Request('http://localhost:3000/api/cron/tick', {
        headers: { authorization: `Bearer ${SECRET}` },
      })
    const early = await handleTick(request(), {
      env,
      now: after(c.expiresAt, -5),
      loadPayload: async () => h.payload,
    })
    expect(early.status).toBe(204)
    const now = after(c.expiresAt, 1)
    h.clock.set(now)
    const res = await handleTick(request(), { env, now, loadPayload: async () => h.payload })
    expect(res.status).toBe(200)
    expect((await productRow(h.payload, a)).status).toBe('available')
    expect((await checkoutById(h.payload, r.checkoutId)).status).toBe('expired')
  })
})
