import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { loadWithdrawalDetail } from '@/admin/views/withdrawals/withdrawalQuery'
import {
  WITHDRAWAL_TRANSITIONS,
  canTransitionWithdrawal,
} from '@/lib/commerce/withdrawalTransitions'
import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { WITHDRAWAL_STATUSES } from '@/lib/enums'
import { parseEnv } from '@/lib/env'
import { recordManualWithdrawal, submitWithdrawal } from '@/lib/legal/withdrawal'
import {
  closeWithoutRefund,
  markGoodsReturned,
  markReturnProof,
  markWithdrawalSpam,
  matchWithdrawalOrder,
  rejectWithdrawal,
  searchOrdersForWithdrawal,
} from '@/lib/legal/withdrawalInbox'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Withdrawal } from '@/payload-types'

import { adminReq, systemReq } from '../helpers/admin'
import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.9 – Widerrufs-Posteingang (KONZEPT §5.4/§7.10, R-094, DATENMODELL §6.11): Aktionen W2/W3/W5/W7, Spam, manuelle
// Erfassung, Countdown „erstatten bis“ über die Zeitumstellung, O20 nur ohne weiteren offenen Widerruf.

const NUMBERS = [987, 988, 989, 990]
const NOW = new Date('2026-10-20T12:03:00.000Z') // Di 20.10.2026 14:03 MESZ
let payload: Payload
let admin: PayloadRequest
let restoreBusiness: () => Promise<void>
let items: ItemInput[] = []
let ipSeq = 0
let orderSeq = 987

const memory = () => createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' }))

async function newOrder(pieces: ItemInput[], over: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(
    payload,
    orderData(orderSeq++, pieces, {
      customer: { name: 'Erika Posteingang', email: 'post@planetclaire.local' },
      ...over,
    }),
  )) as Order
}

async function online(over: Record<string, unknown> = {}, now = NOW): Promise<Withdrawal> {
  const res = await submitWithdrawal(
    {
      name: 'Erika Posteingang',
      contractIdentification: 'Bestellung ohne Nummer',
      email: 'post@planetclaire.local',
      locale: 'de',
      ...over,
    },
    { now, ip: `192.0.2.${++ipSeq}`, payload },
  )
  if (!res.ok || res.spam) throw new Error('kein Widerruf')
  return (await payload.findByID({
    collection: 'withdrawals',
    id: res.receipt.id,
    depth: 0,
    overrideAccess: true,
  })) as Withdrawal
}

const run = <T>(fn: (req: PayloadRequest) => Promise<T>) => inTransaction(admin, () => fn(admin))
const orderOf = async (id: number) =>
  (await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })) as Order

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  items = []
  for (const nr of NUMBERS) {
    const p = await createProduct(payload, completeProduct('keramik', nr, fx))
    items.push({ id: p.id as number, itemNumber: nr })
  }
  const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  const user =
    users.docs[0] ??
    (await payload.create({
      collection: 'users',
      data: {
        email: 'inbox-admin@example.com',
        password: 'richtig-langes-passwort-2026',
        name: 'Jutta',
        role: 'admin',
      } as never,
      overrideAccess: true,
    }))
  admin = await adminReq(payload, user.id as number)
  admin.context = { ...admin.context, now: NOW.toISOString() }
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await restoreBusiness()
})

beforeEach(() => {
  __setEmailAdapterForTests(memory())
  clearMemoryOutbox()
})

