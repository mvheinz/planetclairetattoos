import 'server-only'

import { translatorFor } from '@/i18n/translator'
import { listTourDates, type PublicTourDate } from '@/lib/data/tour'
import { getEnv } from '@/lib/env'
import { localizedPath } from '@/lib/routes/paths'
import { LOCALES, TOUR_ANCHOR, type Locale } from '@/lib/routes/registry'
import { absoluteUrl } from '@/lib/seo/metadata'

import { buildTourIcs, ICS_CONTENT_TYPE, tourIcsFileName } from './ics'

// `GET /api/public/tour-dates/<id>.ics?locale=de|en` (V-60, ARCHITEKTUR §2.5): Kalender-Datei eines veröffentlichten
// Markttermins aus derselben gecachten Liste wie die Startseite (`listTourDates`, Tag `tour-dates`) – keine eigene
// Datenbankabfrage je Download, kein Cookie, keine Personendaten. Unbekannt oder nicht veröffentlicht → 404.
// `Content-Disposition: attachment` mit Dateinamen; kurz zwischenspeicherbar (eine Absage soll bald ankommen).

const FILE_RE = /^(\d{1,9})\.ics$/

/** Zwischenspeichern: 5 Minuten (Browser und CDN) – Änderungen an einem Termin kommen schnell an. */
export const ICS_CACHE_CONTROL = 'public, max-age=300'

const notFound = () =>
  new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })

/** `?locale=` der Anfrage; sonst Deutsch (der Link auf der Seite setzt die Sprache immer). */
export function icsLocale(raw: string | null): Locale {
  return (LOCALES as readonly string[]).includes(raw ?? '') ? (raw as Locale) : 'de'
}

export async function tourIcsResponse(
  file: string,
  localeParam: string | null,
  options: { now: Date; load?: (locale: Locale) => Promise<PublicTourDate[]> } = {
    now: new Date(),
  },
): Promise<Response> {
  let name: string
  try {
    name = decodeURIComponent(file)
  } catch {
    return notFound() // kaputte %-Kodierung
  }
  const match = FILE_RE.exec(name)
  if (!match) return notFound()
  const id = Number(match[1])
  const locale = icsLocale(localeParam)
  const items = await (options.load ?? listTourDates)(locale)
  const item = items.find((i) => i.id === id)
  if (!item) return notFound()
  const t = translatorFor(locale, 'home.tour')
  const pageUrl = `${absoluteUrl(localizedPath('R01', locale))}#${TOUR_ANCHOR}`
  const body = buildTourIcs(item, {
    locale,
    siteUrl: getEnv().NEXT_PUBLIC_SITE_URL,
    pageUrl,
    now: options.now,
    texts: {
      stand: item.standNumber ? t('stand', { number: item.standNumber }) : null,
      more: t('icsMore', { url: pageUrl }),
      cancelled: t('icsCancelled'),
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': ICS_CONTENT_TYPE,
      'content-disposition': `attachment; filename="${tourIcsFileName(item)}"`,
      'cache-control': ICS_CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
    },
  })
}
