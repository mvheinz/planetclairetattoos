import { readFileSync, statSync } from 'node:fs'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import de from '../../../src/i18n/messages/de.json'
import en from '../../../src/i18n/messages/en.json'

// P12.6 Koko, Vorsitzende der Goth Dogs Berlin (U-08): Freistellung nach Juttas Malerei, Bildbudget, Augen, nur
// Pupillen animiert (reines CSS, endlos), Bewegung reduzieren, DE/EN.

const WEBP = 'public/art/koko.v2.webp'
const meta = JSON.parse(readFileSync('src/art/koko/koko.json', 'utf8')) as {
  w: number
  h: number
  eyes: Record<
    'l' | 'r',
    { cx: number; cy: number; rx: number; ry: number; travel: number; hull: number[][] }
  >
}
const css = readFileSync('src/components/home/Koko.module.css', 'utf8')
const tsx = readFileSync('src/components/home/ChairwomanKoko.tsx', 'utf8')

const inPoly = (x: number, y: number, poly: number[][]) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi = 0, yi = 0] = poly[i]!
    const [xj = 0, yj = 0] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

describe('Koko (U-08): Freistellung', () => {
  it('Maße, Größe und Alpha: WebP mit transparentem Hintergrund, ≈ 2× Anzeigebreite, im Bildbudget', async () => {
    const bytes = statSync(WEBP).size
    expect(bytes).toBeLessThanOrEqual(80_000)
    const img = sharp(WEBP)
    const m = await img.metadata()
    expect(m.format).toBe('webp')
    expect(m.hasAlpha).toBe(true)
    expect([m.width, m.height]).toEqual([meta.w, meta.h])
    expect(meta.w).toBeGreaterThanOrEqual(600)
    expect(meta.w).toBeLessThanOrEqual(720)
    const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
    const alpha = (x: number, y: number) =>
      data[(Math.round(y) * info.width + Math.round(x)) * 4 + 3]!
    for (const [x, y] of [
      [3, 3],
      [info.width - 4, 3],
      [3, info.height - 4],
      [info.width - 4, info.height - 4],
    ] as const)
      expect(alpha(x, y)).toBe(0) // Ecken: kein Shirt
    expect(alpha(info.width * 0.45, info.height * 0.62)).toBe(255) // Körper
    expect(alpha(info.width * 0.5, info.height * 0.58)).toBe(255) // weiße Brust bleibt gefüllt
    // Anteil deckender Pixel: ein Hund, kein Shirt-Rechteck
    let opaque = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 200) opaque++
    const share = opaque / (info.width * info.height)
    expect(share).toBeGreaterThan(0.25)
    expect(share).toBeLessThan(0.6)
  })

  it('kein Knochenkreuz: Bild beginnt mit der Kappenspitze, links oben und der Streifen über dem Kopf sind leer', async () => {
    const { data, info } = await sharp(WEBP)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    const rowOpaque = (y: number, x0: number, x1: number) => {
      let n = 0
      for (let x = Math.round(x0); x < Math.round(x1); x++)
        if (data[(y * info.width + x) * 4 + 3]! > 40) n++
      return n
    }
    // Seitenverhältnis des Zuschnitts ≈ Hund (Kreuz hätte das Bild ≈ 1,4× höher gemacht)
    expect(info.height / info.width).toBeGreaterThan(1.25)
    expect(info.height / info.width).toBeLessThan(1.4)
    // oberes Viertel links der Mitte: nur Kappenspitze links/Fell, nichts Breites in der Mitte über dem Kopf
    for (let y = 0; y < info.height * 0.1; y += 3)
      expect(rowOpaque(y, 0, info.width * 0.55)).toBe(0)
  })

  it('Pupillen sind übermalt: im Bild liegt an den Pupillen-Ausgangsorten (links) Weiß statt Schwarz', async () => {
    const { data, info } = await sharp(WEBP)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    for (const e of Object.values(meta.eyes)) {
      // Punkt nahe der rechten Hälfte des Augapfels (Weg der Pupille): hell
      const x = Math.round(e.cx + e.travel * 0.9)
      const y = Math.round(e.cy)
      const o = (y * info.width + x) * 4
      const lum = (data[o]! + data[o + 1]! + data[o + 2]!) / 3
      expect(lum).toBeGreaterThan(200)
      // Ausgangsort der Pupille (hier stand im Foto Schwarz): ebenfalls Weiß (Pupille liegt als Element darüber)
      const o2 = (Math.round(e.cy) * info.width + Math.round(e.cx)) * 4
      expect((data[o2]! + data[o2 + 1]! + data[o2 + 2]!) / 3).toBeGreaterThan(200)
    }
  })
})

