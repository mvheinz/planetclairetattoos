// Seiten der Vorschau-Datei (KONZEPT §12.4/§12.5 Nr. 1, 3–7; ARCHITEKTUR §14.5) mit `cheerio`: Aus jedem `<body>` werden
// alle `<script>` (auch `self.__next_f`-Daten und JSON), Preloads, `<noscript>` und der Next-Routen-Ansager entfernt;
// `data-behavior`, ARIA-Attribute und `id`s bleiben. Bilder → `data-pv-src`, Sprite-Verweise → `#id`, Links → Hash-Routen,
// Formulare ohne `action` und ohne Server-Action-Felder mit `data-pv-form`. Ergebnis je Route: ein `<template data-route …>`.
import * as cheerio from 'cheerio'

import { matchRoute, splitLocale } from '../../../src/lib/routes/paths'
import { ROUTES, type Locale, type PublicPageType } from '../../../src/lib/routes/registry'
import { cssUrls, resolveAssetPath } from '../crawl'

import type { EncodedImage } from './images'
import { rewriteHref, type LinkContext } from './links'
import { spriteUseTarget } from './svg'

/** Anzeige-Adresse der echten Website für Textstellen, die die Export-Adresse nennen. */
export const PUBLIC_ORIGIN = 'https://planetclairetattoos.com'

export type RouteGroup = 'start' | 'shop' | 'tattoo' | 'service' | 'legal' | 'admin'
export const ROUTE_GROUPS: readonly RouteGroup[] = [
  'start',
  'shop',
  'tattoo',
  'service',
  'legal',
  'admin',
]

const GROUP_BY_TYPE: Record<PublicPageType, RouteGroup> = {
  home: 'start',
  about: 'start',
  notFound: 'start',
  error: 'start',
  shop: 'shop',
  category: 'shop',
  product: 'shop',
  archive: 'shop',
  cart: 'shop',
  checkout: 'shop',
  thankYou: 'shop',
  orderStatus: 'shop',
  commissions: 'shop',
  tattoo: 'tattoo',
  contact: 'service',
  withdrawal: 'service',
  legal: 'legal',
  conformity: 'legal',
}

/** Gruppe der Liste „Alle Seiten“ (Start, Shop, Tattoo, Service, Recht, Verwaltung). */
export function groupForPageType(type: PublicPageType | null | undefined): RouteGroup {
  return type ? GROUP_BY_TYPE[type] : 'start'
}

/** Registry-Treffer einer exportierten Route (`/de/impressum` → R21); 404-Seiten → R28. */
export function routeInfo(route: string): {
  id: string
  pageType: PublicPageType | null
  leashKey: string
} {
  const pathOnly = route.split('?')[0]!
  const split = splitLocale(pathOnly)
  const match = split ? matchRoute(split.rest, split.locale) : null
  if (!match) {
    const r28 = ROUTES.find((r) => r.id === 'R28')!
    return { id: 'R28', pageType: r28.pageType, leashKey: 'R28' }
  }
  // Wie `leashRouteKey` in `src/components/leash/LeashLayer.tsx`: Routen-ID plus sprachunabhängige Parameter.
  const params = Object.entries(match.params)
    .filter(([k]) => k !== 'slug')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return {
    id: match.route.id,
    pageType: match.route.pageType,
    leashKey: [match.route.id, ...params].join('/'),
  }
}

/** Stylesheet-Pfade einer Seite (Reihenfolge im Dokument). */
export function pageStylesheets(html: string, pagePath: string): string[] {
  const $ = cheerio.load(html)
  const out: string[] = []
  $('link[rel~="stylesheet"][href]').each((_, el) => {
    const p = resolveAssetPath($(el).attr('href')!, pagePath)
    if (p) out.push(p)
  })
  return out
}

export interface PageMeta {
  title: string
  description: string
  htmlClass: string
  bodyAttrs: Record<string, string>
}

export interface TransformContext {
  link: LinkContext
  /** Kodierte Bilder nach Pfad (auch SVG). */
  images: ReadonlyMap<string, EncodedImage>
  /** Pfade der eingebetteten Sprite-Dateien. */
  sprites: ReadonlySet<string>
  warnings: string[]
}

