import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { requestRefund, type RefundRequestInput } from '@/lib/commerce/refundOrder'
import { __setEmailAdapterForTests, clearMemoryOutbox, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { submitWithdrawal } from '@/lib/legal/withdrawal'
import type { PaymentsAdapter, RefundInput } from '@/lib/payments/types'
import type { EmailLog, Invoice, Order, Withdrawal } from '@/payload-types'

import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.10 – Erstattungen über den Zahlungsadapter (KONZEPT §5.3 O13–O15/O21, §5.4 W4, R-072, R-121): Vorschlag nach
// der Regel (Grund-Seed-Tarife Keramik 890 / Paket klein 650), Erstattung auf dieselbe Zahlung (PaymentIntent),
// Gutschrift GS mit demselben Grund, M09 mit Anhang, Doppelklick, Rest-Grenze, Fehlschlag → A08, Vorkasse.

const NUMBERS = [991, 992, 993, 994, 995, 996, 997, 998]
const NOW = new Date('2026-10-20T10:00:00.000Z')
let payload: Payload
let restoreBusiness: () => Promise<void>
const pieces: ItemInput[] = []
let orderSeq = 991
let ipSeq = 0

const calls: RefundInput[] = []
const adapter = (status: 'succeeded' | 'failed' = 'succeeded') =>
  ({
    driver: 'mock',
    mode: 'mock',
    async refund(i: RefundInput) {
      calls.push(i)
      if (status === 'failed') throw new Error('Karte abgelaufen')
      return { refundId: `re_test_${i.idempotencyKey.replace(/:/g, '_')}`, status }
    },
  }) as unknown as PaymentsAdapter

const req = () => createLocalReq({ context: { system: true, now: NOW.toISOString() } }, payload)

async function paidOrder(items: ItemInput[], over: Record<string, unknown> = {}): Promise<Order> {
  const nr = orderSeq++
  const order = (await createOrder(
    payload,
    orderData(nr, items, {
      customer: { name: 'Erika Erstattung', email: 'erstattung@planetclaire.local' },
      stripe: { paymentIntentId: `pi_test_${nr}` },
      ...over,
    }),
  )) as Order
  const r = await req()
  const { jobId } = await createInvoiceForOrder(r, order, { paidAt: NOW, now: NOW })
  await runInvoicePdfJob(payload, jobId, { now: NOW })
  return (await payload.findByID({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
  })) as Order
}

async function withdraw(order: Order, itemIds: string[] = []): Promise<Withdrawal> {
  const res = await submitWithdrawal(
    {
      name: 'Erika Erstattung',
      contractIdentification: order.orderNumber,
      email: 'erstattung@planetclaire.local',
      affectedItemIds: itemIds,
      locale: 'de',
    },
    { now: NOW, ip: `198.51.100.${200 + ++ipSeq}`, payload },
  )
  if (!res.ok || res.spam) throw new Error('kein Widerruf')
  return (await payload.findByID({
    collection: 'withdrawals',
    id: res.receipt.id,
    overrideAccess: true,
  })) as Withdrawal
}

async function refund(
  order: Order,
  input: RefundRequestInput,
  payments = adapter(),
  runAfter = true,
) {
  const r = await req()
  const res = await requestRefund(r, order.id, input, NOW, { payments })
  if (runAfter) await res.afterCommit?.()
  return res
}

const reload = async (id: number) =>
  (await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })) as Order
const mails = async (orderId: number, template: string) =>
  (
    await payload.find({
      collection: 'email-log',
      where: { and: [{ order: { equals: orderId } }, { template: { equals: template } }] },
      overrideAccess: true,
    })
  ).docs as EmailLog[]
const creditNote = async (id: unknown) =>
  (await payload.findByID({
    collection: 'invoices',
    id: typeof id === 'object' ? (id as { id: number }).id : Number(id),
    overrideAccess: true,
  })) as Invoice

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  for (const nr of NUMBERS) {
    const p = await createProduct(payload, completeProduct('keramik', nr, fx))
    pieces.push({ id: p.id as number, itemNumber: nr })
  }
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await restoreBusiness()
})

