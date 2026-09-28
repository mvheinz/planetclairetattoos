// Warenkorb-Cookie `pc_cart` (ARCHITEKTUR §8.7, Anhang C-05): base64url-JSON `{"v":1,"items":[{"id","p"}…],
// "delivery"}`, nicht HttpOnly, damit statische Seiten die Korb-Anzahl zeigen können. Reines Modul (Browser und
// Server), framework-frei; liest nur, setzt nie etwas.

export const CART_COOKIE = 'pc_cart'
export const CART_MAX_ITEMS = 20

export interface CartCookieItem {
  id: number
  p: number
}
export interface CartCookie {
  v: 1
  items: CartCookieItem[]
  delivery: 'shipping' | 'pickup'
}

function base64UrlDecode(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Dekodiert den Cookie-Wert; `null` bei jeder Abweichung vom Format. */
export function decodeCartCookie(value: string): CartCookie | null {
  try {
    const data = JSON.parse(base64UrlDecode(decodeURIComponent(value))) as Partial<CartCookie>
    if (data.v !== 1 || !Array.isArray(data.items)) return null
    const items = data.items.filter(
      (i): i is CartCookieItem =>
        !!i && Number.isSafeInteger(i.id) && i.id > 0 && Number.isSafeInteger(i.p) && i.p >= 0,
    )
    if (items.length !== data.items.length || items.length > CART_MAX_ITEMS) return null
    return { v: 1, items, delivery: data.delivery === 'pickup' ? 'pickup' : 'shipping' }
  } catch {
    return null
  }
}

/** Wert von `pc_cart` aus einem `Cookie`-String oder `null`, wenn das Cookie fehlt. */
export function findCartCookie(cookieString: string): string | null {
  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === CART_COOKIE) return part.slice(eq + 1).trim()
  }
  return null
}

/** Anzahl der Stücke im Korb laut Cookie-String (0 ohne oder bei ungültigem Cookie). */
export function cartCountFromCookies(cookieString: string): number {
  const raw = findCartCookie(cookieString)
  if (raw === null) return 0
  return decodeCartCookie(raw)?.items.length ?? 0
}
