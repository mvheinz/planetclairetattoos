import type { Locale } from '@/lib/enums'
import { formatMoney } from '@/lib/money'

// Tattoo-Preise als Text (KONZEPT §9.1, §9.6, R-034, DESIGN KO-20): Gesamtpreis ohne Nachkommastellen bei vollen Euro
// („120 €“), mit Sternchen, das die Fußnote `price.tattooNote` auflöst. Kein Preisschild, kein Vergleichs- oder
// Streichpreis (V-20). Einzige Stelle des Tattoo-Bereichs, die `formatMoney` aufruft (Prüfung `money-usage`).

/** „120 €“ bzw. „120,50 €“. */
export function formatTattooPrice(cents: number, locale: Locale): string {
  return formatMoney(cents, locale, { style: 'tag' })
}

/** „120 €*“ – Preis mit Sternchen als reiner Text (Mindestpreis, Preisrahmen). */
export function tattooPriceWithStar(cents: number, locale: Locale): string {
  return `${formatTattooPrice(cents, locale)}*`
}
