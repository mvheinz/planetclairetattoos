import { describe, expect, it } from 'vitest'

import {
  notBuiltRoutes,
  specialPage,
  TOKEN_PAGES_NOTE,
} from '../../../scripts/preview-export/assemble'
import * as cheerio from 'cheerio'

import {
  normalizeCountdowns,
  PREVIEW_COUNTDOWN_TEXT,
  routeInfo,
  templateHtml,
  transformPage,
  type TransformContext,
} from '../../../scripts/preview-export/transform/html'
import type { EncodedImage } from '../../../scripts/preview-export/transform/images'
import { bundleRuntime, RUNTIME_MAX_BYTES } from '../../../scripts/preview-export/runtime'
import {
  buildDocument,
  jsonForScript,
  PREVIEW_CSP,
  scriptForHtml,
} from '../../../scripts/preview-export/write'

const HTML = `<!doctype html><html lang="de" class="font-a font-b"><head>
<meta charset="utf-8"><title>Impressum · Planet Claire</title><meta name="description" content="Wer steht dahinter">
<link rel="preload" href="/_next/static/media/f.woff2" as="font"><link rel="stylesheet" href="/_next/static/chunks/a.css">
<script src="/_next/static/chunks/main.js" async></script></head>
<body data-preset="legal" data-route="R21"><div hidden><!--$--><!--/$--></div>
<a href="#inhalt">Zum Inhalt</a>
<header><img src="/art/wordmark.svg" alt="" width="423" height="107"><a href="/de/warenkorb">Korb</a>
<a href="/en/legal-notice">English</a><a href="https://www.instagram.com/planet.claire.tattoos/">IG</a></header>
<div data-preview-banner="">Vorschau mit Beispieldaten</div>
<main id="inhalt"><h1>Impressum</h1><p>http://127.0.0.1:3999/de/vertrag-widerrufen</p>
<img src="/media/foto.jpg" srcset="/media/foto-2x.jpg 2x" sizes="100vw" alt="Foto">
<div data-behavior="menu" aria-label="Menü" id="menu"></div>
<svg><use href="/art/coco-sprite.v1.svg#coco-sitzen-a"></use></svg>
<form action="/api/withdrawals" method="post"><button type="submit">Senden</button></form></main>
<footer><a href="/de/vertrag-widerrufen">Vertrag widerrufen</a><a href="mailto:hallo@example.com">Mail</a></footer>
<noscript><style>.x{}</style></noscript><next-route-announcer></next-route-announcer>
<script>self.__next_f.push([1,"x"])</script><script type="application/json">{"a":1}</script>
</body></html>`

const img = (hash: string): EncodedImage => ({
  hash,
  dataUri: `data:image/webp;base64,${hash}`,
  width: 1200,
  height: 800,
  bytes: 10,
})

const ctx = (): TransformContext => ({
  link: {
    currentRoute: '/de/impressum',
    exported: new Set(['/de/impressum', '/en/legal-notice', '/de/vertrag-widerrufen']),
    redirects: {},
    origin: 'http://127.0.0.1:3999',
  },
  images: new Map([
    ['/art/wordmark.svg', { ...img('wm'), width: 423, height: 107 }],
    ['/media/foto.jpg', img('foto')],
  ]),
  sprites: new Set(['/art/coco-sprite.v1.svg']),
  warnings: [],
})

