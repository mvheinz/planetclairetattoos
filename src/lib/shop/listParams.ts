// Listen-Parameter und statische Varianten (ARCHITEKTUR §9.1, Spike B-05; KONZEPT §2.3). Reines Modul ohne
// Framework- und Payload-Importe und ohne Pfad-Aliasse: Der Proxy (`src/proxy.ts`) nutzt es ohne Datenbank (§9.5).
//
// Der Proxy übersetzt bekannte Query-Parameter in ein internes Pfad-Segment `…/variant/<schlüssel>` (Schlüssel
// alphabetisch, Werte validiert, z. B. `available-1.page-2`); sichtbare und kanonische URL bleibt die Query-Form.
// Unbekannte Parameter werden verworfen, ungültige Werte wie fehlend behandelt.

import {
  LIST_ROUTE_IDS,
  LIST_VARIANT_SEGMENT,
  fillPattern,
  getRoute,
  matchRoute,
  splitLocale,
  type ListRouteId,
} from '../routes/paths'
export { LIST_ROUTE_IDS, LIST_VARIANT_SEGMENT, type ListRouteId }

/**
 * Parameter je Liste (KONZEPT §2.3, §9.2): `available` R02/R03/R12, `category` nur R05, `kind` nur R15 (Galerie
 * `fresh`/`healed`), `page` bei den Shop-Listen (Flash und Galerie zeigen alles auf einer Seite).
 */
export const LIST_PARAMS: Readonly<Record<ListRouteId, readonly ListParamName[]>> = {
  R02: ['available', 'page'],
  R03: ['available', 'page'],
  R05: ['category', 'page'],
  R12: ['available'],
  R15: ['kind'],
}

export type ListParamName = 'available' | 'category' | 'kind' | 'page'

/** Galerie-Filter (R15, `?kind=`). */
export const GALLERY_KINDS = ['fresh', 'healed'] as const
export type GalleryKindParam = (typeof GALLERY_KINDS)[number]

export interface ListParams {
  /** `?available=1`: nur nicht verkaufte Stücke. */
  available?: true
  /** `?category=<slug der Seiten-Sprache>` (nur R05). */
  category?: string
  /** `?kind=fresh|healed` (nur R15). */
  kind?: GalleryKindParam
  /** `?page=n` ab 2 (Seite 1 ist die Grundform ohne Parameter). */
  page?: number
}

/** Höchste zulässige Seitenzahl (Schutz vor beliebig vielen Varianten). */
export const MAX_LIST_PAGE = 999
const PAGE_RE = /^[1-9]\d{0,2}$/
const CATEGORY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATEGORY_MAX = 60

export const isListRouteId = (id: string): id is ListRouteId =>
  (LIST_ROUTE_IDS as readonly string[]).includes(id)

type ParamSource = URLSearchParams | string | Record<string, string | string[] | undefined>

function toSearchParams(source: ParamSource): URLSearchParams {
  if (source instanceof URLSearchParams) return source
  if (typeof source === 'string') return new URLSearchParams(source)
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(source)) {
    for (const item of Array.isArray(v) ? v : v === undefined ? [] : [v]) sp.append(k, item)
  }
  return sp
}

/**
 * Liest die für die Liste `routeId` bekannten Parameter (erster Wert zählt); unbekannte Parameter entfallen,
 * ungültige Werte (`page=0`, `page=abc`, `available=2`, fremde Zeichen im Slug) gelten als fehlend.
 */
export function parseListParams(routeId: ListRouteId, source: ParamSource): ListParams {
  const sp = toSearchParams(source)
  const allowed = LIST_PARAMS[routeId]
  const out: ListParams = {}
  if (allowed.includes('available') && sp.get('available') === '1') out.available = true
  if (allowed.includes('category')) {
    const c = sp.get('category')
    if (c && c.length <= CATEGORY_MAX && CATEGORY_RE.test(c)) out.category = c
  }
  if (allowed.includes('kind')) {
    const k = sp.get('kind')
    if (k && (GALLERY_KINDS as readonly string[]).includes(k)) out.kind = k as GalleryKindParam
  }
  const p = allowed.includes('page') ? sp.get('page') : null
  if (p && PAGE_RE.test(p)) {
    const n = Number(p)
    if (n >= 2 && n <= MAX_LIST_PAGE) out.page = n
  }
  return out
}

