import { describe, expect, it } from 'vitest'

import { ExportError } from '../../../scripts/preview-export/errors'
import {
  cleanCss,
  inlineCssUrls,
  mergeCss,
  orderStylesheets,
} from '../../../scripts/preview-export/transform/css'
import { fontDataUri, isFont } from '../../../scripts/preview-export/transform/fonts'
import { buildSpriteSheet, spriteUseTarget } from '../../../scripts/preview-export/transform/svg'

describe('Vorschau-Export: CSS (KONZEPT §12.5 Nr. 2, ARCHITEKTUR §14.5)', () => {
  it('Stylesheets in Reihenfolge des ersten Auftretens', () => {
    expect(
      orderStylesheets([
        ['/a.css', '/b.css'],
        ['/b.css', '/c.css', '/a.css'],
      ]),
    ).toEqual(['/a.css', '/b.css', '/c.css'])
  })

  it('dedupliziert nach Inhalts-Hash zu einem Stylesheet', () => {
    const css = mergeCss([
      { path: '/a.css', css: 'a{color:red}' },
      { path: '/b.css', css: 'b{color:blue}' },
      { path: '/c.css', css: 'a{color:red}' },
    ])
    expect(css).toBe('a{color:red}\nb{color:blue}')
  })

  it('@import führt zu Exit 1; Source-Maps werden entfernt', () => {
    const err = (() => {
      try {
        cleanCss('@import url("/x.css");a{}', '/s.css')
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(ExportError)
    expect((err as ExportError).exitCode).toBe(1)
    expect(
      cleanCss('/* @import in Kommentar */a{}\n/*# sourceMappingURL=a.css.map */', '/a.css'),
    ).toBe('/* @import in Kommentar */a{}')
  })

  it('Schriften als data:font/woff2;base64, Bilder als Data-URI, Unbekanntes lädt nichts', () => {
    const font = fontDataUri(
      Buffer.from('wOF2'),
      'application/octet-stream',
      '/_next/static/media/m.woff2',
    )
    expect(font).toBe(`data:font/woff2;base64,${Buffer.from('wOF2').toString('base64')}`)
    expect(isFont('font/woff2', '/x')).toBe(true)
    const warnings: string[] = []
    const out = inlineCssUrls(
      '@font-face{src:url(../media/m.woff2) format("woff2")}.a{background:url("/i.png")}.b{background:url(/gone.png)}.c{mask:url(#m)}',
      '/_next/static/chunks/s.css',
      (p) =>
        p === '/_next/static/media/m.woff2'
          ? font
          : p === '/i.png'
            ? 'data:image/webp;base64,AA'
            : null,
      warnings,
    )
    expect(out).toContain(`url("${font}")`)
    expect(out).toContain('url("data:image/webp;base64,AA")')
    expect(out).toContain('url("data:,")')
    expect(out).toContain('url(#m)')
    expect(out).not.toMatch(/url\(["']?\//)
    expect(warnings).toHaveLength(1)
  })

  it('SVG-Daten-URI mit eigenem url(%23id) bleibt unverändert, ohne Warnung', () => {
    const css = `.h{mask-image:url("data:image/svg+xml,%3Csvg%3E%3Crect fill='url(%23h)'/%3E%3C/svg%3E")}`
    const warnings: string[] = []
    expect(inlineCssUrls(css, '/_next/static/chunks/s.css', () => null, warnings)).toBe(css)
    expect(warnings).toEqual([])
  })
})

describe('Vorschau-Export: SVG-Sprites (ARCHITEKTUR §14.5)', () => {
  it('<use href="/art/…svg#id"> → #id; Symbole einmal in #pv-sprites', () => {
    expect(spriteUseTarget('/art/coco-sprite.v1.svg#coco-sitzen-a')).toEqual({
      file: '/art/coco-sprite.v1.svg',
      id: 'coco-sitzen-a',
    })
    expect(spriteUseTarget('#coco-sitzen-a')).toBeNull()
    const sheet = buildSpriteSheet([
      {
        path: '/art/coco-sprite.v1.svg',
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><style>.fur{fill:red}</style><symbol id="coco-a"><path d="M0 0"/></symbol></svg>',
      },
    ])
    expect(sheet).toMatch(/^<svg id="pv-sprites"[^>]* hidden aria-hidden="true"/)
    expect(sheet).toContain('<symbol id="coco-a">')
    expect(sheet).toContain('.fur{fill:red}')
  })

  it('doppelte Symbol-ID → Exit 1', () => {
    const svg = '<svg><symbol id="x"/></svg>'
    expect(() =>
      buildSpriteSheet([
        { path: '/a.svg', svg },
        { path: '/b.svg', svg },
      ]),
    ).toThrow(ExportError)
  })
})