describe('R-094 Posteingang', () => {
  it('R-094 Countdown „erstatten bis“ über die Zeitumstellung: 14 Berliner Tage, ab Tag 10 rot', async () => {
    const w = await online()
    // Eingang 20.10. 14:03 MESZ → 03.11. 14:03 MEZ (Zeitumstellung am 25.10.)
    expect(w.refundDueAt).toBe('2026-11-03T13:03:00.000Z')
    const day9 = await loadWithdrawalDetail(admin, w.id, new Date('2026-10-29T22:30:00.000Z'))
    expect(day9?.card).toMatchObject({
      refundDue: '03.11.2026',
      refundUrgent: false,
      daysSinceReceipt: 9,
    })
    const day10 = await loadWithdrawalDetail(admin, w.id, new Date('2026-10-29T23:30:00.000Z'))
    expect(day10?.card).toMatchObject({ refundUrgent: true, daysSinceReceipt: 10 })
  })

  it('R-094 DM-WDR-04 manuell erfasster Brief-Widerruf ohne E-Mail: Kanal und Zugangszeitpunkt, keine Kund:innen-Mail, keine IP', async () => {
    const res = await run((req) =>
      recordManualWithdrawal(
        req,
        {
          channel: 'letter',
          receivedAt: '2026-10-19T08:00:00.000Z',
          name: 'Brief Schreiberin',
          contractIdentification: 'Brief vom 17.10., Tasse',
          sendReceipt: false,
        },
        NOW,
      ),
    )
    expect(res.doc).toMatchObject({
      channel: 'letter',
      receivedAt: '2026-10-19T08:00:00.000Z',
      status: 'received',
      matchStatus: 'needs_manual_match',
      email: null,
    })
    expect(res.jobs).toEqual([])
    expect(getMemoryOutbox()).toHaveLength(0)
    const raw = JSON.stringify(res.doc).toLowerCase()
    expect(raw).not.toMatch(/ip_?hash|user.?agent|"ip"/)
    // Eingangsbestätigung nur mit E-Mail
    await expect(
      run((req) =>
        recordManualWithdrawal(
          req,
          {
            channel: 'email',
            receivedAt: '2026-10-19T08:00:00.000Z',
            name: 'Ohne Adresse',
            contractIdentification: 'per Mail',
            sendReceipt: true,
          },
          NOW,
        ),
      ),
    ).rejects.toThrow(/E-Mail/)
    // Zugang in der Zukunft → abgelehnt
    await expect(
      run((req) =>
        recordManualWithdrawal(
          req,
          {
            channel: 'email',
            receivedAt: '2026-10-21T08:00:00.000Z',
            name: 'Zukunft',
            contractIdentification: 'per Mail',
          },
          NOW,
        ),
      ),
    ).rejects.toThrow(/Zukunft/)
  })

  it('R-094 manuell per Mail mit „Eingangsbestätigung senden“ → M08 an die angegebene Adresse', async () => {
    const res = await run((req) =>
      recordManualWithdrawal(
        req,
        {
          channel: 'email',
          receivedAt: '2026-10-19T08:00:00.000Z',
          name: 'Mail Schreiberin',
          contractIdentification: 'per Mail, Schale',
          email: 'manuell@planetclaire.local',
          sendReceipt: true,
        },
        NOW,
      ),
    )
    expect(res.jobs).toHaveLength(1)
    const logs = await payload.find({
      collection: 'email-log',
      where: { withdrawal: { equals: res.doc.id } },
      overrideAccess: true,
    })
    expect(logs.docs.map((l) => l.template)).toEqual(['withdrawal_receipt'])
  })

  it('R-094 W2 zuordnen (Suche nach Nummer/E-Mail/Name) → O11, Widerrufsstatus bleibt', async () => {
    const order = await newOrder([items[0]!])
    const w = await online()
    expect(w.matchStatus).toBe('needs_manual_match')
    const hits = await searchOrdersForWithdrawal(admin, 'post@planetclaire')
    expect(hits.map((h) => h.id)).toContain(order.id)
    const res = await run((req) => matchWithdrawalOrder(req, w.id, { orderId: order.id }, NOW))
    expect(res.doc).toMatchObject({ status: 'received', matchStatus: 'manually_matched' })
    expect((await orderOf(order.id)).status).toBe('withdrawal_received')
    // zweiter Klick → unverändert
    const again = await run((req) => matchWithdrawalOrder(req, w.id, { orderId: order.id }, NOW))
    expect(again.unchanged).toBe(true)
  })

  it('R-094 W3 „Ware ist zurück“ (O12, Zustandsnotiz) und Rücksendenachweis', async () => {
    const order = await newOrder([items[1]!])
    const w = await online({ contractIdentification: order.orderNumber })
    expect(w.matchStatus).toBe('auto_matched')
    const proof = await run((req) => markReturnProof(req, w.id, NOW))
    expect(proof.doc.returnProofReceivedAt).toBe(NOW.toISOString())
    const res = await run((req) =>
      markGoodsReturned(req, w.id, { note: 'Ecke leicht bestoßen' }, NOW),
    )
    expect(res.doc).toMatchObject({
      status: 'goods_returned',
      returnConditionNote: 'Ecke leicht bestoßen',
    })
    expect(res.doc.goodsReturnedAt).toBe(NOW.toISOString())
    const o = await orderOf(order.id)
    expect(o.status).toBe('return_received')
    expect(o.items.every((i) => i.status === 'returned')).toBe(true)
  })

  it('R-094 W7 „Ablehnen“ nur mit Begründung; Spam-Markierung mit Begründung', async () => {
    const w = await online()
    await expect(
      run((req) => rejectWithdrawal(req, w.id, { closeNote: 'kurz' }, NOW)),
    ).rejects.toThrow(/begründen/)
    const res = await run((req) =>
      rejectWithdrawal(
        req,
        w.id,
        { closeNote: 'Frist eindeutig abgelaufen (Zustellung Mai).' },
        NOW,
      ),
    )
    expect(res.doc.status).toBe('rejected')
    const s = await online()
    const spam = await run((req) =>
      markWithdrawalSpam(req, s.id, { reason: 'Testeintrag von mir selbst' }, NOW),
    )
    expect(spam.doc).toMatchObject({
      status: 'rejected',
      spam: { reason: 'Testeintrag von mir selbst' },
    })
    expect(spam.doc.spam?.markedAt).toBe(NOW.toISOString())
  })
})

