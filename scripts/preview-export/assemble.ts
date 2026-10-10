// Umwandlung des Crawl-Ergebnisses in die Einzeldatei (ARCHITEKTUR §14.5/§14.6): Bilder kodieren, CSS zusammenführen,
// Sprites einbetten, Seiten in Templates umwandeln, Zusatzseiten `#/vorschau/nicht-enthalten` und
// `#/vorschau/verwaltung` (DE/EN) erzeugen, `#pv-data` und `#pv-assets` füllen. Ergebnis ist ein String plus
// Größen je Art für den Bericht (§14.8). Rein bis auf die Bildkodierung (`sharp`).
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import * as cheerio from 'cheerio'

import cocoExtra from '../../src/art/coco/coco-extra-anchors.json'
import { localizedPath } from '../../src/lib/routes/paths'
import { LOCALES, ROUTES, type Locale } from '../../src/lib/routes/registry'
import { formatBerlin } from '../../src/lib/time'
import type { PvData, PvGroup, PvRoute, PvTexts } from '../../src/preview-runtime/types'

import type { CrawlResult } from './crawl'
import { cleanCss, inlineCssUrls, mergeCss, orderStylesheets } from './transform/css'
import { fontDataUri, isFont } from './transform/fonts'
import {
  groupForPageType,
  pageStylesheets,
  templateHtml,
  transformPage,
  type TransformedPage,
} from './transform/html'
import { encodeImages, type ImageSettings } from './transform/images'
import { ADMIN_PREVIEW_ROUTE, NOT_INCLUDED_ROUTE, type LinkContext } from './transform/links'
import { buildSpriteSheet, spriteUseTarget } from './transform/svg'
import { buildDocument } from './write'

/** Texte `previewExport.*` einer Sprache (Ausschnitt aus `src/i18n/messages/<lang>.json`). */
export interface PreviewMessages extends PvTexts {
  notIncluded: { title: string; titleShort: string; text: string; back: string }
  admin: { title: string; titleShort: string; intro: string; comingIn: string }
}

export interface AdminShotEntry {
  key: string
  caption: Record<Locale, string>
  /** Phase, ab der die Ansicht existiert (z. B. 5). */
  phase: number
  /** WebP-Bild (Data-URI) oder `null`, wenn die Ansicht noch nicht gebaut ist. */
  image: { dataUri: string; hash: string; width: number; height: number } | null
}

export interface AssembleInput {
  crawl: CrawlResult
  messages: Record<Locale, PreviewMessages>
  /** Anzeige-Phase, z. B. `P2`. */
  phase: string
  /** `SEED_NOW` des Exports (Stand-Datum). */
  seedNow: string
  imageSettings: ImageSettings
  runtime: string
  origin: string
  adminShots?: AdminShotEntry[]
  /** Bestand der Datei (U-76); Standard `demo` (Seed-Anker). */
  inventory?: 'bestand' | 'demo'
}

export interface SizeByKind {
  images: number
  fonts: number
  css: number
  runtime: number
  templates: number
  adminShots: number
}

export interface AssembledRoute {
  route: string
  lang: Locale
  title: string
  status: 'ok' | 'not-built'
  bytes: number
  note?: string
}

export interface Assembled {
  html: string
  sizeByKind: SizeByKind
  routes: AssembledRoute[]
  warnings: string[]
}

const byteLen = (s: string) => Buffer.byteLength(s)

