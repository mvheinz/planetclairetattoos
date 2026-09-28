import type { Metadata } from 'next'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { getEnv } from '@/lib/env'
import { getRoute, isLocale, localizedPath, type RouteParams } from '@/lib/routes/paths'
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type PublicPageType,
  type RobotsMode,
} from '@/lib/routes/registry'

// SEO-Grundlagen (KONZEPT §2.5 und §3.0.5, P2.11): Titel „{Seite} · Planet Claire“ (Startseite „Planet Claire –
// {Claim}“), Beschreibung aus den Nachrichten (je Seitentyp, sonst Standard), `robots` aus der Registry. Nur
// indexierbare Seiten bekommen canonical und die drei hreflang-Links `de`, `en`, `x-default` (→ DE) mit absoluten
// Apex-URLs aus `NEXT_PUBLIC_SITE_URL`; `noindex`-Seiten (Token-Seiten, Korb, Kasse, Widerruf, 404/500) keine.

const MESSAGES = { de, en } as const

export const SITE_NAME = 'Planet Claire'
/** Standard-Vorschaubild 1200×630 (`pnpm art:brand`, DESIGN §12.6). */
export const DEFAULT_OG_IMAGE = '/og/default.png'
const OG_LOCALE: Record<Locale, string> = { de: 'de_DE', en: 'en_GB' }

type Descriptions = (typeof de)['seo']['descriptions']

export interface BuildMetadataOptions {
  /** Seitentitel statt des Routennamens (z. B. Stücktitel ab P3). */
  title?: string
  /** Beschreibung aus dem CMS; sonst Vorlage je Seitentyp. */
  description?: string
  /** Parameter der anderen Sprache, falls sie abweichen (sprachabhängige Slugs ab P3). */
  alternateParams?: Partial<Record<Locale, RouteParams>>
  /** Basis-URL (Tests); Standard `NEXT_PUBLIC_SITE_URL`. */
  siteUrl?: string
}

/** Absolute URL auf der Apex-Domain aus `NEXT_PUBLIC_SITE_URL` (ohne `/` am Ende). */
export function absoluteUrl(path: string, siteUrl: string = getEnv().NEXT_PUBLIC_SITE_URL): string {
  return new URL(path, `${siteUrl}/`).toString()
}

/** Registry-Angabe → Next-`robots` (`noindex` → „noindex“, `noindex,follow` → „noindex, follow“). */
export function robotsFor(mode: RobotsMode): NonNullable<Metadata['robots']> {
  if (mode === 'index') return { index: true, follow: true }
  if (mode === 'noindex,follow') return { index: false, follow: true }
  return { index: false }
}

export function descriptionFor(pageType: PublicPageType | null, locale: Locale): string {
  const texts: Descriptions = MESSAGES[locale].seo.descriptions
  return (pageType && (texts as Record<string, string>)[pageType]) || texts.default
}

export function titleFor(routeId: string, locale: Locale, pageTitle?: string): string {
  const common = MESSAGES[locale].common
  if (routeId === 'R01' && !pageTitle) return `${SITE_NAME} – ${common.claim}`
  const name = pageTitle ?? (common.routes as Record<string, string>)[routeId] ?? SITE_NAME
  return `${name} · ${SITE_NAME}`
}

/** Metadaten einer Registry-Route (R01–R27) in `locale`. */
export function buildMetadata(
  routeId: string,
  locale: Locale,
  params: RouteParams = {},
  options: BuildMetadataOptions = {},
): Metadata {
  const route = getRoute(routeId)
  const siteUrl = options.siteUrl ?? getEnv().NEXT_PUBLIC_SITE_URL
  const title = titleFor(routeId, locale, options.title)
  const description = options.description ?? descriptionFor(route.pageType, locale)
  const indexable = route.robots === 'index'
  const urlFor = (l: Locale) =>
    absoluteUrl(
      localizedPath(routeId, l, l === locale ? params : (options.alternateParams?.[l] ?? params)),
      siteUrl,
    )
  const url = urlFor(locale)

  const metadata: Metadata = {
    title: { absolute: title },
    description,
    robots: robotsFor(route.robots),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE, siteUrl), width: 1200, height: 630 }],
    },
  }
  if (indexable) {
    metadata.alternates = {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, urlFor(l)])),
        'x-default': urlFor(DEFAULT_LOCALE),
      },
    }
  }
  return metadata
}

/** `generateMetadata` für eine Seite unter `[locale]/` ohne Datenbezug. */
export function routeMetadata(routeId: string) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params
    return buildMetadata(routeId, isLocale(locale) ? locale : DEFAULT_LOCALE)
  }
}

export interface ListMetadataOptions extends BuildMetadataOptions {
  /** Seite der Liste (ab 2 als `?page=n` in canonical und hreflang, KONZEPT §2.3). */
  page?: number
}

/**
 * Metadaten der Listen R02, R03, R05 (KONZEPT §2.3, §3.2–§3.5): canonical ohne `available` und `category`, mit `page`
 * erst ab Seite 2; hreflang mit denselben Regeln (Kategorie-Slug der jeweiligen Sprache über `alternateParams`).
 */
export function buildListMetadata(
  routeId: 'R02' | 'R03' | 'R05',
  locale: Locale,
  params: RouteParams = {},
  options: ListMetadataOptions = {},
): Metadata {
  const metadata = buildMetadata(routeId, locale, params, options)
  const siteUrl = options.siteUrl ?? getEnv().NEXT_PUBLIC_SITE_URL
  const query = options.page && options.page >= 2 ? `?page=${options.page}` : ''
  const urlFor = (l: Locale) =>
    absoluteUrl(
      `${localizedPath(routeId, l, l === locale ? params : (options.alternateParams?.[l] ?? params))}${query}`,
      siteUrl,
    )
  metadata.alternates = {
    canonical: urlFor(locale),
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, urlFor(l)])),
      'x-default': urlFor(DEFAULT_LOCALE),
    },
  }
  if (metadata.openGraph) metadata.openGraph = { ...metadata.openGraph, url: urlFor(locale) }
  return metadata
}
