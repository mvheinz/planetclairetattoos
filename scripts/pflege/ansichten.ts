// Ansichten fürs iPad (U-88, PLAN P18.3): zwei PDFs zum Ansehen und Weiterschicken per Mail.
//   pnpm pflege:ansichten [katalog|rundgang|anleitung]
//   → dist/pflege/planet-claire-katalog-<Tag>.pdf   alle noch nicht verkauften Stücke aus content/bestand (Foto, Name,
//                                                   Preis, Maße, Material, Beschreibung; ohne interne Prüfpunkte)
//   → dist/pflege/planet-claire-rundgang-<Tag>.pdf  Bildschirmfotos der wichtigsten Seiten (Handy und großer
//                                                   Bildschirm) aus dist/planet-claire-vorschau.html (vorher
//                                                   `pnpm preview:export`, echter Bestand). Ohne Vorschau-Banner, ohne
//                                                   Tattoo-Galerie; Fotos von Kund:innen (Galerie-Einträge) sind
//                                                   ausgeblendet. Seit P20.2 (V-27) mit Korb und Kasse (deine Stücke aus
//                                                   dem Korb der Vorschau), „Versand & Zahlung“, „Vertrag widerrufen“
//                                                   und Archiv; ohne Fokus-Kasten an der Überschrift und ohne Kaufleiste.
//                                                   Danke- und Statusseite brauchen eine echte Bestellung → Vermerk
//                                                   „ab dem Start sichtbar“.
// Beide offline erzeugt (Chromium von Playwright), Schriften der Seite eingebettet.
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium, type Browser, type BrowserContextOptions } from '@playwright/test'
import sharp from 'sharp'

import { bestandPhotoPath, loadBestand } from '../../src/lib/bestand/schema'
import { berlinDay } from '../../src/lib/pflege/snapshot'
import { localizedPath } from '../../src/lib/routes/paths'

import { CATEGORY_LABEL_DE, catalogFacts, markdownToHtml } from './ansichtenText'

export const ANSICHTEN_OUT = path.join('dist', 'pflege')
const PREVIEW_FILE = path.join('dist', 'planet-claire-vorschau.html')
const PREVIEW_REPORT = path.join('dist', 'planet-claire-vorschau.report.json')

const germanDate = (d: Date) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(d)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function fontFaces(root: string): Promise<string> {
  const font = async (rel: string) =>
    (await readFile(path.join(root, 'node_modules', rel))).toString('base64')
  const spectral = (w: number, style: string) =>
    font(`@fontsource/spectral/files/spectral-latin-${w}-${style}.woff2`)
  return `
@font-face{font-family:Spectral;font-weight:400;font-style:normal;src:url(data:font/woff2;base64,${await spectral(400, 'normal')}) format('woff2')}
@font-face{font-family:Spectral;font-weight:600;font-style:normal;src:url(data:font/woff2;base64,${await spectral(600, 'normal')}) format('woff2')}
@font-face{font-family:Spectral;font-weight:400;font-style:italic;src:url(data:font/woff2;base64,${await spectral(400, 'italic')}) format('woff2')}
@font-face{font-family:Bricolage;font-weight:200 800;src:url(data:font/woff2;base64,${await font('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2')}) format('woff2-variations')}`
}

const BASE_CSS = `
:root{--ink:#1C1A17;--ink-2:#4B463F;--paper:#FFFFFF;--line:#C9CBB0;--accent:#8a2e2e}
*{box-sizing:border-box}
html,body{margin:0;background:var(--paper);color:var(--ink);font:10.5pt/1.45 Bricolage,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3{font-family:Spectral,Georgia,serif;font-weight:600;margin:0}
.muted{color:var(--ink-2)}
`

async function renderPdf(
  browser: Browser,
  html: string,
  out: string,
  footer: string,
): Promise<void> {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font:8px sans-serif;color:#4B463F;width:100%;padding:0 12mm;display:flex;justify-content:space-between"><span>${escapeHtml(footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  })
  await page.close()
}

