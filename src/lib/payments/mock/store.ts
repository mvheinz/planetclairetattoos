import 'server-only'

import type { PaymentEvent, SessionState } from '../types'

// Zustand des Mock-Treibers. Laut ARCHITEKTUR §3.5 liegt er in der Datenbank (`checkouts.mock.state`, Ereignisse in
// `webhook-events` mit provider = 'mock'). Die Collection `checkouts` entsteht erst mit P1.20; bis P4.4 den DB-Speicher
// anschließt, ist der Standard ein Prozess-Speicher (OFFENE-PUNKTE, P1.10). Die Schnittstelle bleibt gleich.

export interface MockSessionRecord extends SessionState {
  checkoutRef: string
  clientSecret: string
  expiresAt: string
  createdAt: string
  shippingLabel: string
  shippingCents: number
}

export interface MockPaymentsStore {
  getSession(sessionId: string): Promise<MockSessionRecord | null>
  putSession(record: MockSessionRecord): Promise<void>
  getRefund(
    idempotencyKey: string,
  ): Promise<{ refundId: string; status: 'pending' | 'succeeded' | 'failed' } | null>
  putRefund(
    idempotencyKey: string,
    refund: { refundId: string; status: 'pending' | 'succeeded' | 'failed' },
  ): Promise<void>
  addEvent(event: PaymentEvent): Promise<void>
  eventsSince(since: Date): Promise<PaymentEvent[]>
}

export function createMemoryMockStore(): MockPaymentsStore {
  const sessions = new Map<string, MockSessionRecord>()
  const refunds = new Map<
    string,
    { refundId: string; status: 'pending' | 'succeeded' | 'failed' }
  >()
  const events: PaymentEvent[] = []
  return {
    async getSession(id) {
      const r = sessions.get(id)
      return r ? { ...r } : null
    },
    async putSession(record) {
      sessions.set(record.sessionId, { ...record })
    },
    async getRefund(key) {
      return refunds.get(key) ?? null
    },
    async putRefund(key, refund) {
      refunds.set(key, refund)
    },
    async addEvent(event) {
      events.push(event)
    },
    async eventsSince(since) {
      return events.filter((e) => e.createdAt.getTime() >= since.getTime())
    },
  }
}
