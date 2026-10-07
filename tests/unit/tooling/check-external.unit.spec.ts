import { describe, expect, it } from 'vitest'

import {
  findAdminRouteLeaks,
  findForeignUrls,
  findSentryLeaks,
} from '../../../scripts/check-external'

// AK-2-04 (Teil): Der Verwaltungspfad steht in keiner ausgelieferten Datei.
describe('check:external --built', () => {
  it('AK-2-04 meldet Dateien mit dem Verwaltungspfad', () => {
    const files = [
      { path: '.next/static/chunks/a.js', content: 'fetch("/api/users")' },
      { path: '.next/server/app/index.html', content: '<a href="/werkstatt/login">' },
    ]
    expect(findAdminRouteLeaks(files, '/werkstatt')).toEqual(['.next/server/app/index.html'])
    expect(findAdminRouteLeaks(files.slice(0, 1), '/werkstatt')).toEqual([])
  })

  it('T-03/R-131 meldet Fremd-URLs und lässt nur die Allowlist zu', () => {
    const files = [
      {
        path: '.next/server/app/de.html',
        content:
          '<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet">' +
          '<a href="https://www.instagram.com/planet.claire.tattoos/">IG</a>' +
          '<a href="https://ig.me/m/planet.claire.tattoos">DM</a>' +
          '<script type="application/ld+json">{"@context":"https://schema.org"}</script>' +
          '<link rel="canonical" href="https://planetclairetattoos.com/de">' +
          '<img src="//cdn.example.net/x.png">' +
          '<a href="https://react.dev/errors/1">nur in JS erlaubt</a>',
      },
      {
        path: '.next/static/chunks/a.js',
        content:
          'e="http://www.w3.org/2000/svg";t="https://react.dev/errors/"+n;a//b.cd;' +
          'fetch("https://www.google-analytics.com/collect")',
      },
      {
        path: '.next/static/chunks/b.css',
        content: '@import url(https://fonts.gstatic.com/s/x.woff2);',
      },
    ]
    expect(findForeignUrls(files, ['https://planetclairetattoos.com'])).toEqual([
      { path: '.next/server/app/de.html', url: 'https://fonts.googleapis.com/css2?family=X' },
      // P12.7 (U-15): Direktnachricht-Links gibt es nicht mehr, `ig.me` ist nicht mehr erlaubt.
      { path: '.next/server/app/de.html', url: 'https://ig.me/m/planet.claire.tattoos' },
      { path: '.next/server/app/de.html', url: '//cdn.example.net/x.png' },
      { path: '.next/server/app/de.html', url: 'https://react.dev/errors/1' },
      { path: '.next/static/chunks/a.js', url: 'https://www.google-analytics.com/collect' },
      { path: '.next/static/chunks/b.css', url: 'https://fonts.gstatic.com/s/x.woff2' },
    ])
  })

  it('P4.25 Kassen-Chunk: Stripe.js-Lader und zod-Schema-Kennungen nur in JS erlaubt; Regex-Literal ist keine Adresse', () => {
    const js = {
      path: '.next/static/chunks/k.js',
      content:
        'x="https://js.stripe.com/v3";y="http://json-schema.org/draft-07/schema#";z=/^https?:\\/\\/i.test(t);w="https://docs.stripe.com/sdks"',
    }
    expect(findForeignUrls([js])).toEqual([])
    const html = {
      path: '.next/server/app/de.html',
      content: '<script src="https://js.stripe.com/v3"></script>',
    }
    expect(findForeignUrls([html])).toEqual([{ path: html.path, url: 'https://js.stripe.com/v3' }])
  })

  it('R-049 lässt nur die Gewährleistungs-Seite von „Your Europe“ zu, nie die OS-Plattform', () => {
    const files = [
      {
        path: '.next/server/app/de/agb.html',
        content:
          '<a href="https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_de.htm">EU</a>' +
          '<a href="https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_en.htm">EU</a>' +
          '<a href="https://ec.europa.eu/consumers/odr">OS</a>' +
          '<a href="https://europa.eu/youreurope/citizens/consumers/consumers-dispute-resolution/index_de.htm">x</a>',
      },
    ]
    expect(findForeignUrls(files)).toEqual([
      { path: '.next/server/app/de/agb.html', url: 'https://ec.europa.eu/consumers/odr' },
      {
        path: '.next/server/app/de/agb.html',
        url: 'https://europa.eu/youreurope/citizens/consumers/consumers-dispute-resolution/index_de.htm',
      },
    ])
  })
})

describe('findSentryLeaks (AK-A-11-02)', () => {
  it('findet Sentry-Code und -Hosts, sonst nichts', () => {
    const files = [
      { path: 'a.js', content: 'import "@sentry/nextjs"' },
      { path: 'b.js', content: 'fetch("https://o1.ingest.de.sentry.io/api")' },
      { path: 'c.js', content: 'console.log(1)' },
    ]
    expect(findSentryLeaks(files)).toEqual(['a.js', 'b.js'])
  })
})