export async function katalog(root: string, browser: Browser, now: Date): Promise<string> {
  const products = (await loadBestand(root))
    .filter((p) => !p.sold)
    .sort((a, b) => a.itemNumber - b.itemNumber)
  const base = JSON.parse(
    await readFile(path.join(root, 'content/seed/data/base.json'), 'utf8'),
  ) as {
    settings: { business: { tradeName: string; legalName: string; city: string; email: string } }
  }
  const tagline = (
    JSON.parse(await readFile(path.join(root, 'src/globals/siteTexts.defaults.json'), 'utf8')) as {
      footer: { tagline: { de: string } }
    }
  ).footer.tagline.de
  const cards: string[] = []
  for (const p of products) {
    const img = await sharp(await readFile(bestandPhotoPath(root, p.images[0]!.file)))
      .resize(600, 500, { fit: 'cover' })
      .jpeg({ quality: 74, mozjpeg: true })
      .toBuffer()
    const f = catalogFacts(p)
    cards.push(`<article>
<img src="data:image/jpeg;base64,${img.toString('base64')}" alt="${escapeHtml(p.images[0]!.alt.de)}">
<div class="meta"><span class="nr">Nr. ${p.itemNumber}</span><span class="cat">${escapeHtml(CATEGORY_LABEL_DE[p.category] ?? p.category)}</span></div>
<h2>${escapeHtml(p.title.de)}</h2>
<p class="price">${escapeHtml(f.price)}</p>
<p class="facts">${f.facts.map(escapeHtml).join(' · ')}</p>
<p class="desc">${escapeHtml(f.description)}</p>
</article>`)
  }
  const b = base.settings.business
  const stand = germanDate(now)
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Planet Claire – Katalog</title><style>
${await fontFaces(root)}
${BASE_CSS}
.cover{padding:0 0 4mm;border-bottom:1.5px solid var(--ink);margin-bottom:5mm}
.cover h1{font-size:28pt;line-height:1.05}
.cover .claim{font-family:Spectral,serif;font-style:italic;font-size:13pt;margin:2mm 0 3mm}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm 8mm}
article{break-inside:avoid;page-break-inside:avoid}
article img{width:100%;aspect-ratio:6/5;object-fit:cover;border-radius:3px;display:block;background:#ddd}
.meta{display:flex;justify-content:space-between;margin-top:2mm;font-size:8.5pt;color:var(--ink-2);letter-spacing:.03em;text-transform:uppercase}
.nr{color:var(--accent);font-weight:600}
article h2{font-size:13pt;line-height:1.2;margin:1mm 0}
.price{font-weight:700;margin:0 0 1mm}
.facts{font-size:9pt;color:var(--ink-2);margin:0 0 1mm}
.desc{font-size:9pt;margin:0}
.end{margin-top:8mm;font-size:9pt;color:var(--ink-2)}
</style></head><body>
<header class="cover"><h1>${escapeHtml(b.tradeName)}</h1><p class="claim">${escapeHtml(tagline)}</p>
<p class="muted">Katalog · Stand ${stand} · ${products.length} Stücke · Preise zzgl. Versand, Abholung in ${escapeHtml(b.city)} nach Absprache</p></header>
<section class="grid">${cards.join('\n')}</section>
<p class="end">${escapeHtml(b.tradeName)} · ${escapeHtml(b.legalName)} · ${escapeHtml(b.city)} · ${escapeHtml(b.email)} · planetclairetattoos.com</p>
</body></html>`
  const out = path.join(root, ANSICHTEN_OUT, `planet-claire-katalog-${berlinDay(now)}.pdf`)
  await renderPdf(browser, html, out, `${b.tradeName} · Katalog · Stand ${stand}`)
  return out
}

export interface RundgangRoute {
  route: string
  title: string
}

/**
 * Seiten des Rundgangs (ohne Tattoo-Galerie: Fotos von Kund:innen). Korb und Kasse zeigen die Stücke, die der Vorschau-
 * Export wie eine Kundin in den Korb legt – mit echtem Bestand deine Stücke (U-76, `cartAnchors`); V-27 (P20.2).
 */
export const RUNDGANG_ROUTES: readonly RundgangRoute[] = [
  { route: '/de', title: 'Startseite' },
  { route: '/de/shop', title: 'Shop' },
  { route: '/de/shop/kategorie/keramik', title: 'Shop – Keramik' },
  { route: 'PRODUCT', title: 'Ein Stück' },
  { route: localizedPath('R06', 'de'), title: 'Korb' },
  { route: localizedPath('R07', 'de'), title: 'Kasse' },
  { route: localizedPath('R25', 'de'), title: 'Versand & Zahlung' },
  { route: localizedPath('R26', 'de'), title: 'Vertrag widerrufen' },
  { route: localizedPath('R05', 'de'), title: 'Archiv' },
  { route: '/de/tattoo', title: 'Tattoo' },
  { route: '/de/tattoo/flash', title: 'Tattoo – Flash' },
  { route: '/de/auftragsarbeiten', title: 'Auftragsarbeiten' },
  { route: '/de/ueber-mich', title: 'Jutta & Coco' },
  { route: '/de/kontakt', title: 'Kontakt' },
]

/** Pfad-Anfang einer Seite mit Token (Danke- bzw. Statusseite), z. B. `/de/danke/`. */
const tokenPrefix = (id: 'R08' | 'R09') => localizedPath(id, 'de', { token: 'T' }).replace(/T$/, '')

/**
 * Seiten, die nur zu einer echten Bestellung gehören (Token-Link). Mit Beispiel-Bestellungen zeigten sie Demo-Stücke
 * (U-76) – deshalb nur, wenn die Vorschau mit echtem Bestand eine solche Seite enthält, sonst ein Vermerk.
 */
export const RUNDGANG_LATER: readonly { prefix: string; title: string; note: string }[] = [
  {
    prefix: tokenPrefix('R08'),
    title: 'Danke-Seite',
    note: 'Nach dem Bezahlen sieht deine Kundin die Danke-Seite: Bestellnummer, ihre Stücke, Summe, Lieferart mit Versanddienst und wie es weitergeht. Sie gehört zu einer echten Bestellung – mit deinen Stücken siehst du sie ab dem Start.',
  },
  {
    prefix: tokenPrefix('R09'),
    title: 'Bestellstatus',
    note: 'Den Link zum Bestellstatus bekommt deine Kundin per Mail: Dort sieht sie, ob bezahlt, verpackt oder unterwegs, dazu die Sendungsnummer. Auch diese Seite gehört zu einer echten Bestellung und ist ab dem Start sichtbar.',
  },
]

/**
 * Für die Fotos: Banner weg, Galerie-Fotos (Kund:innen) verdeckt, keine Bewegung (`reducedMotion`); die Kaufleiste der
 * Produktseite (`position: fixed`) läge im langen Bildschirmfoto mitten im Bild (V-27).
 */
export const RUNDGANG_CSS = `#pv-banner{display:none!important}
[data-buy-bar]{display:none!important}
[data-gallery-entry] img,[data-gallery-entry] picture{visibility:hidden!important}
[data-gallery-entry]{background:#d6d3c2!important}`

/**
 * Im Browser vor jedem Foto: Der Router der Vorschau fokussiert nach jedem Seitenwechsel die Überschrift (für
 * Tastatur und Screenreader) – auf dem Foto wäre das ein dunkler Kasten, den es beim normalen Besuch nicht gibt (V-27).
 * Eigenständig, weil Playwright nur den Quelltext der Funktion in die Seite schickt.
 */
export function blurFocus(): void {
  const active = document.activeElement as HTMLElement | null
  if (active && active !== document.body && typeof active.blur === 'function') active.blur()
}

/**
 * Nie Demo-Stücke oder Testbilder zeigen (U-76): Der Rundgang braucht eine Vorschau mit echtem Bestand. Ohne Angabe
 * `inventory` stammt die Datei aus der Zeit vor P16.3 – damals gab es nur den Demo-Bestand.
 */
export function rundgangInventoryError(report: { inventory?: 'bestand' | 'demo' }): string | null {
  if (report.inventory === 'bestand') return null
  return report.inventory === 'demo'
    ? 'Die Vorschau-Datei zeigt den Demo-Bestand – für den Rundgang erst `pnpm preview:export` mit echtem Bestand.'
    : 'Die Vorschau-Datei ist älter als P16.3 (Demo-Bestand) – für den Rundgang erst `pnpm preview:export` mit echtem Bestand.'
}

export interface RundgangPlan {
  /** Seiten mit Bildschirmfotos, in dieser Reihenfolge. */
  pages: RundgangRoute[]
  /** Seiten ohne Foto, mit Vermerk im PDF. */
  notes: { title: string; note: string }[]
}

/**
 * Welche Seiten der Rundgang fotografiert (rein, testbar): nur Seiten, die die Vorschau-Datei enthält; „Ein Stück“ =
 * `productRoute`; Danke-/Statusseite nur mit echtem Bestand, sonst Vermerk „ab dem Start sichtbar“. Fehlt eine Seite in
 * der Vorschau (z. B. Kasse, wenn der Korb beim Export leer blieb), steht ein Vermerk statt eines Abbruchs im PDF.
 */
export function rundgangPlan(
  report: {
    routes: readonly { route: string; lang: string; status?: string }[]
    inventory?: 'bestand' | 'demo'
  },
  productRoute: string | undefined,
): RundgangPlan {
  const built = report.routes.filter((r) => r.lang === 'de' && (r.status ?? 'ok') === 'ok')
  const has = (route: string) => built.some((r) => r.route === route)
  const pages: RundgangRoute[] = []
  const notes: RundgangPlan['notes'] = []
  for (const r of RUNDGANG_ROUTES) {
    const route = r.route === 'PRODUCT' ? productRoute : r.route
    if (route && has(route)) pages.push({ ...r, route })
    else
      notes.push({
        title: r.title,
        note: 'Diese Seite fehlt in der aktuellen Vorschau-Datei – sie kommt mit der nächsten wieder dazu.',
      })
  }
  for (const later of RUNDGANG_LATER) {
    const found =
      report.inventory === 'bestand'
        ? built.find((r) => r.route.startsWith(later.prefix))
        : undefined
    if (found) pages.push({ route: found.route, title: later.title })
    else notes.push({ title: `${later.title} – ab dem Start sichtbar`, note: later.note })
  }
  return { pages, notes }
}

const DEVICES: { key: string; label: string; options: BrowserContextOptions }[] = [
  {
    key: 'desktop',
    label: 'Großer Bildschirm',
    options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  },
  {
    key: 'handy',
    label: 'Handy',
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
]

/** Seiteninhalt A4 (186 × 269 mm) minus Kopfzeile: 186 × 255 mm für die Bilder. */
const DESK_WIDTH = 1100
const PHONE_WIDTH = 700
const DESK_SLICE = Math.floor((DESK_WIDTH * 254) / 186)
const PHONE_SLICE = Math.floor((PHONE_WIDTH * 254) / ((186 - 10) / 3))

/** Langes Bildschirmfoto in gleich hohe Streifen schneiden, keiner höher als eine Seite (JPEG, Base64). */
async function slices(png: Buffer, maxHeight: number): Promise<string[]> {
  const { width = 0, height: total = 0 } = await sharp(png).metadata()
  const n = Math.max(1, Math.ceil(total / maxHeight))
  const height = Math.ceil(total / n)
  const out: string[] = []
  for (let top = 0; top < total; top += height) {
    const jpg = await sharp(png)
      .extract({ left: 0, top, width, height: Math.min(height, total - top) })
      .jpeg({ quality: 68, mozjpeg: true })
      .toBuffer()
    out.push(jpg.toString('base64'))
  }
  return out
}

export async function rundgang(root: string, browser: Browser, now: Date): Promise<string> {
  const file = path.join(root, PREVIEW_FILE)
  if (!existsSync(file))
    throw new Error(`${PREVIEW_FILE} fehlt – erst \`pnpm preview:export\` ausführen.`)
  const report = JSON.parse(await readFile(path.join(root, PREVIEW_REPORT), 'utf8')) as {
    routes: { route: string; lang: string; status?: string }[]
    inventory?: 'bestand' | 'demo'
  }
  const blocked = rundgangInventoryError(report)
  if (blocked) throw new Error(blocked)
  const products = (await loadBestand(root)).filter((p) => !p.sold && p.category === 'keramik')
  const productRoute = report.routes.find(
    (r) => products[0] && r.route.startsWith(`/de/shop/${products[0].itemNumber}-`),
  )?.route
  const { pages: routes, notes } = rundgangPlan(report, productRoute)
  const url = pathToFileURL(file).href
  const shots = new Map<string, Buffer>()
  for (const d of DEVICES) {
    const ctx = await browser.newContext({ ...d.options, reducedMotion: 'reduce', locale: 'de-DE' })
    const page = await ctx.newPage()
    await page.goto(`${url}#/de`)
    for (const r of routes) {
      await page.evaluate((h) => {
        window.location.hash = `#${h}`
      }, r.route)
      await page.waitForFunction(
        (h) => document.querySelector(`template[data-route="${h}"]`) !== null,
        r.route,
      )
      await page.locator('#pv-root h1').first().waitFor()
      await page.addStyleTag({ content: RUNDGANG_CSS })
      // Bilder sofort laden (sonst fehlen sie unterhalb der ersten Ansicht)
      await page.locator('#pv-root img').evaluateAll((imgs) => {
        for (const img of imgs) (img as HTMLImageElement).loading = 'eager'
      })
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y)
          await new Promise((res) => setTimeout(res, 40))
        }
        window.scrollTo(0, 0)
      })
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll<HTMLImageElement>('#pv-root img')].every(
              (i) => i.complete,
            ),
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => undefined)
      await page.waitForTimeout(500)
      await page.evaluate(blurFocus)
      const png = await page.screenshot({ fullPage: true, type: 'png' })
      const width = d.key === 'desktop' ? DESK_WIDTH : PHONE_WIDTH
      shots.set(
        `${d.key}:${r.route}`,
        await sharp(png).resize({ width, withoutEnlargement: true }).png().toBuffer(),
      )
    }
    await ctx.close()
  }
  const stand = germanDate(now)
  const img = (b64: string) => `<img src="data:image/jpeg;base64,${b64}" alt="">`
  const head = (title: string, what: string, i: number, n: number) =>
    `<h2>${escapeHtml(title)} <span>${what}${n > 1 ? ` · ${i + 1}/${n}` : ''}</span></h2>`
  const sections: string[] = []
  for (const r of routes) {
    // Großer Bildschirm: ein Streifen je Seite; Handy: drei Streifen nebeneinander je Seite (wie Zeitungsspalten)
    const desk = await slices(shots.get(`desktop:${r.route}`)!, DESK_SLICE)
    desk.forEach((b64, i) =>
      sections.push(
        `<section>${head(r.title, 'Großer Bildschirm', i, desk.length)}<div class="desk">${img(b64)}</div></section>`,
      ),
    )
    const phone = await slices(shots.get(`handy:${r.route}`)!, PHONE_SLICE)
    const pages = Math.ceil(phone.length / 3)
    for (let i = 0; i < pages; i++)
      sections.push(
        `<section>${head(r.title, 'Handy', i, pages)}<div class="cols">${phone
          .slice(i * 3, i * 3 + 3)
          .map(img)
          .join('')}</div></section>`,
      )
  }
  if (notes.length > 0)
    sections.push(
      `<section class="notes"><h2>Ohne Bildschirmfoto</h2>${notes
        .map((n) => `<h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.note)}</p>`)
        .join('')}</section>`,
    )
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Planet Claire – Rundgang</title><style>
${await fontFaces(root)}
${BASE_CSS}
.cover{padding:4mm 0 6mm;border-bottom:1.5px solid var(--ink);margin-bottom:4mm}
.cover h1{font-size:26pt}
section{break-before:page}
.toc{font-size:12pt;line-height:1.9;padding-left:1.2em}
section h2{font-size:14pt;margin:0 0 3mm;height:8mm}
section h2 span{font-family:Bricolage,sans-serif;font-weight:400;font-size:9pt;color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em;margin-left:2mm}
.desk img{width:100%;display:block;border:1px solid var(--line)}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;align-items:start}
.cols img{width:100%;display:block;border:1px solid var(--line)}
.notes h3{font-size:12pt;margin:5mm 0 1mm}
.notes p{margin:0;max-width:150mm}
</style></head><body>
<header class="cover"><h1>Planet Claire – Rundgang</h1>
<p class="muted">So sieht die Seite gerade aus (Stand ${stand}, noch nicht online). Je Seite zuerst der große Bildschirm, dann das Handy. Korb und Kasse zeigen deine Stücke so, wie eine Kundin sie in den Korb gelegt hat – bestellt wurde nichts. Inhalte teils Beispiele (z. B. Tattoo-Motive und Termine); Fotos von Kund:innen sind ausgeblendet.</p></header>
<ol class="toc">${routes.map((r) => `<li>${escapeHtml(r.title)}</li>`).join('')}${notes
    .map((n) => `<li class="muted">${escapeHtml(n.title)}</li>`)
    .join('')}</ol>
