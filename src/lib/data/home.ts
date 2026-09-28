import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import { loadContactInfo, type ContactInfo } from '@/lib/data/contact'
import { instagramUrl, loadNavigation, type NavCategory } from '@/lib/data/navigation'
import { loadPublicPage } from '@/lib/data/pages'
import type { CocoPose, Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'
import { localizedPath } from '@/lib/routes/paths'
import type { Page } from '@/payload-types'

// Startseite R01 (KONZEPT §3.1, DESIGN §11.4/KO-21, P2.20): die veröffentlichte Seite `pages` mit `key = home` (über
// `getPublicPayload()`, Seed-Filter greift) als Anzeige-Modell – Kopf-Station (Block `hero`) und die Stationen (Blöcke
// `station`) in der Reihenfolge der Seite, Links aufgelöst. Geschäftsangaben (Name) kommen aus `settings.business`; es
// gibt keine eigenen Globals für Start- oder Über-mich-Seite. Fehlt `home` oder ist die Datenbank nicht erreichbar,
// liefert der Loader `null` (neutraler Leerzustand statt 500, DM-PAGE-01). Noch keine Produktkarten (W-33, P3).

const log = createLogger()

type Block = NonNullable<Page['layout']>[number]
type HeroBlock = Extract<Block, { blockType: 'hero' }>
type StationBlock = Extract<Block, { blockType: 'station' }>
type StationLink = NonNullable<StationBlock['link']>

/** Die 7 Stationen der Startseite in ihrer festen Reihenfolge (KONZEPT §3.1, SEED-SPEC `pages:home`, AK-SEED-18). */
export const HOME_STATION_IDS = [
  'hallo',
  'keramik',
  'textil',
  'zeichnungen',
  'schmuck',
  'tattoo',
  'jutta-und-coco',
] as const

export interface HomeLink {
  href: string
  label: string | null
  external: boolean
}

export interface HomeStation {
  stationId: string
  /** 1-basiert, Anzeige „Station 01“. */
  number: number
  heading: string
  text: string | null
  pose: CocoPose | null
  ornament: 'planet' | 'star' | 'none'
  link: HomeLink | null
}

export interface HomeView {
  /** Name der Kopf-Station (H1) aus `settings.business.tradeName`. */
  name: string | null
  hero: { heading: string; subheading: string | null; pose: CocoPose | null } | null
  stations: HomeStation[]
}

export interface HomeContext {
  locale: Locale
  categories: readonly NavCategory[]
  contact: Pick<ContactInfo, 'email' | 'instagramHandle'>
  tradeName: string | null
}

/** Ziel eines Stations-Links (`link.target`) als Pfad bzw. URL; unbekannt/unvollständig → `null`. */
export function stationLinkHref(link: StationLink, ctx: HomeContext): HomeLink['href'] | null {
  const { locale } = ctx
  switch (link.target) {
    case 'home':
      return localizedPath('R01', locale)
    case 'shop':
      return localizedPath('R02', locale)
    case 'archive':
      return localizedPath('R05', locale)
    case 'category': {
      const slug = ctx.categories.find((c) => c.key === link.category)?.slug
      // Kategorie nicht (mehr) in der Navigation → Shop statt toter Link.
      return slug ? localizedPath('R03', locale, { slug }) : localizedPath('R02', locale)
    }
    case 'tattoo':
      return localizedPath('R11', locale)
    case 'tattoo_aftercare':
      return localizedPath('R17', locale)
    case 'about':
      return localizedPath('R19', locale)
    case 'commissions':
      return localizedPath('R10', locale)
    case 'contact':
      return localizedPath('R20', locale)
    case 'conformity':
      return localizedPath('R27', locale)
    case 'instagram':
      return instagramUrl(ctx.contact.instagramHandle)
    case 'email':
      return ctx.contact.email ? `mailto:${ctx.contact.email}` : null
    default:
      return null
  }
}

const text = (v: string | null | undefined): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

/** Reine Abbildung der Seite auf das Anzeige-Modell (testbar ohne Datenbank). */
export function toHomeView(page: Page | null, ctx: HomeContext): HomeView | null {
  if (!page) return null
  const blocks = page.layout ?? []
  const hero = blocks.find((b): b is HeroBlock => b.blockType === 'hero')
  const stations = blocks
    .filter((b): b is StationBlock => b.blockType === 'station')
    .map((b, i): HomeStation => {
      const href = b.link?.target ? stationLinkHref(b.link, ctx) : null
      return {
        stationId: b.stationId,
        number: i + 1,
        heading: b.heading,
        text: text(b.text),
        pose: b.cocoPose ?? null,
        ornament: b.ornament ?? 'none',
        link: href
          ? { href, label: text(b.link?.label), external: /^(https?:|mailto:)/.test(href) }
          : null,
      }
    })
  return {
    name: ctx.tradeName,
    hero: hero
      ? { heading: hero.heading, subheading: text(hero.subheading), pose: hero.cocoPose ?? null }
      : null,
    stations,
  }
}

/** Lädt Seite, Kategorien, Kontaktwege und den Namen (ungecacht). */
export async function loadHomeView(locale: Locale): Promise<HomeView | null> {
  try {
    const [page, nav, contact, settings] = await Promise.all([
      loadPublicPage('home', locale),
      loadNavigation(locale),
      loadContactInfo(),
      getPublicSettings(undefined, { locale }),
    ])
    const business = settings.business as { tradeName?: unknown } | undefined
    const tradeName = typeof business?.tradeName === 'string' ? text(business.tradeName) : null
    return toHomeView(page, { locale, categories: nav.categories, contact, tradeName })
  } catch (err) {
    log.warn('home.load_failed', { locale, reason: (err as Error).message })
    return null
  }
}

/** Startseite je Sprache (gecacht; Tags `page:home`, `home`, `categories`, `settings`). */
export const getHomeView = (locale: Locale): Promise<HomeView | null> =>
  unstable_cache(() => loadHomeView(locale), ['home-view', locale], {
    tags: [TAGS.page('home'), TAGS.home, TAGS.categories, TAGS.settings],
    revalidate: 60,
  })()
