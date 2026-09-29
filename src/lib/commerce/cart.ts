import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { Locale } from '@/lib/enums'
import { pickPublicSettings, toPublicPayload } from '@/lib/payload/public'
import { ipHash } from '@/lib/security/ipHash'
import { hit } from '@/lib/security/rateLimit'
import { pickShopDisplaySettings } from '@/lib/shop/displaySettings'
import type { Product } from '@/payload-types'

import {
  CART_MAX_ITEMS,
  decodeCartCookie,
  emptyCart,
  encodeCartCookie,
  type AddToCartResponse,
  type CartCookie,
  type ProductLiveState,
} from './cartCookie'

// „In den Korb“ (KONZEPT §4.2 Aktion „Hinzufügen“, ARCHITEKTUR §8.5/§8.7, PLAN P3.11): Der Server prüft bei jeder
// Aktion neu – Rate-Limit `cart_add` (IP-Hash), Shop geöffnet (`settings.shop.isOpen`), Stück öffentlich (gleiche
// Leseregel wie die Shop-Seiten, inkl. Seed-Filter) und `available`, noch nicht im Korb, Korb < 20 Stücke. Erst bei
// Erfolg entsteht bzw. ändert sich das Cookie `pc_cart` (die Server-Action setzt es). Ein ungültiges oder manipuliertes
// Cookie gilt als leerer Korb und wird neu geschrieben; `p` stammt immer aus der Datenbank. Die Lieferart bleibt, wie sie
// ist (Standard `shipping`); ein Stück mit Versandklasse `nur_abholung` erzwingt `pickup`.

export interface AddToCartRequest {
  productId: number
  locale: Locale
  /** Roher Wert von `pc_cart` (fehlt → leerer Korb). */
  cookie: string | null | undefined
  /** Client-IP (§8.5); ohne IP zählt der gemeinsame Schlüssel `unknown`. */
  ip: string | null
  now: Date
}

/** Öffentliche Eckdaten des Stücks (für die Weiterleitung ohne JavaScript). */
export interface CartProductRef {
  id: number
  itemNumber: number
  slug: Product['slug']
}

export interface AddToCartOutcome {
  response: AddToCartResponse
  /** Neuer Cookie-Wert – nur, wenn sich der Korb geändert hat. */
  cookie: string | null
  /** Öffentliches Stück (sonst `null`). */
  product: CartProductRef | null
}

type Select = Pick<
  Product,
  'id' | 'itemNumber' | 'slug' | 'status' | 'priceCents' | 'shippingClass'
>

/** Live-Zustand aus dem Status eines öffentlich lesbaren Stücks. */
export function liveState(status: string | null | undefined): ProductLiveState {
  return status === 'available' || status === 'reserved' || status === 'sold' ? status : 'gone'
}

/** Korb aus dem Cookie-Wert (ungültig oder fehlend → leer). */
export function cartFromCookie(value: string | null | undefined): CartCookie {
  return (value ? decodeCartCookie(value) : null) ?? emptyCart()
}

const reject = (
  code: Extract<AddToCartResponse, { ok: false }>['code'],
  state: ProductLiveState | null,
  product: CartProductRef | null = null,
  message: string | null = null,
): AddToCartOutcome => ({
  response: { ok: false, code, state, message },
  cookie: null,
  product,
})

/** Prüft und legt das Stück in den Korb (ohne Cookie-Zugriff; das Setzen übernimmt die Server-Action). */
export async function addToCart(
  req: AddToCartRequest,
  payload?: Payload,
): Promise<AddToCartOutcome> {
  payload ??= await getPayload({ config })
  const { now } = req
  const limit = await hit('cart_add', ipHash(req.ip ?? 'unknown', { now: () => now }), now, payload)
  if (!limit.allowed) return reject('rate_limited', null)

  // Einstellungen frisch aus der Datenbank (nicht aus dem Seiten-Cache): auch eine veraltete Seite wird abgelehnt.
  const raw = await payload.findGlobal({
    slug: 'settings',
    overrideAccess: true,
    depth: 0,
    locale: req.locale,
  })
  const shop = pickShopDisplaySettings(pickPublicSettings(raw, now))

  // Öffentliche Leseregel (DATENMODELL §1.4): Entwurf, archiviert, verkauft ohne Archiv oder Seed außerhalb der
  // Vorschau gelten als „gone“.
  const found = await toPublicPayload(payload).find({
    collection: 'products',
    where: { id: { equals: req.productId } },
    locale: req.locale,
    fallbackLocale: 'de',
    depth: 0,
    limit: 1,
    pagination: false,
    select: {
      itemNumber: true,
      slug: true,
      status: true,
      priceCents: true,
      shippingClass: true,
    },
  })
  const doc = found.docs[0] as Select | undefined
  const product: CartProductRef | null = doc
    ? { id: doc.id, itemNumber: doc.itemNumber, slug: doc.slug }
    : null
  const state = liveState(doc?.status)

  if (!shop.isOpen) return reject('shop_closed', state, product, shop.closedMessage)
  if (!doc || state !== 'available') return reject('product_unavailable', state, product)

  const cart = cartFromCookie(req.cookie)
  if (cart.items.some((i) => i.id === doc.id)) {
    return {
      response: { ok: true, added: false, count: cart.items.length, state: 'available' },
      // Unverändert – nichts neu schreiben.
      cookie: null,
      product,
    }
  }
  if (cart.items.length >= CART_MAX_ITEMS) return reject('cart_full', state, product)

  const next: CartCookie = {
    v: 1,
    items: [...cart.items, { id: doc.id, p: doc.priceCents }],
    delivery: doc.shippingClass === 'nur_abholung' ? 'pickup' : cart.delivery,
  }
  return {
    response: { ok: true, added: true, count: next.items.length, state: 'available' },
    cookie: encodeCartCookie(next),
    product,
  }
}

/** Live-Zustand mehrerer Stücke (`GET /api/public/product-status`): unbekannt oder nicht öffentlich → `gone`. */
export async function productStates(
  payload: Payload,
  ids: readonly number[],
): Promise<Record<string, ProductLiveState>> {
  const out: Record<string, ProductLiveState> = {}
  for (const id of ids) out[String(id)] = 'gone'
  if (ids.length === 0) return out
  const res = await toPublicPayload(payload).find({
    collection: 'products',
    where: { id: { in: [...ids] } },
    depth: 0,
    pagination: false,
    select: { status: true },
  })
  for (const doc of res.docs) out[String(doc.id)] = liveState(doc.status)
  return out
}
