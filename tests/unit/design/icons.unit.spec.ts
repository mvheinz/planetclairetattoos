import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { buildIconSvg, splitSvg } from '../../../scripts/art/build-brand'
import {
  ICON_MAX_BYTES,
  ICON_NAMES,
  iconsModule,
  parseIcon,
  readIconSources,
} from '../../../scripts/art/build-icons'
import {
  WORDMARK_HEIGHT,
  WORDMARK_SRC,
  WORDMARK_WIDTH,
  WordmarkLink,
} from '@/components/brand/WordmarkLink'
import { Icon } from '@/components/icons/Icon'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'

// P2.5 Icons, Wortmarke, Planet-Marke, Favicon, Standard-OG (DESIGN §6.5, §12.6).

const read = (p: string) => readFileSync(path.resolve(p))
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)

describe('P2.5 Icons (DESIGN §6.5)', () => {
  it('Bestand genau laut §6.5, jede Quelle ≤ 600 B', () => {
    const files = readdirSync(path.resolve('src/art/icons')).sort()
    expect(files).toEqual([...ICON_NAMES].map((n) => `${n}.svg`).sort())
    for (const name of ICON_NAMES) {
      const bytes = read(`src/art/icons/${name}.svg`).length
      expect(bytes, name).toBeLessThanOrEqual(ICON_MAX_BYTES)
    }
  })

  it('Quellen: 24er-viewBox, Strich 1.75, runde Enden, currentColor, nur Formen ohne Fremdverweise', () => {
    for (const name of ICON_NAMES) {
      const svg = read(`src/art/icons/${name}.svg`).toString('utf8')
      expect(() => parseIcon(svg, name)).not.toThrow()
      expect(svg).not.toMatch(/<use|href=|<image|<text|style=/)
    }
    expect(() =>
      parseIcon(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><use href="#x"/></svg>',
        'x',
      ),
    ).toThrow()
  })

  it('erzeugte Komponenten-Daten entsprechen den Quellen', () => {
    expect(readFileSync(path.resolve('src/components/icons/icons.generated.ts'), 'utf8')).toBe(
      iconsModule(readIconSources()),
    )
  })

  it('jedes Icon ist aria-hidden, außer mit Label; Inline-SVG ohne <use>', () => {
    for (const name of ICON_NAMES) {
      const out = html(createElement(Icon, { name }))
      expect(out, name).toMatch(/^<svg [^>]*aria-hidden="true"/)
      expect(out).not.toContain('role="img"')
      expect(out).not.toContain('<use')
      // Darstellung einmal in global.css (PF-10), nicht je Icon als Attribute
      expect(out).toContain('class="glyph"')
    }
    const css = read('src/styles/global.css').toString('utf8')
    expect(css).toMatch(/:where\(\.glyph\)\s*\{[^}]*stroke: currentColor;[^}]*stroke-width: 1\.75;/)
    const labelled = html(createElement(Icon, { name: 'close', label: 'Schließen' }))
    expect(labelled).toContain('role="img"')
    expect(labelled).toContain('aria-label="Schließen"')
    expect(labelled).not.toContain('aria-hidden')
  })
})

describe('P2.5 Wortmarke und Planet-Marke (DESIGN §12.6)', () => {
  const wordmark = read('public/art/wordmark.svg').toString('utf8')

  it('public/art/wordmark.svg ≤ 5 KB, aus der Quelle src/art/wordmark.svg, reine Vektorumrisse', () => {
    expect(Buffer.byteLength(wordmark)).toBeLessThanOrEqual(5 * 1024)
    expect(wordmark).toBe(read('src/art/wordmark.svg').toString('utf8'))
    expect(wordmark).not.toMatch(/<text|<image|href=|@import|url\(/)
    const [, , w, h] = splitSvg(wordmark).viewBox.split(/\s+/).map(Number)
    expect([w, h]).toEqual([WORDMARK_WIDTH, WORDMARK_HEIGHT])
  })

  it('der Wortmarken-Link hat den zugänglichen Namen „planet claire – Startseite“', () => {
    expect(de.header.home).toBe('planet claire – Startseite')
    expect(en.header.home).toBe('planet claire – home page')
    // React stellt ggf. ein <link rel="preload"> für das Bild voran – nur der Link zählt.
    const out = html(createElement(WordmarkLink, { href: '/de', label: de.header.home })).replace(
      /^<link [^>]*\/?>/,
      '',
    )
    expect(out).toMatch(/^<a href="\/de"[^>]*><img [^>]*alt="planet claire – Startseite"/)
    expect(out).toContain(`src="${WORDMARK_SRC}"`)
    // Einziger Inhalt des Links ist das Bild → zugänglicher Name = Alternativtext.
    const inner = /<a [^>]*>([\s\S]*)<\/a>/.exec(out)![1]!
    expect(inner.replace(/<img [^>]*\/?>/, '')).toBe('')
  })

  it('src/app/icon.svg: Planet auf Papier-Kreis, aus src/art/planet.svg erzeugt', () => {
    const icon = read('src/app/icon.svg').toString('utf8')
    expect(icon).toBe(buildIconSvg(read('src/art/planet.svg').toString('utf8')))
    expect(icon).toContain('fill="#F4EFE6"')
    expect(icon).not.toMatch(/href=|<image|<text/)
  })

  it('favicon.ico enthält 16 und 32 px, apple-icon.png ist 180×180', async () => {
    const ico = read('src/app/favicon.ico')
    expect(ico.readUInt16LE(2)).toBe(1)
    const count = ico.readUInt16LE(4)
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + 16 * i))
    expect(sizes).toEqual([16, 32])
    for (let i = 0; i < count; i++) {
      const len = ico.readUInt32LE(6 + 16 * i + 8)
      const off = ico.readUInt32LE(6 + 16 * i + 12)
      const meta = await sharp(ico.subarray(off, off + len)).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['png', sizes[i], sizes[i]])
    }
    const apple = await sharp(read('src/app/apple-icon.png')).metadata()
    expect([apple.format, apple.width, apple.height]).toEqual(['png', 180, 180])
  })

  it('Standard-OG-Bild public/og/default.png ist 1200×630', async () => {
    const og = await sharp(read('public/og/default.png')).metadata()
    expect([og.format, og.width, og.height]).toEqual(['png', 1200, 630])
  })
})
