import { TEXT_DEFAULTS } from '@/globals/settingsDefaults'
import type { Locale } from '@/lib/enums'

// Lieferzeit (R-035, E-31): konkrete Angabe aus `settings.shipping.deliveryTimeText` ohne vage Zusätze („ca.“,
// „in der Regel“ …). Reines Modul – genutzt von der Einstellungs-Prüfung und der Komponente `DeliveryTime`.

/** Vage Zusätze, die eine Lieferzeit unbestimmt machen (DE/EN). */
export const VAGUE_DELIVERY_RE =
  /(?<![\p{L}])(ca\.|circa|zirka|in\s+der\s+regel|i\.\s?d\.\s?r\.|voraussichtlich|ungefähr|etwa|meistens|approx\.?|approximately|usually|typically|about|around|roughly)(?![\p{L}])/iu

export const isVagueDeliveryTime = (text: string): boolean => VAGUE_DELIVERY_RE.test(text)

/** Geprüfte Lieferzeit: leer oder vage → Standard „2–5 Werktage“ der Sprache (E-31). */
export function deliveryTimeOrDefault(text: string | null | undefined, locale: Locale): string {
  const t = text?.trim()
  return t && !isVagueDeliveryTime(t) ? t : TEXT_DEFAULTS.deliveryTimeText[locale]
}

export const DELIVERY_TIME_MAX_LENGTH = 60

/** Feldprüfung für `settings.shipping.deliveryTimeText` (Verwaltung; ersetzt die Standardprüfung inkl. Länge). */
export function validateDeliveryTimeText(value: unknown): true | string {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string') return 'Bitte einen Text eingeben.'
  if (value.length > DELIVERY_TIME_MAX_LENGTH)
    return `Höchstens ${DELIVERY_TIME_MAX_LENGTH} Zeichen.`
  return isVagueDeliveryTime(value)
    ? 'Bitte eine feste Angabe ohne „ca.“ oder „in der Regel“ (z. B. „2–5 Werktage“).'
    : true
}

/**
 * Lieferzeit in Tagen aus dem Text der Einstellungen (V-61 b, für die Produktdaten bei Google): „2–5 Werktage“,
 * „2-5 working days“, „2 bis 5 Werktage“, „3 Werktage“ → `{ min, max }`. Andere Einheiten (Wochen) oder unklare Texte →
 * `null` (dann steht in den Produktdaten keine Lieferzeit – lieber nichts als etwas Falsches).
 */
export function deliveryDayRange(
  text: string | null | undefined,
): { min: number; max: number } | null {
  const t = (text ?? '').trim()
  if (!t || isVagueDeliveryTime(t)) return null
  if (!/(?:werk)?tage?n?\b|(?:working|business)?\s*days?\b/i.test(t)) return null
  if (/woche|week|monat|month/i.test(t)) return null
  const range = /(\d{1,2})\s*(?:[–—-]|bis|to)\s*(\d{1,2})/i.exec(t)
  const single = /(\d{1,2})/.exec(t)
  const min = Number(range ? range[1] : single?.[1])
  const max = Number(range ? range[2] : single?.[1])
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 60)
    return null
  return { min, max }
}
