import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'
import pg from 'pg'

import { localizedPath, pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../src/lib/routes/registry'
import { serverURL } from '../helpers/adminEnv'
import { expectNoSeriousViolations } from './axe'
import { expect, test } from './fixtures'
import { holdListData } from './shop/fresh'
import { P3_PAGES, homeVariant } from './shop/p3Pages'

// P2.22 Barrierefreiheit (ARCHITEKTUR §7.5, KONZEPT EK-07, RECHT R-191, T-11): axe mit den Tags `wcag2a`, `wcag2aa`,
// `wcag21a`, `wcag21aa`, `wcag22aa` auf jeder `live`-Route je Sprache und in den Zuständen offenes Menü, 404, 500,
// Leerzustand der Startseite (ohne `pages:home`) und Rechtsseite mit Platzhalter. Gate: 0 Verstöße `serious`/`critical`;
// `moderate`/`minor` erscheinen als Annotation im Report. Dazu: `lang` je Seite korrekt. Den Tastatur-Durchlauf und die
// Fokus-Sichtbarkeit prüft `keyboard.e2e.spec.ts`.
// P3.16: zusätzlich R02, R03 und R05 mit ihren Varianten und jeder Kategorie sowie R04 je Kategorie und Zustand
// (reserviert, verkauft) und die 404-Varianten (unbekannt/Entwurf, „Schon ein Zuhause“, Seite hinter der letzten).

async function expectLang(page: Page, locale: Locale) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  // Rückfall auf den deutschen Text auf englischen Seiten (R-015) ist als Deutsch ausgezeichnet.
  if (locale === 'en') {
    const germanOnly = await page.getByText('Only available in German.').count()
    if (germanOnly > 0)
      await expect(page.locator('[data-legal-text] [lang="de"]').first()).toBeVisible()
  }
}

async function open(page: Page, url: string, status = 200) {
  const res = await page.goto(url)
  expect(res?.status(), url).toBe(status)
  await page.waitForLoadState('networkidle')
}

const livePages = pageRoutes().filter((r) => r.status === 'live')

test.describe('axe je live-Route @a11y', () => {
  for (const route of livePages) {
    for (const locale of LOCALES) {
      const url = samplePath(route.id, locale)
      test(`T-11 R-191 ${route.id} ${url} @a11y`, async ({ page }) => {
        await open(page, url)
        await expectLang(page, locale)
        await expectNoSeriousViolations(page, url)
      })
    }
  }
})

test.describe('axe P3: Varianten und Zustände von R02–R05 @a11y', () => {
  // Je Route prüft die Suite oben alle drei Projekte; die Varianten und Zustände laufen im Desktop- und im Mobil-Layout
  // (desktop, pixel-7) – axe prüft das DOM, iphone-15 hätte dasselbe Mobil-Layout (CI-Minuten, OFFENE-PUNKTE P3.16).
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === 'iphone-15',
      'P3-Varianten: desktop und pixel-7 (Mobil-Layout)',
    )
  })
  // Seed-Anker (S06 verkauft, Listen) nicht während eines exklusiven Bestandstests lesen.
  holdListData(test, 'shared')

  for (const p of P3_PAGES) {
    test(`T-11 R-191 EK-07 ${p.name} ${p.path} @a11y`, async ({ page }) => {
      await open(page, p.path, p.status)
      if (p.routeId === 'R31') {
        // Kurzlink ohne Sprachpräfix: Sprache per Accept-Language des Browsers – `lang` passt zur Zielseite.
        const lang = (await page.locator('html').getAttribute('lang')) as Locale
        expect(LOCALES).toContain(lang)
        const target = new URL(page.url()).pathname.split('/')[1]
        if (p.status === 200) expect(target).toBe(lang)
      } else await expectLang(page, p.locale)
      await expectNoSeriousViolations(page, `${p.name} ${p.path}`)
    })
  }

  for (const locale of LOCALES) {
    test(`T-11 R-191 R04 404-Variante „Schon ein Zuhause“ (Fixture analog S08) ${locale} @a11y`, async ({
      page,
      fixtureProducts,
      request,
    }) => {
      const url = await homeVariant(fixtureProducts, request, locale)
      await open(page, url, 404)
      await expect(page.locator('[data-not-found]')).toHaveAttribute('data-variant', 'home')
      await expectLang(page, locale)
      await expectNoSeriousViolations(page, `Zuhause ${locale}`)
    })
  }
})

