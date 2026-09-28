import React from 'react'

import type { PublicProduct } from '@/lib/data/products'
import type { Locale } from '@/lib/enums'

// Produktseite R04 (KONZEPT §3.4): Blöcke in verbindlicher Reihenfolge (Pflichtangaben vor dem Kaufknopf) – Inhalt ab
// P3.8.
export function ProductPage(props: { product: PublicProduct; locale: Locale }) {
  const { product } = props
  return (
    <article
      className="u-container"
      data-product-page=""
      data-item-number={product.itemNumber}
      data-status={product.status}
    >
      <h1>{product.title}</h1>
    </article>
  )
}
