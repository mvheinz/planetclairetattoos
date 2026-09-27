import type { Locale } from '@/lib/enums'

// Lokalisierte Werte eines Stücks (DATENMODELL §1.2): je nach Abfrage ein einzelner String (eine Sprache) oder ein
// Objekt `{ de, en }` (`locale: 'all'`). Reine Hilfsfunktionen, auch im Browser nutzbar.

export type LocalizedValue = string | null | undefined | Partial<Record<Locale, string | null>>

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined

/**
 * Wert in einer Sprache. `fallback = true`: fehlt EN, gilt DE (Fallback laut E-61). Ein einzelner String gilt als
 * Wert der angefragten Sprache.
 */
export function pickLocale(
  value: LocalizedValue | unknown,
  locale: Locale,
  fallback = true,
): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return text(value)
  if (typeof value === 'object') {
    const obj = value as Partial<Record<Locale, unknown>>
    return text(obj[locale]) ?? (fallback && locale !== 'de' ? text(obj.de) : undefined)
  }
  return undefined
}