export interface TransformedPage extends PageMeta {
  route: string
  lang: Locale | 'auto'
  group: RouteGroup
  leashKey: string
  /** Inhalt des `<body>` nach der Umwandlung. */
  body: string
}

/** Entfernt alles, was in der Einzeldatei nichts zu suchen hat. */
export function stripFramework($: cheerio.CheerioAPI): void {
  $('script, noscript, next-route-announcer, template').remove()
  $('link').remove()
  // App-Banner (KONZEPT §3.0.4) – die Vorschau-Datei hat ihr eigenes Banner (§12.5 Nr. 8).
  $('[data-preview-banner]').remove()
  // Leere Suspense-Hüllen von React (`<div hidden><!--$--><!--/$--></div>`) und Kommentare.
  $('body > div[hidden]').each((_, el) => {
    if ($(el).text().trim() === '' && $(el).children().length === 0) $(el).remove()
  })
  $('*')
    .contents()
    .filter((_, n) => n.type === 'comment')
    .remove()
}

function rewriteImages($: cheerio.CheerioAPI, ctx: TransformContext, pagePath: string): void {
  $('picture source').remove()
  $('img').each((_, node) => {
    const el = $(node)
    const src = el.attr('src')
    const path = src ? resolveAssetPath(src, pagePath) : null
    const img = path ? ctx.images.get(path) : undefined
    el.removeAttr('src').removeAttr('srcset').removeAttr('sizes').removeAttr('fetchpriority')
    if (!img) {
      ctx.warnings.push(`Bild ${src ?? '(ohne src)'} auf ${pagePath} fehlt – leer eingebettet.`)
      el.attr('data-pv-src', 'missing')
      return
    }
    el.attr('data-pv-src', img.hash)
    if (!el.attr('width') || !el.attr('height')) {
      el.attr('width', String(img.width))
      el.attr('height', String(img.height))
    }
    if (el.attr('alt') === undefined) el.attr('alt', '')
    el.attr('loading', 'lazy')
    el.attr('decoding', 'async')
  })
  $('[style*="url("]').each((_, node) => {
    const el = $(node)
    let style = el.attr('style') ?? ''
    for (const u of cssUrls(style)) {
      const p = resolveAssetPath(u, pagePath)
      const img = p ? ctx.images.get(p) : undefined
      style = style.split(u).join(img ? img.dataUri : 'data:,')
    }
    el.attr('style', style)
  })
}

function rewriteSprites($: cheerio.CheerioAPI, ctx: TransformContext, pagePath: string): void {
  $('use').each((_, node) => {
    const el = $(node)
    // `data-href` (Coco im geschlossenen Menü, `Coco deferSprite`) bleibt `data-href`; das Menü-Modul setzt `href`.
    const deferred = el.attr('href') === undefined && el.attr('xlink:href') === undefined
    const href = el.attr('href') ?? el.attr('xlink:href') ?? el.attr('data-href')
    if (!href || href.startsWith('#')) return
    const target = spriteUseTarget(href)
    const file = target ? resolveAssetPath(target.file, pagePath) : null
    if (!target || !file || !ctx.sprites.has(file)) {
      ctx.warnings.push(`<use href="${href}"> auf ${pagePath} ohne eingebettetes Sprite.`)
      return
    }
    el.removeAttr('xlink:href')
    el.attr(deferred ? 'data-href' : 'href', `#${target.id}`)
  })
}

/** Links, Formulare und Knöpfe (KONZEPT §12.5 Nr. 5 und 7). */
export function rewriteInteractive($: cheerio.CheerioAPI, link: LinkContext): void {
  $('a[href]').each((_, node) => {
    const el = $(node)
    const res = rewriteHref(el.attr('href')!, link)
    el.attr('href', res.href)
    if (res.kind === 'external') {
      el.attr('target', '_blank')
      el.attr('rel', 'noopener noreferrer')
    }
  })
  $('form').each((_, node) => {
    const el = $(node)
    el.removeAttr('action').removeAttr('method')
    el.attr('data-pv-form', '')
    // Server-Action-Felder von React (`$ACTION_ID_…`, `$ACTION_REF_…`, `$ACTION_KEY`, `$ACTION_1:0` …) und Formular-Tokens
    // (`formToken`) sind Server-Spuren ohne Funktion in der Datei; Tokens tragen Zeitstempel und Zufallswert und machen
    // sonst jeden Lauf anders (AK-A-14-01/AK-A-14-02).
    el.find('input[type="hidden"]').each((_, input) => {
      const name = $(input).attr('name') ?? ''
      if (name.startsWith('$ACTION') || name === 'formToken') $(input).remove()
    })
  })
  $('button[formaction], input[formaction]').removeAttr('formaction')
}

