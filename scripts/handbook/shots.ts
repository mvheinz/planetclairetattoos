// Bildschirmfotos für das Handbuch (PLAN P10.17): pnpm handbook:shots [--only=<id,…>] [--out=<ordner>] [--list]
// Nimmt jede Handy-Ansicht der Verwaltung (Ansichtsliste des Vorschau-Exports, `scripts/preview-export/adminViews.ts`),
// die wichtigsten Dialoge und drei öffentliche Seiten bei 390 × 844 (DPR 2) auf → WebP in `docs/owner/img/handbuch/`
// (je Bild ≤ 150 KB, zusammen ≤ 3 MB). Nur Beispieldaten; keine Adressleiste im Bild (Seitenaufnahme); der Wert von
// `ADMIN_ROUTE` steht in keinem Bild (Prüfung per Text, siehe `assertNoAdminRoute`).
//
// Nur lokal, nie in der CI. Voraussetzung (eigene Test-Datenbank und eigener Port, nie die Entwicklungsdatenbank):
//   SEED_NOW=<heute 12:00 Berlin> pnpm db:reset --test --seed=all      # Beispielbestand mit festem SEED_NOW
//   pnpm build && PORT=3210 APP_ENV=test pnpm start                    # gegen dieselbe Test-Datenbank
//   HANDBOOK_ORIGIN=http://localhost:3210 pnpm handbook:shots
// Zwei Läufe am selben Tag auf demselben Datenstand liefern byte-gleiche Bilder (Schriftart fest, Animationen aus,
// Uhr der Seite fest auf `SEED_NOW`, jedes Bild erst nach zwei gleichen Aufnahmen).
import 'dotenv/config'

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import {
  PIN_FONT_CSS,
  SHOT_DPR,
  SHOT_VIEWPORT,
  SHOT_WIDTH,
  stableScreenshot,
} from '../preview-export/adminShots'

import { SHOT_IDS, SHOT_SPECS, type ShotContext, type ShotPage, type ShotSpec } from './shotList'

export const OUT_DIR = 'docs/owner/img/handbuch'
export const MAX_IMAGE_BYTES = 150 * 1024
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024
const QUALITIES = [70, 62, 55, 48, 40, 32] as const

export interface ShotArgs {
  only: string[] | null
  out: string
  list: boolean
}

export function parseShotArgs(argv: readonly string[]): ShotArgs {
  const out: ShotArgs = { only: null, out: OUT_DIR, list: false }
  for (const a of argv) {
    if (a.startsWith('--only=')) out.only = a.slice(7).split(',').filter(Boolean)
    else if (a.startsWith('--out=')) out.out = a.slice(6)
    else if (a === '--list') out.list = true
    else
      throw new Error(
        `Unbekannte Option: ${a}\nAufruf: pnpm handbook:shots [--only=<id,…>] [--out=<ordner>] [--list]`,
      )
  }
  if (out.only) {
    const unknown = out.only.filter((id) => !SHOT_IDS.includes(id))
    if (unknown.length) throw new Error(`Unbekannte Bild-IDs: ${unknown.join(', ')}`)
  }
  return out
}

