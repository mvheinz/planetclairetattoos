import 'server-only'

import type { CountryCode } from '@/lib/enums'

// Länder-Sperren je Stück (R-202, PLAN P5.22): Keramik mit `foodContact = lebensmittelecht` ist für NL und LU nicht
// bestellbar (nationale Keramik-Grenzwerte). Geprüft in `computeShipping` (Korb, Kasse, Summen) und beim Absenden der
// Kasse (`submitCheckout`). Weitere EU-Funktionen gibt es bewusst nicht (ENTSCHEIDUNGEN „Später“). Rein, ohne DB.

/** Länder, in die lebensmittelechte Keramik nicht geliefert wird (R-202). */
export const FOOD_CONTACT_BLOCKED_COUNTRIES: readonly CountryCode[] = ['NL', 'LU']

export interface OrderableItem {
  foodContact?: string | null
}

/** Darf das Stück in `country` geliefert werden? (Abholung in Berlin ist immer möglich.) */
export function isOrderableInCountry(item: OrderableItem, country: string): boolean {
  const code = country.trim().toUpperCase()
  if (item.foodContact === 'lebensmittelecht') {
    return !(FOOD_CONTACT_BLOCKED_COUNTRIES as readonly string[]).includes(code)
  }
  return true
}
