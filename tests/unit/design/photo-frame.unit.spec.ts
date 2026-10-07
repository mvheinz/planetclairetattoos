import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildPhotoFrame,
  FRAME_FILE,
  FRAME_SIZE,
  FRAME_TILE,
} from '../../../scripts/art/build-photo-frame'
import { ROOT } from '../../helpers/designLint'

// U-13 / P12.3 (DESIGN §12.2a): Goth-Fotorahmen – eine gemeinsame SVG-Datei (PF-10), eingebunden als `border-image` am
// Bildrahmen von `ResponsiveImage`; alle Foto-Stellen laufen darüber.
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out)
    else out.push(rel)
  }
  return out
}

describe('U-13 Goth-Fotorahmen: SVG-Datei', () => {
  it('eingecheckte Datei = Skript-Ausgabe (pnpm art:frame), 9 Teile à 40 Einheiten', () => {
    expect(read(FRAME_FILE)).toBe(buildPhotoFrame())
    expect(FRAME_SIZE).toBe(3 * FRAME_TILE)
    expect(read(FRAME_FILE)).toContain(`viewBox="0 0 ${FRAME_SIZE} ${FRAME_SIZE}"`)
  })

  it('PF-10: ≤ 4 KB, eine Datei für alle Fotos, keine Fremdverweise, keine Skripte', () => {
    const svg = read(FRAME_FILE)
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(4096)
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)|<script|<image|xlink:href="http|@import/)
    // Ecke (4×) und Kante (4×) kommen aus je einem `<g>` – nie je Foto, nie je Seite neu gezeichnet.
    expect(svg.match(/<use /g)).toHaveLength(8)
    expect(svg.match(/<g id=/g)).toHaveLength(2)
  })

  it('dünne Tuschelinie: Außenlinie ≤ 2 Einheiten, kein dicker Block', () => {
    const widths = [...read(FRAME_FILE).matchAll(/stroke-width="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    )
    expect(widths.length).toBeGreaterThan(5)
    expect(Math.max(...widths)).toBeLessThanOrEqual(2)
  })
})

describe('U-13 Goth-Fotorahmen: Einbindung', () => {
  const css = read('src/components/media/ResponsiveImage.module.css')
  const frameRule = /\n\.frame \{([^}]*)\}/.exec(css)?.[1] ?? ''

  it('ResponsiveImage: border-image mit der gemeinsamen Datei, Slice 40, Wiederholung rund', () => {
    expect(frameRule).toMatch(
      /border-image:\s*url\('\/art\/photo-frame\.v1\.svg'\) 40 \/ var\(--pf-band\) round/,
    )
    expect(frameRule).toMatch(/border:\s*var\(--pf-band\) solid/)
  })

  it('CLS: feste aspect-ratio (inline) bleibt, Rahmen liegt in der Border-Box, kein Layout durch Nachladen', () => {
    const tsx = read('src/components/media/ResponsiveImage.tsx')
    expect(tsx).toMatch(/aspectRatio,/)
    expect(tsx).toContain('data-photo-frame')
    expect(frameRule).toMatch(/container-type:\s*size/)
    expect(css).not.toMatch(/\.frame[^{]*\{[^}]*(?:width|height):\s*(?!100%)[^;]*\+/)
  })

  it('Registry: jede Foto-Stelle nutzt ResponsiveImage (Rahmen), kein Foto ohne Rahmen', () => {
    const files = walk('src/components').concat(walk('src/app/(frontend)'))
    const photoFiles = files.filter((f) => f.endsWith('.tsx') && /<ResponsiveImage\b/.test(read(f)))
    // Mindestens die Kontexte aus U-13: Karten, Produktseite, Galerie, Flash, Über mich, Teaser/Startseite.
    for (const need of [
      'src/components/shop/ProductCard.tsx',
      'src/components/shop/product/ProductGallery.tsx',
      'src/components/tattoo/GalleryGrid.tsx',
      'src/components/tattoo/FlashCard.tsx',
      'src/app/(frontend)/[locale]/about/page.tsx',
      'src/components/tattoo/TattooTeaser.tsx',
    ])
      expect(photoFiles, need).toContain(need)
    // Kein `<img>` mit Foto-Inhalt außerhalb von ResponsiveImage – bis auf benannte Ausnahmen (Marke, Icons, QR,
    // Vorschau eigener Uploads, QA-Seite) bzw. Stellen, die den Rahmen selbst tragen (`data-photo-frame`).
    const allowed = new Set([
      'src/components/brand/WordmarkLink.tsx',
      'src/components/order/BankDetails.tsx',
      'src/components/layout/MenuOverlay.tsx',
      'src/components/shop/product/ProductGallery.tsx', // nur Kommentar: Lightbox-Vollbild legt sein img selbst an
      'src/components/layout/SiteHeader.tsx',
      'src/components/shop/WarrantyNotice.tsx',
      'src/components/commission/CommissionImages.tsx',
      'src/app/(frontend)/[locale]/qa/art/page.tsx',
      // P12.5/P12.6: gezeichnete Figuren (keine Fotos) – Fitness-Coco und Koko, Vorsitzende der Goth Dogs Berlin
      'src/components/home/FitnessCoco.tsx',
      'src/components/home/ChairwomanKoko.tsx',
    ])
    const stray = files
      .filter((f) => f.endsWith('.tsx') && !f.startsWith('src/components/media/'))
      .filter((f) => /<img\b/.test(read(f)) && !allowed.has(f) && !/data-photo-frame/.test(read(f)))
    expect(stray).toEqual([])
  })

  it('Verkaufskarte: Passepartout und Doppelrahmen sind weg', () => {
    const card = read('src/components/shop/ProductCard.module.css')
    expect(card).not.toMatch(/padding:\s*8%/)
    expect(card).not.toMatch(/inset 0 0 0 3px/)
  })

  it('Goth-Rahmen verändert die Leine nicht: keine Leine-Datei kennt ihn', () => {
    for (const f of readdirSync(path.join(ROOT, 'src/leash')).filter((n) => n.endsWith('.ts')))
      expect(read(`src/leash/${f}`), f).not.toMatch(/photo-frame|data-photo-frame/)
  })
})
