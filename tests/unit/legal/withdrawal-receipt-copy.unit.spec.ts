import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const enqueueEmail = vi.fn()
vi.mock('@/lib/email/outbox', () => ({
  adminRecipient: vi.fn(async () => 'jutta@example.test'),
  enqueueEmail: (...args: unknown[]) => enqueueEmail(...args),
}))
vi.mock('@/lib/payload/localReq', () => ({
  preservingReq: async (_req: unknown, fn: () => unknown) => fn(),
}))

import { sendWithdrawalReceiptCopy, WithdrawalCopyError } from '@/lib/legal/withdrawalReceiptCopy'

const NOW = new Date('2026-10-01T10:00:00Z')

function makeReq(opts: {
  withdrawal: Record<string, unknown> | null
  order?: Record<string, unknown> | null
  returnAddress?: string | null
}) {
  const findByID = vi.fn(async ({ collection }: { collection: string }) =>
    collection === 'withdrawals' ? opts.withdrawal : (opts.order ?? null),
  )
  const findGlobal = vi.fn(async () => ({
    business: opts.returnAddress === undefined ? {} : { returnAddress: opts.returnAddress },
  }))
  return { req: { payload: { findByID, findGlobal } } as unknown as PayloadRequest, findByID }
}

const base = {
  id: 7,
  reference: 'WI-1',
  receivedAt: '2026-10-01T08:00:00Z',
  refundDueAt: '2026-10-15T08:00:00Z',
  name: 'Erika',
  contractIdentification: 'PC-1',
}

describe('P6.19 Kopie der Eingangsbestätigung M08 (Zweige)', () => {
  beforeEach(() => {
    enqueueEmail.mockReset()
    enqueueEmail.mockResolvedValue({ jobId: 42 })
  })

  it('R-093 unbekannter Widerruf → WithdrawalCopyError 404', async () => {
    const { req } = makeReq({ withdrawal: null })
    const err = await sendWithdrawalReceiptCopy(req, 1, 'k', NOW).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(WithdrawalCopyError)
    expect((err as WithdrawalCopyError).status).toBe(404)
  })

  it('R-093 Empfänger immer die Verwaltung; Positionen aus der Bestellung, Objekt-Verweis, Schlüssel bereinigt', async () => {
    const { req, findByID } = makeReq({
      withdrawal: {
        ...base,
        order: { id: 3 },
        affectedItemIds: ['a', 'c'],
        email: 'erika@example.test',
        itemsText: 'Schale',
        reason: 'zu klein',
      },
      order: {
        status: 'cancelled',
        timestamps: {},
        items: [
          { id: 'a', itemNumber: 12, titleDe: 'Schale' },
          { id: 'b', itemNumber: 13, titleDe: 'Tasse' },
          { id: 'c', itemNumber: 14, titleDe: '' },
          { itemNumber: 15, titleDe: 'ohne id' },
        ],
      },
      returnAddress: 'Musterweg 1',
    })
    const res = await sendWithdrawalReceiptCopy(req, 7, 'a b/c!', NOW)
    expect(res.to).toBe('jutta@example.test')
    expect(res.jobId).toBe(42)
    expect(findByID).toHaveBeenCalledTimes(2)
    const arg = enqueueEmail.mock.calls[0]![1] as {
      to: string
      idempotencyKey: string
      data: Record<string, unknown>
    }
    expect(arg.to).toBe('jutta@example.test')
    expect(arg.idempotencyKey).toBe('withdrawal_receipt:7:copy:abc')
    expect(arg.data.items).toEqual([
      { itemNumber: 12, title: 'Schale' },
      { itemNumber: 14, title: 'Nr. 14' },
    ])
    expect(arg.data.unpaidOrderCancelled).toBe(true)
    expect(arg.data.email).toBe('erika@example.test')
    expect(arg.data.returnAddress).toBe('Musterweg 1')
    expect(arg.data.reason).toBe('zu klein')
  })

  it('R-093 Bestellung als Zahl, bezahlt → nicht „unbezahlt storniert“; Standardwerte ohne Angaben', async () => {
    const { req } = makeReq({
      withdrawal: { ...base, order: 5, affectedItemIds: 'kaputt' },
      order: { status: 'cancelled', timestamps: { paidAt: '2026-09-30T00:00:00Z' } },
    })
    await sendWithdrawalReceiptCopy(req, 7, '', NOW)
    const arg = enqueueEmail.mock.calls[0]![1] as {
      idempotencyKey: string
      data: Record<string, unknown>
    }
    expect(arg.idempotencyKey).toBe(`withdrawal_receipt:7:copy:${NOW.getTime()}`)
    expect(arg.data).toMatchObject({
      email: 'keine Angabe',
      itemsText: null,
      reason: null,
      items: [],
      unpaidOrderCancelled: false,
      returnAddress: null,
    })
  })

  it('R-093 ohne Bestellung: keine Positionen, nicht storniert', async () => {
    const { req, findByID } = makeReq({ withdrawal: { ...base, order: null } })
    await sendWithdrawalReceiptCopy(req, 7, 'x', NOW)
    expect(findByID).toHaveBeenCalledTimes(1)
    const arg = enqueueEmail.mock.calls[0]![1] as { data: Record<string, unknown> }
    expect(arg.data.items).toEqual([])
    expect(arg.data.unpaidOrderCancelled).toBe(false)
  })
})
