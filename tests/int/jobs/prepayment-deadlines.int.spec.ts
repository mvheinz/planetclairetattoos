import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { placePrepaymentOrder } from '@/lib/commerce/prepayment'
import { runTaskNow } from '@/lib/jobs/runTask'
import type { Order } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import { productRow, reservationsOf } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.19 – Fristen-Jobs `prepaymentReminders` und `cancelOverduePrepayments` (AK-8-02/DM-ORD-06): Bestellung
// Sa 26.09.2026 10:00 Berlin → Erinnerung Di 29.09. 10:00, Frist Do 01.10. 23:59:59 Berlin; Doppel-Lauf ohne
// Doppelwirkung; Beispiel-Bestellungen (`seed = true`) bekommen weder Mail noch Storno; R-071 Rechnungszähler unverändert.

const NUMBERS = [990, 991]
const PLACED = '2026-09-26T08:00:00.000Z' // Sa 26.09.2026 10:00 Europe/Berlin
const h = shopHarness({ start: PLACED, numbers: NUMBERS, tag: 'deadlines' })

async function placed(
  nr: number,
  seed = false,
): Promise<{ order: Order; email: string; a: number }> {
  const a = await h.piece(nr)
  const { checkoutId, email } = await h.submitted([a], { confirming: false })
  if (seed)
    await dbOf(h.payload).execute(sql`UPDATE checkouts SET seed = true WHERE id = ${checkoutId}`)
  const req = await createLocalReq(
    { context: { system: true, now: h.now().toISOString() } },
    h.payload,
  )
  const res = await placePrepaymentOrder(req, checkoutId, { now: h.now(), payments: h.mock })
  await res.afterCommit()
  return { order: res.order, email, a }
}

async function run(iso: string) {
  const now = new Date(iso)
  h.clock.set(now)
  await runTaskNow(h.payload, 'prepaymentReminders', { now })
  await runTaskNow(h.payload, 'cancelOverduePrepayments', { now })
}

const mails = (orderId: number, template: string) =>
  h.count('email_log', sql`template = ${template} AND order_id = ${orderId}`)

describe('Vorkasse-Fristen (AK-8-02/DM-ORD-06)', () => {
  it('R-071 AK-8-02: keine Mail bis Di 09:59, ab 10:00 genau eine M03; Do 23:59 offen; danach genau einmal Storno + M04 + A03, Stück available; Rechnungszähler unverändert', async () => {
    const { order, email, a } = await placed(990)
    expect(order.prepayment?.reminderDueAt).toBe('2026-09-29T08:00:00.000Z')
    expect(order.prepayment?.dueAt).toBe('2026-10-01T21:59:59.000Z')
    const counters = await h.count('invoice_counters')

    await run('2026-09-29T07:59:00.000Z') // Di 09:59 Berlin
    expect(await mails(order.id, 'prepayment_reminder')).toBe(0)

    await run('2026-09-29T08:00:00.000Z') // Di 10:00 Berlin
    await run('2026-09-29T08:05:00.000Z') // Doppel-Lauf
    expect(await mails(order.id, 'prepayment_reminder')).toBe(1)
    expect((await h.order(order.id)).prepayment?.reminderSentAt).toBe('2026-09-29T08:00:00.000Z')
    expect(await readOutbox({ to: email, type: 'prepayment_reminder' }, h.outboxDir)).toHaveLength(
      1,
    )

    await run('2026-10-01T21:59:00.000Z') // Do 23:59 Berlin
    expect((await h.order(order.id)).status).toBe('awaiting_prepayment')
    // S12: bis Zahlung oder Storno „gerade reserviert“
    expect((await productRow(h.payload, a)).status).toBe('reserved')

    await run('2026-10-01T22:00:00.000Z') // erster Lauf nach 23:59:59
    await run('2026-10-01T22:30:00.000Z') // Doppel-Lauf
    const cancelled = await h.order(order.id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.cancelReason).toBe('payment_timeout')
    expect(cancelled.statusHistory?.at(-1)).toMatchObject({ transition: 'O4', actorType: 'job' })
    expect(await mails(order.id, 'prepayment_cancelled')).toBe(1)
    expect(await mails(order.id, 'admin_prepayment_cancelled')).toBe(1)
    expect(await readOutbox({ to: email, type: 'prepayment_cancelled' }, h.outboxDir)).toHaveLength(
      1,
    )
    expect(
      await readOutbox({ to: email, type: 'prepayment_instructions' }, h.outboxDir),
    ).toHaveLength(1)
    const p = await productRow(h.payload, a)
    expect(p).toMatchObject({ status: 'available', reservation_ref: null })
    expect((await reservationsOf(h.payload, a))[0]).toMatchObject({
      status: 'released',
      release_reason: 'prepayment_overdue',
    })
    expect(await h.count('invoices')).toBe(0)
    expect(await h.count('invoice_counters')).toBe(counters)
  })

  it('Gegenprobe seed = true: weder M03 noch M04/A03, bleibt awaiting_prepayment', async () => {
    const { order, a } = await placed(991, true)
    expect(order.seed).toBe(true)
    await run('2026-09-29T08:00:00.000Z')
    await run('2026-10-01T22:00:00.000Z')
    const after = await h.order(order.id)
    expect(after.status).toBe('awaiting_prepayment')
    expect(after.prepayment?.reminderSentAt ?? null).toBeNull()
    expect(after.prepayment?.dueAt).toBe('2026-10-01T21:59:59.000Z')
    expect(await mails(order.id, 'prepayment_reminder')).toBe(0)
    expect(await mails(order.id, 'prepayment_cancelled')).toBe(0)
    expect(await mails(order.id, 'admin_prepayment_cancelled')).toBe(0)
    expect((await productRow(h.payload, a)).status).toBe('reserved')
  })
})
