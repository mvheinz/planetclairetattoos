// Verwaltung als Bildschirmfotos (ARCHITEKTUR §14.7, KONZEPT §12.5 Nr. 9): Anmeldung unter `ADMIN_ROUTE` mit dem
// Admin-Konto des Grund-Seeds der Export-Datenbank (`SEED_ADMIN_*` aus `.env.example`, E-03: kein zweites Konto),
// Chromium 390×844 bei DPR 2 → WebP 780 px breit, Qualität 70. Die echte Verwaltung ist nicht in der Datei. Nur der
// Export-Server wird angefragt (alles andere bricht die Route ab). Uhr der Seite fest auf `SEED_NOW`, Animationen aus,
// damit zwei Läufe am selben Tag gleiche Bilder liefern (AK-A-14-01).
import { createHash } from 'node:crypto'

import sharp from 'sharp'

import type { AdminShotEntry } from './assemble'
import type { AdminView } from './adminViews'
import { ExportError } from './errors'

export const SHOT_VIEWPORT = { width: 390, height: 844 } as const
export const SHOT_DPR = 2
export const SHOT_WIDTH = 780
export const SHOT_QUALITY = 70
/**
 * Die Verwaltung nutzt den System-Schriftstapel (`-apple-system, …, Arial, sans-serif`). Unter Linux löste Chromium ihn
 * von Seitenaufruf zu Seitenaufruf verschieden auf (gleiche Arial-kompatible Zeichen, aber andere Metriken → Fließtext
 * um Bruchteile eines Pixels versetzt; gemessen: 2 Varianten in 12 Aufrufen). Fest auf „Liberation Sans“ (das, was
 * ohnehin gerendert wird; Rückfall Arial) gibt es nur noch eine Variante (12/12). Code-Schrift bleibt unverändert.
 */
export const PIN_FONT_CSS =
  'body, body *:not(code):not(pre):not(kbd):not(samp) { font-family: "Liberation Sans", Arial, sans-serif !important; }'

/** Höchstzahl der Seitenaufrufe je Ansicht, bis zwei hintereinander das gleiche Bild liefern. */
export const LOADS_PER_VIEW = 4

/** Ansichten, die in dieser Phase schon existieren können (bis zur laufenden Phase); der Rest ist „kommt in P<n>“. */
export function viewsToCapture(views: readonly AdminView[], phase: string): AdminView[] {
  const n = /^p(\d+)$/.exec(phase)?.[1]
  const upTo = n === undefined ? 1 : Math.max(1, Number(n) + 1)
  return views.filter((v) => v.phase <= upTo)
}

export async function encodeShot(png: Buffer): Promise<NonNullable<AdminShotEntry['image']>> {
  const { data, info } = await sharp(png)
    .resize({ width: SHOT_WIDTH, withoutEnlargement: true })
    .webp({ quality: SHOT_QUALITY })
    .toBuffer({ resolveWithObject: true })
  return {
    dataUri: `data:image/webp;base64,${data.toString('base64')}`,
    hash: `admin-${createHash('sha256').update(data).digest('hex').slice(0, 16)}`,
    width: info.width,
    height: info.height,
  }
}

type ShotPage = {
  screenshot: (o: object) => Promise<Buffer>
  waitForTimeout: (ms: number) => Promise<void>
}

/** Bildschirmfoto erst, wenn zwei aufeinanderfolgende Aufnahmen byte-gleich sind (wie `toHaveScreenshot`). */
export async function stableScreenshot(page: ShotPage, attempts = 6): Promise<Buffer> {
  const shot = () => page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' })
  let previous = await shot()
  for (let i = 1; i < attempts; i++) {
    await page.waitForTimeout(150)
    const next = await shot()
    if (next.equals(previous)) return next
    previous = next
  }
  return previous
}

export interface AdminShotOptions {
  origin: string
  adminRoute: string
  email: string
  password: string
  seedNow: string
  phase: string
  views: readonly AdminView[]
}

