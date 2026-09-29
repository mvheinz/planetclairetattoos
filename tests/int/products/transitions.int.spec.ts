import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStatusHistory } from '@/lib/audit'
import {
  evaluateProductTransition,
  PRODUCT_TRANSITION_NAMES,
  PRODUCT_TRANSITIONS,
  transitionProduct,
  type ProductTransition,
  type ProductTransitionFacts,
} from '@/lib/commerce/productTransitions'
import { PRODUCT_STATUSES, type ProductStatus } from '@/lib/enums'

import { adminReq, resetAdmin, systemReq } from '../helpers/admin'
import { checkoutData, createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.7 – Statusautomat der Stücke nach KONZEPT §5.1 (P1–P15), Namen nach DATENMODELL §6.6.7 (AK-5-01, AK-5-02).

/** KONZEPT §5.1: erlaubte Übergänge (Ausgangsstatus:Übergang → ID). Alles andere scheitert. */
const ALLOWED: Readonly<Record<string, string>> = {
  'draft:publish': 'P2',
  'available:unpublish': 'P3',
  'available:reserve': 'P4',
  'reserved:release': 'P5',
  'reserved:convertToPrepayment': 'P6',
  'reserved:sell': 'P7',
  'available:sell': 'P8',
  'available:sellOffline': 'P9',
  'reserved:sellOffline': 'P10',
  'sold:returnToStock': 'P11',
  'draft:archive': 'P12',
  'available:archive': 'P12',
  'sold:archiveAfterReturn': 'P13',
  'archived:restore': 'P14',
}
const TARGET: Readonly<Record<string, ProductStatus>> = {
  P2: 'available',
  P3: 'draft',
  P4: 'reserved',
  P5: 'available',
  P6: 'reserved',
  P7: 'sold',
  P8: 'sold',
  P9: 'sold',
  P10: 'sold',
  P11: 'available',
  P12: 'archived',
  P13: 'archived',
  P14: 'draft',
}

/** Fakten, bei denen jede Vorbedingung erfüllt ist – so prüft die Matrix nur die Tabelle. */
const permissive = (actor: 'admin' | 'system'): ProductTransitionFacts => ({
  actor,
  soldChannel: 'offline',
  reservationRef: 'ref-1',
  activeReservation: false,
  reservation: { ref: 'ref-1', source: 'checkout_session', checkoutStatus: 'open' },
  order: {
    itemStatus: 'refunded',
    returnReceivedAt: '2026-09-28T10:00:00.000Z',
    refunds: [{ reason: 'breakage', status: 'succeeded' }],
  },
})
const input = {
  reservationRef: 'ref-1',
  reservedUntil: '2026-09-29T10:30:00.000Z',
  orderId: 1,
  channel: 'online' as const,
  confirmReservedCheckout: true,
}

describe('AK-5-01 Produkt – Matrix des Statusautomaten (reine Funktion)', () => {
  it('AK-5-01 Produkt: genau die Übergänge aus KONZEPT §5.1 gelingen, alle anderen scheitern', () => {
    const seen: string[] = []
    for (const from of PRODUCT_STATUSES) {
      for (const t of PRODUCT_TRANSITION_NAMES) {
        const def = PRODUCT_TRANSITIONS[t]
        const actor = def.actors.includes('admin') ? 'admin' : 'system'
        const result = evaluateProductTransition(from, t, permissive(actor), input)
        const expected = ALLOWED[`${from}:${t}`]
        if (expected) {
          expect(result, `${from} → ${t}`).toEqual({
            ok: true,
            id: expected,
            from,
            to: TARGET[expected],
          })
          seen.push(expected)
        } else {
          expect(result.ok, `${from} → ${t} muss scheitern`).toBe(false)
        }
      }
    }
    // P1 (Anlage) und P15 (Löschen) laufen über create/delete, alle übrigen IDs kommen vor.
    expect([...new Set(seen)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))).toEqual(
      Array.from({ length: 13 }, (_, i) => `P${i + 2}`),
    )
  })

  it('AK-5-01 Produkt: Auslöser – System-Schritte nicht für die Verwaltung, Verwaltungs-Schritte nicht fürs System', () => {
    const systemOnly: [ProductStatus, ProductTransition][] = [
      ['available', 'reserve'],
      ['reserved', 'release'],
      ['reserved', 'convertToPrepayment'],
    ]
    for (const [from, t] of systemOnly) {
      expect(evaluateProductTransition(from, t, permissive('admin'), input).ok).toBe(false)
    }
    const adminOnly: [ProductStatus, ProductTransition][] = [
      ['available', 'sellOffline'],
      ['reserved', 'sellOffline'],
      ['draft', 'archive'],
      ['sold', 'archiveAfterReturn'],
      ['archived', 'restore'],
    ]
    for (const [from, t] of adminOnly) {
      expect(evaluateProductTransition(from, t, permissive('system'), input).ok).toBe(false)
    }
    // P3 auch durch das System (Widerruf einer Konformitätserklärung)
    expect(
      evaluateProductTransition('available', 'unpublish', permissive('system'), input).ok,
    ).toBe(true)
  })

  it('AK-5-01 Produkt: P3/P12 nur ohne aktive Reservierung; P10 nie bei Vorkasse, bei confirming gesperrt', () => {
    const reservedFacts = { ...permissive('admin'), activeReservation: true }
    expect(evaluateProductTransition('available', 'unpublish', reservedFacts, input).ok).toBe(false)
    expect(evaluateProductTransition('available', 'archive', reservedFacts, input).ok).toBe(false)
    const prepayment = {
      ...permissive('admin'),
      reservation: { ref: 'ref-1', source: 'prepayment' as const, checkoutStatus: 'open' as const },
    }
    expect(evaluateProductTransition('reserved', 'sellOffline', prepayment, input)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/für eine Vorkasse-Bestellung reserviert/),
    })
    const confirming = {
      ...permissive('admin'),
      reservation: {
        ref: 'ref-1',
        source: 'checkout_session' as const,
        checkoutStatus: 'confirming' as const,
      },
    }
    expect(evaluateProductTransition('reserved', 'sellOffline', confirming, input).ok).toBe(false)
    expect(
      evaluateProductTransition('reserved', 'sellOffline', permissive('admin'), {
        ...input,
        confirmReservedCheckout: false,
      }).ok,
    ).toBe(false)
  })
})

