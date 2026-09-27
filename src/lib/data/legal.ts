import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import { getEnv } from '@/lib/env'
import type { LegalTextType, Locale } from '@/lib/enums'
import { getActiveLegalText } from '@/lib/legal/getActive'
import {
  buildLegalTokenValues,
  LegalRenderError,
  renderLegalContent,
  type LegalTokenSettings,
  type LexicalContent,
} from '@/lib/legal/render'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'
import { systemClock, type Clock } from '@/lib/time'

// Rechtstexte für die öffentlichen Rechtsseiten R21–R25 (KONZEPT §3.14, RECHT R-002/R-012/R-015): die zu „jetzt“
// gültige Fassung des Typs, Tokens aus den öffentlichen Einstellungen ersetzt. Fehlt eine EN-Fassung, kommt der deutsche
// Text mit Hinweis „Only available in German“ (R-015). Keine Fassung, ein Render-Fehler (unersetztes Token) oder eine
// nicht erreichbare Datenbank ergeben einen neutralen Leerzustand statt 500 – nie ein rohes `{{…}}` im HTML.
// Zwischengespeichert (Tags `legal:<type>` und `settings`, spätestens nach 60 s neu; ARCHITEKTUR §9.3).

const log = createLogger()

export type LegalTextView =
  | {
      state: 'ok'
      type: LegalTextType
      content: LexicalContent
      /** ISO-Zeitpunkt `validFrom` (Anzeige „Stand“ in Europe/Berlin). */
      validFrom: string
      /** `origin !== 'lawyer'` → Band „PLATZHALTER – nicht rechtsverbindlich“ (R-002). */
      isPlaceholder: boolean
      /** EN-Seite ohne EN-Fassung: deutscher Text (R-015). */
      germanOnly: boolean
    }
  | { state: 'missing' | 'unavailable'; type: LegalTextType }

const hasRoot = (c: unknown): c is LexicalContent =>
  typeof c === 'object' && c !== null && 'root' in c && !!(c as LexicalContent).root

export interface LoadLegalTextOptions {
  clock?: Clock
}

/** Lädt und rendert die gültige Fassung (ungecacht; Grundlage für `getLegalText` und Tests). */
export async function loadLegalText(
  type: LegalTextType,
  locale: Locale,
  options: LoadLegalTextOptions = {},
): Promise<LegalTextView> {
  const now = (options.clock ?? systemClock).now()
  try {
    let doc = await getActiveLegalText(type, now, { locale, fallbackLocale: false })
    if (!doc) return { state: 'missing', type }
    let textLocale: Locale = locale
    if (!hasRoot(doc.content) && locale !== 'de') {
      doc = await getActiveLegalText(type, now, { locale: 'de', fallbackLocale: false })
      textLocale = 'de'
    }
    if (!doc || !hasRoot(doc.content)) return { state: 'missing', type }

    const settings = await getPublicSettings(options.clock, { locale: textLocale })
    const values = buildLegalTokenValues({
      settings: settings as LegalTokenSettings,
      siteUrl: getEnv().NEXT_PUBLIC_SITE_URL,
      locale: textLocale,
    })
    const rendered = renderLegalContent(doc.content, values)
    return {
      state: 'ok',
      type,
      content: rendered.content,
      validFrom: new Date(doc.validFrom).toISOString(),
      isPlaceholder: doc.origin !== 'lawyer',
      germanOnly: textLocale !== locale,
    }
  } catch (err) {
    if (err instanceof LegalRenderError) {
      log.error('legal.render_failed', { type, locale, reason: err.message })
    } else {
      log.warn('legal.load_failed', { type, locale, reason: (err as Error).message })
    }
    return { state: 'unavailable', type }
  }
}

/** Gültige Fassung je Typ und Sprache (gecacht). */
export const getLegalText = (type: LegalTextType, locale: Locale): Promise<LegalTextView> =>
  unstable_cache(() => loadLegalText(type, locale), ['legal-text', type, locale], {
    tags: [TAGS.legal(type), TAGS.settings],
    revalidate: 60,
  })()