/** WebP, 780 px breit; Qualität sinkt in festen Stufen, bis das Bild ≤ 150 KB ist (deterministisch). */
export async function encodeHandbookShot(png: Buffer): Promise<Buffer> {
  let last: Buffer = Buffer.alloc(0)
  for (const quality of QUALITIES) {
    last = await sharp(png)
      .resize({ width: SHOT_WIDTH, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer()
    if (last.length <= MAX_IMAGE_BYTES) return last
  }
  return last
}

/** Der Wert von `ADMIN_ROUTE` darf in keinem Bild als Text stehen (Prüfung am Seitentext vor der Aufnahme). */
export function assertNoAdminRoute(text: string, adminRoute: string, id: string): void {
  if (adminRoute.length > 1 && text.includes(adminRoute))
    throw new Error(`Bild „${id}“ zeigt den Verwaltungspfad ${adminRoute} als Text.`)
}

interface Api {
  get(url: string): Promise<{ ok(): boolean; json(): Promise<unknown> }>
}

async function findId(
  api: Api,
  origin: string,
  collection: string,
  where: string,
): Promise<number> {
  const res = await api.get(`${origin}/api/${collection}?limit=1&depth=0&sort=id&${where}`)
  const body = (await res.json()) as { docs?: { id: number }[] }
  const id = body.docs?.[0]?.id
  if (!res.ok() || typeof id !== 'number')
    throw new Error(
      `Kein Beispieldatensatz in „${collection}“ (${where}). Ist die Test-Datenbank mit dem Beispielbestand befüllt (db:reset --test --seed=all)?`,
    )
  return id
}

async function main(): Promise<void> {
  const args = parseShotArgs(process.argv.slice(2))
  if (args.list) {
    for (const s of SHOT_SPECS) console.log(`${s.id}\t${s.kind}\t${s.caption}`)
    return
  }
  const origin = (process.env.HANDBOOK_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '')
  const adminRoute = process.env.HANDBOOK_ADMIN_ROUTE ?? process.env.ADMIN_ROUTE ?? '/werkstatt'
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password)
    throw new Error('SEED_ADMIN_EMAIL und SEED_ADMIN_PASSWORD fehlen (.env).')
  if (/vercel\.app|planetclairetattoos\.com/.test(origin))
    throw new Error('Nur gegen eine lokale Test-Umgebung aufnehmen, nie gegen Produktion.')
  const healthy = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok)
    .catch(() => false)
  if (!healthy)
    throw new Error(
      `Keine laufende App unter ${origin} (siehe Kopf von scripts/handbook/shots.ts).`,
    )
  const seedNow = process.env.SEED_NOW || new Date().toISOString()

  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ args: ['--disable-lcd-text'] })
  const written = new Map<string, number>()
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
      if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:'))
        return route.continue()
      return route.abort()
    })
    const page = await context.newPage()
    await page.clock.setFixedTime(new Date(seedNow))

    await page.goto(`${origin}${adminRoute}/login`, { waitUntil: 'networkidle' })
    await page.fill('#field-email', email)
    await page.fill('#field-password', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 60_000 })

    await page.goto(`${origin}/de/shop`, { waitUntil: 'networkidle' })
    const productPath = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')]
        .map((x) => x.getAttribute('href') ?? '')
        .find((h) => /^\/de\/shop\/[^/?#]+$/.test(h))
      return a ?? ''
    })
    if (!productPath) throw new Error('Keine Produktseite im Shop gefunden.')

    const api = context.request as unknown as Api
    const ctx: ShotContext = {
      paidOrder: await findId(
        api,
        origin,
        'orders',
        'where[status][equals]=paid&where[fulfillmentMethod][equals]=shipping',
      ),
      packedOrder: await findId(api, origin, 'orders', 'where[status][equals]=packed'),
      prepaymentOrder: await findId(
        api,
        origin,
        'orders',
        'where[status][equals]=awaiting_prepayment',
      ),
      pickupOrder: await findId(api, origin, 'orders', 'where[status][equals]=ready_for_pickup'),
      withdrawal: await findId(api, origin, 'withdrawals', 'where[status][equals]=goods_returned'),
      inquiry: await findId(api, origin, 'inquiries', 'where[status][equals]=new'),
      privacyRequest: await findId(
        api,
        origin,
        'privacy-requests',
        'where[status][equals]=identity_check',
      ),
      piece: await findId(
        api,
        origin,
        'products',
        'where[status][equals]=available&where[seed][equals]=true',
      ),
      productPath,
    }

    const selected: readonly ShotSpec[] = args.only
      ? SHOT_SPECS.filter((s) => args.only!.includes(s.id))
      : SHOT_SPECS
    mkdirSync(args.out, { recursive: true })

    const load = async (spec: ShotSpec): Promise<Buffer> => {
      const url =
        spec.kind === 'public'
          ? `${origin}${spec.path(ctx)}`
          : `${origin}${adminRoute}${spec.path(ctx)}`
      const res = await page.goto(url, { waitUntil: 'networkidle' })
      if (!res || res.status() >= 400)
        throw new Error(
          `${spec.id}: HTTP ${res?.status() ?? 'keine Antwort'} für ${spec.path(ctx)}`,
        )
      await page.addStyleTag({ content: PIN_FONT_CSS })
      await page.evaluate(() => document.fonts.ready)
      if (spec.act) await spec.act(page as unknown as ShotPage, ctx)
      await page.waitForTimeout(250)
      assertNoAdminRoute(await page.locator('body').innerText(), adminRoute, spec.id)
      await page.mouse.move(0, 0)
      return stableScreenshot(page)
    }

    for (const spec of selected) {
      if (spec.anonymous) {
        const anon = await browser.newContext({
          viewport: SHOT_VIEWPORT,
          deviceScaleFactor: SHOT_DPR,
          locale: 'de-DE',
          timezoneId: 'Europe/Berlin',
          reducedMotion: 'reduce',
          colorScheme: 'light',
        })
        const ap = await anon.newPage()
        await ap.clock.setFixedTime(new Date(seedNow))
        await ap.goto(`${origin}${adminRoute}${spec.path(ctx)}`, { waitUntil: 'networkidle' })
        await ap.addStyleTag({ content: PIN_FONT_CSS })
        await ap.evaluate(() => document.fonts.ready)
        assertNoAdminRoute(await ap.locator('body').innerText(), adminRoute, spec.id)
        await ap.mouse.move(0, 0)
        const png = await stableScreenshot(ap)
        await anon.close()
        const webp = await encodeHandbookShot(png)
        writeFileSync(path.join(args.out, `${spec.id}.webp`), webp)
        written.set(spec.id, webp.length)
        continue
      }
      // Zwei Seitenaufrufe mit gleichem Bild übernehmen (höchstens vier), wie beim Vorschau-Export.
      let previous = await load(spec)
      for (let i = 1; i < 4; i++) {
        const next = await load(spec)
        if (next.equals(previous)) break
        previous = next
      }
      const webp = await encodeHandbookShot(previous)
      writeFileSync(path.join(args.out, `${spec.id}.webp`), webp)
      written.set(spec.id, webp.length)
      console.log(`${spec.id}: ${(webp.length / 1024).toFixed(0)} KB`)
    }
  } finally {
    await browser.close()
  }

  if (!args.only) {
    for (const f of readdirSync(args.out))
      if (f.endsWith('.webp') && !SHOT_IDS.includes(f.slice(0, -5))) rmSync(path.join(args.out, f))
  }
  const sizes = readdirSync(args.out)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => ({ f, size: readFileSync(path.join(args.out, f)).length }))
  const total = sizes.reduce((n, s) => n + s.size, 0)
  const tooBig = sizes.filter((s) => s.size > MAX_IMAGE_BYTES)
  console.log(
    `handbook:shots: ${sizes.length} Bilder, zusammen ${(total / 1024 / 1024).toFixed(2)} MB`,
  )
  if (tooBig.length || total > MAX_TOTAL_BYTES)
    throw new Error(`Größenbudget verletzt: ${tooBig.map((s) => s.f).join(', ') || 'Gesamtgröße'}`)
}

if (process.argv[1]?.endsWith('shots.ts')) {
  main().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