/** Zusatzseite auf Basis der (umgewandelten) Startseite derselben Sprache: Kopf und Fuß bleiben, `<main>` neu. */
export function specialPage(
  base: TransformedPage,
  route: string,
  title: string,
  mainHtml: string,
): TransformedPage {
  const $ = cheerio.load(base.body, null, false)
  const main = $('main').first()
  main.empty().append(`<div class="u-container pv-page">${mainHtml}</div>`)
  // Ruhige Linie (Unterstreichung der H1) statt der Reise der Startseite; keine Coco an der Leine.
  $('[data-leash-coco]').remove()
  $('[data-leash-layer]').attr('data-leash-preset', 'calm')
  return {
    ...base,
    route,
    title,
    description: '',
    group: route === ADMIN_PREVIEW_ROUTE ? 'admin' : 'service',
    leashKey: `preview${route}`,
    bodyAttrs: { 'data-preset': 'calm' },
    body: $.html(),
  }
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function adminMain(lang: Locale, m: PreviewMessages, shots: AdminShotEntry[]): string {
  const items = shots.map((s) => {
    const caption = esc(s.caption[lang])
    if (!s.image) {
      const coming = esc(m.admin.comingIn.replace('{phase}', `P${s.phase}`))
      return `<li class="pv-admin__missing" data-admin-view="${esc(s.key)}"><strong>${caption}</strong> – ${coming}</li>`
    }
    return `<li data-admin-view="${esc(s.key)}"><figure><img data-pv-src="${s.image.hash}" width="${s.image.width}" height="${s.image.height}" alt="${caption}" loading="lazy" decoding="async"><figcaption>${caption}</figcaption></figure></li>`
  })
  return `<h1>${esc(m.admin.title)}</h1><p>${esc(m.admin.intro)}</p><ul class="pv-admin">${items.join('')}</ul>`
}

function notIncludedMain(lang: Locale, m: PreviewMessages): string {
  return `<h1>${esc(m.notIncluded.title)}</h1><p>${esc(m.notIncluded.text)}</p><p><a href="#/${lang}">${esc(m.notIncluded.back)}</a></p>`
}

/** Anzeige-Datum „Stand …“ je Sprache aus `SEED_NOW`. */
export function standDate(seedNow: string): Record<Locale, string> {
  const d = new Date(seedNow)
  return { de: formatBerlin(d, 'dd.MM.yyyy', 'de'), en: formatBerlin(d, 'd MMMM yyyy', 'en') }
}

export async function assemble(input: AssembleInput): Promise<Assembled> {
  const { crawl } = input
  const warnings: string[] = []
  const assets = [...crawl.assets.values()]

  // Sprites: SVG-Dateien, auf die `<use href="…svg#id">` (oder `data-href`, `Coco deferSprite`) zeigt.
  const spritePaths = new Set<string>()
  for (const page of crawl.pages) {
    const $ = cheerio.load(page.html)
    $('use').each((_, el) => {
      const href = $(el).attr('href') ?? $(el).attr('xlink:href') ?? $(el).attr('data-href') ?? ''
      const t = spriteUseTarget(href)
      if (t) spritePaths.add(new URL(t.file, `http://x${page.path}`).pathname)
    })
  }
  // Zusatz-Posen von Coco (Warte-Aktionen, P12.4) lädt die Seite erst zur Laufzeit nach – im Vorschau-Dokument müssen
  // ihre Symbole von Anfang an im Sprite-Blatt liegen (sonst verschwindet Coco bei der ersten Aktion).
  const lazySprites: { path: string; svg: string }[] = []
  for (const href of [cocoExtra.href]) {
    if (spritePaths.has(href)) continue
    const file = path.join(process.cwd(), 'public', href)
    lazySprites.push({ path: href, svg: await readFile(file, 'utf8') })
  }
  const sprites = buildSpriteSheet([
    ...assets
      .filter((a) => spritePaths.has(a.path))
      .map((a) => ({ path: a.path, svg: a.body.toString('utf8') })),
    ...lazySprites,
  ])

  // Bilder (inkl. SVG-Bilder und Bilder aus CSS), Schriften.
  const imageInputs = assets.filter(
    (a) => a.contentType.startsWith('image/') && !spritePaths.has(a.path),
  )
  const { byPath: images, assets: imageAssets } = await encodeImages(
    imageInputs,
    input.imageSettings,
  )
  const fonts = new Map<string, string>()
  for (const a of assets)
    if (isFont(a.contentType, a.path)) fonts.set(a.path, fontDataUri(a.body, a.contentType, a.path))

  // CSS in Reihenfolge des ersten Auftretens.
  let fontBytes = 0
  let cssImageBytes = 0
  const usedFonts = new Set<string>()
  const sheetOrder = orderStylesheets(crawl.pages.map((p) => pageStylesheets(p.html, p.path)))
  const sources = sheetOrder.flatMap((p) => {
    const asset = crawl.assets.get(p)
    if (!asset) {
      warnings.push(`Stylesheet ${p} fehlt.`)
      return []
    }
    const css = inlineCssUrls(
      cleanCss(asset.body.toString('utf8'), p),
      p,
      (ref) => {
        const font = fonts.get(ref)
        if (font) {
          if (!usedFonts.has(ref)) {
            usedFonts.add(ref)
            fontBytes += font.length
          }
          return font
        }
        const img = images.get(ref)
        if (img) {
          cssImageBytes += img.dataUri.length
          return img.dataUri
        }
        return null
      },
      warnings,
    )
    return [{ path: p, css }]
  })
  const css = mergeCss(sources)

  // Seiten.
  const exported = new Set<string>([
    ...crawl.pages.map((p) => p.path),
    NOT_INCLUDED_ROUTE,
    ADMIN_PREVIEW_ROUTE,
  ])
  const link: LinkContext = {
    currentRoute: '/de',
    exported,
    redirects: crawl.redirects,
    origin: input.origin,
  }
  const pages = crawl.pages.map((p) =>
    transformPage(p, { link, images, sprites: spritePaths, warnings }),
  )
  const htmlClass = pages[0]?.htmlClass ?? ''
  for (const p of pages)
    if (p.htmlClass !== htmlClass) warnings.push(`Seite ${p.route}: abweichende <html class>.`)

  // Zusatzseiten je Sprache (Kopf und Fuß der Startseite).
  const shots = input.adminShots ?? []
  const extra: TransformedPage[] = []
  for (const lang of LOCALES) {
    const home = pages.find((p) => p.route === `/${lang}`)
    if (!home) {
      warnings.push(`Startseite /${lang} fehlt – Zusatzseiten ${lang} ohne Kopf/Fuß.`)
      continue
    }
    const m = input.messages[lang]
    const siteName = home.title.split(/ [–·] /)[0] || 'Planet Claire'
    const nb = specialPage(
      home,
      NOT_INCLUDED_ROUTE,
      `${m.notIncluded.titleShort} · ${siteName}`,
      notIncludedMain(lang, m),
    )
    const ad = specialPage(
      home,
      ADMIN_PREVIEW_ROUTE,
      `${m.admin.titleShort} · ${siteName}`,
      adminMain(lang, m, shots),
    )
    extra.push(
      { ...nb, body: rewriteSpecialLinks(nb.body, NOT_INCLUDED_ROUTE) },
      { ...ad, body: rewriteSpecialLinks(ad.body, ADMIN_PREVIEW_ROUTE) },
    )
  }
  const allPages = [...pages, ...extra]

  // Nicht gebaute Registry-Routen (für „Alle Seiten“ und den Bericht).
  const inventory = input.inventory ?? 'demo'
  const notBuilt = notBuiltRoutes(crawl, { inventory })
  const routes: PvRoute[] = [
    ...allPages.map((p) => ({
      route: p.route,
      lang: p.lang as Locale,
      title: p.title,
      group: p.group as PvGroup,
      built: true,
    })),
    // Danke- und Statusseiten ohne Beispiel-Bestellungen (echter Bestand) nicht als „Noch nicht gebaut“ zeigen –
    // sie sind gebaut, nur in dieser Datei nicht enthalten; der Bericht nennt sie mit Hinweis.
    ...notBuilt
      .filter((r) => r.note !== BESTAND_TOKEN_PAGES_NOTE)
      .map(({ note: _note, ...r }) => ({ ...r, built: false })),
  ]

  const data: PvData = {
    phase: input.phase,
    date: standDate(input.seedNow),
    texts: {
      de: pickTexts(input.messages.de),
      en: pickTexts(input.messages.en),
    },
    routes,
  }

  const templates = allPages.map(templateHtml)
  // Nur Bilder, auf die eine Seite verweist (`data-pv-src`): `srcset`-Kandidaten werden mitgeladen, die Vorschau nutzt
  // aber nur `src` – ungenutzte Größen würden die Datei aufblähen (und ihren Inhalt vom Bildbestand abhängig machen).
  const referenced = new Set<string>()
  for (const t of templates)
    for (const m of t.matchAll(/data-pv-src="([0-9a-f]+)"/g)) referenced.add(m[1]!)
  const assetTable = new Map([...imageAssets].filter(([hash]) => referenced.has(hash)))
  let adminBytes = 0
  for (const s of shots) {
    if (!s.image || assetTable.has(s.image.hash)) continue
    assetTable.set(s.image.hash, s.image.dataUri)
    adminBytes += s.image.dataUri.length
  }
  const html = buildDocument({
    htmlClass,
    title: 'Planet Claire – Vorschau',
    css,
    sprites,
    templates,
    data,
    assets: assetTable,
    runtime: input.runtime,
  })

  let imageBytes = cssImageBytes
  for (const [hash, v] of imageAssets) if (referenced.has(hash)) imageBytes += v.length
  const templateBytes = templates.reduce((n, t) => n + byteLen(t), 0) + byteLen(sprites)
  const sizeByKind: SizeByKind = {
    images: imageBytes,
    fonts: fontBytes,
    css: Math.max(0, byteLen(css) - fontBytes - cssImageBytes),
    runtime: byteLen(input.runtime),
    templates: templateBytes,
    adminShots: adminBytes,
  }
  const reportRoutes: AssembledRoute[] = [
    ...allPages.map((p, i) => ({
      route: p.route,
      lang: p.lang as Locale,
      title: p.title,
      status: 'ok' as const,
      bytes: byteLen(templates[i]!),
    })),
    ...notBuilt.map((r) => ({ ...r, status: 'not-built' as const, bytes: 0 })),
  ]
  return { html, sizeByKind, routes: reportRoutes, warnings }
}

function rewriteSpecialLinks(body: string, route: string): string {
  // Seiten-Anker der Kopf-/Fußbereiche zeigen noch auf die Startseite – auf die Zusatzseite umbiegen.
  const $ = cheerio.load(body, null, false)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = /^#\/(de|en)#(.+)$/.exec(href)
    if (m) $(el).attr('href', `#${route}#${m[2]}`)
  })
  return $.html()
}