export async function captureAdminShots(
  options: AdminShotOptions,
): Promise<{ entries: AdminShotEntry[]; warnings: string[] }> {
  const { chromium } = await import('@playwright/test')
  const warnings: string[] = []
  const capture = new Set(viewsToCapture(options.views, options.phase).map((v) => v.key))
  const images = new Map<string, AdminShotEntry['image']>()
  // Graustufen-Kantenglättung statt LCD-Text: Ob Chromium Text subpixel-geglättet rastert, hängt davon ab, ob eine
  // Ebene gerade zusammengesetzt wird – unter Last schwankte das zwischen zwei Läufen (AK-A-14-01).
  const browser = await chromium.launch({ args: ['--disable-lcd-text'] })
  try {
    const context = await browser.newContext({
      viewport: SHOT_VIEWPORT,
      deviceScaleFactor: SHOT_DPR,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      reducedMotion: 'reduce',
      colorScheme: 'light',
    })
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith(options.origin) || url.startsWith('data:') || url.startsWith('blob:'))
        return route.continue()
      warnings.push(`Verwaltung: Anfrage an ${url.slice(0, 80)} blockiert.`)
      return route.abort()
    })
    const page = await context.newPage()
    await page.clock.setFixedTime(new Date(options.seedNow))
    const base = `${options.origin}${options.adminRoute}`

    /** Ansicht laden und stabil fotografieren; `null` = 404 („kommt in P<n>“). */
    const load = async (view: AdminView): Promise<Buffer | null> => {
      const res = await page.goto(`${base}${view.path}`, { waitUntil: 'networkidle' })
      if (!res || res.status() === 404) return null
      if (res.status() >= 500) {
        throw new ExportError(1, `Verwaltung: ${view.key} antwortet mit HTTP ${res.status()}.`)
      }
      await page.addStyleTag({ content: PIN_FONT_CSS })
      await page.evaluate(() => document.fonts.ready)
      // Maus aus der Seite: Sonst bleibt sie dort stehen, wo der Anmelde-Knopf war, und je nach Zeitpunkt der
      // Hover-Aktualisierung von Chromium ist das Element darunter (z. B. eine Kategorie-Kachel) hervorgehoben oder nicht.
      // Schon ein Pixel Unterschied ändert über die globale Segmentierung von WebP das ganze Bild (AK-A-14-01).
      await page.mouse.move(0, 0)
      // Kein Fokus, ganz oben: Ein Feld mit Fokus (oder eine Anker-Sprungmarke) scrollte die Ansicht „Versand“ unter Last
      // um einen Pixel – das ganze Bild verschob sich (AK-A-14-01, P14.14).
      await page.evaluate(() => {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        window.scrollTo(0, 0)
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*')))
          if (el.scrollTop) el.scrollTop = 0
      })
      return stableScreenshot(page)
    }

    const shoot = async (view: AdminView) => {
      // Sicherheitsnetz: erst zwei aufeinanderfolgende Seitenaufrufe mit gleichem Bild übernehmen (höchstens vier).
      let previous = await load(view)
      if (!previous) {
        warnings.push(
          `Verwaltung: ${view.key} (${view.path || '/'}) antwortet mit 404 – „kommt in P${view.phase}“.`,
        )
        return
      }
      for (let i = 1; i < LOADS_PER_VIEW; i++) {
        const next = await load(view)
        if (!next || next.equals(previous)) break
        previous = next
      }
      images.set(view.key, await encodeShot(previous))
    }

    const anonymous = options.views.filter((v) => v.anonymous && capture.has(v.key))
    for (const v of anonymous) await shoot(v)

    const needsLogin = options.views.some((v) => !v.anonymous && capture.has(v.key))
    if (needsLogin) {
      await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
      await page.fill('#field-email', options.email)
      await page.fill('#field-password', options.password)
      await page.click('button[type="submit"]')
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 60_000 })
      for (const v of options.views.filter((x) => !x.anonymous && capture.has(x.key)))
        await shoot(v)
    }
  } finally {
    await browser.close()
  }
  const entries = options.views.map((v) => ({
    key: v.key,
    caption: v.caption,
    phase: v.phase,
    image: images.get(v.key) ?? null,
  }))
  return { entries, warnings }
}
