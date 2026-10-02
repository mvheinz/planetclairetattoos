import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SEED_EXPECTED_COUNTS } from '@/lib/seed/expected'
import { loadSeedData, SEED_DATA_DIR } from '@/lib/seed/loader'
import { keepCheckout, keepReservation, planOrder } from '@/lib/seed/orderPlan'
import { CANONICAL_SEED_NOW, resolveSeedDate, seedIso } from '@/lib/seed/time'

// P8.4: AK-SEED-09 direkt auf den Datendateien (SEED-SPEC §7.2, §19) – Zeitlogik je Bestellung, Widerruf ≤ 14 Tage nach
// Zustellung/Abholung, `firstPublishedAt` vor `placedAt`, Vorkasse-Fristen, Kassen/Reservierungen nach L-02/L-03.

const now = new Date(CANONICAL_SEED_NOW)
const dir = path.join(process.cwd(), SEED_DATA_DIR)
const DAY = 86_400_000
const data = await loadSeedData({ dir, now, requireBase: true })
const settings = data.base!.settings as Parameters<typeof planOrder>[2]

const ORDER = [
  'placedAt',
  'paidAt',
  'packedAt',
  'shippedAt',
  'deliveredAt',
  'readyForPickupAt',
  'pickedUpAt',
  'withdrawalReceivedAt',
  'returnReceivedAt',
  'refundedAt',
  'cancelledAt',
  'disputedAt',
] as const

describe('AK-SEED-09 Zeitlogik der Beispiel-Bestellungen', () => {
  it('Kasse createdAt < placed ≤ paid ≤ packed ≤ shipped ≤ delivered ≤ withdrawal ≤ return ≤ refunded; Statusverlauf monoton', () => {
    for (const o of data.orders.orders) {
      const plan = planOrder(o, now, settings)
      const times = ORDER.map((k) => plan.timestamps[k]?.getTime()).filter(
        (v): v is number => v !== undefined,
      )
      expect(
        [...times].sort((a, b) => a - b),
        o.key,
      ).toEqual(times)
      if (plan.checkout) {
        expect(plan.checkout.createdAt.getTime()).toBeLessThan(plan.timestamps.placedAt!.getTime())
      }
      const at = plan.history.map((h) => h.at.getTime())
      expect(
        [...at].sort((a, b) => a - b),
        o.key,
      ).toEqual(at)
      expect(plan.history.at(-1)!.to).toBe(o.status)
    }
  })

  it('disputedAt liegt nach dem Zeitpunkt des Status vor der Anfechtung', () => {
    for (const o of data.orders.orders.filter((x) => x.status === 'disputed')) {
      const plan = planOrder(o, now, settings)
      const before = plan.history.at(-2)!
      expect(before.to).toBe(plan.statusBeforeDispute)
      expect(plan.timestamps.disputedAt!.getTime()).toBeGreaterThan(before.at.getTime())
    }
  })

  it('jeder Widerruf liegt ≤ 14 Tage nach deliveredAt bzw. pickedUpAt', () => {
    const withWithdrawal = data.orders.orders.filter((o) => o.timeline.withdrawalReceivedAt)
    expect(withWithdrawal.length).toBeGreaterThan(0)
    for (const o of withWithdrawal) {
      const plan = planOrder(o, now, settings)
      const handover = (plan.timestamps.deliveredAt ?? plan.timestamps.pickedUpAt)!
      const diff = plan.timestamps.withdrawalReceivedAt!.getTime() - handover.getTime()
      expect(diff, o.key).toBeGreaterThan(0)
      expect(diff, o.key).toBeLessThanOrEqual(14 * DAY)
    }
  })

  it('firstPublishedAt jedes Stücks < placedAt seiner Bestellungen', () => {
    for (const o of data.orders.orders) {
      const placed = resolveSeedDate(o.timeline.placedAt!, now).getTime()
      for (const item of o.items) {
        const p = data.products.find((x) => `products:${x.key}` === item.product)!
        expect(p.state.firstPublishedAt, `${o.key} ${p.key}`).toBeDefined()
        expect(resolveSeedDate(p.state.firstPublishedAt!, now).getTime()).toBeLessThan(placed)
      }
    }
  })

  it('jede gepackte oder versendete Bestellung hat eine Verpackungsvorlage mit ≥ 1 Bestandteil', () => {
    const pack = data.base!.settings.packaging as {
      templates: { key: string; components: unknown[] }[]
      defaultsByShippingClass: { shippingClass: string; templateKey: string }[]
    }
    for (const o of data.orders.orders.filter((x) => x.timeline.packedAt || x.timeline.shippedAt)) {
      const classes = o.items.map(
        (i) => data.products.find((p) => `products:${p.key}` === i.product)!.shippingClass,
      )
      for (const c of classes) {
        const key = pack.defaultsByShippingClass.find((d) => d.shippingClass === c)?.templateKey
        const template = pack.templates.find((t) => t.key === key)
        expect(template?.components.length ?? 0, `${o.key} ${c}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('Vorkasse-Fristen aus prepaymentDeadlines wie SEED-SPEC §7.2 (E-23, KA-28)', () => {
    const expected: Record<string, [string, string]> = {
      O04: ['D-19@23:59:59', 'D-21@08:55'],
      O07: ['D-4@23:59:59', 'D-6@10:10'],
      O09: ['D-2@23:59:59', 'D-4@13:20'],
      O13: ['D+3@23:59:59', 'D+1@15:37'],
    }
    for (const o of data.orders.orders.filter((x) => x.payment.method === 'prepayment')) {
      const plan = planOrder(o, now, settings)
      const [due, reminder] = expected[o.key]!
      expect(plan.prepayment!.dueAt.toISOString(), o.key).toBe(seedIso(due, now))
      expect(plan.prepayment!.reminderDueAt.toISOString(), o.key).toBe(seedIso(reminder, now))
    }
  })

  it('AK-SEED-03 (Daten): nach L-03/L-02 bleiben genau die Kassen und Reservierungen aus §0.1', () => {
    const plans = data.orders.orders.map((o) => planOrder(o, now, settings))
    const t = (e: string | undefined) => (e ? resolveSeedDate(e, now) : null)
    const checkouts =
      plans.filter((p) => p.checkout).length +
      data.orders.checkouts.filter((c) => keepCheckout(t(c.createdAt)!, now)).length
    const reservations =
      plans.filter((p) => p.reservation).length +
      data.orders.reservations.filter((r) =>
        keepReservation(
          { status: r.status, releasedAt: t(r.releasedAt), convertedAt: t(r.convertedAt) },
          now,
        ),
      ).length
    expect([checkouts, reservations]).toEqual([
      SEED_EXPECTED_COUNTS.checkouts,
      SEED_EXPECTED_COUNTS.reservations,
    ])
    expect(plans.filter((p) => !p.checkout).map((p) => p.key)).toEqual(['O01', 'O02'])
  })
})