/** Startwert des Demo-Countdowns in der Vorschau (Verhaltensmodul `reservation-countdown`, Modus `preview`). */
export const PREVIEW_COUNTDOWN_TEXT = '30:00'

/**
 * Countdown der Reservierung (KO-15; KONZEPT §12.5 Nr. 7): In der Vorschau läuft er als Demo ab 30:00. Die echten
 * Zeitpunkte des Export-Laufs (`data-expires-at`, `data-server-now`) und die Restzeit beim Rendern fallen weg, damit zwei
 * Läufe am selben Tag byte-gleich bleiben (AK-A-14-01) und nichts auf eine echte Reservierung verweist.
 */
export function normalizeCountdowns($: cheerio.CheerioAPI): void {
  $('[data-countdown]').each((_, node) => {
    const el = $(node)
    el.removeAttr('data-expires-at').removeAttr('data-server-now').attr('data-level', 'normal')
    const template = el.attr('data-time-template')
    el.find('[data-countdown-time]').text(
      template ? template.replace('{time}', PREVIEW_COUNTDOWN_TEXT) : PREVIEW_COUNTDOWN_TEXT,
    )
    el.find('[data-countdown-text]').removeAttr('hidden')
    el.find('[data-countdown-expired]').attr('hidden', '')
  })
}

/**
 * Bestellknopf der Kasse (KONZEPT §12.5 Nr. 7): In der Datei zeigt ein Klick immer den Vorschau-Dialog – auch wenn der
 * Knopf auf der echten Seite noch gesperrt wäre (z. B. bis zur Bestätigung einer Abweichung). `data-pv-block` fängt den
 * Klick vor der Formularprüfung des Browsers ab.
 */
export function openOrderButtons($: cheerio.CheerioAPI): void {
  $('[data-order-button]')
    .removeAttr('disabled')
    .removeAttr('aria-disabled')
    .attr('data-pv-block', '')
}

/** Titel, Beschreibung, `<html class>` und `<body>`-Attribute einer erfassten Seite. */
export function pageMeta($: cheerio.CheerioAPI): PageMeta {
  const bodyAttrs: Record<string, string> = {}
  for (const [k, v] of Object.entries($('body').attr() ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    bodyAttrs[k] = v
  return {
    title: $('head > title').first().text().trim(),
    description: $('head > meta[name="description"]').attr('content')?.trim() ?? '',
    htmlClass: $('html').attr('class') ?? '',
    bodyAttrs,
  }
}

/** Wandelt eine erfasste Seite in ein Template um. */
export function transformPage(
  page: { path: string; lang: Locale; html: string },
  ctx: TransformContext,
): TransformedPage {
  const $ = cheerio.load(page.html)
  const meta = pageMeta($)
  const info = routeInfo(page.path)
  stripFramework($)
  rewriteImages($, ctx, page.path)
  rewriteSprites($, ctx, page.path)
  rewriteInteractive($, { ...ctx.link, currentRoute: page.path })
  normalizeCountdowns($)
  openOrderButtons($)
  return {
    ...meta,
    route: page.path,
    lang: page.lang,
    group: groupForPageType(info.pageType),
    leashKey: info.leashKey,
    // Reste der Export-Adresse in Texten (z. B. „…/vertrag-widerrufen“ als Platzhalter-Text) zeigen die echte Domain.
    body: ($('body').html() ?? '').trim().split(ctx.link.origin).join(PUBLIC_ORIGIN),
  }
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** `<template data-route …>` einer Seite (Attribute in fester Reihenfolge). */
export function templateHtml(page: TransformedPage): string {
  const attrs: [string, string][] = [
    ['data-route', page.route],
    ['data-lang', page.lang],
    ['data-title', page.title],
    ['data-description', page.description],
    ['data-group', page.group],
    ['data-leash-key', page.leashKey],
    ['data-body', JSON.stringify(page.bodyAttrs)],
  ]
  return `<template ${attrs.map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')}>${page.body}</template>`
}