/** Varianten-Schlüssel: Schlüssel alphabetisch, `name-wert`, mit `.` verbunden; Grundform → `''`. */
export function variantKey(params: ListParams): string {
  const parts: string[] = []
  if (params.available) parts.push('available-1')
  if (params.category) parts.push(`category-${params.category}`)
  if (params.kind) parts.push(`kind-${params.kind}`)
  if (params.page && params.page >= 2) parts.push(`page-${params.page}`)
  return parts.join('.')
}

/**
 * Umkehrung für die Varianten-Seite: nur kanonische Schlüssel (Reihenfolge, Werte, erlaubte Parameter der Liste)
 * ergeben Parameter, alles andere `null` (→ 404).
 */
export function parseVariantKey(routeId: ListRouteId, key: string): ListParams | null {
  if (!key || key.length > 120) return null
  const sp = new URLSearchParams()
  for (const part of key.split('.')) {
    const dash = part.indexOf('-')
    if (dash < 1) return null
    sp.append(part.slice(0, dash), part.slice(dash + 1))
  }
  const params = parseListParams(routeId, sp)
  return variantKey(params) === key ? params : null
}

/** Kanonische URL einer Liste (KONZEPT §2.3): ohne `available` und `category`, mit `page` erst ab Seite 2. */
export function canonicalListUrl(basePath: string, params: ListParams): string {
  return params.page && params.page >= 2 ? `${basePath}?page=${params.page}` : basePath
}

/** Sichtbare Such-Parameter einer Variante (für Links „Mehr zeigen“, Chips): feste Reihenfolge wie der Schlüssel. */
export function listSearch(params: ListParams): string {
  const sp = new URLSearchParams()
  if (params.available) sp.set('available', '1')
  if (params.category) sp.set('category', params.category)
  if (params.kind) sp.set('kind', params.kind)
  if (params.page && params.page >= 2) sp.set('page', String(params.page))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export type ListVariantDecision =
  | { kind: 'none' }
  /** Interner Pfad (Ordnernamen = EN-Pfade, §2.3) der statischen Variante. */
  | { kind: 'rewrite'; pathname: string; routeId: ListRouteId; key: string }
  /** Direkter Aufruf eines internen Varianten-Pfads → 404 (keine doppelten Inhalte). */
  | { kind: 'not-found' }

const INTERNAL_RE = new RegExp(`^(.*)/${LIST_VARIANT_SEGMENT}(?:/[^/]*)?$`)

/** Ist `pathname` ein interner Varianten-Pfad einer Liste (`/de/shop/variant/page-2`)? */
export function isInternalVariantPath(pathname: string): boolean {
  const split = splitLocale(pathname)
  if (!split) return false
  const m = INTERNAL_RE.exec(split.rest)
  if (!m) return false
  const base = m[1] || '/'
  const match = matchRoute(base, 'en') ?? matchRoute(base, split.locale)
  return !!match && isListRouteId(match.route.id)
}

/**
 * Entscheidung des Proxys für eine Seite mit Sprachpräfix: Liste mit gültigen Parametern → Umschreibung auf die
 * Variante; interner Varianten-Pfad direkt aufgerufen → 404; sonst nichts.
 */
export function decideListVariant(pathname: string, search: string): ListVariantDecision {
  if (isInternalVariantPath(pathname)) return { kind: 'not-found' }
  if (!search || search === '?') return { kind: 'none' }
  const split = splitLocale(pathname)
  if (!split) return { kind: 'none' }
  const match = matchRoute(split.rest, split.locale)
  if (!match || !isListRouteId(match.route.id)) return { kind: 'none' }
  const routeId = match.route.id
  const key = variantKey(parseListParams(routeId, search))
  if (!key) return { kind: 'none' }
  const folder = fillPattern(getRoute(routeId).key!, match.params)
  const base = folder === '/' ? '' : folder
  return {
    kind: 'rewrite',
    pathname: `/${split.locale}${base}/${LIST_VARIANT_SEGMENT}/${key}`,
    routeId,
    key,
  }
}