${sections.join('\n')}
</body></html>`
  const out = path.join(root, ANSICHTEN_OUT, `planet-claire-rundgang-${berlinDay(now)}.pdf`)
  await renderPdf(browser, html, out, `Planet Claire · Rundgang · Stand ${stand}`)
  return out
}

/** Die iPad-Anleitung (`docs/owner/IPAD.md`) als PDF – zum Lesen auf dem iPad (U-88). */
export async function anleitung(root: string, browser: Browser, now: Date): Promise<string> {
  const md = await readFile(path.join(root, 'docs', 'owner', 'IPAD.md'), 'utf8')
  // Verweise auf Dokumente im Repo braucht Jutta nicht
  const body = markdownToHtml(md.replace(/\s*\(UEBERARBEITUNG[^)]*\)/g, ''))
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Planet Claire – Anleitung fürs iPad</title><style>
${await fontFaces(root)}
${BASE_CSS}
body{font-size:12pt;line-height:1.55}
h1{font-size:22pt;margin:0 0 4mm}
h2{font-size:15pt;margin:7mm 0 2mm;break-after:avoid}
ol,ul{padding-left:6mm;margin:0 0 3mm}
li{margin:1.2mm 0}
table{border-collapse:collapse;width:100%;margin:2mm 0 4mm;font-size:10.5pt}
th,td{border:1px solid var(--line);padding:2mm;text-align:left;vertical-align:top}
aside{border-left:3px solid var(--accent);padding:1mm 0 1mm 4mm;margin:3mm 0;color:var(--ink-2)}
code{font-family:inherit;background:#f1efe6;padding:0 1mm;border-radius:2px}
</style></head><body>${body}</body></html>`
  const out = path.join(root, ANSICHTEN_OUT, 'planet-claire-anleitung-ipad.pdf')
  await renderPdf(
    browser,
    html,
    out,
    `Planet Claire · Anleitung fürs iPad · Stand ${germanDate(now)}`,
  )
  return out
}

async function main(argv: readonly string[]): Promise<void> {
  const root = process.cwd()
  const now = new Date()
  const all = ['katalog', 'rundgang', 'anleitung'] as const
  const which = all.filter((a) => argv.includes(a))
  const kinds = which.length ? which : all
  await mkdir(path.join(root, ANSICHTEN_OUT), { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const k of kinds) {
      const out =
        k === 'katalog'
          ? await katalog(root, browser, now)
          : k === 'rundgang'
            ? await rundgang(root, browser, now)
            : await anleitung(root, browser, now)
      const size = (await readFile(out)).length
      console.log(`${path.relative(root, out)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
    }
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}