function pickTexts(m: PreviewMessages): PvTexts {
  return {
    bannerInternal: m.bannerInternal,
    bannerStand: m.bannerStand,
    allPages: m.allPages,
    notBuilt: m.notBuilt,
    dialogTitle: m.dialogTitle,
    dialogClose: m.dialogClose,
    cartDemo: m.cartDemo,
    groups: m.groups,
  }
}

/** Hinweis im Bericht für Danke- und Statusseiten, solange die Seed-Anker fehlen (PLAN P4.25, P8.4). */
export const TOKEN_PAGES_NOTE = 'ab P8 (Seed-Anker der Kassen und Bestellungen, P8.4)'
/** Hinweis im Bericht für Danke- und Statusseiten in der Datei mit echtem Bestand (U-76, P16.3). */
export const BESTAND_TOKEN_PAGES_NOTE =
  'nicht in der Datei mit echtem Bestand (brauchen Beispiel-Bestellungen; PREVIEW_INVENTORY=demo)'

/** Registry-Routen ohne Template: `planned` und beim Crawl mit 404 beantwortete (je Sprache). */
export function notBuiltRoutes(
  crawl: Pick<CrawlResult, 'pages' | 'notBuilt'>,
  options: { inventory?: 'bestand' | 'demo' } = {},
): { route: string; lang: Locale; title: string; group: PvGroup; note?: string }[] {
  const bestand = options.inventory === 'bestand'
  const out: { route: string; lang: Locale; title: string; group: PvGroup; note?: string }[] = []
  const builtIds = new Set<string>()
  for (const p of crawl.pages) if (p.routeId) builtIds.add(`${p.routeId}:${p.lang}`)
  const seen = new Set<string>()
  for (const r of ROUTES) {
    if (r.kind !== 'page' || !r.paths) continue
    for (const lang of LOCALES) {
      const hasParams = r.paths[lang].includes('[')
      const route = hasParams ? `/${lang}${r.paths[lang]}` : localizedPath(r.id, lang)
      const failed = crawl.notBuilt.some((n) => n.routeId === r.id && n.lang === lang)
      const token = r.pageType === 'thankYou' || r.pageType === 'orderStatus'
      // Echter Bestand: Danke-/Statusseiten haben keine Start-Einträge – trotzdem im Bericht nennen.
      const missingToken = bestand && token && r.status !== 'planned'
      if (r.status !== 'planned' && !failed && !missingToken) continue
      if (builtIds.has(`${r.id}:${lang}`) && !failed) continue
      if (seen.has(route)) continue
      seen.add(route)
      const note = missingToken ? BESTAND_TOKEN_PAGES_NOTE : TOKEN_PAGES_NOTE
      out.push({
        route,
        lang,
        title: `${r.id} ${route}`,
        group: groupForPageType(r.pageType),
        ...(token && r.status !== 'planned' ? { note } : {}),
      })
    }
  }
  return out
}
