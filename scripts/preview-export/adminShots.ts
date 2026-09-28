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
  const browser = await chromium.launch()
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

    const shoot = async (view: AdminView) => {
      const res = await page.goto(`${base}${view.path}`, { waitUntil: 'networkidle' })
      if (!res || res.status() === 404) {
        warnings.push(
          `Verwaltung: ${view.key} (${view.path || '/'}) antwortet mit 404 – „kommt in P${view.phase}“.`,
        )
        return
      }
      if (res.status() >= 500) {
        throw new ExportError(1, `Verwaltung: ${view.key} antwortet mit HTTP ${res.status()}.`)
      }
      await page.evaluate(() => document.fonts.ready)
      const png = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' })
      images.set(view.key, await encodeShot(png))
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
