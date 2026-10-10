import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startCheckout, type StartCheckoutResult } from '@/lib/commerce/checkout'
import { transitionCheckout } from '@/lib/commerce/checkoutTransitions'
import { createOrderFromCheckout } from '@/lib/commerce/createOrderFromCheckout'
import {
  listStrayPayments,
  refundStrayPayment,
  StrayRefundError,
} from '@/lib/commerce/strayPayments'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import type { MockPaymentsAdapter } from '@/lib/payments/mock'
import { processPaymentEvent } from '@/lib/payments/processPaymentEvent'
import { __setSystemFilesForTests } from '@/lib/storage/systemFiles'

import { adminReq, resetAdmin } from '../helpers/admin'
import {
  cartOf,
  checkoutById,
  piece as makePiece,
  submitForTest,
  testClock,
  useMemorySystemFiles,
  useMockPayments,
  type TestClock,
} from '../helpers/checkout'
import { dbOf, deleteCommerce } from '../helpers/commerce'
import { ensureLegalTextFixturesWithPdfs } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import { createProductFixtures, deleteProducts, type ProductFixtures } from '../helpers/products'
import { rest } from '../helpers/rest'

// P14.9 (U-58 a, J-26/J-27) – Zahlungen ohne Bestellung: Der Webhook vermerkt eine zu späte Zahlung (S16) bzw. eine
// Karte-/PayPal-Zahlung zusätzlich zur Vorkasse (S17) an der Kasse; „Erstatten“ läuft über den Erstattungs-Adapter,
// nur für die Verwaltung, idempotent, mit Audit-Log; ein Anbieterfehler bleibt erneut versuchbar.

let payload: Payload
let fx: ProductFixtures
let clock: TestClock
let mock: MockPaymentsAdapter
let legal: Record<string, number>
let admin: { token: string; userId: number }
let mailNr = 0
const NUMBERS = [990, 991]
const T0 = '2026-10-06T10:00:00.000Z'
const now = () => clock.now()

async function submitted(id: number) {
  const r = await startCheckout(
    { cart: cartOf([{ id }]), locale: 'de', existingToken: null, now: now() },
    { payload },
  )
  if (!r.ok) throw new Error(`Kassenstart abgelehnt: ${JSON.stringify(r)}`)
  const checkout = await submitForTest(payload, r.checkoutId, {
    now: now(),
    confirming: false,
    legal,
    email: `stray${++mailNr}@planetclaire.local`,
  })
  return {
    checkoutId: (r as Extract<StartCheckoutResult, { ok: true }>).checkoutId,
    session: checkout.stripe!.checkoutSessionId!,
  }
}

/** S16: Kasse beendet, danach „bezahlt“ (einmal plus Wiederholung desselben Ereignisses). */
async function latePayment() {
  const a = await makePiece(payload, fx, 990)
  const { checkoutId, session } = await submitted(a)
  await dbOf(payload).execute(
    sql`UPDATE checkouts SET status = 'expired'::enum_checkouts_status, close_reason = 'reservation_expired'::enum_checkouts_close_reason WHERE id = ${checkoutId}`,
  )
  const emission = await mock.emit(session, 'checkout.session.completed')
  await processPaymentEvent(emission.event, { payload, payments: mock, now: now() })
  return { checkoutId, event: emission.event }
}

