import 'server-only'

import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { z } from 'zod'

import type { SqlExecutor } from '@/lib/db/tx'
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
  type CartDelivery,
  type ProductLiveState,
} from './cartCookie'
import { cancelCheckout, findCheckoutByToken, type CheckoutDeps } from './checkout'
import {
  evaluateCartItems,
  type CartEvaluation,
  type CartEvaluationSettings,
  type CartProductFacts,
} from './evaluateCart'
import { intArray } from './reservation'

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

const CartSchema = z
  .object({
    v: z.literal(1),
    items: z
      .array(
        z
          .object({
            id: z.number().int().positive().max(2_147_483_647),
            p: z.number().int().min(0),
          })
          .strict(),
      )
      .max(CART_MAX_ITEMS),
    delivery: z.enum(['shipping', 'pickup']),
  })
  .strict()

/**
 * Korb aus dem Cookie-Wert, tolerant (KONZEPT §4.2: nur eine Merkliste): fehlend, ungültig oder manipuliert → leerer
 * Korb. Dekodieren über `decodeCartCookie`, danach zod-Prüfung.
 */
export function readCart(value: string | null | undefined): CartCookie {
  const decoded = value ? decodeCartCookie(value) : null
  const parsed = CartSchema.safeParse(decoded)
  return parsed.success ? parsed.data : emptyCart()
}

