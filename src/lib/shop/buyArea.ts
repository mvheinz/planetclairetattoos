import type { AddToCartCode, AddToCartResponse } from '@/lib/commerce/cartCookie'

// Kaufbereich der Produktseite ohne JavaScript (PLAN P3.11): Die Server-Action „In den Korb“ antwortet mit 303 zurück
// auf die Produktseite und einem Fragment; die statische Seite zeigt den Zustand per CSS `:target` –
// `#in-cart` → „Liegt schon in deinem Korb“ + „Zum Korb“, sonst die passende Meldung. Mit JavaScript zeigt das Modul
// `add-to-cart` dieselben Elemente (`[data-in-cart]`, `[data-buy-note]`).

export const IN_CART_FRAGMENT = 'in-cart'

/** Fragment (= Element-ID) je Ablehnungsgrund. */
export const BUY_NOTE_FRAGMENTS: Readonly<Record<AddToCartCode, string>> = {
  cart_full: 'cart-full',
  rate_limited: 'cart-wait',
  shop_closed: 'cart-closed',
  product_unavailable: 'cart-unavailable',
  invalid: 'cart-error',
}

/** Reihenfolge der Meldungen im Kaufbereich. */
export const BUY_NOTE_CODES: readonly AddToCartCode[] = [
  'cart_full',
  'rate_limited',
  'shop_closed',
  'product_unavailable',
  'invalid',
]

export function buyFragment(res: AddToCartResponse): string {
  return res.ok ? IN_CART_FRAGMENT : BUY_NOTE_FRAGMENTS[res.code]
}
