import type { Payload } from 'payload'

import { completeProduct, createProductFixtures } from '../../int/helpers/products'
import { cleanupCheckouts } from '../../e2e/checkout/checkoutHelpers'
import { testPayload } from '../../e2e/fixtures'
import { PUBLISHED } from '../../e2e/shop/productPage'

// Stücke für Kasse/Danke der Kunst-Abnahme (SC-05 … SC-09): eigene Fixture-Stücke im Nummernbereich 990–999
// (`seed: true`, CLAUDE.md §3 Nr. 5), damit Aufnahmen den Beispielbestand nie verkaufen; danach samt Kassen und
// Bestellungen entfernt. Zahlung immer über `PAYMENTS_DRIVER=mock` (kein Netz).

const NUMBERS = Array.from({ length: 10 }, (_, i) => 990 + i)

async function removePieces(payload: Payload): Promise<void> {
  const { docs } = await payload.find({
    collection: 'products',
    where: { itemNumber: { in: NUMBERS } },
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })
  await cleanupCheckouts(docs.map((d) => d.id as number))
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { in: NUMBERS } },
    overrideAccess: true,
    context: { seed: true },
  })
}

export interface ArtPieces {
  payload: Payload
  create(overrides?: Record<string, unknown>): Promise<{ id: number; itemNumber: number }>
  cleanup(): Promise<void>
}

export async function artPieces(): Promise<ArtPieces> {
  const payload = await testPayload()
  await removePieces(payload)
  const fx = await createProductFixtures(payload)
  let next = 0
  return {
    payload,
    async create(overrides = {}) {
      const itemNumber = NUMBERS[next++]
      if (itemNumber === undefined) throw new Error('Fixture-Bereich 990–999 erschöpft.')
      const doc = await payload.create({
        collection: 'products',
        data: {
          ...completeProduct('keramik', itemNumber, fx),
          ...PUBLISHED,
          seed: true,
          ...overrides,
        } as never,
        overrideAccess: true,
        context: { seed: true },
      })
      return { id: doc.id as number, itemNumber }
    },
    cleanup: () => removePieces(payload),
  }
}

/** Erstes verfügbares bzw. „hat ein Zuhause gefunden“-Stück des Beispielbestands (nur lesen). */
export async function seedPiece(kind: 'available' | 'gone'): Promise<number | null> {
  const payload = await testPayload()
  const where =
    kind === 'available'
      ? { and: [{ status: { equals: 'available' } }, { itemNumber: { less_than: 975 } }] }
      : {
          and: [{ status: { equals: 'sold' } }, { showInArchiveAfterSale: { not_equals: true } }],
        }
  const { docs } = await payload.find({
    collection: 'products',
    where: where as never,
    sort: 'itemNumber',
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0]?.itemNumber as number | undefined) ?? null
}
