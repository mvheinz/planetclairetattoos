import { ENUM_LABELS } from '@/lib/enumLabels'
import { SHIPPING_CLASS_RANK, type Locale, type ShippingClass } from '@/lib/enums'

// Versanddienst und Versandklasse in Kundentexten (KONZEPT §7.6, V-09/U-93): Korb, Kasse, Danke- und Statusseite nennen
// den echten Dienst – Versandklasse `brief` → Deutsche Post, sonst DHL; nach „Versendet melden“ den dort gewählten
// Dienst (bei „Sonstige“ keinen Namen). Rein, ohne Datenbank (auch für Tests und Client-Code).

export type ParcelCarrier = 'dhl' | 'deutsche_post'

/** Versanddienst einer Versandklasse (KONZEPT §7.6: Brief → Deutsche Post, sonst DHL). */
export function carrierForClass(shippingClass: ShippingClass | null | undefined): ParcelCarrier {
  return shippingClass === 'brief' ? 'deutsche_post' : 'dhl'
}

/** Anzeigename des Dienstes („DHL“, „Deutsche Post“ – in beiden Sprachen gleich); `other`/unbekannt → `null`. */
export function carrierName(code: unknown): string | null {
  return code === 'dhl' || code === 'deutsche_post' ? ENUM_LABELS.CARRIERS[code].de : null
}

/** Name des Dienstes einer Versandklasse („DHL“ bzw. „Deutsche Post“). */
export function classCarrierName(shippingClass: ShippingClass | null | undefined): string {
  return ENUM_LABELS.CARRIERS[carrierForClass(shippingClass)].de
}

/** Höchste Versandklasse einer Liste (E-25); leere Liste → `null`. */
export function highestClassOf(
  classes: readonly (ShippingClass | null | undefined)[],
): ShippingClass | null {
  let best: ShippingClass | null = null
  for (const c of classes) {
    if (c && (best === null || SHIPPING_CLASS_RANK[c] > SHIPPING_CLASS_RANK[best])) best = c
  }
  return best
}

/** Name der Versandklasse in der Sprache der Seite („Keramik-Paket“, „Ceramics parcel“). */
export function shippingClassName(shippingClass: ShippingClass, locale: Locale): string {
  const label = ENUM_LABELS.SHIPPING_CLASSES[shippingClass]
  return (locale === 'en' ? label.en : undefined) ?? label.de
}

/**
 * Versanddienst einer Bestellung für Danke- und Statusseite: der beim Versand gemeldete Dienst, sonst der Dienst der
 * höchsten Versandklasse (Bestellung, ersatzweise Positionen). „Sonstige“ oder gar keine Klasse → `null` (die Seite
 * schreibt dann nur „Versand“).
 */
export function orderCarrierName(order: {
  shipmentCarrier?: string | null
  shippingClass?: ShippingClass | null
  itemClasses?: readonly (ShippingClass | null | undefined)[]
}): string | null {
  if (order.shipmentCarrier) return carrierName(order.shipmentCarrier)
  const cls = order.shippingClass ?? highestClassOf(order.itemClasses ?? [])
  return cls ? classCarrierName(cls) : null
}
