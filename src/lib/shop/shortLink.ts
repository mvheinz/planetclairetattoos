import { pickLocale } from '@/i18n/pickLocale'
import { isValidItemNumber } from '@/lib/products/itemNumber'
import { LOCALES, type Locale } from '@/lib/routes/registry'

// Kurzlink R31 `/nr/[nummer]` (KONZEPT §2.4) und das Nummernfeld `/nr?nummer=…` (404-Seite, V-60: Shop-Kopf und Menü):
// reine Entscheidung, testbar ohne Server.

/** Ziel des Nummernfelds (GET-Formular, ohne JavaScript). */
export const SHORT_LINK_FORM_PATH = '/nr'
/** Parameter der Nummer im Formular. */
export const SHORT_LINK_NUMBER_PARAM = 'nummer'
/** Sprache der Seite, auf der das Feld steht (V-60): geht vor `Accept-Language`. */
export const SHORT_LINK_LOCALE_PARAM = 'locale'

/** Kopfzeilen jeder Antwort des Kurzlinks: Ziel hängt von `Accept-Language` ab, nie zwischenspeichern, kein Cookie. */
export const SHORT_LINK_HEADERS = {
  vary: 'Accept-Language',
  'cache-control': 'no-store',
} as const

/**
 * Objektnummer aus dem Kurzlink oder dem Nummernfeld: 1–6 Ziffern (führende Nullen erlaubt), sonst `null`. Davor darf
 * stehen, was auf Instagram steht (V-60): „Nr. 115“, „Nr.115“, „No. 115“, „#115“ (Groß/klein egal, Leerzeichen egal).
 */
export function parseShortLinkNumber(raw: string | null | undefined): number | null {
  const value = (raw ?? '')
    .trim()
    .replace(/^(?:nr\.?|no\.?|#)\s*/i, '')
    .trim()
  if (!/^\d{1,6}$/.test(value)) return null
  const nr = Number.parseInt(value, 10)
  return isValidItemNumber(nr) ? nr : null
}

/**
 * Sprache des Ziels: zuerst der Parameter `locale` des Formulars (Sprache der Seite, V-60), sonst `Accept-Language` mit
 * q-Werten, Standard `de` (wie R30).
 */
export function shortLinkLocale(
  acceptLanguage: string | null | undefined,
  param?: string | null,
): Locale {
  const fromParam = (param ?? '').trim().toLowerCase()
  if ((LOCALES as readonly string[]).includes(fromParam)) return fromParam as Locale
  return pickLocale(acceptLanguage)
}
