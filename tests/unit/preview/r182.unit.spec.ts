// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import de from '../../../src/i18n/messages/de.json'
import en from '../../../src/i18n/messages/en.json'
import {
  externalReferences,
  forbiddenStrings,
  hasBanner,
  R182_BANNER_DE,
} from '../../../scripts/preview-export/portable'
import { buildDocument } from '../../../scripts/preview-export/write'
import { installBanner } from '../../../src/preview-runtime/banner'
import type { PvData } from '../../../src/preview-runtime/types'

// R-182 (E-98, P10.20): Die erzeugte Datei trägt das Band „Interne Vorschau – nicht weitergeben · Beispieldaten ·
// Rechtstexte sind Platzhalter“ und enthält keine `src=`/`href=` auf `http(s)://` außer Textlinks. Hier gegen ein
// kleines Dokument aus `buildDocument` (derselbe Weg wie der Export) und gegen die Laufzeit des Bandes; die echte Datei
// prüfen `tests/int/preview-export/determinism.int.spec.ts` und `tests/e2e/preview-portable.e2e.spec.ts`.

const pick = (m: typeof de.previewExport) => ({
  bannerInternal: m.bannerInternal,
  bannerStand: m.bannerStand,
  allPages: m.allPages,
  notBuilt: m.notBuilt,
  dialogTitle: m.dialogTitle,
  dialogClose: m.dialogClose,
  cartDemo: m.cartDemo,
  groups: m.groups,
})

const data: PvData = {
  phase: 'P10',
  date: { de: '06.10.2026', en: '6 October 2026' },
  texts: { de: pick(de.previewExport), en: pick(en.previewExport) } as PvData['texts'],
  routes: [{ route: '/de', lang: 'de', title: 'Start', group: 'start', built: true }],
}

function document_(templates: string[] = [], css = 'a{color:red}') {
  return buildDocument({
    htmlClass: '',
    title: 'Planet Claire – Vorschau',
    css,
    sprites: '',
    templates,
    data,
    assets: new Map([['a', 'data:image/webp;base64,AA']]),
    runtime: 'var x=1;',
  })
}

describe('R-182 Vorschau-Datei als interne Datei', () => {
  it('R-182 das Band steht in den Texten beider Sprachen und im Dokument', () => {
    expect(de.previewExport.bannerInternal).toBe(R182_BANNER_DE)
    expect(en.previewExport.bannerInternal).toContain('do not share')
    const html = document_()
    expect(hasBanner(html)).toBe(true)
    expect(html).toContain('<div id="pv-banner"></div>')
  })

  it('R-182 die Laufzeit schreibt das Band oben auf jede Seite, in der Sprache der Seite', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const banner = installBanner(document, host, data)
    expect(host.textContent).toContain(R182_BANNER_DE)
    expect(host.textContent).toContain(
      'Vorschau – hier wird nichts gekauft. Stand 06.10.2026, Phase P10.',
    )
    banner.setLang('en')
    expect(host.textContent).toContain(en.previewExport.bannerInternal)
    banner.destroy()
  })

  it('R-182 keine src/href auf http(s) außer Textlinks; Vorlagen und CSS werden mitgeprüft', () => {
    const clean = document_([
      '<template data-route="/de"><a href="https://www.instagram.com/planet.claire.tattoos/">IG</a>' +
        '<a href="mailto:hallo@example.com">Mail</a><a href="#/de/shop">Shop</a>' +
        '<img src="data:image/webp;base64,AA" srcset="data:image/webp;base64,AA 1x"></template>',
    ])
    expect(externalReferences(clean)).toEqual([])
    // Verweise auf Fragmente in der Datei (SVG-Filter) sind erlaubt, externe in style-Attributen nicht
    const fragments = document_(
      [
        '<template data-route="/de"><svg style="filter:url(%23h)"><g style="filter:url(#h)"></g></svg></template>',
      ],
      '.a{filter:url(#h)}',
    )
    expect(externalReferences(fragments)).toEqual([])
    expect(
      externalReferences(
        document_(['<template><p style="background:url(https://x.test/a.png)"></p></template>']),
      ),
    ).toEqual(['<p style url(https://x.test/a.png)>'])

    const bad = document_(
      [
        '<template data-route="/de"><img src="https://example.com/a.png">' +
          '<link rel="stylesheet" href="https://example.com/a.css">' +
          '<script src="//cdn.example.com/x.js"></script><img src="/media/foto.jpg"></template>',
      ],
      '@font-face{src:url(https://example.com/f.woff2)}',
    )
    expect(externalReferences(bad)).toEqual([
      '<img src="https://example.com/a.png">',
      '<link href="https://example.com/a.css">',
      '<script src="//cdn.example.com/x.js">',
      '<img src="/media/foto.jpg">',
      'url(https://example.com/f.woff2)',
    ])
  })

  it('R-182 keine Spuren von Server, Build-Pfad und Debug-Schnittstelle', () => {
    expect(forbiddenStrings(document_(), '/home/user/repo')).toEqual([])
    const html =
      '<p>http://127.0.0.1:3999/x</p> /_next/ __next_f __leash /werkstatt file:///a /home/user/repo/x'
    expect(forbiddenStrings(html, '/home/user/repo')).toEqual([
      '/_next/',
      '127.0.0.1:3999',
      '__next_f',
      '__leash',
      '/werkstatt',
      '127.0.0.1',
      'file://',
      '/home/user/repo',
    ])
    // CSS-Modul-Klassennamen der Kunst-QA-Seiten enthalten „__leash“ nur als Wortteil – kein Fund
    expect(forbiddenStrings('.qa-module__O2_KOq__leashPage{position:relative}', '/x')).toEqual([])
    expect(forbiddenStrings('window.__leash.step()', '/x')).toEqual(['__leash'])
  })
})