// Matrix über die echten Endpunkte (DATENMODELL §6.6.10) mit Audit (AK-5-02).

let payload: Payload
let fx: ProductFixtures
let token: string
let admin: PayloadRequest
let orderNr = 760

const post = (id: number, action: string, body: Record<string, unknown> = {}) =>
  rest('POST', `/products/${id}/${action}`, body, { authorization: `JWT ${token}` })
const byId = (id: number) =>
  payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true })

const FUTURE = '2099-01-01T10:00:00.000Z'

/** Legt ein Stück im gewünschten Status an (nur über Übergänge). */
async function productIn(status: ProductStatus, nr: number): Promise<number> {
  await deleteCommerce(payload)
  await deleteProducts(payload, [nr])
  const p = await createProduct(payload, completeProduct('keramik', nr, fx))
  const id = p.id as number
  if (status === 'draft') return id
  if (status === 'archived') {
    await transitionProduct(admin, id, 'archive')
    return id
  }
  await transitionProduct(admin, id, 'publish')
  if (status === 'available') return id
  if (status === 'sold') {
    await transitionProduct(admin, id, 'sellOffline', { note: 'Flohmarkt' })
    return id
  }
  const { data } = checkoutData([{ id, itemNumber: p.itemNumber }], {
    expiresAt: FUTURE,
    displayExpiresAt: FUTURE,
  })
  const checkout = await payload.create({
    collection: 'checkouts',
    data: data as never,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'reservations',
    data: {
      ref: data.reservationRef,
      checkout: checkout.id,
      product: id,
      expiresAt: FUTURE,
    } as never,
    overrideAccess: true,
  })
  await transitionProduct(await systemReq(payload), id, 'reserve', {
    reservationRef: data.reservationRef as string,
    reservedUntil: FUTURE,
  })
  return id
}

