import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import pg from 'pg'

import { localizedPath, pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, type Locale } from '../../src/lib/routes/registry'
import { serverURL } from '../helpers/adminEnv'

// P2.22 Barrierefreiheit (ARCHITEKTUR §7.5, KONZEPT EK-07, RECHT R-191, T-11): axe mit den Tags `wcag2a`, `wcag2aa`,
// `wcag21a`, `wcag21aa`, `wcag22aa` auf jeder `live`-Route je Sprache und in den Zuständen offenes Menü, 404, 500,
// Leerzustand der Startseite (ohne `pages:home`) und Rechtsseite mit Platzhalter. Gate: 0 Verstöße `serious`/`critical`;
// `moderate`/`minor` erscheinen als Annotation im Report. Dazu: `lang` je Seite korrekt. Den Tastatur-Durchlauf und die
// Fokus-Sichtbarkeit prüft `keyboard.e2e.spec.ts`.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoSeriousViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const describe = (v: (typeof result.violations)[number]) =>
    `${v.id} (${v.impact}): ${v.help} – ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join(' | ')}`
  for (const v of result.violations.filter(
    (v) => v.impact !== 'serious' && v.impact !== 'critical',
  ))
    test.info().annotations.push({
      type: `axe ${v.impact ?? 'minor'}`,
      description: `${label}: ${describe(v)}`,
    })
  const blocking = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(describe)
  expect(blocking, `axe serious/critical: ${label}`).toEqual([])
  expect(result.passes.length, 'axe hat geprüft').toBeGreaterThan(0)
}

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
