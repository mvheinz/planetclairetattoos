// Warenkorb-Cookie `pc_cart` (ARCHITEKTUR §8.7, Anhang C-05, PLAN P3.11): base64url-JSON
// `{"v":1,"items":[{"id":12,"p":4500}…],"delivery":"shipping"|"pickup"}` – nur Stück-IDs, `p` = Preis in Cent beim
// Hinzufügen (nur für den Hinweis „Preis wurde aktualisiert“, P4.7; der Server rechnet immer mit dem DB-Preis) und die
// Lieferart. Keine Kennung, keine Personendaten. Nicht HttpOnly, damit statische Seiten die Korb-Anzahl zeigen können.
// Reines Modul ohne `server-only` (Ausnahme in `check:static`): Browser (`cart-count`, `add-to-cart`) und Server
// (`src/lib/commerce/cart.ts`) nutzen dieselben Funktionen. Framework-frei.

export const CART_COOKIE = 'pc_cart'
/** Höchstens 20 Stücke im Korb (das 21. wird abgelehnt). */
export const CART_MAX_ITEMS = 20
/** 7 Tage in Sekunden. */
export const CART_COOKIE_MAX_AGE = 604_800

export type CartDelivery = 'shipping' | 'pickup'

export interface CartCookieItem {
  id: number
  p: number
}
export interface CartCookie {
  v: 1
  items: CartCookieItem[]
  delivery: CartDelivery
}

/** Leerer Korb (Standard-Lieferart Versand). */
export const emptyCart = (): CartCookie => ({ v: 1, items: [], delivery: 'shipping' })

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('kein base64url')
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

const isItem = (i: unknown): i is CartCookieItem => {
  if (typeof i !== 'object' || i === null) return false
  const { id, p } = i as Record<string, unknown>
  return (
    Object.keys(i).length === 2 &&
    Number.isSafeInteger(id) &&
    (id as number) > 0 &&
    Number.isSafeInteger(p) &&
    (p as number) >= 0
  )
}

/** Serialisiert den Korb (Reihenfolge der Stücke bleibt erhalten). */
export function encodeCartCookie(cart: CartCookie): string {
  return base64UrlEncode(
    JSON.stringify({
      v: 1,
      items: cart.items.map((i) => ({ id: i.id, p: i.p })),
      delivery: cart.delivery,
    }),
  )
}

/**
 * Dekodiert den Cookie-Wert; `null` bei jeder Abweichung vom Format (auch fremde Felder, doppelte Stücke, mehr als 20
 * Stücke, unbekannte Lieferart) – der Server behandelt den Korb dann als leer und schreibt ihn neu.
 */
export function decodeCartCookie(value: string): CartCookie | null {
  try {
    const data: unknown = JSON.parse(base64UrlDecode(decodeURIComponent(value.trim())))
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
    const { v, items, delivery } = data as Record<string, unknown>
    if (Object.keys(data).some((k) => k !== 'v' && k !== 'items' && k !== 'delivery')) return null
    if (v !== 1 || !Array.isArray(items) || items.length > CART_MAX_ITEMS) return null
    if (delivery !== 'shipping' && delivery !== 'pickup') return null
    if (!items.every(isItem)) return null
    if (new Set(items.map((i) => i.id)).size !== items.length) return null
    return { v: 1, items: items.map((i) => ({ id: i.id, p: i.p })), delivery }
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

/** Korb laut Cookie-String; ohne oder bei ungültigem Cookie leer. */
export function cartFromCookies(cookieString: string): CartCookie {
  const raw = findCartCookie(cookieString)
  return (raw === null ? null : decodeCartCookie(raw)) ?? emptyCart()
}

/** Anzahl der Stücke im Korb laut Cookie-String (0 ohne oder bei ungültigem Cookie). */
export function cartCountFromCookies(cookieString: string): number {
  return cartFromCookies(cookieString).items.length
}

/** `localhost`, `127.0.0.1`, `[::1]` (mit oder ohne Port): dort ohne `Secure` (ARCHITEKTUR §8.7). */
export function isLocalHost(host: string | null | undefined): boolean {
  const name = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '')
  return name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name === '::1'
}

export interface CartCookieAttributes {
  path: '/'
  sameSite: 'lax'
  secure: boolean
  maxAge: number
  httpOnly: false
}

/** Attribute laut ARCHITEKTUR §8.7: `Path=/; SameSite=Lax; Secure` (außer localhost); `Max-Age=604800`; nicht HttpOnly. */
export function cartCookieAttributes(host: string | null | undefined): CartCookieAttributes {
  return {
    path: '/',
    sameSite: 'lax',
    secure: !isLocalHost(host),
    maxAge: CART_COOKIE_MAX_AGE,
    httpOnly: false,
  }
}

/** Live-Zustand eines Stücks für Kaufknopf und Karten (`GET /api/public/product-status`). */
export type ProductLiveState = 'available' | 'reserved' | 'sold' | 'gone'
export const PRODUCT_LIVE_STATES: readonly ProductLiveState[] = [
  'available',
  'reserved',
  'sold',
  'gone',
]

/** Ablehnungsgründe von „In den Korb“ (feste Codes, Texte per i18n, ARCHITEKTUR §15.2). */
export type AddToCartCode =
  'shop_closed' | 'product_unavailable' | 'cart_full' | 'rate_limited' | 'invalid'

/**
 * Antwort der Server-Action `addToCart` an das Verhaltensmodul `add-to-cart` – ohne Personendaten. `count` = Stücke im
 * Korb danach; `state` = aktueller Zustand des Stücks; `message` = `settings.shop.closedMessage` bei `shop_closed`.
 */
export type AddToCartResponse =
  | { ok: true; added: boolean; count: number; state: 'available' }
  | { ok: false; code: AddToCartCode; state: ProductLiveState | null; message: string | null }