const ACTIONS = [
  'publish',
  'unpublish',
  'sell-offline',
  'archive',
  'archive-after-return',
  'restore',
  'return-to-stock',
  'delete',
] as const
type Action = (typeof ACTIONS)[number]

/** Erwartung je (Status, Aktion): Übergangs-ID bzw. `P15` fürs Löschen; fehlt der Eintrag → Ablehnung. */
const ENDPOINT_OK: Readonly<Record<string, string>> = {
  'draft:publish': 'P2',
  'draft:archive': 'P12',
  'draft:delete': 'P15',
  'available:unpublish': 'P3',
  'available:sell-offline': 'P9',
  'available:archive': 'P12',
  'reserved:sell-offline': 'P10',
  'sold:return-to-stock': 'P11', // Offline-Verkauf (Korrektur)
  'archived:restore': 'P14',
}

/**
 * P5.1 (ARCHITEKTUR §2.4): Verwaltungs-Aktionen sind zustandsbasiert idempotent – steht das Stück schon im Zielzustand
 * der Aktion, antwortet der Endpunkt 200 `{ unchanged: true }` ohne Übergang (Doppeltipp, zweiter Tab).
 */
const ACTION_TARGET: Readonly<Record<Exclude<Action, 'delete'>, ProductStatus>> = {
  publish: 'available',
  unpublish: 'draft',
  'sell-offline': 'sold',
  archive: 'archived',
  'archive-after-return': 'archived',
  restore: 'draft',
  'return-to-stock': 'available',
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.47')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('AK-5-01 Produkt – Matrix über die Admin-Endpunkte', () => {
  const statuses: ProductStatus[] = ['draft', 'available', 'reserved', 'sold', 'archived']
  for (const status of statuses) {
    it(`AK-5-01 Produkt: aus „${status}“ gelingen nur die erlaubten Aktionen; AK-5-02 Audit mit Auslöser`, async () => {
      for (const [i, action] of ACTIONS.entries()) {
        const nr = 980 + i
        const id = await productIn(status, nr)
        const before = await getStatusHistory('products', id, { payload })
        const expected = ENDPOINT_OK[`${status}:${action as Action}`]
        const label = `${status} → ${action}`
        if (action === 'delete') {
          const res = await rest('DELETE', `/products/${id}`, undefined, {
            authorization: `JWT ${token}`,
          })
          if (expected) {
            expect(res.status, label).toBe(200)
            await expect(byId(id)).rejects.toThrow()
            const audit = await payload.count({
              collection: 'audit-log',
              where: {
                and: [
                  { action: { equals: 'product_deleted' } },
                  { entityId: { equals: String(id) } },
                ],
              },
              overrideAccess: true,
            })
            expect(audit.totalDocs, label).toBe(1)
          } else {
            expect(res.status, label).toBeGreaterThanOrEqual(400)
            expect((await byId(id)).status, label).toBe(status)
          }
          continue
        }
        const body = action === 'sell-offline' ? { confirmReservedCheckout: true } : {}
        const res = await post(id, action, body)
        if (expected) {
          expect(res.status, label).toBe(200)
          expect((await byId(id)).status, label).toBe(TARGET[expected])
          const history = await getStatusHistory('products', id, { payload })
          expect(history.length, label).toBe(before.length + 1)
          expect(history.at(-1), label).toMatchObject({
            from: status,
            to: TARGET[expected],
            transition: expected,
            actorType: 'admin',
          })
        } else if (ACTION_TARGET[action] === status) {
          expect(res.status, label).toBe(200)
          expect(((await res.json()) as { unchanged: boolean }).unchanged, label).toBe(true)
          expect((await byId(id)).status, label).toBe(status)
          expect((await getStatusHistory('products', id, { payload })).length, label).toBe(
            before.length,
          )
        } else {
          expect(res.status, label).toBe(409)
          expect(((await res.json()) as { error: string }).error, label).toBeTruthy()
          expect((await byId(id)).status, label).toBe(status)
          expect((await getStatusHistory('products', id, { payload })).length, label).toBe(
            before.length,
          )
        }
      }
    })
  }

  it('AK-5-02 System-Übergänge tragen actorType system (P4 beim Reservieren)', async () => {
    const id = await productIn('reserved', 990)
    const history = await getStatusHistory('products', id, { payload })
    expect(history.map((h) => [h.transition, h.actorType])).toEqual([
      ['P2', 'admin'],
      ['P4', 'system'],
    ])
  })

  it('AK-5-01 Produkt: P3/P12 scheitern bei aktiver Reservierung trotz Status available', async () => {
    const id = await productIn('available', 991)
    const { data } = checkoutData([{ id, itemNumber: 991 }], { expiresAt: FUTURE })
    const checkout = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'reservations',
      data: {
        ref: data.reservationRef,
        checkout: checkout.id,
        product: id,
        expiresAt: FUTURE,
      } as never,
      overrideAccess: true,
    })
    for (const action of ['unpublish', 'archive']) {
      const res = await post(id, action)
      expect(res.status).toBe(409)
      expect(((await res.json()) as { error: string }).error).toMatch(/in einer Kasse/)
    }
    expect((await byId(id)).status).toBe('available')
  })
})