describe('Vorschau-Export: Seiten-Umwandlung (ARCHITEKTUR §14.5)', () => {
  const page = transformPage({ path: '/de/impressum', lang: 'de', html: HTML }, ctx())

  it('entfernt Skripte, Next-Daten, Preloads, noscript, Routen-Ansager und das App-Banner', () => {
    expect(page.body).not.toMatch(
      /<script|__next_f|<noscript|next-route-announcer|<link|_next|<!--/,
    )
    expect(page.body).not.toContain('data-preview-banner')
  })

  it('behält data-behavior, ARIA und ids', () => {
    expect(page.body).toContain('data-behavior="menu"')
    expect(page.body).toContain('aria-label="Menü"')
    expect(page.body).toContain('id="inhalt"')
  })

  it('Bilder → data-pv-src ohne src/srcset/sizes, mit Maßen, lazy', () => {
    expect(page.body).toContain(
      '<img alt="Foto" data-pv-src="foto" width="1200" height="800" loading="lazy" decoding="async">',
    )
    expect(page.body).not.toMatch(/\ssrc=|srcset|sizes=/)
    expect(page.body).toContain('data-pv-src="wm"')
  })

  it('Sprite-Verweise → <use href="#id">', () => {
    expect(page.body).toContain('<use href="#coco-sitzen-a">')
  })

  it('Links nach KONZEPT §12.5 Nr. 5, externe Links in neuem Tab', () => {
    expect(page.body).toContain('href="#/de/impressum#inhalt"')
    expect(page.body).toContain('href="#/vorschau/nicht-enthalten"')
    expect(page.body).toContain('href="#/en/legal-notice"')
    expect(page.body).toContain('href="#/de/vertrag-widerrufen"')
    expect(page.body).toContain(
      'href="https://www.instagram.com/planet.claire.tattoos/" target="_blank" rel="noopener noreferrer"',
    )
    expect(page.body).toContain('href="mailto:hallo@example.com"')
  })

  it('Formulare ohne action mit data-pv-form', () => {
    expect(page.body).toContain('<form data-pv-form="">')
  })

  it('keine Export-Adresse im Text', () => {
    expect(page.body).not.toContain('127.0.0.1:3999')
    expect(page.body).toContain('https://planetclairetattoos.com/de/vertrag-widerrufen')
  })

  it('Template mit Route, Titel, Sprache, Beschreibung und <body>-Attributen', () => {
    expect(page.title).toBe('Impressum · Planet Claire')
    expect(page.description).toBe('Wer steht dahinter')
    expect(page.htmlClass).toBe('font-a font-b')
    expect(page.group).toBe('legal')
    const tpl = templateHtml(page)
    expect(tpl).toMatch(
      /^<template data-route="\/de\/impressum" data-lang="de" data-title="Impressum · Planet Claire" data-description="Wer steht dahinter" data-group="legal" data-leash-key="R21" data-body="\{&quot;data-preset&quot;:&quot;legal&quot;,&quot;data-route&quot;:&quot;R21&quot;\}">/,
    )
  })

  it('Leinen-Schlüssel wie LeashLayer: Route plus sprachunabhängige Parameter, 404 → R28', () => {
    expect(routeInfo('/de').leashKey).toBe('R01')
    expect(routeInfo('/de/__404').leashKey).toBe('R28')
    expect(routeInfo('/de/shop/017-vase').leashKey).toBe('R04/nummer=017')
  })

  it('Zusatzseite behält Kopf und Fuß, ersetzt <main> und nutzt die ruhige Linie', () => {
    const withLayer = transformPage(
      {
        path: '/de',
        lang: 'de',
        html: HTML.replace(
          '<main',
          '<div data-leash-layer="" data-leash-preset="journey"></div><div data-leash-coco=""></div><main',
        ),
      },
      ctx(),
    )
    const sp = specialPage(
      withLayer,
      '/vorschau/nicht-enthalten',
      'Nicht enthalten',
      '<h1>Weg</h1>',
    )
    expect(sp.body).toContain('<h1>Weg</h1>')
    expect(sp.body).not.toContain('<h1>Impressum</h1>')
    expect(sp.body).toContain('Vertrag widerrufen')
    expect(sp.body).toContain('data-leash-preset="calm"')
    expect(sp.body).not.toContain('data-leash-coco')
    expect(sp.bodyAttrs).toEqual({ 'data-preset': 'calm' })
  })

  it('nicht gebaute Registry-Routen (planned bzw. 404) je Sprache', () => {
    const nb = notBuiltRoutes({
      pages: [],
      notBuilt: [{ routeId: 'R21', path: '/de/impressum', lang: 'de' }],
    })
    const routes = nb.map((r) => r.route)
    // R06–R09 sind seit P4 gebaut; R10 (Auftragsarbeiten) noch nicht.
    expect(routes).not.toContain('/de/warenkorb')
    expect(routes).not.toContain('/de/kasse')
    expect(routes).not.toContain('/de/bestellung/[token]')
    expect(routes).toContain('/de/auftragsarbeiten')
    expect(routes).not.toContain('/de/shop')
    expect(routes).not.toContain('/de/archiv')
    expect(routes).not.toContain('/en/checkout')
    expect(routes).toContain('/de/impressum')
    expect(routes).not.toContain('/en/legal-notice')
  })
})