async function auditCount(): Promise<number> {
  const r = await dbOf(payload).execute(
    sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'stray_payment_refunded'`,
  )
  return Number(r.rows[0]?.n ?? 0)
}

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
  legal = await ensureLegalTextFixturesWithPdfs(payload)
  admin = await resetAdmin(payload)
})

beforeEach(() => {
  clock = testClock(T0)
  mock = useMockPayments(clock)
  useMemorySystemFiles()
})

afterEach(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await dbOf(payload).execute(sql`DELETE FROM audit_log WHERE action = 'stray_payment_refunded'`)
})

afterAll(() => {
  __setPaymentsAdapterForTests(undefined)
  __setSystemFilesForTests(undefined)
})

describe('Zahlungen ohne Bestellung (U-58 a)', () => {
  it('S16: Zahlung wird an der Kasse vermerkt – genau einmal, auch bei wiederholtem Ereignis', async () => {
    const { checkoutId, event } = await latePayment()
    await processPaymentEvent(event, { payload, payments: mock, now: now() })
    const c = await checkoutById(payload, checkoutId)
    expect(c.strayPayments).toHaveLength(1)
    expect(c.strayPayments![0]).toMatchObject({
      kind: 'late',
      refundStatus: 'none',
      amountCents: c.totalCents,
    })
    expect(c.strayPayments![0]!.paymentIntentId).toMatch(/^pi_/)
    const open = await listStrayPayments(payload, { openOnly: true })
    expect(open.map((p) => p.checkoutId)).toContain(checkoutId)
  })

  it('Erstatten: nur Verwaltung (403), dann erstattet mit Audit; zweiter Klick ändert nichts', async () => {
    const { checkoutId } = await latePayment()
    const pi = (await checkoutById(payload, checkoutId)).strayPayments![0]!.paymentIntentId

    const anonymous = await rest('POST', `/checkouts/${checkoutId}/refund-stray-payment`, {
      paymentIntentId: pi,
    })
    expect(anonymous.status).toBe(403)

    const viaRest = await rest(
      'POST',
      `/checkouts/${checkoutId}/refund-stray-payment`,
      { paymentIntentId: pi },
      { authorization: `JWT ${admin.token}` },
    )
    expect(viaRest.status).toBe(200)
    expect(await viaRest.json()).toMatchObject({ unchanged: false, status: 'succeeded' })
    const row = (await checkoutById(payload, checkoutId)).strayPayments![0]!
    expect(row).toMatchObject({ refundStatus: 'succeeded', refundAttempts: 1 })
    expect(row.refundId).toMatch(/^re_/)
    expect(row.refundedAt).toBeTruthy()
    expect(await auditCount()).toBe(1)

    const req = await adminReq(payload, admin.userId)
    const again = await refundStrayPayment(req, { checkoutId, paymentIntentId: pi, now: now() })
    expect(again).toMatchObject({ unchanged: true, status: 'succeeded' })
    expect(await auditCount()).toBe(1)
    expect(await listStrayPayments(payload, { openOnly: true })).toEqual([])
  })

  it('Anbieterfehler → „fehlgeschlagen“ (Audit), erneuter Versuch mit neuem Schlüssel klappt', async () => {
    const { checkoutId } = await latePayment()
    const pi = (await checkoutById(payload, checkoutId)).strayPayments![0]!.paymentIntentId
    const req = await adminReq(payload, admin.userId)
    const keys: string[] = []
    const broken = {
      ...mock,
      refund: async (i: { idempotencyKey: string }) => {
        keys.push(i.idempotencyKey)
        throw new Error('Karte gesperrt')
      },
    } as unknown as MockPaymentsAdapter
    await expect(
      refundStrayPayment(req, { checkoutId, paymentIntentId: pi, now: now(), payments: broken }),
    ).rejects.toBeInstanceOf(StrayRefundError)
    expect((await checkoutById(payload, checkoutId)).strayPayments![0]).toMatchObject({
      refundStatus: 'failed',
      refundAttempts: 1,
    })
    const ok = await refundStrayPayment(req, { checkoutId, paymentIntentId: pi, now: now() })
    expect(ok.status).toBe('succeeded')
    expect(keys).toEqual([`stray-refund:${pi}:1`])
    expect(await auditCount()).toBe(2)
  })

  it('S17: Zahlung zusätzlich zur Vorkasse erscheint an der Vorkasse-Bestellung', async () => {
    const a = await makePiece(payload, fx, 991)
    const { checkoutId, session } = await submitted(a)
    const req = await createLocalReq({ context: { system: true } }, payload)
    const { order } = await createOrderFromCheckout(req, checkoutId, {
      transition: 'O2',
      now: now(),
    })
    await transitionCheckout(req, checkoutId, 'completed', { now: now() })
    const emission = await mock.emit(session, 'checkout.session.completed')
    await processPaymentEvent(emission.event, { payload, payments: mock, now: now() })
    const list = await listStrayPayments(payload, { orderId: order.id })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ kind: 'double', orderId: order.id, refundStatus: 'none' })
  })

  it('unbekannte Zahlung → 404', async () => {
    const req = await adminReq(payload, admin.userId)
    await expect(
      refundStrayPayment(req, { checkoutId: 999999, paymentIntentId: 'pi_x', now: now() }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
