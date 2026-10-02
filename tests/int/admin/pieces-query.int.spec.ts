import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parsePiecesQuery, queryPieces } from '@/admin/views/pieces/piecesQuery'
import { transitionProduct } from '@/lib/commerce/productTransitions'
import { formatBerlin } from '@/lib/time'

import { adminReq, resetAdmin } from '../helpers/admin'
import { deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { prepaymentReserved } from '../helpers/pieces'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'

// P5.8 – „Meine Stücke“ (KONZEPT §7.5): Suche Nummer exakt / Titel enthält, Filter Status und Kategorie, 20 je Seite,
// Reservierungs-Hinweis (Vorkasse) und Knöpfe je Status.

let payload: Payload
let fx: ProductFixtures
let req: PayloadRequest

const piece = (
  itemNumber: number,
  category: Parameters<typeof completeProduct>[0] = 'keramik',
  overrides: Record<string, unknown> = {},
) => createProduct(payload, completeProduct(category, itemNumber, fx, overrides))

const run = (params: Record<string, string>) => queryPieces(req, parsePiecesQuery(params))

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const { userId } = await resetAdmin(payload, '198.51.100.58')
  req = await adminReq(payload, userId)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('„Meine Stücke“ (P5.8)', () => {
  it('Suche „017“ findet genau das Stück mit Nummer 17; Titel enthält (ohne Groß/klein)', async () => {
    await piece(17, 'keramik', { title: 'Schale mit Hund' })
    await piece(170, 'keramik', { title: 'Becher 017' })
    await piece(1017, 'textil', { title: 'Hundepulli' })
    const byNumber = await run({ q: '017' })
    expect(byNumber.cards.map((c) => c.itemNumber)).toEqual([17])
    expect(byNumber.cards[0]).toMatchObject({ title: 'Schale mit Hund', status: 'draft' })
    const byTitle = await run({ q: 'hund' })
    expect(byTitle.cards.map((c) => c.itemNumber).sort((a, b) => a - b)).toEqual([17, 1017])
    const textil = await run({ q: 'hund', category: 'textil' })
    expect(textil.cards.map((c) => c.itemNumber)).toEqual([1017])
  })

  it('Filter „reserviert“ zeigt ein Stück mit Vorkasse-Reservierung samt Vorkasse-Hinweis und „Zur Bestellung“', async () => {
    const p = await piece(981)
    await transitionProduct(req, p.id, 'publish')
    const pre = await prepaymentReserved(payload, { id: p.id, itemNumber: 981 }, 881)
    const result = await run({ status: 'reserved' })
    expect(result.cards).toHaveLength(1)
    const card = result.cards[0]!
    expect(card).toMatchObject({ itemNumber: 981, status: 'reserved', orderId: pre.orderId })
    expect(card.reservationText).toBe(
      `Vorkasse ${pre.orderNumber} bis ${formatBerlin(pre.dueAt, 'dd.MM.yyyy')}`,
    )
    expect(card.actions).toContain('toOrder')
    expect(card.actions).not.toContain('sellOfflineReserved')
  })

  it('Knöpfe je Status (KONZEPT §7.5): Entwurf, online, offline verkauft, ausgeblendet', async () => {
    const d = await piece(982)
    const a = await piece(983)
    await transitionProduct(req, a.id, 'publish')
    const s = await piece(984)
    await transitionProduct(req, s.id, 'publish')
    await transitionProduct(req, s.id, 'sellOffline', { showInArchive: true })
    const h = await piece(985)
    await transitionProduct(req, h.id, 'archive')
    const cards = new Map((await run({})).cards.map((c) => [c.itemNumber, c.actions] as const))
    expect(cards.get(982)).toEqual(['edit', 'publish', 'archive', 'delete'])
    expect(cards.get(983)).toEqual(['edit', 'copyLink', 'sellOffline', 'unpublish', 'archive'])
    expect(cards.get(984)).toEqual(['edit', 'toggleArchive', 'returnToStock', 'copyLink'])
    expect(cards.get(985)).toEqual(['edit', 'restore'])
    expect(d.id).toBeGreaterThan(0)
  })

  it('seitenweise 20 Karten, neueste Änderung zuerst', async () => {
    await deleteCommerce(payload)
    await deleteProducts(payload)
    for (let i = 0; i < 21; i++) await piece(300 + i, 'sonstiges')
    const first = await run({})
    expect(first).toMatchObject({ totalDocs: 21, totalPages: 2, page: 1 })
    expect(first.cards).toHaveLength(20)
    expect(first.cards[0]!.itemNumber).toBe(320)
    const second = await run({ page: '2' })
    expect(second.cards.map((c) => c.itemNumber)).toEqual([300])
    expect(parsePiecesQuery({ status: 'kaputt', category: 'x', page: '-1' })).toEqual({
      q: '',
      status: null,
      category: null,
      page: 1,
    })
  })
})
