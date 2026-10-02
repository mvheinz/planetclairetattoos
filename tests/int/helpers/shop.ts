import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { startCheckout, type StartCheckoutResult } from '@/lib/commerce/checkout'
import { __setEmailAdapterForTests, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { __setPaymentsAdapterForTests, type PaymentsAdapter } from '@/lib/payments'
import type { MockPaymentsAdapter } from '@/lib/payments/mock'
import { processPaymentEvent } from '@/lib/payments/processPaymentEvent'
import type { StripeEventType } from '@/lib/payments/normalize'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'
import type { Order } from '@/payload-types'

import {
  cartOf,
  checkoutById,
  piece as makePiece,
  submitForTest,
  testClock,
  useMemorySystemFiles as installMemorySystemFiles,
  useMockPayments as installMockPayments,
  type TestClock,
} from './checkout'
import { dbOf, deleteCommerce } from './commerce'
import { withBusiness } from './invoices'
import { ensureLegalTextFixturesWithPdfs } from './legal'
import { getTestPayload } from './payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from './products'

// Gemeinsamer Aufbau für Shop-Tests ab P4.18 (Kasse starten und absenden, Mock-Zahlung mit verstellbarer Uhr, Mails im
// Datei-Treiber, Aufräumen). Stücke im Bereich 980–999 (CLAUDE.md §3 Nr. 5).

export type StartedOk = Extract<StartCheckoutResult, { ok: true }>

export interface ShopHarness {
  readonly payload: Payload
  readonly clock: TestClock
  readonly mock: MockPaymentsAdapter
  readonly legal: Record<string, number>
  readonly outboxDir: string
  now(): Date
  piece(nr: number, extra?: Record<string, unknown>): Promise<number>
  start(
    ids: number[],
    o?: { delivery?: 'shipping' | 'pickup'; payments?: PaymentsAdapter },
  ): Promise<StartedOk>
  submitted(
    ids: number[],
    o?: { confirming?: boolean; email?: string; delivery?: 'shipping' | 'pickup' },
  ): Promise<{ r: StartedOk; email: string; session: string | null; checkoutId: number }>
  emit(session: string, type: StripeEventType): ReturnType<MockPaymentsAdapter['emit']>
  deliver(
    session: string,
    type: StripeEventType,
  ): Promise<Awaited<ReturnType<typeof processPaymentEvent>>>
  count(table: string, where?: ReturnType<typeof sql>): Promise<number>
  orderOfCheckout(checkoutId: number): Promise<Order>
  order(id: number): Promise<Order>
}

export function shopHarness(o: { start: string; numbers: number[]; tag: string }): ShopHarness {
  let payload: Payload
  let fx: ProductFixtures
  let clock: TestClock
  let mock: MockPaymentsAdapter
  let legal: Record<string, number>
  let restoreBusiness: () => Promise<void>
  let outboxDir: string
  let mailNr = 0

  beforeAll(async () => {
    payload = await getTestPayload()
    fx = await createProductFixtures(payload)
    legal = await ensureLegalTextFixturesWithPdfs(payload)
    restoreBusiness = await withBusiness(payload)
    outboxDir = await mkdtemp(path.join(tmpdir(), `pc-${o.tag}-`))
    __setEmailAdapterForTests(
      createEmailAdapter(
        parseEnv({ ...process.env, EMAIL_DRIVER: 'file', EMAIL_FILE_DIR: outboxDir }),
      ),
    )
  })

  beforeEach(async () => {
    clock = testClock(o.start)
    mock = installMockPayments(clock)
    installMemorySystemFiles()
    await jobAlarm.markFullRun(new Date(o.start), null)
  })

  afterEach(async () => {
    await deleteCommerce(payload)
    await deleteProducts(payload, o.numbers)
  })

  afterAll(async () => {
    await restoreBusiness()
    __setEmailAdapterForTests(undefined)
    __setPaymentsAdapterForTests(undefined)
    __setSystemFilesForTests(undefined)
  })

  const h: ShopHarness = {
    get payload() {
      return payload
    },
    get clock() {
      return clock
    },
    get mock() {
      return mock
    },
    get legal() {
      return legal
    },
    get outboxDir() {
      return outboxDir
    },
    now: () => clock.now(),
    piece: (nr, extra) => makePiece(payload, fx, nr, extra),
    async start(ids, s = {}) {
      const r = await startCheckout(
        {
          cart: cartOf(
            ids.map((id) => ({ id })),
            s.delivery ?? 'shipping',
          ),
          locale: 'de',
          existingToken: null,
          now: clock.now(),
        },
        { payload, ...(s.payments ? { payments: s.payments } : {}) },
      )
      if (!r.ok) throw new Error(`Kassenstart abgelehnt: ${JSON.stringify(r)}`)
      return r as StartedOk
    },
    async submitted(ids, s = {}) {
      const r = await h.start(ids, { delivery: s.delivery })
      const email = s.email ?? `kundin${++mailNr}@planetclaire.local`
      const checkout = await submitForTest(payload, r.checkoutId, {
        now: clock.now(),
        confirming: s.confirming ?? true,
        legal,
        email,
      })
      return {
        r,
        email,
        session: checkout.stripe?.checkoutSessionId ?? null,
        checkoutId: r.checkoutId,
      }
    },
    emit: (session, type) => mock.emit(session, type),
    async deliver(session, type) {
      const emission = await mock.emit(session, type)
      return processPaymentEvent(emission.event, { payload, payments: mock, now: clock.now() })
    },
    async count(table, where = sql`true`) {
      const r = await dbOf(payload).execute(
        sql`SELECT count(*)::int AS n FROM ${sql.raw(`"${table}"`)} WHERE ${where}`,
      )
      return Number(r.rows[0]?.n ?? 0)
    },
    async orderOfCheckout(checkoutId) {
      const c = await checkoutById(payload, checkoutId)
      return h.order(c.order as number)
    },
    async order(id) {
      return (await payload.findByID({
        collection: 'orders',
        id,
        depth: 0,
        overrideAccess: true,
      })) as Order
    },
  }
  return h
}
