// Links in der Vorschau-Datei (KONZEPT §12.5 Nr. 5, ARCHITEKTUR §14.5): interne Links → Hash-Routen
// (`/de/shop?available=1` → `#/de/shop?available=1`, Anker angehängt: `#/de/tattoo/flash#f-012`), Seiten-Anker
// (`#kontakt`) → `#/<aktuelle Route>#kontakt`, nicht exportierte Ziele (API, PDFs, Verwaltung, nicht gebaute Routen) →
// `#/vorschau/nicht-enthalten`. Externe `https:`-Links bleiben (neuer Tab, `rel="noopener"`), `mailto:`/`tel:` bleiben.
import { canonicalPath } from '../crawl'

export const NOT_INCLUDED_ROUTE = '/vorschau/nicht-enthalten'
export const ADMIN_PREVIEW_ROUTE = '/vorschau/verwaltung'

export interface LinkContext {
  /** Route der Seite, auf der der Link steht (für reine Anker). */
  currentRoute: string
  /** Alle Routen, die als Template in der Datei stehen. */
  exported: ReadonlySet<string>
  /** Interne Weiterleitungen aus dem Crawl (Quelle → Ziel). */
  redirects: Readonly<Record<string, string>>
  /** Herkunft des Export-Servers (absolute Links darauf gelten als intern). */
  origin: string
}

export type RewrittenLink =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'keep'; href: string }

const BASE = 'http://export.invalid'
const hashRoute = (route: string, anchor: string) => `#${route}${anchor ? `#${anchor}` : ''}`

/** Ziel eines Links in der Vorschau-Datei. */
export function rewriteHref(href: string, ctx: LinkContext): RewrittenLink {
  const raw = href.trim()
  if (raw === '' || raw === '#') return { kind: 'internal', href: hashRoute(ctx.currentRoute, '') }
  if (raw.startsWith('#/')) return { kind: 'keep', href: raw }
  if (raw.startsWith('#')) {
    return { kind: 'internal', href: hashRoute(ctx.currentRoute, decodeURIComponent(raw.slice(1))) }
  }
  if (/^(mailto|tel):/i.test(raw)) return { kind: 'keep', href: raw }
  let path: string | null = null
  if (raw.startsWith(ctx.origin)) path = raw.slice(ctx.origin.length) || '/'
  else if (raw.startsWith('/') && !raw.startsWith('//')) path = raw
  if (path === null) {
    if (/^https:\/\//i.test(raw)) return { kind: 'external', href: raw }
    return { kind: 'internal', href: `#${NOT_INCLUDED_ROUTE}` }
  }
  const url = new URL(path, BASE)
  const anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : ''
  let route = canonicalPath(url)
  for (let i = 0; i < 5 && ctx.redirects[route]; i++) route = ctx.redirects[route]!
  if (!ctx.exported.has(route)) return { kind: 'internal', href: `#${NOT_INCLUDED_ROUTE}` }
  return { kind: 'internal', href: hashRoute(route, anchor) }
}
