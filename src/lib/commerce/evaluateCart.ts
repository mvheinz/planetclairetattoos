import 'server-only'

import type { ShippingClass, VatCategory } from '@/lib/enums'

import type { CartCookie, CartDelivery } from './cartCookie'
import { ShippingError, type ShippingErrorCode, type ShippingLabel } from './shipping'
import { computeTotals, type TotalsSettings } from './totals'

// Bewertung des Warenkorbs für die Anzeige (KONZEPT §4.2, PLAN P4.7): Das Cookie ist nur eine Merkliste – jede
// Position wird gegen den aktuellen Stand aus der Datenbank geprüft. Reine Funktion ohne DB (Laden in `cart.ts`,
// `evaluateCart`); Versand und Summen nur über den Rechenkern (`computeTotals`), immer mit dem DB-Preis.

/** Zustand einer Position: frei, in der eigenen Kasse, anderweitig reserviert (fremde Kasse, Vorkasse S12), weg. */
export type CartLineState = 'available' | 'reserved_by_you' | 'reserved' | 'sold'

/** Stand eines Stücks aus der DB; `status = null` ⇒ nicht (mehr) öffentlich. */
export interface CartProductFacts {
  id: number
  itemNumber: number
  status: string | null
  priceCents: number
  vatCategory: VatCategory
  shippingClass: ShippingClass
  reservationRef?: string | null
  reservedUntil?: string | Date | null
  title?: string | null
  slug?: string | null
  category?: string | null
  isCustomCommission?: boolean | null
}

export interface CartLine {
  id: number
  itemNumber: number | null
  state: CartLineState
  /** Kaufbar (`available` oder in der eigenen Kasse) – zählt in die Summe. */
  purchasable: boolean
  /** Aktueller DB-Preis (angezeigt und berechnet); `null`, wenn das Stück nicht mehr öffentlich ist. */
  priceCents: number | null
  /** Preis beim Hinzufügen (`p` im Cookie). */
  addedPriceCents: number
  /** „Preis wurde aktualisiert“ (DB-Preis ≠ `p`). */
  priceChanged: boolean
  product: CartProductFacts | null
}

export type CartBlocker = 'shop_closed' | 'empty' | 'too_many' | 'unavailable' | 'shipping'

export interface CartEvaluation {
  lines: CartLine[]
  /** Lieferart für Anzeige und Rechnung: `pickup`, sobald ein kaufbares Stück `nur_abholung` ist. */
  delivery: CartDelivery
  /** Nummern der kaufbaren Stücke, die es nur zur Abholung gibt („Nr. 023 gibt es nur zur Abholung“). */
  pickupOnly: number[]
  totals: {
    subtotalCents: number
    shippingCents: number
    totalCents: number
    shippingClass: ShippingClass
    label: ShippingLabel
  } | null
  shippingError: ShippingErrorCode | null
  count: number
  maxItemsPerCheckout: number
  shopOpen: boolean
  closedMessage: string | null
  canCheckout: boolean
  blockers: CartBlocker[]
}

export interface CartEvaluationSettings extends TotalsSettings {
  shop?: {
    isOpen?: boolean | null
    closedMessage?: string | null
    maxItemsPerCheckout?: number | null
  } | null
}

export interface EvaluateCartInput {
  cart: CartCookie
  products: readonly CartProductFacts[]
  /** `reservationRef` der laufenden Kasse dieser Person (Cookie `pc_checkout`), sonst `null`. */
  ownReservationRef: string | null
  settings: CartEvaluationSettings
  now: Date
}

const DEFAULT_MAX = 10

function lineState(p: CartProductFacts | undefined, own: string | null, now: Date): CartLineState {
  if (!p || p.status === null || p.isCustomCommission === true) return 'sold'
  if (p.status === 'available') return 'available'
  if (p.status === 'reserved') {
    if (own && p.reservationRef === own) return 'reserved_by_you'
    // Abgelaufen, aber noch nicht freigegeben: gibt „Zur Kasse“ frei („lazy release“, DATENMODELL §8.1).
    const until = p.reservedUntil ? new Date(p.reservedUntil).getTime() : Number.NaN
    if (!Number.isNaN(until) && until < now.getTime()) return 'available'
    return 'reserved'
  }
  return 'sold'
}

export function evaluateCartItems(input: EvaluateCartInput): CartEvaluation {
  const { cart, settings, now } = input
  const byId = new Map(input.products.map((p) => [p.id, p] as const))
  const lines: CartLine[] = cart.items.map((item) => {
    const product = byId.get(item.id)
    const state = lineState(product, input.ownReservationRef, now)
    const visible = product && product.status !== null ? product : null
    const priceCents = visible ? visible.priceCents : null
    return {
      id: item.id,
      itemNumber: product?.itemNumber ?? null,
      state,
      purchasable: state === 'available' || state === 'reserved_by_you',
      priceCents,
      addedPriceCents: item.p,
      priceChanged: priceCents !== null && priceCents !== item.p,
      product: visible,
    }
  })

  const shopOpen = settings.shop?.isOpen !== false
  const closedMessage = settings.shop?.closedMessage?.trim() || null
  const rawMax = settings.shop?.maxItemsPerCheckout
  const maxItemsPerCheckout =
    typeof rawMax === 'number' && Number.isInteger(rawMax) && rawMax >= 1 ? rawMax : DEFAULT_MAX

  const buyable = lines.filter((l) => l.purchasable && l.product)
  const pickupOnly = buyable
    .filter((l) => l.product!.shippingClass === 'nur_abholung')
    .map((l) => l.product!.itemNumber)
  const delivery: CartDelivery = pickupOnly.length > 0 ? 'pickup' : cart.delivery

  let totals: CartEvaluation['totals'] = null
  let shippingError: ShippingErrorCode | null = null
  if (buyable.length > 0) {
    try {
      const t = computeTotals(
        {
          items: buyable.map((l) => ({
            itemNumber: l.product!.itemNumber,
            priceCents: l.product!.priceCents,
            vatCategory: l.product!.vatCategory,
            shippingClass: l.product!.shippingClass,
          })),
          fulfillmentMethod: delivery,
          at: now,
        },
        settings,
      )
      totals = {
        subtotalCents: t.subtotalCents,
        shippingCents: t.shippingCents,
        totalCents: t.totalCents,
        shippingClass: t.shipping.shippingClass,
        label: t.shipping.label,
      }
    } catch (err) {
      if (!(err instanceof ShippingError)) throw err
      shippingError = err.code
    }
  }

  const blockers: CartBlocker[] = []
  if (!shopOpen) blockers.push('shop_closed')
  if (lines.length === 0) blockers.push('empty')
  if (lines.length > maxItemsPerCheckout) blockers.push('too_many')
  if (lines.some((l) => !l.purchasable)) blockers.push('unavailable')
  if (shippingError) blockers.push('shipping')

  return {
    lines,
    delivery,
    pickupOnly,
    totals,
    shippingError,
    count: lines.length,
    maxItemsPerCheckout,
    shopOpen,
    closedMessage,
    canCheckout: blockers.length === 0,
    blockers,
  }
}