beforeEach(() => {
  calls.length = 0
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
  clearMemoryOutbox()
})

describe('R-072 Erstattung nach Widerruf', () => {
  it('R-072 Voll-Widerruf: dieselbe Zahlung, Stücke + Versand, GS, M09, Status refunded', async () => {
    const order = await paidOrder([
      { ...pieces[0]!, priceCents: 3800 },
      { ...pieces[1]!, priceCents: 2900, shippingClass: 'paket_klein' },
    ])
    const w = await withdraw(order)
    const ids = order.items.map((i) => String(i.id))
    await refund(order, {
      reason: 'withdrawal',
      withdrawalId: w.id,
      itemIds: ids,
      amountCents: 7590,
    })
    expect(calls).toEqual([
      expect.objectContaining({
        paymentIntentId: order.stripe?.paymentIntentId,
        amountCents: 7590,
        idempotencyKey: `refund:${order.id}:1`,
      }),
    ])
    const o = await reload(order.id)
    expect(o.status).toBe('refunded')
    expect(o.refunds?.[0]).toMatchObject({ status: 'succeeded', reason: 'withdrawal' })
    expect(o.items.every((i) => i.status === 'refunded')).toBe(true)
    const gs = await creditNote(o.refunds?.[0]?.creditNote)
    expect(gs).toMatchObject({ type: 'credit_note', reason: 'withdrawal', totalGrossCents: 7590 })
    const m09 = await mails(order.id, 'refund_confirmation')
    expect(m09).toHaveLength(1)
    expect(m09[0]!.status).toBe('sent')
    expect(JSON.stringify(m09[0]!.attachments)).toContain(String(gs.number))
    const wd = await payload.findByID({ collection: 'withdrawals', id: w.id, overrideAccess: true })
    expect(wd.status).toBe('refunded')
  })

  it('R-072 Teil-Widerruf: Preis + Versanddifferenz (3800 + 890 − 650 = 4040), partially_refunded', async () => {
    const order = await paidOrder([
      { ...pieces[2]!, priceCents: 3800 },
      { ...pieces[3]!, priceCents: 2900, shippingClass: 'paket_klein' },
    ])
    const cup = String(order.items[0]!.id)
    const w = await withdraw(order, [cup])
    // weniger als der Vorschlag geht nicht
    await expect(
      refund(order, {
        reason: 'withdrawal',
        withdrawalId: w.id,
        itemIds: [cup],
        amountCents: 3800,
      }),
    ).rejects.toThrow(/nur erhöhen/)
    await refund(order, {
      reason: 'withdrawal',
      withdrawalId: w.id,
      itemIds: [cup],
      amountCents: 4040,
    })
    const o = await reload(order.id)
    expect(o.status).toBe('partially_refunded')
    expect(o.items.map((i) => i.status)).toEqual(['refunded', 'active'])
    const wd = await payload.findByID({ collection: 'withdrawals', id: w.id, overrideAccess: true })
    expect(wd.status).toBe('refunded')
    expect((await creditNote(o.refunds?.[0]?.creditNote)).totalGrossCents).toBe(4040)
  })

  it('R-072 Doppelklick → eine Erstattung; Betrag über dem Rest → abgelehnt', async () => {
    const order = await paidOrder([{ ...pieces[4]!, priceCents: 4500 }])
    const w = await withdraw(order)
    const ids = order.items.map((i) => String(i.id))
    const input = { reason: 'withdrawal', withdrawalId: w.id, itemIds: ids, amountCents: 5390 }
    const first = await refund(order, input, adapter(), false)
    const second = await refund(order, input, adapter(), false)
    expect(second.unchanged).toBe(true)
    await first.afterCommit?.()
    await second.afterCommit?.()
    expect(calls).toHaveLength(1)
    const o = await reload(order.id)
    expect(o.refunds).toHaveLength(1)
    expect(await mails(order.id, 'refund_confirmation')).toHaveLength(1)
    await expect(
      refund(order, { reason: 'goodwill', itemIds: [], amountCents: 1, note: 'Kulanz extra' }),
    ).rejects.toThrow()
  })

  it('R-072 Betrag über dem noch erstattbaren Rest → abgelehnt; Erhöhung nur mit Notiz', async () => {
    const order = await paidOrder([{ ...pieces[5]!, priceCents: 4500 }])
    const w = await withdraw(order)
    const ids = order.items.map((i) => String(i.id))
    await expect(
      refund(order, {
        reason: 'withdrawal',
        withdrawalId: w.id,
        itemIds: ids,
        amountCents: 5391,
        note: 'mehr',
      }),
    ).rejects.toThrow(/Rest/)
    expect(calls).toHaveLength(0)
  })

  it('R-072 Fehlschlag beim Anbieter → failed + A08, keine Gutschrift', async () => {
    const order = await paidOrder([{ ...pieces[6]!, priceCents: 4500 }])
    const w = await withdraw(order)
    const ids = order.items.map((i) => String(i.id))
    await refund(
      order,
      { reason: 'withdrawal', withdrawalId: w.id, itemIds: ids, amountCents: 5390 },
      adapter('failed'),
    )
    const o = await reload(order.id)
    expect(o.refunds?.[0]?.status).toBe('failed')
    expect(o.refunds?.[0]?.creditNote ?? null).toBeNull()
    expect(o.status).toBe('withdrawal_received')
    expect(o.adminAttention).toMatchObject({ flag: true, reason: 'refund_failed' })
    expect(await mails(order.id, 'admin_refund_failed')).toHaveLength(1)
    expect(await mails(order.id, 'refund_confirmation')).toHaveLength(0)
  })
})