describe('Vorschau-Export: Dokument (KONZEPT §12.4)', () => {
  it('Kopf mit robots noindex und CSP-Meta, JSON und Laufzeit sicher eingebettet', () => {
    const html = buildDocument({
      htmlClass: 'f',
      title: 'Planet Claire – Vorschau',
      css: 'a{}',
      sprites: '',
      templates: ['<template data-route="/de"></template>'],
      data: {
        phase: 'P2',
        date: { de: '28.09.2026', en: '28 September 2026' },
        texts: {} as never,
        routes: [],
      },
      assets: new Map([
        ['b', 'data:image/webp;base64,BB'],
        ['a', 'data:image/webp;base64,AA'],
      ]),
      runtime: 'var s="</script>";',
    })
    expect(html).toMatch(/^<!doctype html>\n<html lang="de" class="f">/)
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`)
    expect(PREVIEW_CSP).toContain("default-src 'none'")
    expect(PREVIEW_CSP).toContain("connect-src 'none'")
    expect(html.indexOf('"a":')).toBeLessThan(html.indexOf('"b":'))
    expect(html.match(/<\/script>/g)).toHaveLength(3)
    expect(scriptForHtml('x="</script>"')).toBe('x="<\\/script>"')
    expect(jsonForScript({ a: '</script>' })).not.toContain('</')
    expect(html).toContain('<div id="pv-banner"></div>\n<div id="pv-root"></div>')
  })
})

describe('Vorschau-Laufzeit: Bündel (ARCHITEKTUR §14.6, AK-A-2-03)', () => {
  it('AK-A-2-03 Laufzeit ≤ 300 KB minifiziert, ohne react/next/payload', async () => {
    const bundle = await bundleRuntime()
    expect(bundle.bytes).toBeLessThanOrEqual(RUNTIME_MAX_BYTES)
    expect(
      bundle.inputs.some((p) => /node_modules\/(react|react-dom|next|payload)\//.test(p)),
    ).toBe(false)
    expect(bundle.inputs).toContain('src/leash/runtime.ts')
    expect(bundle.inputs).toContain('src/behaviors/menu.ts')
    expect(bundle.code).not.toMatch(/\bimport\(/)
    expect(bundle.code).not.toContain('__leash')
    expect(bundle.code).not.toMatch(/XMLHttpRequest|\bfetch\(/)
  }, 30_000)
})

describe('P4.25 Korb und Kasse in der Vorschau', () => {
  it('Countdown: Demo ab 30:00, ohne echte Zeitpunkte des Export-Laufs (AK-A-14-01, KONZEPT §12.5 Nr. 7)', () => {
    const $ = cheerio.load(`<section data-behavior="reservation-countdown" data-countdown="full"
      data-expires-at="2026-09-29T10:30:00.000Z" data-server-now="2026-09-29T10:00:01.000Z" data-level="warn">
      <p data-countdown-time>04:59</p><p data-countdown-text hidden>x</p><div data-countdown-expired></div></section>
      <div data-countdown="compact" data-time-template="Noch {time} reserviert" data-expires-at="x" data-server-now="y">
      <p data-countdown-time>Noch 29:59 reserviert</p></div>`)
    normalizeCountdowns($)
    expect($('[data-expires-at], [data-server-now]')).toHaveLength(0)
    expect($('[data-countdown="full"]').attr('data-level')).toBe('normal')
    expect($('[data-countdown="full"] [data-countdown-time]').text()).toBe(PREVIEW_COUNTDOWN_TEXT)
    expect($('[data-countdown="full"] [data-countdown-text]').attr('hidden')).toBeUndefined()
    expect($('[data-countdown="full"] [data-countdown-expired]').attr('hidden')).toBeDefined()
    expect($('[data-countdown="compact"] [data-countdown-time]').text()).toBe(
      'Noch 30:00 reserviert',
    )
  })

  it('Danke- und Statusseiten ohne Seed-Anker: „ab P8“ im Bericht (EK-11)', () => {
    const nb = notBuiltRoutes({
      pages: [],
      notBuilt: [
        { routeId: 'R08', path: '/de/danke/abc', lang: 'de' },
        { routeId: 'R09', path: '/en/order/abc', lang: 'en' },
      ],
    })
    expect(nb.find((r) => r.route === '/de/danke/[token]')?.note).toBe(TOKEN_PAGES_NOTE)
    expect(nb.find((r) => r.route === '/en/order/[token]')?.note).toBe(TOKEN_PAGES_NOTE)
    expect(TOKEN_PAGES_NOTE).toMatch(/^ab P8/)
  })
})
