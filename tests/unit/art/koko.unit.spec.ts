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

describe('Koko (U-08): Büste', () => {
  it('Maße, Größe und Alpha: WebP mit transparentem Hintergrund, ≈ 2× Anzeigebreite, im Bildbudget', async () => {
    expect(statSync(WEBP).size).toBeLessThanOrEqual(80_000)
    const img = sharp(WEBP)
    const m = await img.metadata()
    expect(m.format).toBe('webp')
    expect(m.hasAlpha).toBe(true)
    expect([m.width, m.height]).toEqual([meta.w, meta.h])
    expect(meta.w).toBeGreaterThanOrEqual(640)
    expect(meta.w).toBeLessThanOrEqual(760)
    const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
    const alpha = (x: number, y: number) =>
      data[(Math.round(y) * info.width + Math.round(x)) * 4 + 3]!
    for (const [x, y] of [
      [3, 3],
      [info.width - 4, info.height - 4],
      [3, info.height - 4],
      [info.width - 4, info.height / 2],
    ] as const)
      expect(alpha(x, y)).toBe(0)
    expect(alpha(info.width * 0.5, info.height * 0.6)).toBeGreaterThan(250) // Fell
    let opaque = 0
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 200) opaque++
    const share = opaque / (info.width * info.height)
    expect(share).toBeGreaterThan(0.35)
    expect(share).toBeLessThan(0.7)
  })

  it('nur Büste: Seitenverhältnis ≈ 1, unterer Rand ist der Kragen (kein Orange, Weiß, Körper, Pfoten, Schwanz, Kreuz)', async () => {
    const { data, info } = await sharp(WEBP)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    expect(info.height / info.width).toBeGreaterThan(0.85)
    expect(info.height / info.width).toBeLessThan(1.1)
    // nirgends deckende, warme (orange) oder helle Pixel in den unteren 15 % – nur schwarzes Fell
    let bad = 0
    let seen = 0
    for (let y = Math.floor(info.height * 0.85); y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const o = (y * info.width + x) * 4
        if (data[o + 3]! < 200) continue
        seen++
        const [r, g, b] = [data[o]!, data[o + 1]!, data[o + 2]!]
        if (r - b > 50 || (r + g + b) / 3 > 215) bad++
      }
    expect(seen).toBeGreaterThan(500)
    expect(bad / seen).toBeLessThan(0.03)
    // Zacken: der untere Rand ist uneben (mehrere Spitzen), keine gerade Kante
    const bottoms: number[] = []
    for (let x = Math.floor(info.width * 0.3); x < info.width * 0.7; x += 6) {
      let yb = 0
      for (let y = info.height - 1; y >= 0; y--)
        if (data[(y * info.width + x) * 4 + 3]! > 128) {
          yb = y
          break
        }
      bottoms.push(yb)
    }
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeGreaterThan(info.height * 0.04)
  })

  it('Pupillen sind übermalt: im Bild liegt am Ausgangsort und auf dem Weg Weiß statt Schwarz', async () => {
    const { data, info } = await sharp(WEBP)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    for (const e of Object.values(meta.eyes))
      for (const x of [e.cx, e.cx + e.travel * 0.9]) {
        const o = (Math.round(e.cy) * info.width + Math.round(x)) * 4
        expect((data[o]! + data[o + 1]! + data[o + 2]!) / 3).toBeGreaterThan(200)
      }
  })
})

describe('Koko (U-08): Augen und Animation', () => {
  it('Pupillen liegen auf dem ganzen Weg innerhalb des Augapfels (Hülle), Augen im oberen Teil des Kopfes', () => {
    for (const e of Object.values(meta.eyes)) {
      expect(e.cy).toBeGreaterThan(meta.h * 0.4)
      expect(e.cy).toBeLessThan(meta.h * 0.6)
      expect(e.travel).toBeGreaterThan(e.rx)
      for (const f of [0, 0.5, 1]) {
        const x = e.cx + f * e.travel
        expect(inPoly(x, e.cy, e.hull)).toBe(true)
        expect(inPoly(x - e.rx * 0.5, e.cy, e.hull)).toBe(true)
        expect(inPoly(x + e.rx * 0.5, e.cy, e.hull)).toBe(true)
      }
    }
    expect(meta.eyes.l.cx).toBeLessThan(meta.eyes.r.cx)
    expect(meta.eyes.r.cx + meta.eyes.r.travel).toBeLessThan(meta.w * 0.85)
  })

  it('Komponente: <img> + kleines Overlay-SVG, Bild mit Maßen, nichts Drittes, kein Skript', () => {
    expect(tsx).toContain('<img')
    expect(tsx).toContain('/art/koko.v2.webp')
    expect(tsx).toMatch(/width=\{koko\.w\}/)
    expect(tsx).toMatch(/height=\{koko\.h\}/)
    expect(tsx).not.toMatch(/useEffect|setInterval|setTimeout|requestAnimationFrame|'use client'/)
    expect(tsx).not.toMatch(/https?:\/\//)
    expect(tsx).not.toMatch(/<text|GOTH DOGS BERLIN/)
    expect((tsx.match(/<ellipse/g) ?? []).length).toBe(1) // eine je Auge (in der Schleife)
  })

  it('reines CSS, endlos, mit Token; ruhige Halts (≈ 3 s) und schnelle Wechsel (≈ 0,4 s); Standbild bei weniger Bewegung', () => {
    expect(css).toContain('var(--dur-koko-look)')
    const anims = [...css.matchAll(/^\s*animation:\s*([^;]+);/gm)]
      .map((m) => m[1]!)
      .filter((a) => a !== 'none')
    expect(anims).toHaveLength(1)
    expect(anims[0]).toMatch(/\binfinite\b/)
    expect(anims[0]).not.toMatch(/\b\d+m?s\b|\bforwards\b/)
    // Token 6,8 s = 2 × (3 s Halt + 0,4 s Wechsel); Prozentpunkte im Keyframe passen dazu
    const tokens = readFileSync('src/styles/tokens.css', 'utf8')
    expect(tokens).toMatch(/--dur-koko-look:\s*6800ms/)
    const cycle = 6800
    const kf = css.slice(css.indexOf('@keyframes koko-look'))
    const pcts = [...kf.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]))
    expect(pcts).toEqual(expect.arrayContaining([0, 44.12, 50, 94.12, 100]))
    expect(((44.12 / 100) * cycle) / 1000).toBeCloseTo(3, 1) // Halt links
    expect((((50 - 44.12) / 100) * cycle) / 1000).toBeCloseTo(0.4, 1) // Wechsel
    expect((((94.12 - 50) / 100) * cycle) / 1000).toBeCloseTo(3, 1) // Halt rechts
    expect((((100 - 94.12) / 100) * cycle) / 1000).toBeCloseTo(0.4, 1)
    expect(css).not.toMatch(/\.drawing\s*\{[^}]*animation/s)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/)
    expect(css).toMatch(/html\[data-motion='reduced'\] \.look[\s\S]*animation:\s*none/)
  })

  it('Alt-Text DE/EN beschreibt den Hund', () => {
    expect(de.home.chairwomanAlt).toMatch(/^Koko, Vorsitzende der Goth Dogs Berlin/)
    expect(de.home.chairwomanAlt).toMatch(/Hund/)
    expect(en.home.chairwomanAlt).toMatch(/^Koko, chairwoman of the Goth Dogs Berlin/)
    expect(en.home.chairwomanAlt).toMatch(/dog/)
  })
})
