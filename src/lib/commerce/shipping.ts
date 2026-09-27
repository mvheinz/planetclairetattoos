import 'server-only'

import {
  SHIPPING_CLASS_RANK,
  type FulfillmentMethod,
  type ShippingClass,
  type ShippingZone,
} from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'

// Versandkosten (E-25, DATENMODELL §6.8.1, DM-ORD-05): die höchste Versandklasse im Korb bestimmt den Tarif aus
// `settings.shipping.rates`; Abholung kostet nichts. Reine Funktion ohne DB. P4.2 ergänzt Länder und Anzeigenamen.

export interface ShippingItem {
  itemNumber?: number | null
  shippingClass: ShippingClass
}

export interface ShippingRate {
  zone?: ShippingZone | null
  shippingClass?: ShippingClass | null
  priceCents?: number | null
}

export interface ShippingSettings {
  shipping?: { rates?: readonly ShippingRate[] | null } | null
}

export interface ShippingResult {
  shippingClass: ShippingClass
  /** `null` bei Abholung. */
  zone: ShippingZone | null
  shippingCents: number
}

export class ShippingError extends Error {
  constructor(
    readonly code: 'empty' | 'pickup_only' | 'no_rate',
    message: string,
  ) {
    super(message)
    this.name = 'ShippingError'
  }
}

/** Versandklasse mit dem höchsten Rang (`SHIPPING_CLASS_RANK`). */
export function highestShippingClass(items: readonly ShippingItem[]): ShippingClass {
  if (items.length === 0) throw new ShippingError('empty', 'Der Warenkorb ist leer.')
  return items.reduce<ShippingClass>(
    (best, item) =>
      SHIPPING_CLASS_RANK[item.shippingClass] > SHIPPING_CLASS_RANK[best]
        ? item.shippingClass
        : best,
    items[0]!.shippingClass,
  )
}

export function computeShipping(
  items: readonly ShippingItem[],
  method: FulfillmentMethod,
  settings: ShippingSettings,
  zone: ShippingZone = 'DE',
): ShippingResult {
  const shippingClass = highestShippingClass(items)
  if (method === 'pickup') return { shippingClass, zone: null, shippingCents: 0 }
  const pickupOnly = items.find((i) => i.shippingClass === 'nur_abholung')
  if (pickupOnly) {
    const label =
      typeof pickupOnly.itemNumber === 'number'
        ? formatItemNumber(pickupOnly.itemNumber, 'de')
        : 'Ein Stück'
    throw new ShippingError('pickup_only', `${label} gibt es nur zur Abholung.`)
  }
  const rate = (settings.shipping?.rates ?? []).find(
    (r) => r.zone === zone && r.shippingClass === shippingClass,
  )
  if (!rate || typeof rate.priceCents !== 'number' || !Number.isInteger(rate.priceCents)) {
    throw new ShippingError(
      'no_rate',
      `Für ${shippingClass} (${zone}) ist kein Versandpreis hinterlegt.`,
    )
  }
  return { shippingClass, zone, shippingCents: rate.priceCents }
}
