import { formatMoney } from '@/lib/money'

// Audit-Zusammenfassung einer Preisänderung (DATENMODELL §6.6, Audit `product_price_changed`) – die Formatierung liegt
// hier, weil `formatMoney` außerhalb von `src/lib/` nur in den Preis-Komponenten erlaubt ist (R-030, `money-usage`).

/** „Nr. 017 · Schale: Preis 45,00 € → 48,00 €“ (Verwaltung, Deutsch). */
export function priceChangeSummary(label: string, fromCents: number, toCents: number): string {
  return `${label}: Preis ${formatMoney(fromCents, 'de')} → ${formatMoney(toCents, 'de')}`
}
