// Routen-Registry (ARCHITEKTUR §2.3): einzige Quelle aller öffentlichen Routen R01–R31 im Code.
// Reine Daten ohne Framework-Importe und ohne Pfad-Aliasse – `next.config.ts`, der Proxy, Tests und der
// Vorschau-Export importieren diese Datei relativ. DE-/EN-Muster entsprechen exakt KONZEPT §2.2 (ohne Sprachpräfix;
// `/` = Startseite der Sprache). Interner Schlüssel `key` = EN-Pfad = Ordnername unter `src/app/(frontend)/[locale]/`.

export const LOCALES = ['de', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'de'

/** Öffentliche Seitentypen (RECHT ANFORDERUNGEN §2, Fixture `PUBLIC_PAGE_TYPES`). */
export const PUBLIC_PAGE_TYPES = [
  'home',
  'shop',
  'category',
  'product',
  'archive',
  'cart',
  'checkout',
  'thankYou',
  'orderStatus',
  'commissions',
  'tattoo',
  'about',
  'contact',
  'legal',
  'withdrawal',
  'conformity',
  'notFound',
  'error',
] as const
export type PublicPageType = (typeof PUBLIC_PAGE_TYPES)[number]

/** Presets der Tuschelinie je Seitentyp (DESIGN §9.7). R29 und Weiterleitungen haben keins. */
export const PRESETS = [
  'journey',
  'about',
  'shopString',
  'product',
  'calm',
  'stencil',
  'frame',
  'legal',
  'margin',
  'thanks',
  'lost',
] as const
export type PresetId = (typeof PRESETS)[number]

/** Rendering je Route (ARCHITEKTUR §9.1). */
export type RenderingMode = 'isr' | 'static' | 'dynamic' | 'redirect'
/** Robots-Angabe (KONZEPT §2.5). */
export type RobotsMode = 'index' | 'noindex' | 'noindex,follow'
/** Header-/CSP-Kontext (ARCHITEKTUR §8.1). */
export type HeaderContext = 'public' | 'dynamic' | 'checkout'
export type RouteStatus = 'live' | 'planned'
/** `page` = Seite unter `[locale]/`; `error` = R28/R29 (kein eigenes Muster); `redirect` = R30/R31. */
export type RouteKind = 'page' | 'error' | 'redirect'

export interface RouteEntry {
  id: string
  kind: RouteKind
  /** EN-Pfad = Ordnername unter `[locale]/` (nur `page`). */
  key: string | null
  /** Muster je Sprache ohne Sprachpräfix, exakt KONZEPT §2.2 (nur `page`). */
  paths: Record<Locale, string> | null
  /** Unpräfixierter Quellpfad einer Weiterleitung (R30 `/`, R31 `/nr/[nummer]`). */
  from: string | null
  pageType: PublicPageType | null
  preset: PresetId | null
  rendering: RenderingMode
  robots: RobotsMode
  headerContext: HeaderContext
  status: RouteStatus
  /** Phase des vollständigen Inhalts laut KONZEPT §2.2. */
  phase: number
  /** Phase des Gerüsts („Gerüst P2“), falls früher als `phase`. */
  scaffoldPhase: number | null
}

type PageInit = Omit<RouteEntry, 'kind' | 'from' | 'key' | 'paths' | 'scaffoldPhase'> & {
  de: string
  en: string
  scaffoldPhase?: number
}

const page = ({ de, en, scaffoldPhase, ...rest }: PageInit): RouteEntry => ({
  ...rest,
  kind: 'page',
  key: en,
  paths: { de, en },
  from: null,
  scaffoldPhase: scaffoldPhase ?? null,
})

// prettier-ignore
export const ROUTES: readonly RouteEntry[] = [
  page({ id: 'R01', de: '/', en: '/', pageType: 'home', preset: 'journey', rendering: 'isr', robots: 'index', headerContext: 'public', status: 'live', phase: 2 }),
  page({ id: 'R02', de: '/shop', en: '/shop', pageType: 'shop', preset: 'shopString', rendering: 'isr', robots: 'index', headerContext: 'public', status: 'live', phase: 3 }),
  page({ id: 'R03', de: '/shop/kategorie/[slug]', en: '/shop/category/[slug]', pageType: 'category', preset: 'shopString', rendering: 'isr', robots: 'index', headerContext: 'public', status: 'live', phase: 3 }),
  { ...page({ id: 'R04', de: '/shop/[nummer]-[slug]', en: '/shop/[nummer]-[slug]', pageType: 'product', preset: 'product', rendering: 'isr', robots: 'index', headerContext: 'public', status: 'live', phase: 3 }), key: '/shop/[product]' },
  page({ id: 'R05', de: '/archiv', en: '/archive', pageType: 'archive', preset: 'shopString', rendering: 'isr', robots: 'index', headerContext: 'public', status: 'live', phase: 3 }),
  page({ id: 'R06', de: '/warenkorb', en: '/cart', pageType: 'cart', preset: 'calm', rendering: 'dynamic', robots: 'noindex', headerContext: 'dynamic', status: 'live', phase: 4 }),
  page({ id: 'R07', de: '/kasse', en: '/checkout', pageType: 'checkout', preset: 'calm', rendering: 'dynamic', robots: 'noindex', headerContext: 'checkout', status: 'live', phase: 4 }),
  page({ id: 'R08', de: '/danke/[token]', en: '/thank-you/[token]', pageType: 'thankYou', preset: 'thanks', rendering: 'dynamic', robots: 'noindex', headerContext: 'dynamic', status: 'live', phase: 4 }),
  page({ id: 'R09', de: '/bestellung/[token]', en: '/order/[token]', pageType: 'orderStatus', preset: 'calm', rendering: 'dynamic', robots: 'noindex', headerContext: 'dynamic', status: 'live', phase: 4 }),
  page({ id: 'R10', de: '/auftragsarbeiten', en: '/commissions', pageType: 'commissions', preset: 'frame', rendering: 'dynamic', robots: 'index', headerContext: 'dynamic', status: 'planned', phase: 7 }),
  page({ id: 'R11', de: '/tattoo', en: '/tattoo', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R12', de: '/tattoo/flash', en: '/tattoo/flash', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R13', de: '/tattoo/angebote', en: '/tattoo/offers', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R14', de: '/tattoo/preise', en: '/tattoo/prices', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R15', de: '/tattoo/galerie', en: '/tattoo/gallery', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R16', de: '/tattoo/ablauf', en: '/tattoo/process', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R17', de: '/tattoo/aftercare', en: '/tattoo/aftercare', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R18', de: '/tattoo/faq', en: '/tattoo/faq', pageType: 'tattoo', preset: 'stencil', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 7 }),
  page({ id: 'R19', de: '/ueber-mich', en: '/about', pageType: 'about', preset: 'about', rendering: 'static', robots: 'index', headerContext: 'public', status: 'planned', phase: 8 }),
  page({ id: 'R20', de: '/kontakt', en: '/contact', pageType: 'contact', preset: 'margin', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 6, scaffoldPhase: 2 }),
  page({ id: 'R21', de: '/impressum', en: '/legal-notice', pageType: 'legal', preset: 'legal', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 6, scaffoldPhase: 2 }),
  page({ id: 'R22', de: '/datenschutz', en: '/privacy', pageType: 'legal', preset: 'legal', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 6, scaffoldPhase: 2 }),
  page({ id: 'R23', de: '/agb', en: '/terms', pageType: 'legal', preset: 'legal', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 6, scaffoldPhase: 2 }),
  page({ id: 'R24', de: '/widerrufsbelehrung', en: '/right-of-withdrawal', pageType: 'legal', preset: 'legal', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 6, scaffoldPhase: 2 }),
  page({ id: 'R25', de: '/versand-und-zahlung', en: '/shipping-and-payment', pageType: 'legal', preset: 'legal', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 4, scaffoldPhase: 2 }),
  page({ id: 'R26', de: '/vertrag-widerrufen', en: '/withdraw-from-contract', pageType: 'withdrawal', preset: 'calm', rendering: 'dynamic', robots: 'noindex,follow', headerContext: 'dynamic', status: 'live', phase: 6, scaffoldPhase: 2 }),
  page({ id: 'R27', de: '/konformitaetserklaerungen', en: '/declarations-of-conformity', pageType: 'conformity', preset: 'legal', rendering: 'static', robots: 'index', headerContext: 'public', status: 'live', phase: 6, scaffoldPhase: 2 }),
  { id: 'R28', kind: 'error', key: null, paths: null, from: null, pageType: 'notFound', preset: 'lost', rendering: 'static', robots: 'noindex', headerContext: 'public', status: 'live', phase: 2, scaffoldPhase: null },
  { id: 'R29', kind: 'error', key: null, paths: null, from: null, pageType: 'error', preset: null, rendering: 'static', robots: 'noindex', headerContext: 'public', status: 'live', phase: 2, scaffoldPhase: null },
  { id: 'R30', kind: 'redirect', key: null, paths: null, from: '/', pageType: null, preset: null, rendering: 'redirect', robots: 'noindex', headerContext: 'public', status: 'live', phase: 2, scaffoldPhase: null },
  { id: 'R31', kind: 'redirect', key: null, paths: null, from: '/nr/[nummer]', pageType: null, preset: null, rendering: 'redirect', robots: 'noindex', headerContext: 'public', status: 'live', phase: 3, scaffoldPhase: null },
]

/** Die sieben rechtlichen Kurz-URLs (RECHT R-010, KONZEPT §2.4) → 308 auf die kanonische DE-Route. */
export const shortLinks: readonly { path: string; routeId: string }[] = [
  { path: '/impressum', routeId: 'R21' },
  { path: '/datenschutz', routeId: 'R22' },
  { path: '/agb', routeId: 'R23' },
  { path: '/widerrufsbelehrung', routeId: 'R24' },
  { path: '/versand', routeId: 'R25' },
  { path: '/vertrag-widerrufen', routeId: 'R26' },
  { path: '/widerruf', routeId: 'R26' },
]

/** Feste Varianten mit Sprachpräfix (ARCHITEKTUR §2.3) → 308 auf die Route dieser Sprache. */
export const aliases: readonly { path: string; locale: Locale; routeId: string }[] = [
  { path: '/en/imprint', locale: 'en', routeId: 'R21' },
  { path: '/en/impressum', locale: 'en', routeId: 'R21' },
]
