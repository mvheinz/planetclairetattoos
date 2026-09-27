// Spracherkennung über `Accept-Language` (KONZEPT §2.4, R30): q-Werte beachten, erste passende Sprache aus de/en;
// keine passende oder kein Header → de. Rein, ohne Framework-Importe; kein Cookie (E-43, R-130).
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../lib/routes/registry'

export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const entries = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...rest] = part.trim().split(';')
      const qParam = rest.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const q = qParam === undefined ? 1 : Number.parseFloat(qParam.slice(2))
      return {
        lang: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: Number.isFinite(q) ? q : 0,
        index,
      }
    })
    .filter((e) => e.lang !== '' && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  for (const e of entries) {
    if ((LOCALES as readonly string[]).includes(e.lang)) return e.lang as Locale
  }
  return DEFAULT_LOCALE
}
