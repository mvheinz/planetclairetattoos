import { describe, expect, it } from 'vitest'

import { findAdminRouteLeaks, findForeignUrls } from '../../../scripts/check-external'

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
      { path: '.next/server/app/de.html', url: '//cdn.example.net/x.png' },
      { path: '.next/server/app/de.html', url: 'https://react.dev/errors/1' },
      { path: '.next/static/chunks/a.js', url: 'https://www.google-analytics.com/collect' },
      { path: '.next/static/chunks/b.css', url: 'https://fonts.gstatic.com/s/x.woff2' },
    ])
  })
})
