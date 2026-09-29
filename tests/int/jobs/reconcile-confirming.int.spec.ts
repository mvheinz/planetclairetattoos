import { describe, expect, it } from 'vitest'

import { runTaskNow } from '@/lib/jobs/runTask'

import { checkoutById, productRow } from '../helpers/checkout'
import { shopHarness } from '../helpers/shop'

// P4.18 (b) – Kassen, die seit > 10 min `confirming` sind, beim Anbieter abgleichen (KONZEPT §4.10, §4.11 S10):
// bezahlt ⇒ Bestellabschluss; Session offen und Reservierung gültig ⇒ zurück nach `open`; sonst bis zum Ablauf warten.

const NUMBERS = [990, 991, 992, 993]
const h = shopHarness({ start: '2026-10-06T10:00:00.000Z', numbers: NUMBERS, tag: 'reconcile' })
const at = (minutes: number) => new Date(Date.parse('2026-10-06T10:00:00.000Z') + minutes * 60_000)

async function runJob(now: Date) {
  h.clock.set(now)
  return runTaskNow(h.payload, 'releaseExpiredReservations', { now })
}

describe('Kassen abgleichen (PLAN P4.18 b)', () => {
  it('S10: confirming > 10 min, Session bezahlt, Webhook fehlt → genau eine Bestellung paid', async () => {
    const a = await h.piece(990)
    const { checkoutId, session } = await h.submitted([a])
    h.clock.set(at(2))
    await h.emit(session!, 'checkout.session.completed')
    await runJob(at(9))
    expect(await h.count('orders')).toBe(0)
    await runJob(at(11))
    expect((await h.orderOfCheckout(checkoutId)).status).toBe('paid')
    expect((await productRow(h.payload, a)).status).toBe('sold')
    await runJob(at(12))
    expect(await h.count('orders')).toBe(1)
  })

  it('Session offen und Reservierung gültig → confirming → open', async () => {
    const a = await h.piece(991)
    const { checkoutId } = await h.submitted([a])
    await runJob(at(11))
    const c = await checkoutById(h.payload, checkoutId)
    expect(c.status).toBe('open')
    expect((await productRow(h.payload, a)).status).toBe('reserved')
  })

  it('Session abgeschlossen, aber unbezahlt (verzögerte Zahlart) → bleibt confirming bis zum Ablauf', async () => {
    const a = await h.piece(992)
    const { checkoutId, session } = await h.submitted([a])
    await h.mock.setNextOutcome(session!, { result: 'delayed' })
    await h.emit(session!, 'checkout.session.completed')
    await runJob(at(11))
    expect((await checkoutById(h.payload, checkoutId)).status).toBe('confirming')
    expect((await productRow(h.payload, a)).status).toBe('reserved')
    expect(await h.count('orders')).toBe(0)
  })

  it('innerhalb von 10 min bleibt die Kasse unangetastet', async () => {
    const a = await h.piece(993)
    const { checkoutId } = await h.submitted([a])
    await runJob(at(9))
    expect((await checkoutById(h.payload, checkoutId)).status).toBe('confirming')
  })
})
