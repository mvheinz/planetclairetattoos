import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { pickLocale } from '@/i18n/pickLocale'
import { ROOT_FILES, decidePublicRoute, isExcludedPath } from '@/lib/routes/redirects'
import { wwwRedirectTarget } from '@/proxy'

// KONZEPT §2.4, AK-2-02 (R30): Spracherkennung über Accept-Language, q-Werte beachten, Rückfall de, kein Cookie.
describe('pickLocale (AK-2-02)', () => {
  it.each([
    [undefined, 'de'],
    [null, 'de'],
    ['', 'de'],
    ['en-US,en;q=0.9', 'en'],
    ['de-DE,de;q=0.9,en;q=0.8', 'de'],
    ['fr-FR,fr;q=0.9,en;q=0.8,de;q=0.7', 'en'],
    ['fr-FR,fr;q=0.9', 'de'],
    ['de;q=0.5,en;q=0.8', 'en'],
    ['en;q=0,de;q=0.1', 'de'],
    ['EN-gb', 'en'],
    ['*', 'de'],
    ['en;q=abc,de;q=0.2', 'de'],
  ])('%s → %s', (header, expected) => {
    expect(pickLocale(header)).toBe(expected)
  })
})

describe('decidePublicRoute (ARCHITEKTUR §2.3)', () => {
  it('AK-2-02 / → 307 in die erkannte Sprache mit Vary', () => {
    expect(decidePublicRoute('/', '', 'en-US,en;q=0.9')).toEqual({
      kind: 'redirect',
      status: 307,
      location: '/en',
      vary: true,
    })
    expect(decidePublicRoute('/', '', null)).toMatchObject({ status: 307, location: '/de' })
  })

  it('unpräfixierte Pfade → 307, übersetzt in die erkannte Sprache', () => {
    expect(decidePublicRoute('/tattoo/preise', '', 'en')).toMatchObject({
      status: 307,
      location: '/en/tattoo/prices',
    })
    expect(decidePublicRoute('/legal-notice', '?x=1', 'de')).toMatchObject({
      status: 307,
      location: '/de/impressum?x=1',
    })
    expect(decidePublicRoute('/gibt-es-nicht', '', 'en')).toMatchObject({
      status: 307,
      location: '/en/gibt-es-nicht',
    })
  })

  it('AK-A-2-04 Pfad der anderen Sprache und Aliasse → 308', () => {
    expect(decidePublicRoute('/en/vertrag-widerrufen', '', null)).toEqual({
      kind: 'redirect',
      status: 308,
      location: '/en/withdraw-from-contract',
    })
    expect(decidePublicRoute('/de/legal-notice', '', null)).toMatchObject({
      status: 308,
      location: '/de/impressum',
    })
    expect(decidePublicRoute('/en/imprint', '', null)).toMatchObject({
      status: 308,
      location: '/en/legal-notice',
    })
    expect(decidePublicRoute('/en/impressum', '', null)).toMatchObject({
      status: 308,
      location: '/en/legal-notice',
    })
    expect(decidePublicRoute('/de/shop/category/keramik', '?page=2', null)).toMatchObject({
      status: 308,
      location: '/de/shop/kategorie/keramik?page=2',
    })
  })

  it('Pfade der eigenen Sprache und Unbekanntes gehen an next-intl', () => {
    expect(decidePublicRoute('/de/impressum', '', 'en')).toEqual({ kind: 'intl' })
    expect(decidePublicRoute('/en', '', 'de')).toEqual({ kind: 'intl' })
    expect(decidePublicRoute('/en/shop', '', null)).toEqual({ kind: 'intl' })
    expect(decidePublicRoute('/de/gibt-es-nicht', '', null)).toEqual({ kind: 'intl' })
  })

  it('abschließender Schrägstrich → 308 ohne', () => {
    expect(decidePublicRoute('/de/', '', null)).toMatchObject({ status: 308, location: '/de' })
    expect(decidePublicRoute('/de/impressum/', '?a=b', null)).toMatchObject({
      status: 308,
      location: '/de/impressum?a=b',
    })
  })

  it('Ausnahmen: /nr, Sitemap, robots.txt, Dateien', () => {
    for (const p of ['/nr/17', '/sitemap.xml', '/robots.txt', '/icon.svg', '/art/wordmark.svg']) {
      expect(isExcludedPath(p), p).toBe(true)
      expect(decidePublicRoute(p, '', null), p).toEqual({ kind: 'pass' })
    }
    expect(isExcludedPath('/nrw')).toBe(false)
  })
})

describe('wwwRedirectTarget', () => {
  it('www.<apex> → Apex aus NEXT_PUBLIC_SITE_URL, sonst null', () => {
    const site = 'https://planetclairetattoos.com'
    expect(wwwRedirectTarget('www.planetclairetattoos.com', site, '/de/shop?page=2')).toBe(
      'https://planetclairetattoos.com/de/shop?page=2',
    )
    expect(wwwRedirectTarget('planetclairetattoos.com', site, '/de')).toBeNull()
    expect(wwwRedirectTarget('www.evil.example', site, '/de')).toBeNull()
    expect(wwwRedirectTarget(null, site, '/de')).toBeNull()
    expect(wwwRedirectTarget('www.localhost:3000', 'http://localhost:3000', '/de')).toBe(
      'http://localhost:3000/de',
    )
  })
})

describe('Unbekannte Dateien auf erster Ebene (P5.29, T-04)', () => {
  it('T-04 /sw.js, /manifest.webmanifest, /foo.txt → 404 im Proxy; echte Wurzel-Dateien und tiefere Dateien → weiter', () => {
    for (const p of ['/sw.js', '/manifest.webmanifest', '/foo.txt', '/.env'])
      expect(decidePublicRoute(p, '', 'de')).toEqual({ kind: 'not-found' })
    for (const p of [
      '/robots.txt',
      '/sitemap.xml',
      '/icon.svg',
      '/apple-icon.png',
      '/de/og-image.png',
    ])
      expect(decidePublicRoute(p, '', 'de')).toEqual({ kind: 'pass' })
    expect(decidePublicRoute('/de', '', 'de')).toEqual({ kind: 'intl' })
  })

  it('T-04 ROOT_FILES deckt alle Metadaten-Dateien in src/app/ und alle Dateien in public/ ab', () => {
    const metadata = readdirSync('src/app', { withFileTypes: true })
      .filter((e) => e.isFile() && /^(robots|sitemap|favicon|icon|apple-icon)\./.test(e.name))
      .map((e) =>
        e.name === 'robots.ts'
          ? '/robots.txt'
          : e.name === 'sitemap.ts'
            ? '/sitemap.xml'
            : `/${e.name}`,
      )
    const publicFiles = readdirSync('public', { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => `/${e.name}`)
    for (const f of [...metadata, ...publicFiles]) expect(ROOT_FILES.has(f), f).toBe(true)
    expect(metadata.length).toBeGreaterThanOrEqual(4)
  })
})
