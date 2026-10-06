import { execFileSync } from 'node:child_process'

import type { Page } from '@playwright/test'

import { productPath } from '../../src/lib/shop/format'
import { hasSamplePath, localizedPath, pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../src/lib/routes/registry'
import { expectNoSeriousViolations } from './axe'
import { expect, test, testPayload } from './fixtures'
import { revalidatePrerendered } from './global-setup'
import { freshPage, holdListData, refresh } from './shop/fresh'

// P8.16 Leere Zustände, 404 und 500 (DESIGN KO-17/KO-18, KONZEPT §3.1/§3.17, DATENMODELL DM-PAGE-01).
// Teil 1 mit Beispielbestand: S08 (Nr. 908, verkauft, nicht im Archiv) → 404-Variante „schon ein Zuhause“.
// Teil 2 ohne Beispieldaten: eigene DB-Vorbereitung mit `pnpm seed:remove --yes --drop-texts` (Seiten und FAQ weg),
// danach `pnpm seed:reset` – jede öffentliche Registry-Route DE/EN antwortet 200 (R28: 404), nie 500; jede Liste zeigt
// ihren Leerzustand mit Weiter-Link; „Vertrag widerrufen“ ist überall sichtbar (AK-3-11); axe ohne serious/critical;
// mit reduzierter Bewegung statisch.
//
// Achtung: Teil 2 ändert die Test-DB für die Dauer der Spec. In CI läuft jedes Projekt mit einem Worker (nacheinander);
// lokal parallel laufende Specs mit Beispieldaten können in dieser Zeit fehlschlagen (exklusiver Listen-Lock dämpft das
// für die Stück-Listen). Gegen den Produktions-Build werden die vorgerenderten Seiten nach jedem Schritt erneuert.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const productionBuild = process.env.E2E_SERVER === 'start'

function seedCli(...args: string[]) {
  // DATABASE_URL zeigt hier schon auf die Test-DB (playwright.config.ts).
  execFileSync('pnpm', ['run', ...args], {
    stdio: 'pipe',
    env: { ...process.env, NODE_OPTIONS: '' },
    timeout: 240_000,
  })
}

async function revalidateAll() {
  if (!productionBuild) return
  const failures = await revalidatePrerendered(BASE_URL, { allowNotFound: true })
  expect(failures, 'vorgerenderte Seiten erneuern').toEqual([])
}

/** Listen mit Leerzustand (KO-17) – Weiter-Link und Coco-Pose (DESIGN §10.6; ohne Pose: keine Coco). */
const LISTS: { id: string; params?: Record<Locale, Record<string, string>>; pose?: string }[] = [
  { id: 'R01' },
  { id: 'R02', pose: 'sitzen' },
  {
    id: 'R03',
    params: { de: { slug: 'keramik' }, en: { slug: 'ceramics' } },
    pose: 'kopfschief',
  },
  { id: 'R05', pose: 'sitzen' },
  { id: 'R06', pose: 'schnueffeln' },
  { id: 'R12', pose: 'schlafen' },
  { id: 'R15' },
  { id: 'R18', pose: 'kopfschief' },
  { id: 'R27' },
]

const listUrl = (l: (typeof LISTS)[number], locale: Locale) =>
  localizedPath(l.id, locale, l.params?.[locale] ?? {})

async function expectWithdrawLink(page: Page, locale: Locale) {
  const link = page.locator('[data-site-footer] [data-withdraw-link]')
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', localizedPath('R26', locale))
  await link.scrollIntoViewIfNeeded()
  await expect(link).toBeVisible()
}

test.describe('P8.16 mit Beispielbestand', () => {
  test('KO-18 /de/shop/908-…: 404-Variante „schon ein Zuhause“ mit Shop und Archiv, noindex', async ({
    page,
    request,
  }) => {
    const payload = await testPayload()
    const doc = (
      await payload.find({
        collection: 'products',
        where: { itemNumber: { equals: 908 } },
        locale: 'de',
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]
    expect(doc?.status, 'S08 im Beispielbestand').toBe('sold')
    const url = productPath({ itemNumber: 908, slug: doc!.slug }, 'de')
    await freshPage(page)
    await refresh(request, [url])
    const res = await page.goto(url)
    expect(res?.status()).toBe(404)
    // Next ergänzt bei 404 ein eigenes `noindex` – alle Robots-Angaben müssen `noindex` sein.
    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('content') ?? ''))
    expect(robots.length).toBeGreaterThan(0)
    for (const r of robots) expect(r).toMatch(/noindex/)
    const nf = page.locator('[data-not-found]')
    await expect(nf).toHaveAttribute('data-variant', 'home')
    await expect(page.locator('h1')).toHaveText('Dieses Stück hat schon ein Zuhause gefunden')
    const links = nf.locator('nav a')
    await expect(links).toHaveCount(2)
    await expect(links.nth(0)).toHaveAttribute('href', '/de/shop')
    await expect(links.nth(1)).toHaveAttribute('href', '/de/archiv')
    await expectWithdrawLink(page, 'de')
  })
})

test.describe('P8.16 ohne Beispieldaten (seed:remove --drop-texts)', () => {
  test.describe.configure({ mode: 'serial' })
  holdListData(test, 'exclusive')

  test.beforeAll(async () => {
    test.setTimeout(300_000)
    seedCli('seed:remove', '--yes', '--drop-texts')
    await revalidateAll()
  })

  test.afterAll(async () => {
    test.setTimeout(300_000)
    seedCli('seed:reset')
    await revalidateAll()
  })

  test.beforeEach(async ({ page }) => {
    await freshPage(page)
  })

  test('DM-PAGE-01 AK-3-11 jede öffentliche Registry-Route DE/EN: 200 (R28 404), nie 500, „Vertrag widerrufen“', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const routes = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))
    for (const route of routes) {
      for (const locale of LOCALES) {
        // R04: das Beispiel-Stück ist entfernt → 404 (R28); R07 ohne Kasse → zurück in den Korb.
        const url = samplePath(route.id, locale)
        const res = await page.goto(url)
        const status = res?.status() ?? 0
        expect(status, url).toBeLessThan(500)
        expect(status, url).toBe(route.id === 'R04' ? 404 : 200)
        await expectWithdrawLink(page, locale)
      }
    }
    const res = await page.goto('/de/gibt-es-nicht-leer')
    expect(res?.status()).toBe(404)
    await expectWithdrawLink(page, 'de')
  })

  for (const locale of LOCALES) {
    test(`KO-17 Listen ohne Einträge zeigen ihren Leerzustand mit Weiter-Link (${locale})`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      for (const list of LISTS) {
        const url = listUrl(list, locale)
        const res = await page.goto(url)
        expect(res?.status(), url).toBe(200)
        const empty = page.locator('main [data-empty-state]').first()
        await expect(empty, url).toBeVisible()
        await expect(empty.locator('h2, h3').first(), url).not.toBeEmpty()
        await expect(empty.locator('a[href]'), `${url}: Weiter-Link`).toHaveCount(1)
        if (list.pose)
          await expect(empty.locator('[data-coco-slot]'), url).toHaveAttribute(
            'data-coco-pose',
            list.pose,
          )
        await expectWithdrawLink(page, locale)
      }
    })
  }

  test('axe ohne serious/critical auf 404, 500 und allen Leerzuständen @a11y', async ({ page }) => {
    test.setTimeout(180_000)
    for (const locale of LOCALES) {
      for (const list of LISTS) {
        const url = listUrl(list, locale)
        await page.goto(url)
        await expectNoSeriousViolations(page, `leer ${url}`)
      }
    }
    expect((await page.goto('/de/gibt-es-nicht-leer'))?.status()).toBe(404)
    await expectNoSeriousViolations(page, '404')
    const res = await page.goto('/de/__fehler-test')
    expect(res?.status(), 'R29 nur mit APP_ENV=test').toBe(500)
    await expect(page.locator('h1')).toHaveText('Hoppla – die Leine hat sich verheddert')
    await expectNoSeriousViolations(page, '500')
  })

  test('reduzierte Bewegung: Leerzustände, 404 und 500 statisch', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const urls = [
      ...LISTS.map((l) => listUrl(l, 'de')),
      '/de/gibt-es-nicht-leer',
      '/de/__fehler-test',
    ]
    for (const url of urls) {
      await page.goto(url)
      await page.waitForLoadState('load')
      // nach load und dem verzögerten Laden der Module (Leerlauf) darf nichts laufen
      await page.waitForTimeout(1500)
      const running = await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      )
      expect(running, url).toBe(0)
    }
  })
})