describe('AK-5-01 Produkt – Erstattungsgründe bei nie versendetem Stück (KA-37, analog S09/O08)', () => {
  async function soldAndRefunded(nr: number, reason: string) {
    await deleteCommerce(payload)
    await deleteProducts(payload, [nr])
    const p = await createProduct(payload, completeProduct('keramik', nr, fx))
    await transitionProduct(admin, p.id, 'publish')
    const order = await createOrder(
      payload,
      orderData(++orderNr, [{ id: p.id, itemNumber: p.itemNumber }]),
    )
    await transitionProduct(await systemReq(payload), p.id, 'sell', {
      orderId: order.id as number,
      channel: 'online',
    })
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        refunds: [
          {
            amountCents: 5390,
            reason,
            status: 'succeeded',
            createdAt: '2026-09-28T10:00:00.000Z',
          },
        ],
      } as never,
      overrideAccess: true,
    })
    return p.id as number
  }

  it('breakage: P13 gelingt, P11 nicht', async () => {
    const id = await soldAndRefunded(992, 'breakage')
    expect((await post(id, 'return-to-stock')).status).toBe(409)
    expect((await post(id, 'archive-after-return')).status).toBe(200)
    expect(await byId(id)).toMatchObject({
      status: 'archived',
      soldAt: null,
      soldChannel: null,
      currentOrder: null,
    })
    expect((await getStatusHistory('products', id, { payload })).at(-1)?.transition).toBe('P13')
  })

  it('admin_cancellation vor dem Versand: P11 gelingt', async () => {
    const id = await soldAndRefunded(993, 'admin_cancellation')
    expect((await post(id, 'return-to-stock')).status).toBe(200)
    expect(await byId(id)).toMatchObject({ status: 'available', currentOrder: null })
  })

  it('goodwill ohne Rücksendung: P11 und P13 scheitern', async () => {
    const id = await soldAndRefunded(994, 'goodwill')
    expect((await post(id, 'return-to-stock')).status).toBe(409)
    expect((await post(id, 'archive-after-return')).status).toBe(409)
    expect((await byId(id)).status).toBe('sold')
  })
})
