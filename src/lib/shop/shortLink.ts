import { pickLocale } from '@/i18n/pickLocale'
import { isValidItemNumber } from '@/lib/products/itemNumber'
import type { Locale } from '@/lib/routes/registry'

// Kurzlink R31 `/nr/[nummer]` (KONZEPT §2.4, Nummernfeld der 404-Seite): reine Entscheidung, testbar ohne Server.

/** Kopfzeilen jeder Antwort des Kurzlinks: Ziel hängt von `Accept-Language` ab, nie zwischenspeichern, kein Cookie. */
export const SHORT_LINK_HEADERS = {
  vary: 'Accept-Language',
  'cache-control': 'no-store',
} as const

/** Objektnummer aus dem Kurzlink: nur Ziffern (1–6 Stellen, führende Nullen erlaubt), sonst `null`. */
export function parseShortLinkNumber(raw: string | null | undefined): number | null {
  const value = (raw ?? '').trim()
  if (!/^\d{1,6}$/.test(value)) return null
  const nr = Number.parseInt(value, 10)
  return isValidItemNumber(nr) ? nr : null
}

/** Sprache des Ziels: `Accept-Language` mit q-Werten, Standard `de` (wie R30). */
export const shortLinkLocale = (acceptLanguage: string | null | undefined): Locale =>
  pickLocale(acceptLanguage)
