import 'server-only'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import type { Locale } from '@/lib/enums'
import { getPublicPayload } from '@/lib/payload/public'

import { toPublicProduct, type PublicProduct } from './products'

// Stück für das OG-Produktbild (P3.14, ARCHITEKTUR §9.1: „statisch je Stück“, Erneuerung über `product:<id>`): öffentlich
// gelesen wie die Produktseite, zwischengespeichert mit den Tags `product:<id>` und `products` – so erneuert
// `revalidateProduct(id)` (P3.15) auch das Bild.

export async function loadOgProduct(id: number, locale: Locale): Promise<PublicProduct | null> {
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'products',
    where: { id: { equals: id } },
    locale,
    fallbackLocale: 'de',
    depth: 1,
    limit: 1,
    pagination: false,
  })
  const doc = res.docs[0]
  return doc ? toPublicProduct(doc) : null
}

export const getOgProduct = cached(loadOgProduct, {
  key: 'og-product',
  tags: ([id]) => [TAGS.products, TAGS.product(id)],
})
