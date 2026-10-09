import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import { loadContactInfo, type ContactInfo } from '@/lib/data/contact'
import { instagramUrl, loadNavigation, type NavCategory } from '@/lib/data/navigation'
import { loadPublicPage } from '@/lib/data/pages'
import { PRODUCT_CATEGORIES, type CocoPose, type Locale, type ProductCategory } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicSettings } from '@/lib/payload/public'
import { localizedPath } from '@/lib/routes/paths'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'
import type { Media, Page } from '@/payload-types'

// Startseite R01 (KONZEPT §3.1, DESIGN §11.4/KO-21, P2.20): die veröffentlichte Seite `pages` mit `key = home` (über
// `getPublicPayload()`, Seed-Filter greift) als Anzeige-Modell – Kopf-Station (Block `hero`) und die Stationen (Blöcke
// `station`) in der Reihenfolge der Seite, Links aufgelöst. Geschäftsangaben (Name) kommen aus `settings.business`; es
// gibt keine eigenen Globals für Start- oder Über-mich-Seite. Fehlt `home` oder ist die Datenbank nicht erreichbar,
// liefert der Loader `null` (neutraler Leerzustand statt 500, DM-PAGE-01). Die Kategorie-Stationen (Keramik, Textil,
// Zeichnungen, Schmuck) tragen ihre Kategorien für die Karten (P3.12, `listStationProducts`); die Kategorie kommt aus dem
// Stations-Link (`link.target = category`), sonst aus der festen Zuordnung – Station Textil = `textil` + `cap` (KA-17).

const log = createLogger()

type Block = NonNullable<Page['layout']>[number]
type HeroBlock = Extract<Block, { blockType: 'hero' }>
type ImageTextBlock = Extract<Block, { blockType: 'imageText' }>
type StationBlock = Extract<Block, { blockType: 'station' }>
type StationLink = NonNullable<StationBlock['link']>

/**
 * Die 5 Stationen der Startseite in ihrer festen Reihenfolge (KONZEPT §3.1, SEED-SPEC `pages:home`, AK-SEED-18). Die
 * frühere Station „hallo“ („Komm näher.“) ist seit U-40 (P13.1) entfernt, „Jutta & Coco“ seit U-50 (P14.1): Foto und
 * Text stehen jetzt oben links (Block „Bild und Text“ der Startseite, {@link HomeView.intro}).
 */
export const HOME_STATION_IDS = ['keramik', 'textil', 'zeichnungen', 'schmuck', 'tattoo'] as const

/**
 * Entfernte Stationen (U-40 P13.1, U-50 P14.1): Steht so ein Block noch in einer übernommenen oder älteren Startseite
 * (Seed nicht neu eingespielt), wird er nicht gezeigt und zählt nicht mit – die übrigen Stationen beginnen bei
 * „Station 01“.
 */
export const RETIRED_STATION_IDS: ReadonlySet<string> = new Set(['hallo', 'jutta-und-coco'])

/** Kategorien der Produkt-Stationen, wenn der Stations-Link keine Kategorie nennt (KONZEPT §3.1, KA-17). */
export const STATION_CATEGORIES: Readonly<Record<string, readonly ProductCategory[]>> = {
  keramik: ['keramik'],
  textil: ['textil', 'cap'],
  zeichnungen: ['zeichnung'],
  schmuck: ['schmuck'],
}

/**
 * Kategorien der Karten einer Station: nur die vier Kategorie-Stationen (`sonstiges` hat keine eigene Station). Nennt der
 * Stations-Link eine Kategorie, gilt sie (Textil zusätzlich mit `cap`, KA-17); sonst die feste Zuordnung.
 */
export function stationCategories(
  stationId: string,
  link: Pick<StationLink, 'target' | 'category'> | null | undefined,
): ProductCategory[] | null {
  const fallback = STATION_CATEGORIES[stationId]
  if (!fallback) return null
  const chosen = link?.target === 'category' ? link.category : null
  if (!chosen || !(PRODUCT_CATEGORIES as readonly string[]).includes(chosen)) return [...fallback]
  return chosen === 'textil' ? ['textil', 'cap'] : [chosen as ProductCategory]
}

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
  /** Kategorien der Karten (Kategorie-Stationen), sonst `null`. */
  categories: ProductCategory[] | null
  /** Name der ersten Kategorie für „Alle {Kategorie}“ (Kategorie-Stationen). */
  categoryName: string | null
}

/**
 * Oben links (U-50, P14.1): Foto von Jutta und Coco mit dem kurzen Text darunter – der erste Block „Bild und Text“
 * (`imageText`) der Startseite, in der Verwaltung pflegbar (Foto tauschen, Text ändern). Das Foto erscheint nur, wenn es
 * öffentlich zeigbar ist (R-181: Foto von Jutta nur mit ihrer Freigabe, `isMediaPubliclyVisible`); sonst nur der Text.
 */
export interface HomeIntro {
  image: Media | null
  /** Lexical-Inhalt des Blocks (Server-HTML über `RichTextContent`). */
  content: ImageTextBlock['content']
}

export interface HomeView {
  /** Name der Kopf-Station (H1) aus `settings.business.tradeName`. */
  name: string | null
  hero: { heading: string; subheading: string | null; pose: CocoPose | null } | null
  intro: HomeIntro | null
  stations: HomeStation[]
}

export interface HomeContext {
  locale: Locale
  categories: readonly NavCategory[]
  contact: Pick<ContactInfo, 'email' | 'instagramHandle'>
  tradeName: string | null
  /** Einwilligungs-/Freigaberegel für Bilder (Standard `isMediaPubliclyVisible`; Tests injizieren sie). */
  mediaVisible?: (media: Media) => boolean
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
  const mediaVisible = ctx.mediaVisible ?? isMediaPubliclyVisible
  const blocks = page.layout ?? []
  const hero = blocks.find((b): b is HeroBlock => b.blockType === 'hero')
  const introBlock = blocks.find((b): b is ImageTextBlock => b.blockType === 'imageText')
  const introImage =
    introBlock && typeof introBlock.image === 'object' && introBlock.image !== null
      ? introBlock.image
      : null
  const stations = blocks
    .filter((b): b is StationBlock => b.blockType === 'station')
    .filter((b) => !RETIRED_STATION_IDS.has(b.stationId))
    .map((b, i): HomeStation => {
      const categories = stationCategories(b.stationId, b.link)
      const nav = categories ? ctx.categories.find((c) => c.key === categories[0]) : undefined
      // Kategorie-Station ohne Link: „Alle {Kategorie}“ → R03 (bzw. Shop, wenn die Kategorie nicht in der Navigation ist).
      const href = b.link?.target
        ? stationLinkHref(b.link, ctx)
        : categories
          ? stationLinkHref({ target: 'category', category: categories[0] }, ctx)
          : null
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
        categories,
        categoryName: nav?.name ?? null,
      }
    })
  return {
    name: ctx.tradeName,
    hero: hero
      ? { heading: hero.heading, subheading: text(hero.subheading), pose: hero.cocoPose ?? null }
      : null,
    intro: introBlock
      ? {
          image: introImage && mediaVisible(introImage) ? introImage : null,
          content: introBlock.content,
        }
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
