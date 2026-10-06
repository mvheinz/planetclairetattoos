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
/** Statisches Standard-Vorschaubild 1200×630 (`pnpm art:brand`, DESIGN §12.6) – Rückfall der OG-Routen. */
export const DEFAULT_OG_IMAGE = '/og/default.png'
/** Standard-OG-Bild je Sprache (P3.14, `src/app/(frontend)/[locale]/og-image.png/route.tsx`). */
export const defaultOgImagePath = (locale: Locale) => `/${locale}/og-image.png`
const OG_LOCALE: Record<Locale, string> = { de: 'de_DE', en: 'en_GB' }

type Descriptions = (typeof de)['seo']['descriptions']

export interface BuildMetadataOptions {
  /** Seitentitel statt des Routennamens (z. B. Stücktitel ab P3). */
  title?: string
  /**
   * `og:type` (KONZEPT §3.0.5): `website` (Standard) oder `product` (R04). Next kennt `product` nicht als Open-Graph-Typ;
   * bei `product` fehlt `type` in den Metadaten, und die Seite setzt `<meta property="og:type" content="product">`
   * selbst (`ProductSeo`).
   */
  ogType?: 'website' | 'product'
  /**
   * `false`: kein `og:image` in den Metadaten – die Seite hat ein eigenes `opengraph-image` (R04, P3.14), das Next
   * dann einsetzt. Sonst das Standard-OG-Bild der Sprache.
   */
  ogImage?: false
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

export function descriptionFor(
  pageType: PublicPageType | null,
  locale: Locale,
  routeId?: string,
): string {
  const texts: Descriptions = MESSAGES[locale].seo.descriptions
  // Tattoo-Seiten R11–R18 je eine eigene Beschreibung (P7.1).
  const tattoo = routeId ? (MESSAGES[locale].seo.tattoo as Record<string, string>)[routeId] : null
  if (tattoo) return tattoo
  return (pageType && (texts as Record<string, string>)[pageType]) || texts.default
}

/** Unterseiten des Tattoo-Bereichs (R12–R18) tragen „Tattoo“ im Titel (PLAN P7.1). */
const TATTOO_SUBPAGES: ReadonlySet<string> = new Set([
  'R12',
  'R14',
  'R15',
  'R16',
  'R17',
  'R18',
])

export function titleFor(routeId: string, locale: Locale, pageTitle?: string): string {
  const common = MESSAGES[locale].common
  if (routeId === 'R01' && !pageTitle) return `${SITE_NAME} – ${common.claim}`
  const name = pageTitle ?? (common.routes as Record<string, string>)[routeId] ?? SITE_NAME
  // `{Seitentitel} · Tattoo · Planet Claire` (R11 selbst: „Tattoo · Planet Claire“).
  if (TATTOO_SUBPAGES.has(routeId)) return `${name} · ${common.routes.R11} · ${SITE_NAME}`
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
  const description = options.description ?? descriptionFor(route.pageType, locale, routeId)
  const indexable = route.robots === 'index'
  const urlFor = (l: Locale) =>
    absoluteUrl(
      localizedPath(routeId, l, l === locale ? params : (options.alternateParams?.[l] ?? params)),
      siteUrl,
    )
  const url = urlFor(locale)

  const metadata: Metadata = {
    metadataBase: new URL(`${siteUrl}/`),
    title: { absolute: title },
    description,
    robots: robotsFor(route.robots),
    openGraph: {
      ...(options.ogType === 'product' ? {} : { type: 'website' as const }),
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      ...(options.ogImage === false
        ? {}
        : {
            images: [
              {
                url: absoluteUrl(defaultOgImagePath(locale), siteUrl),
                width: 1200,
                height: 630,
                alt: MESSAGES[locale].seo.og.defaultAlt,
                type: 'image/png',
              },
            ],
          }),
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

/**
 * 404-Varianten (KONZEPT §2.5, §3.17, P3.13): Titel „Coco hat sich losgerissen · Planet Claire“ bzw. für verkaufte,
 * ausgeblendete Stücke „Dieses Stück hat schon ein Zuhause gefunden · Planet Claire“; `noindex`, **kein** canonical und
 * kein hreflang.
 */
export function notFoundMetadata(locale: Locale, variant: 'lost' | 'home' = 'lost'): Metadata {
  const errors = MESSAGES[locale].errors
  const title = `${variant === 'home' ? errors.homeTitle : errors.notFoundTitle} · ${SITE_NAME}`
  return { title: { absolute: title }, robots: robotsFor('noindex') }
}

/**
 * Token-Seiten R08/R09 (KONZEPT §4.12, P4.17/P4.23): Titel und `noindex, nofollow`, aber weder canonical noch hreflang
 * noch `og:url` – die URL mit dem Kunden-Token steht nie in den Metadaten.
 */
export function tokenPageMetadata(routeId: 'R08' | 'R09') {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale: raw } = await params
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE
    return {
      title: { absolute: titleFor(routeId, locale) },
      description: descriptionFor(getRoute(routeId).pageType, locale),
      robots: { index: false, follow: false },
      referrer: 'no-referrer',
    }
  }
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