describe('R-072 O15 Erstatten aus der Bestellung', () => {
  it('R-072 O15 ohne Grund → abgelehnt; Storno einer bezahlten Bestellung (admin_cancellation) → refunded, GS mit Grund', async () => {
    const order = await paidOrder([{ ...pieces[7]!, priceCents: 4500 }])
    const ids = order.items.map((i) => String(i.id))
    await expect(refund(order, { reason: '', itemIds: ids, amountCents: 5390 })).rejects.toThrow(
      /Grund/,
    )
    await expect(
      refund(order, { reason: 'item_unavailable', itemIds: ids, amountCents: 5390 }),
    ).rejects.toThrow(/Grund/)
    await refund(order, { reason: 'admin_cancellation', itemIds: ids, amountCents: 5390 })
    const o = await reload(order.id)
    expect(o.status).toBe('refunded')
    expect(o.statusHistory?.at(-1)?.transition).toBe('O15')
    expect((await creditNote(o.refunds?.[0]?.creditNote)).reason).toBe('admin_cancellation')
  })

  it('R-072 Bruch vor dem Versand (breakage) → refunded, GS mit Grund breakage', async () => {
    const order = await paidOrder([{ ...pieces[0]!, priceCents: 1200 }])
    const ids = order.items.map((i) => String(i.id))
    await refund(order, { reason: 'breakage', itemIds: ids, amountCents: 2090 })
    const o = await reload(order.id)
    expect(o.status).toBe('refunded')
    expect((await creditNote(o.refunds?.[0]?.creditNote)).reason).toBe('breakage')
  })

  it('R-072 Vorkasse: nur nach „Erstattung überwiesen“, dann sofort GS und M09, keine Anbieter-Erstattung', async () => {
    const order = await paidOrder([{ ...pieces[1]!, priceCents: 2000 }], {
      paymentMethod: 'prepayment',
      paymentProvider: 'bank_transfer',
      stripe: {},
    })
    const ids = order.items.map((i) => String(i.id))
    await expect(
      refund(order, { reason: 'goodwill', itemIds: ids, amountCents: 2890 }),
    ).rejects.toThrow(/überwiesen/)
    await refund(order, {
      reason: 'goodwill',
      itemIds: ids,
      amountCents: 2890,
      manualTransferConfirmed: true,
    })
    expect(calls).toHaveLength(0)
    const o = await reload(order.id)
    expect(o.status).toBe('refunded')
    expect(o.refunds?.[0]?.manualTransferConfirmedAt).toBe(NOW.toISOString())
    expect(await mails(order.id, 'refund_confirmation')).toHaveLength(1)
    expect(JSON.stringify(o)).not.toMatch(/iban/i)
  })
})
