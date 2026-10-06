import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const enqueueEmail = vi.fn()
vi.mock('@/lib/email/outbox', () => ({ enqueueEmail: (...a: unknown[]) => enqueueEmail(...a) }))
vi.mock('@/lib/payload/localReq', () => ({
  preservingReq: async (_req: unknown, fn: () => unknown) => fn(),
}))

import {
  ComplaintActionError,
  complaintDeadlines,
  createComplaint,
  handoverAt,
  repairChosenForOrder,
  sendRepairChoice,
  sendVsbgNotice,
  warrantyEndsAt,
} from '@/lib/legal/complaints'

const NOW = new Date('2026-10-05T10:00:00Z')

const order = (over: Record<string, unknown> = {}) =>
  ({
    id: 5,
    orderNumber: 'PC-2026-00005',
    locale: 'de',
    customer: { email: 'k@example.test', name: 'Kundin' },
    items: [
      { id: 'a', itemNumber: 1, titleDe: 'Schale', titleEn: 'Bowl' },
      { id: 'b', itemNumber: 2, titleDe: '', titleEn: '' },
      { id: 'c', itemNumber: 3, titleDe: 'Tasse', titleEn: '' },
    ],
    ...over,
  }) as never

function req(complaint: Record<string, unknown> | null, collections: object = { complaints: {} }) {
  const update = vi.fn(async ({ data }: { data: object }) => ({ ...complaint, ...data }))
  const create = vi.fn(async ({ data }: { data: object }) => ({ id: 1, ...data }))
  const count = vi.fn(async () => ({ totalDocs: 1 }))
  return {
    req: {
      payload: { collections, findByID: vi.fn(async () => complaint), update, create, count },
    } as unknown as PayloadRequest,
    update,
    create,
    count,
  }
}
const complaint = (over: Record<string, unknown> = {}) => ({
  id: 9,
  order: 5,
  kind: 'defect',
  receivedAt: '2026-10-01T08:00:00Z',
  ...over,
})

