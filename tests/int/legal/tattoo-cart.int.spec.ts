import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addToCart } from '@/lib/commerce/cart'
import { encodeCartCookie } from '@/lib/commerce/cartCookie'
import { startCheckout } from '@/lib/commerce/checkout'

import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'

// P7.15 – R-170 (Tattoo-Bereich ohne Online-Vertragsschluss, E-51): Flash-Motive sind keine Stücke. Der
// Warenkorb kennt nur `products`; eine Warenkorb-Aktion bzw. „Zur Kasse“ mit der ID eines Flash-Motivs
// wird abgelehnt und setzt kein Cookie.

const NOW = new Date('2026-10-02T10:00:00.000Z')
let payload: Payload
let image: number
const flashIds: number[] = []
let ipSeq = 0
const ip = () => `10.7.15.${++ipSeq}`

/** ID, unter der es kein Stück gibt (sonst weitere Einträge anlegen, bis eine freie ID entsteht). */
async function freeOfProducts(create: () => Promise<number>): Promise<number> {
  for (let i = 0; i < 20; i++) {
    const id = await create()
    const clash = await payload.count({
      collection: 'products',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    if (clash.totalDocs === 0) return id
  }
  throw new Error('Keine ID ohne gleichnamiges Stück gefunden')
}

beforeAll(async () => {
  payload = await getTestPayload()
  image = await createTestImage(payload, 'Hase mit Blume, Tusche')
})

afterAll(async () => {
  await payload.delete({
    collection: 'flash',
    where: { id: { in: flashIds } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({ collection: 'media', id: image, overrideAccess: true }).catch(() => null)
})

describe('R-170 Warenkorb ohne Tattoo-Leistungen', () => {
  it('R-170 Warenkorb-Aktion und „Zur Kasse“ mit Flash-ID werden abgelehnt', async () => {
    const flashId = await freeOfProducts(async () => {
      const doc = await payload.create({
        collection: 'flash',
        data: {
          image,
          sizeCm: 8,
          priceCents: 9000,
          title: 'Hase (R-170)',
          published: true,
          seed: false,
        } as never,
        overrideAccess: true,
        context: { seed: true },
      })
      flashIds.push(doc.id as number)
      return doc.id as number
    })
    for (const id of [flashId]) {
      const out = await addToCart(
        { productId: id, locale: 'de', cookie: null, ip: ip(), now: NOW },
        payload,
      )
      expect(out.response.ok, String(id)).toBe(false)
      expect(out.cookie).toBeNull()

      const checkout = await startCheckout(
        {
          cart: { v: 1, items: [{ id, p: 9000 }], delivery: 'shipping' },
          locale: 'de',
          existingToken: null,
          now: NOW,
        },
        { payload },
      )
      expect(checkout.ok, String(id)).toBe(false)
    }
    // Gegenprobe: ein Korb-Cookie mit diesen IDs ist formal lesbar, führt aber nie zu einer Kasse
    expect(
      encodeCartCookie({ v: 1, items: [{ id: flashId, p: 9000 }], delivery: 'shipping' }),
    ).toBeTruthy()
  })
})