describe('AK-5-01 Widerruf: Matrix der Übergänge', () => {
  it('AK-5-01 Widerruf: erlaubt sind genau die Übergänge aus DATENMODELL §6.11', () => {
    const allowed = new Set(
      Object.entries(WITHDRAWAL_TRANSITIONS).flatMap(([from, tos]) =>
        tos.map((to) => `${from}>${to}`),
      ),
    )
    expect([...allowed].sort()).toEqual(
      [
        'received>goods_returned',
        'received>refunded',
        'received>partially_refunded',
        'received>closed',
        'received>rejected',
        'goods_returned>refunded',
        'goods_returned>partially_refunded',
        'goods_returned>closed',
        'partially_refunded>refunded',
        'partially_refunded>closed',
      ].sort(),
    )
    for (const from of WITHDRAWAL_STATUSES) {
      for (const to of WITHDRAWAL_STATUSES) {
        expect(canTransitionWithdrawal(from, to), `${from}>${to}`).toBe(
          allowed.has(`${from}>${to}`),
        )
      }
    }
  })

  it('AK-5-01 Widerruf: received → refunded ohne Erstattung und jede automatische Ablehnung schlagen fehl', async () => {
    const w = await online()
    // ohne Aktionsknopf (kein `transition` im Kontext) kein Statuswechsel
    await expect(
      payload.update({
        collection: 'withdrawals',
        id: w.id,
        data: { status: 'refunded' },
        overrideAccess: true,
        context: { system: true },
      }),
    ).rejects.toThrow()
    // System (Job/Webhook, ohne Verwaltung) kann nicht ablehnen
    const sys = await systemReq(payload, NOW.toISOString())
    await expect(
      inTransaction(sys, () =>
        rejectWithdrawal(sys, w.id, { closeNote: 'automatisch abgelehnt, Frist vorbei' }, NOW),
      ),
    ).rejects.toThrow(/nie automatisch/)
    await expect(
      payload.update({
        collection: 'withdrawals',
        id: w.id,
        data: { status: 'rejected', closeNote: 'automatisch abgelehnt, Frist vorbei' },
        overrideAccess: true,
        context: { system: true, transition: 'W7' },
      }),
    ).rejects.toThrow()
    const after = await payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      overrideAccess: true,
    })
    expect(after.status).toBe('received')
  })
})

describe('„Ohne Erstattung abschließen“ (W5, O20)', () => {
  it('R-094 genau ein offener Widerruf → O20 auf statusBeforeWithdrawal, Positionen wieder aktiv', async () => {
    const order = await newOrder([items[2]!])
    const w = await online({ contractIdentification: order.orderNumber })
    expect((await orderOf(order.id)).status).toBe('withdrawal_received')
    await expect(run((req) => closeWithoutRefund(req, w.id, {}, NOW))).rejects.toThrow(/Grund/)
    await expect(
      run((req) => closeWithoutRefund(req, w.id, { closeReason: 'other', closeNote: 'kurz' }, NOW)),
    ).rejects.toThrow(/begründen/)
    const res = await run((req) => closeWithoutRefund(req, w.id, { closeReason: 'retracted' }, NOW))
    expect(res.doc).toMatchObject({ status: 'closed', closeReason: 'retracted' })
    const o = await orderOf(order.id)
    expect(o.status).toBe('paid')
    expect(o.items.every((i) => i.status === 'active')).toBe(true)
    expect(o.statusHistory?.at(-1)?.transition).toBe('O20')
  })

  it('R-094 zwei offene Widerrufe → erst das Abschließen des zweiten löst O20 aus', async () => {
    const order = await newOrder([items[3]!])
    const first = await online({ contractIdentification: order.orderNumber })
    const second = await online({ contractIdentification: `${order.orderNumber} nochmal` })
    expect(second.matchStatus).toBe('auto_matched')
    await run((req) => closeWithoutRefund(req, first.id, { closeReason: 'duplicate' }, NOW))
    expect((await orderOf(order.id)).status).toBe('withdrawal_received')
    await run((req) => closeWithoutRefund(req, second.id, { closeReason: 'retracted' }, NOW))
    expect((await orderOf(order.id)).status).toBe('paid')
  })

  it('R-094 nicht zugeordneter Widerruf ändert keine Bestellung', async () => {
    const before = await payload.find({
      collection: 'orders',
      depth: 0,
      overrideAccess: true,
      limit: 100,
    })
    const w = await online()
    await run((req) => closeWithoutRefund(req, w.id, { closeReason: 'duplicate' }, NOW))
    const after = await payload.find({
      collection: 'orders',
      depth: 0,
      overrideAccess: true,
      limit: 100,
    })
    expect(after.docs.map((o) => [o.id, o.status, o.updatedAt])).toEqual(
      before.docs.map((o) => [o.id, o.status, o.updatedAt]),
    )
  })
})
