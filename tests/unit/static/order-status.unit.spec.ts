import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkOrderStatuses,
  findUnknownOrderStatuses,
  orderStatusInput,
} from '../../../scripts/lib/static-checks/order-status'

// P4.25 Phasen-Abnahme P4 (KONZEPT §5.2/§5.3 Grundsatz 1): Bestellstatus nur aus ORDER_STATUSES – Regel `order-status`
// in check:static über `src/`, `tests/` und `scripts/`.

const ROOT = path.resolve(import.meta.dirname, '../../..')

describe('Statischer Scan: Bestellstatus nur aus ORDER_STATUSES (P4.25)', () => {
  it('der aktuelle Quellbaum (src, tests, scripts) nutzt nur bekannte Bestellstatus', () => {
    const files = orderStatusInput(ROOT)
    expect(files.length).toBeGreaterThan(300)
    expect(checkOrderStatuses(files).errors).toEqual([])
    // Der Scan greift tatsächlich: Übergänge und SQL auf orders.status kommen im Baum vor.
    const hits = files.filter((f) =>
      /transitionOrder\(|expectedFrom:|o\.status\s*=|orders\.status/.test(f.source),
    )
    expect(hits.length).toBeGreaterThan(5)
  })

  it('Gegenprobe: erfundene Status in Übergängen, Casts, SQL und Test-Erwartungen werden erkannt', () => {
    const src = [
      "await transitionOrder(req, order.id, 'completed', { now })",
      "await transitionOrder(r, created.order.id, 'paid', { expectedFrom: ['pending', 'awaiting_prepayment'] })",
      "const s = 'processing' as OrderStatus",
      "sql`SELECT id FROM orders o WHERE o.status = 'canceled'`",
      "sql`UPDATE orders SET x = 1 WHERE orders.status IN ('paid', 'fulfilled')`",
      "expect(order.status).toBe('on_hold')",
      "expect(await ordersOf([p.id])).toMatchObject([{ status: 'unpaid' }])",
      "expect(order.status).toBe('shipped')",
    ].join('\n')
    expect(findUnknownOrderStatuses(src)).toEqual([
      { line: 1, value: 'completed' },
      { line: 2, value: 'pending' },
      { line: 3, value: 'processing' },
      { line: 4, value: 'canceled' },
      { line: 5, value: 'fulfilled' },
      { line: 6, value: 'on_hold' },
      { line: 7, value: 'unpaid' },
    ])
  })

  it('Kassen- und Stückstatus zählen nicht (eigene Listen), Kommentare auch nicht', () => {
    const src = [
      "expect(await checkoutStatuses([p.id])).toEqual(['completed'])",
      "sql`SELECT status FROM checkouts c WHERE c.status = 'expired'`",
      "// transitionOrder(req, id, 'erfunden')",
    ].join('\n')
    expect(findUnknownOrderStatuses(src)).toEqual([])
  })
})