/** Korb aus dem Cookie-Wert (ungültig oder fehlend → leer). */
export function cartFromCookie(value: string | null | undefined): CartCookie {
  return readCart(value)
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

// Warenkorb-Aktionen (KONZEPT §4.2, PLAN P4.7): Entfernen, Lieferart wählen, Bewertung für die Anzeige. Die
// Server-Actions (`src/app/(frontend)/[locale]/cart/actions.ts`) setzen bzw. löschen das Cookie; hier nur Prüfung und
// Wirkung auf eine laufende Kasse.

/** Cookie-Wirkung einer Aktion: neuer Wert, löschen (Korb leer) oder unverändert (`null`). */
export type CartCookieChange = { set: string } | { delete: true } | null

export type CartActionCode = 'payment_running' | 'pickup_only' | 'invalid'

export type CartActionOutcome =
  | { ok: true; cart: CartCookie; cookie: CartCookieChange }
  | { ok: false; code: CartActionCode; itemNumbers?: number[]; cart: CartCookie; cookie: null }

export interface RemoveFromCartRequest {
  productId: number
  /** Roher Wert von `pc_cart`. */
  cookie: string | null | undefined
  /** Roher Wert von `pc_checkout`. */
  checkoutToken: string | null | undefined
  now: Date
}

/**
 * Entfernt ein Stück aus dem Korb. Eine Kasse `open` desselben `pc_checkout` wird abgebrochen (`cart_changed`,
 * Reservierung frei, S6); während `confirming` (Zahlung läuft, DATENMODELL §6.25.3 kennt keinen Übergang) wird das
 * Entfernen abgelehnt. Leerer Korb → Cookie löschen.
 */
export async function removeFromCart(
  req: RemoveFromCartRequest,
  deps: CheckoutDeps = {},
): Promise<CartActionOutcome> {
  const cart = readCart(req.cookie)
  if (!cart.items.some((i) => i.id === req.productId)) return { ok: true, cart, cookie: null }
  const payload = deps.payload ?? (await getPayload({ config }))
  const checkout = await findCheckoutByToken(payload, req.checkoutToken)
  if (checkout?.status === 'confirming') {
    return { ok: false, code: 'payment_running', cart, cookie: null }
  }
  if (checkout?.status === 'open') {
    const out = await cancelCheckout(checkout.id as number, 'cart_changed', req.now, {
      ...deps,
      payload,
    })
    if (out.status !== 'released' && out.status !== 'not_open') {
      return { ok: false, code: 'payment_running', cart, cookie: null }
    }
  }
  const next: CartCookie = { ...cart, items: cart.items.filter((i) => i.id !== req.productId) }
  return {
    ok: true,
    cart: next,
    cookie: next.items.length === 0 ? { delete: true } : { set: encodeCartCookie(next) },
  }
}

export interface SetDeliveryRequest {
  method: CartDelivery
  cookie: string | null | undefined
}

/**
 * Lieferart wählen: `shipping` wird abgelehnt, solange ein Stück mit Versandklasse `nur_abholung` im Korb liegt
 * (AK-4-02). Eine laufende Kasse rechnet selbst neu (P4.10b); die Reservierung bleibt unberührt. Ohne Korb entsteht
 * kein Cookie (erst „In den Korb“ setzt es).
 */
export async function setDeliveryMethod(
  req: SetDeliveryRequest,
  payload?: Payload,
): Promise<CartActionOutcome> {
  const cart = readCart(req.cookie)
  if (req.method !== 'shipping' && req.method !== 'pickup') {
    return { ok: false, code: 'invalid', cart, cookie: null }
  }
  if (cart.items.length === 0) return { ok: true, cart, cookie: null }
  if (req.method === 'shipping') {
    payload ??= await getPayload({ config })
    const res = await payload.find({
      collection: 'products',
      where: {
        and: [
          { id: { in: cart.items.map((i) => i.id) } },
          { shippingClass: { equals: 'nur_abholung' } },
        ],
      },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { itemNumber: true },
    })
    if (res.docs.length > 0) {
      return {
        ok: false,
        code: 'pickup_only',
        itemNumbers: res.docs.map((d) => d.itemNumber).sort((a, b) => a - b),
        cart,
        cookie: null,
      }
    }
  }
  if (cart.delivery === req.method) return { ok: true, cart, cookie: null }
  const next: CartCookie = { ...cart, delivery: req.method }
  return { ok: true, cart: next, cookie: { set: encodeCartCookie(next) } }
}

type ReservationFacts = { id: number; reservationRef: string | null; reservedUntil: string | null }

async function reservationFacts(
  payload: Payload,
  ids: readonly number[],
): Promise<Map<number, ReservationFacts>> {
  const out = new Map<number, ReservationFacts>()
  if (ids.length === 0) return out
  const db = (payload.db as unknown as { drizzle: SqlExecutor }).drizzle
  const res = await db.execute(sql`
    SELECT id, reservation_ref, reserved_until FROM products WHERE id = ANY(${intArray(ids)})
  `)
  for (const r of res.rows) {
    out.set(Number(r.id), {
      id: Number(r.id),
      reservationRef: (r.reservation_ref as string | null) ?? null,
      reservedUntil: r.reserved_until ? new Date(r.reserved_until as string).toISOString() : null,
    })
  }
  return out
}

/** `reservationRef` der laufenden Kasse (`open`/`confirming`, nicht abgelaufen) zum Token, sonst `null`. */
async function liveReservationRef(
  payload: Payload,
  token: string | null | undefined,
  now: Date,
): Promise<string | null> {
  const checkout = await findCheckoutByToken(payload, token)
  if (!checkout || (checkout.status !== 'open' && checkout.status !== 'confirming')) return null
  if (new Date(checkout.expiresAt).getTime() <= now.getTime()) return null
  return checkout.reservationRef
}

const firstImageId = (images: Product['images']): number | null => {
  const first = images?.[0]
  if (typeof first === 'number') return first
  return first && typeof first === 'object' ? first.id : null
}

export interface EvaluateCartOptions {
  locale?: Locale
  /** Roher Wert von `pc_checkout` (eigene Kasse erkennen). */
  checkoutToken?: string | null
  payload?: Payload
}

/**
 * Bewertung des Korbs für die Anzeige (Korbseite R06): jede Position wird serverseitig neu geprüft (öffentliche
 * Leseregel, Status, DB-Preis, Reservierung der eigenen Kasse), dazu Versand, Summen und `canCheckout`.
 */
export async function evaluateCart(
  cart: CartCookie,
  now: Date,
  options: EvaluateCartOptions = {},
): Promise<CartEvaluation> {
  const payload = options.payload ?? (await getPayload({ config }))
  const locale = options.locale ?? 'de'
  const ids = cart.items.map((i) => i.id)
  const settings = (await payload.findGlobal({
    slug: 'settings',
    overrideAccess: true,
    depth: 0,
    locale,
  })) as unknown as CartEvaluationSettings
  const found =
    ids.length === 0
      ? { docs: [] as Product[] }
      : await toPublicPayload(payload).find({
          collection: 'products',
          where: { id: { in: ids } },
          locale,
          fallbackLocale: 'de',
          depth: 0,
          pagination: false,
        })
  const facts = await reservationFacts(payload, ids)
  const products: CartProductFacts[] = (found.docs as Product[]).map((d) => ({
    id: d.id,
    itemNumber: d.itemNumber,
    status: d.status,
    priceCents: d.priceCents,
    vatCategory: d.vatCategory,
    shippingClass: d.shippingClass,
    reservationRef: facts.get(d.id)?.reservationRef ?? null,
    reservedUntil: facts.get(d.id)?.reservedUntil ?? null,
    title: d.title,
    slug: d.slug,
    category: d.category,
    isCustomCommission: d.isCustomCommission,
    imageId: firstImageId(d.images),
  }))
  // Nicht (mehr) öffentliche Stücke: nur die Nummer für den Hinweis „Leider schon verkauft“.
  const missing = ids.filter((id) => !products.some((p) => p.id === id))
  if (missing.length > 0) {
    const hidden = await payload.find({
      collection: 'products',
      where: { id: { in: missing } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { itemNumber: true, priceCents: true, vatCategory: true, shippingClass: true },
    })
    for (const d of hidden.docs) {
      products.push({
        id: d.id,
        itemNumber: d.itemNumber,
        status: null,
        priceCents: d.priceCents,
        vatCategory: d.vatCategory,
        shippingClass: d.shippingClass,
      })
    }
  }
  return evaluateCartItems({
    cart,
    products,
    ownReservationRef: await liveReservationRef(payload, options.checkoutToken, now),
    settings,
    now,
  })
}

/**
 * `reservedByYou` für `GET /api/public/product-status`: `true` nur für Stücke, die gerade durch die laufende Kasse
 * aus `pc_checkout` reserviert sind; ohne Cookie immer `false`.
 */
export async function reservedByYou(
  payload: Payload,
  ids: readonly number[],
  checkoutToken: string | null | undefined,
  now: Date,
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  for (const id of ids) out[String(id)] = false
  if (ids.length === 0 || !checkoutToken) return out
  const ref = await liveReservationRef(payload, checkoutToken, now)
  if (!ref) return out
  const facts = await reservationFacts(payload, ids)
  for (const id of ids) out[String(id)] = facts.get(id)?.reservationRef === ref
  return out
}
