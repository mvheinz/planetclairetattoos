// next-intl-Routing aus der Routen-Registry (ARCHITEKTUR §2.3). Kein Sprach-Cookie (R-130, E-43).
import { defineRouting } from 'next-intl/routing'

import { pageRoutes, toFolderPattern } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/routes/registry'

/** Schlüssel = EN-Pfad = Ordnername unter `[locale]/`; Werte = lokalisierte Muster (z. B. `/impressum`). */
export const pathnames: Record<string, { de: string; en: string }> = Object.fromEntries(
  pageRoutes().map((r) => [
    r.key!,
    { de: toFolderPattern(r.paths!.de, r.key!), en: toFolderPattern(r.paths!.en, r.key!) },
  ]),
)

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: false,
  localeDetection: true,
  pathnames,
})
