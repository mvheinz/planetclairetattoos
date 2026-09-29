import React from 'react'

import type { Locale, ShippingClass } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { deliveryTimeOrDefault } from '@/lib/shop/deliveryTime'

// Lieferzeit (R-035, E-31): Baustein `delivery.timeShipping` mit `settings.shipping.deliveryTimeText`; bei Versandklasse
// `nur_abholung` Baustein `delivery.timePickup`. Vage Angaben („ca.“, „in der Regel“) erscheinen nie – dann gilt der
// Standard „2–5 Werktage“ (die Einstellungen lassen sie ohnehin nicht zu).
export function deliveryTimeText(
  locale: Locale,
  deliveryTime: string | null | undefined,
  shippingClass?: ShippingClass | null,
): string {
  const key = shippingClass === 'nur_abholung' ? 'delivery.timePickup' : 'delivery.timeShipping'
  return getSnippet(key, locale, { deliveryTime: deliveryTimeOrDefault(deliveryTime, locale) }).text
}

export function DeliveryTime({
  locale,
  deliveryTime,
  shippingClass,
  className,
}: {
  locale: Locale
  /** `settings.shipping.deliveryTimeText` in der Sprache der Seite. */
  deliveryTime: string | null | undefined
  shippingClass?: ShippingClass | null
  className?: string
}) {
  return (
    <p
      className={className}
      data-delivery-time={shippingClass === 'nur_abholung' ? 'pickup' : 'shipping'}
    >
      {deliveryTimeText(locale, deliveryTime, shippingClass)}
    </p>
  )
}