describe('Koko (U-08): Augen und Animation', () => {
  it('Pupillen liegen auf dem ganzen Weg innerhalb des Augapfels (Hülle) und oben im Kopf des Bildes', () => {
    for (const e of Object.values(meta.eyes)) {
      expect(e.cy).toBeGreaterThan(meta.h * 0.18)
      expect(e.cy).toBeLessThan(meta.h * 0.33)
      expect(e.travel).toBeGreaterThan(e.rx) // sichtbarer Weg: mehr als eine Pupillenbreite/2
      for (const f of [0, 0.5, 1]) {
        const x = e.cx + f * e.travel
        expect(inPoly(x, e.cy, e.hull)).toBe(true)
        // Mittelpunkt und die vier Randpunkte der Pupille liegen (fast) im Auge – der Rest wird beschnitten
        expect(inPoly(x - e.rx * 0.5, e.cy, e.hull)).toBe(true)
        expect(inPoly(x + e.rx * 0.5, e.cy, e.hull)).toBe(true)
      }
    }
    // linkes Auge links vom rechten, beide in der Kopfmitte
    expect(meta.eyes.l.cx).toBeLessThan(meta.eyes.r.cx)
    expect(meta.eyes.l.cx).toBeGreaterThan(meta.w * 0.3)
    expect(meta.eyes.r.cx + meta.eyes.r.travel).toBeLessThan(meta.w * 0.8)
  })

  it('Komponente: <img> + kleines Overlay-SVG, Bild mit Maßen, nichts Drittes, kein Skript', () => {
    expect(tsx).toContain('<img')
    expect(tsx).toContain('/art/koko.v2.webp')
    expect(tsx).toMatch(/width=\{koko\.w\}/)
    expect(tsx).toMatch(/height=\{koko\.h\}/)
    expect(tsx).not.toMatch(/useEffect|setInterval|setTimeout|requestAnimationFrame|'use client'/)
    expect(tsx).not.toMatch(/https?:\/\//)
    expect(tsx).not.toMatch(/<text|GOTH DOGS BERLIN/)
  })

  it('reines CSS, endlos, mit Token; nur Pupillen animiert; Standbild bei weniger Bewegung', () => {
    expect(css).toContain('var(--dur-koko-look)')
    const anims = [...css.matchAll(/^\s*animation:\s*([^;]+);/gm)]
      .map((m) => m[1]!)
      .filter((a) => a !== 'none')
    expect(anims.length).toBe(2)
    for (const a of anims) expect(a).toMatch(/\binfinite\b/)
    expect(anims.join(' ')).not.toMatch(/\b\d+s\b|\bforwards\b/)
    // Läufer und Standort sind die einzigen Elemente mit Animation
    expect(css).toMatch(/\.home\s*\{[^}]*animation:/s)
    expect(css).toMatch(/\.look\s*\{[^}]*animation:/s)
    expect(css).not.toMatch(/\.drawing\s*\{[^}]*animation/s)
    // nie sichtbar von rechts nach links: der Läufer ist bei der Rückkehr unsichtbar (Deckkraft 0 am Ende)
    const look = css.slice(css.indexOf('@keyframes koko-look'), css.indexOf('@keyframes koko-home'))
    expect(look).toMatch(
      /89%,\s*100%\s*\{\s*opacity:\s*0;\s*transform:\s*translateX\(var\(--koko-travel\)\)/,
    )
    // reduzierte Bewegung: beides ohne Animation (Standbild = Blick nach links)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/)
    expect(css).toMatch(/html\[data-motion='reduced'\] \.home[\s\S]*animation:\s*none/)
  })

  it('Alt-Text DE/EN beschreibt den Hund', () => {
    expect(de.home.chairwomanAlt).toMatch(/^Koko, Vorsitzende der Goth Dogs Berlin/)
    expect(de.home.chairwomanAlt).toMatch(/Hund/)
    expect(en.home.chairwomanAlt).toMatch(/^Koko, chairwoman of the Goth Dogs Berlin/)
    expect(en.home.chairwomanAlt).toMatch(/dog/)
  })
})