describe('R-100/R-110/R-111 Reklamation (Zweige)', () => {
  beforeEach(() => {
    enqueueEmail.mockReset()
    enqueueEmail.mockResolvedValue({ jobId: 77 })
  })

  it('Übergabe und Gewährleistung', () => {
    expect(handoverAt(null)).toBeNull()
    expect(handoverAt({ deliveredAt: '', pickedUpAt: 'kaputt' })).toBeNull()
    expect(handoverAt({ deliveredAt: null, pickedUpAt: new Date('2026-01-01T00:00:00Z') })).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(warrantyEndsAt(undefined, false)).toBeNull()
    const base = { deliveredAt: '2026-01-10T12:00:00Z' }
    expect(warrantyEndsAt(base, false)!.toISOString()).toMatch(/^2028-01-10/)
    expect(warrantyEndsAt(base, true)!.toISOString()).toMatch(/^2029-01-10/)
  })

  it('Fristen: Transportschaden ab Zustellung bzw. Eingang; Mangel ohne Versandfrist', () => {
    const t = complaintDeadlines({
      kind: 'transport_damage',
      receivedAt: '2026-10-01T10:00:00Z',
      order: { deliveredAt: '2026-09-28T10:00:00Z' },
    })
    expect(t.carrierClaimDueAt!.toISOString()).toMatch(/^2026-10-05/)
    const noDelivery = complaintDeadlines({
      kind: 'transport_damage',
      receivedAt: '2026-10-01T10:00:00Z',
      order: null,
      customerChoice: 'repair',
    })
    expect(noDelivery.carrierClaimDueAt!.toISOString()).toMatch(/^2026-10-08/)
    expect(noDelivery.warrantyEndsAt).toBeNull()
    const none = complaintDeadlines({
      kind: 'transport_damage',
      receivedAt: 'kaputt',
      order: undefined,
    })
    expect(none.carrierClaimDueAt).toBeNull()
    expect(
      complaintDeadlines({ kind: 'defect', receivedAt: NOW, order: undefined }).carrierClaimDueAt,
    ).toBeNull()
  })

  it('Reparatur gewählt? (Sammlung fehlt → false)', async () => {
    expect(await repairChosenForOrder(req(null, {}).req, 5)).toBe(false)
    expect(await repairChosenForOrder(req(null).req, 5)).toBe(true)
  })

  it('createComplaint: Prüfung der Art und der Stücke, Standardwerte', async () => {
    const r = req(null)
    await expect(createComplaint(r.req, order(), { kind: 'x' as never })).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      createComplaint(r.req, order(), { affectedItemIds: ['zz'] }),
    ).rejects.toBeInstanceOf(ComplaintActionError)
    await createComplaint(r.req, order(), {})
    expect(r.create.mock.calls[0]![0].data).toMatchObject({
      kind: 'transport_damage',
      affectedItemIds: [],
    })
    expect('receivedAt' in r.create.mock.calls[0]![0].data).toBe(false)
    await createComplaint(r.req, order({ items: undefined }), {
      kind: 'defect',
      receivedAt: '2026-10-02T00:00:00Z',
      description: '  Riss  ',
    })
    expect(r.create.mock.calls[1]![0].data).toMatchObject({
      kind: 'defect',
      receivedAt: '2026-10-02T00:00:00Z',
      description: 'Riss',
    })
    await createComplaint(r.req, order(), { description: '   ', affectedItemIds: ['a'] })
    expect(r.create.mock.calls[2]![0].data.description).toBeUndefined()
  })

  it('Aktionen: Auswahl der Akte und Zugehörigkeit', async () => {
    const r = req(complaint())
    await expect(sendRepairChoice(r.req, order(), 'abc', NOW)).rejects.toMatchObject({
      status: 400,
    })
    await expect(sendRepairChoice(r.req, order(), 0, NOW)).rejects.toMatchObject({ status: 400 })
    await expect(sendRepairChoice(req(null).req, order(), 9, NOW)).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      sendRepairChoice(req(complaint({ order: 6 })).req, order(), 9, NOW),
    ).rejects.toMatchObject({
      status: 404,
    })
    const ok = await sendRepairChoice(req(complaint({ order: { id: 5 } })).req, order(), 9, NOW)
    expect(ok.unchanged).toBe(false)
  })

  it('M12: Stücke der Akte (alle oder Auswahl), EN-Titel mit Rückfall, Zeitstempel gesetzt', async () => {
    const r = req(complaint({ affectedItemIds: ['a', 'b'] }))
    const res = await sendRepairChoice(r.req, order({ locale: 'en' }), 9, NOW)
    expect(res).toMatchObject({ unchanged: false, jobId: 77 })
    const mail = enqueueEmail.mock.calls[0]![1]
    expect(mail.template).toBe('complaint_repair_choice')
    expect(mail.idempotencyKey).toBe('complaint_repair_choice:9:1')
    expect(mail.data.items).toEqual([
      { itemNumber: 1, title: 'Bowl' },
      { itemNumber: 2, title: 'Nr. 2' },
    ])
    expect(r.update.mock.calls[0]![0].data).toEqual({ repairChoiceSentAt: NOW.toISOString() })
    const all = req(complaint({ affectedItemIds: 'kaputt' }))
    await sendRepairChoice(all.req, order({ locale: 'en' }), 9, NOW)
    expect(
      enqueueEmail.mock.calls[1]![1].data.items.map((i: { title: string }) => i.title),
    ).toEqual(['Bowl', 'Nr. 2', 'Tasse'])
  })

  it('M13: Streitbeilegungshinweis; bereits gesendet → unverändert; ohne E-Mail → 409', async () => {
    const r = req(complaint())
    await sendVsbgNotice(r.req, order(), 9, NOW)
    expect(enqueueEmail.mock.calls[0]![1].template).toBe('dispute_vsbg')
    expect(enqueueEmail.mock.calls[0]![1].data.items).toBeUndefined()
    expect(enqueueEmail.mock.calls[0]![1].data.customerName).toBe('Kundin')
    expect(r.update.mock.calls[0]![0].data).toEqual({ vsbgNoticeSentAt: NOW.toISOString() })
    const done = await sendVsbgNotice(
      req(complaint({ vsbgNoticeSentAt: '2026-10-02T00:00:00Z' })).req,
      order(),
      9,
      NOW,
    )
    expect(done).toMatchObject({ unchanged: true, jobId: null })
    expect(enqueueEmail).toHaveBeenCalledTimes(1)
    await expect(
      sendVsbgNotice(r.req, order({ customer: { email: null } }), 9, NOW),
    ).rejects.toMatchObject({ status: 409 })
    await sendVsbgNotice(r.req, order({ customer: { email: 'k@example.test' } }), 9, NOW)
    expect(enqueueEmail.mock.calls[1]![1].data.customerName).toBeNull()
  })
})