test.describe('axe in Zuständen @a11y', () => {
  for (const locale of LOCALES) {
    test(`T-11 offenes Menü (${locale}) @a11y`, async ({ page }) => {
      await open(page, localizedPath('R01', locale))
      const trigger = page.locator('[data-site-header] [data-menu-trigger]')
      await expect(trigger).toHaveAttribute('role', 'button')
      await trigger.click()
      await expect(page.locator('dialog#menu')).toBeVisible()
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== 'running' ||
              !Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
          ),
      )
      await expectLang(page, locale)
      await expectNoSeriousViolations(page, `Menü ${locale}`)
    })

    test(`T-11 404 (${locale}) @a11y`, async ({ page }) => {
      await open(page, `/${locale}/gibt-es-nicht-a11y`, 404)
      await expectLang(page, locale)
      await expectNoSeriousViolations(page, `404 ${locale}`)
    })

    test(`T-11 500 (${locale}) @a11y`, async ({ page }) => {
      await open(page, `/${locale}/__fehler-test`, 500)
      await expectLang(page, locale)
      await expectNoSeriousViolations(page, `500 ${locale}`)
    })

    test(`T-11 Rechtsseite mit Platzhalter (${locale}) @a11y`, async ({ page }) => {
      await open(page, localizedPath('R21', locale))
      await expect(page.locator('[data-placeholder-banner]')).toBeVisible()
      await expectLang(page, locale)
      await expectNoSeriousViolations(page, `Platzhalter ${locale}`)
    })
  }
})

// Leerzustand der Startseite (DM-PAGE-01): `pages:home` kurz auf Entwurf setzen (öffentlich unsichtbar) und die Seite im
// Draft-Modus abrufen – der rendert frisch aus der Datenbank und schreibt weder Seiten- noch Daten-Cache, andere Specs
// sehen also weiter die zwischengespeicherte Startseite. Parallele Projekte stimmen sich über ein Advisory-Lock ab.
// Kein Hook läuft (direktes SQL), es entsteht also auch keine Cache-Erneuerung oder Version.
const HOME_LOCK = 7_314_010
const EMPTY_TITLE: Record<Locale, string> = {
  de: 'Hier wird gerade umgeräumt.',
  en: 'We’re rearranging things.',
}

function previewModeId(): string {
  const distDir = process.env.NEXT_DIST_DIR || '.next'
  for (const file of [
    path.join(distDir, 'prerender-manifest.json'),
    path.join(distDir, 'dev', 'prerender-manifest.json'),
  ]) {
    if (existsSync(file))
      return (JSON.parse(readFileSync(file, 'utf8')) as { preview: { previewModeId: string } })
        .preview.previewModeId
  }
  throw new Error('prerender-manifest.json fehlt – Draft-Modus für den Leerzustand nicht möglich.')
}

test.describe('axe Leerzustand der Startseite @a11y', () => {
  for (const locale of LOCALES) {
    test(`T-11 DM-PAGE-01 Startseite ohne home (${locale}) @a11y`, async ({ page, context }) => {
      const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
      await db.connect()
      try {
        await db.query('SELECT pg_advisory_lock($1)', [HOME_LOCK])
        await db.query(`UPDATE pages SET _status = 'draft' WHERE key = 'home'`)
        await context.addCookies([
          { name: '__prerender_bypass', value: previewModeId(), url: serverURL, httpOnly: true },
        ])
        await open(page, localizedPath('R01', locale))
        await expect(page.locator('[data-home-stations]')).toHaveCount(0)
        await expect(page.locator('main [data-empty-state]')).toContainText(EMPTY_TITLE[locale])
        await expectLang(page, locale)
        await expectNoSeriousViolations(page, `Startseite leer ${locale}`)
      } finally {
        await db.query(`UPDATE pages SET _status = 'published' WHERE key = 'home'`)
        await db.query('SELECT pg_advisory_unlock($1)', [HOME_LOCK])
        await db.end()
      }
    })
  }
})
