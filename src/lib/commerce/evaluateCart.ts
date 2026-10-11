import 'server-only'

import type { ShippingClass, VatCategory } from '@/lib/enums'
import { pickupEnabledIn, pickupOnlyOrderable, pickupSelectable } from '@/lib/shop/pickupPolicy'

import type { CartCookie, CartDelivery } from './cartCookie'
import {
  computeShipping,
  ShippingError,
  type ShippingErrorCode,
  type ShippingLabel,
} from './shipping'
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
  /** ID des ersten Fotos (Korbzeile, Foto 64×80). */
  imageId?: number | null
}

export interface CartLine {
  id: number
  itemNumber: number | null
  state: CartLineState
  /** Kaufbar (`available` oder in der eigenen Kasse, nicht `pickupBlocked`) – zählt in die Summe. */
  purchasable: boolean
  /**
   * Stück `nur_abholung`, das gerade nicht bestellbar ist, weil Abholung aus ist (`settings.shipping.pickupEnabled`, P18.5):
   * gedämpft, aus der Summe, Hinweis „Gerade nicht bestellbar – Abholung ist im Moment nicht möglich“.
   */
  pickupBlocked: boolean
  /** Aktueller DB-Preis (angezeigt und berechnet); `null`, wenn das Stück nicht mehr öffentlich ist. */
  priceCents: number | null
  /** Preis beim Hinzufügen (`p` im Cookie). */
  addedPriceCents: number
  /** „Preis wurde aktualisiert“ (DB-Preis ≠ `p`). */
  priceChanged: boolean
  /**
   * Nur bei `reserved` (fremde Kasse oder Vorkasse, U-58 b): Ende der Reservierung als ISO-Zeit – nur die Uhrzeit wird
   * angezeigt („reserviert bis 14:30“), nie wer oder welche Kasse.
   */
  reservedUntil: string | null
  product: CartProductFacts | null
}

export type CartBlocker =
  'shop_closed' | 'empty' | 'too_many' | 'unavailable' | 'pickup_disabled' | 'shipping'

export interface CartEvaluation {
  lines: CartLine[]
  /**
   * Lieferart für Anzeige und Rechnung: `pickup`, sobald ein kaufbares Stück `nur_abholung` ist; `shipping`, solange
   * Abholung nicht wählbar ist (Schalter aus, P18.5) – auch wenn das Cookie noch `pickup` sagt.
   */
  delivery: CartDelivery
  /** Nummern der kaufbaren Stücke, die es nur zur Abholung gibt („Nr. 023 gibt es nur zur Abholung“). */
  pickupOnly: number[]
  /** Nummern der `nur_abholung`-Stücke, die gerade nicht bestellbar sind (Abholung aus, P18.5). */
  pickupBlocked: number[]
  /** Schalter „Abholung möglich“ (`settings.shipping.pickupEnabled`). */
  pickupEnabled: boolean
  /** Abholung im Korb wählbar (Radio sichtbar): Schalter an – oder ein bestellbares `nur_abholung`-Stück im Korb. */
  pickupSelectable: boolean
  /** Vorkasse angeboten (`settings.payment.prepaymentEnabled`) – für die Zahlarten vor „Zur Kasse“ (R-036). */
  prepaymentEnabled: boolean
  totals: {
    subtotalCents: number
    shippingCents: number
    totalCents: number
    shippingClass: ShippingClass
    label: ShippingLabel
  } | null
  shippingError: ShippingErrorCode | null
  /**
   * Versandpreis, falls „Versand“ gewählt wäre (Radiogruppe im Korb, KO-13) – auch bei gewählter Abholung; `null`, wenn
   * ein Stück nur zur Abholung ist oder kein Tarif passt.
   */
  shippingQuoteCents: number | null
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
  shipping?: (NonNullable<TotalsSettings['shipping']> & { pickupEnabled?: boolean | null }) | null
  payment?: { prepaymentEnabled?: boolean | null } | null
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
  const pickupEnabled = pickupEnabledIn(settings)
  const pickupOnlyOk = pickupOnlyOrderable(pickupEnabled)
  const byId = new Map(input.products.map((p) => [p.id, p] as const))
  const lines: CartLine[] = cart.items.map((item) => {
    const product = byId.get(item.id)
    const state = lineState(product, input.ownReservationRef, now)
    const visible = product && product.status !== null ? product : null
    const open = state === 'available' || state === 'reserved_by_you'
    const pickupBlocked = open && !pickupOnlyOk && visible?.shippingClass === 'nur_abholung'
    const priceCents = visible ? visible.priceCents : null
    const until =
      state === 'reserved' && product?.reservedUntil ? new Date(product.reservedUntil) : null
    return {
      id: item.id,
      itemNumber: product?.itemNumber ?? null,
      state,
      reservedUntil: until && !Number.isNaN(until.getTime()) ? until.toISOString() : null,
      purchasable: open && !pickupBlocked,
      pickupBlocked,
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
  const pickupBlocked = lines.flatMap((l) => (l.pickupBlocked ? [l.product!.itemNumber] : []))
  const canPickUp = pickupSelectable(pickupEnabled, pickupOnly.length > 0)
  const delivery: CartDelivery =
    pickupOnly.length > 0 ? 'pickup' : canPickUp ? cart.delivery : 'shipping'

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

  let shippingQuoteCents: number | null = null
  if (buyable.length > 0 && pickupOnly.length === 0) {
    try {
      shippingQuoteCents = computeShipping(
        buyable.map((l) => ({
          itemNumber: l.product!.itemNumber,
          shippingClass: l.product!.shippingClass,
        })),
        'shipping',
        settings,
      ).shippingCents
    } catch (err) {
      if (!(err instanceof ShippingError)) throw err
    }
  }

  const blockers: CartBlocker[] = []
  if (!shopOpen) blockers.push('shop_closed')
  if (lines.length === 0) blockers.push('empty')
  if (lines.length > maxItemsPerCheckout) blockers.push('too_many')
  if (lines.some((l) => !l.purchasable && !l.pickupBlocked)) blockers.push('unavailable')
  if (pickupBlocked.length > 0) blockers.push('pickup_disabled')
  if (shippingError) blockers.push('shipping')

  return {
    lines,
    delivery,
    pickupOnly,
    pickupBlocked,
    pickupEnabled,
    pickupSelectable: canPickUp,
    prepaymentEnabled: settings.payment?.prepaymentEnabled !== false,
    totals,
    shippingError,
    shippingQuoteCents,
    count: lines.length,
    maxItemsPerCheckout,
    shopOpen,
    closedMessage,
    canCheckout: blockers.length === 0,
    blockers,
  }
}
