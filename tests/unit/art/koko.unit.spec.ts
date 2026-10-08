import { readFileSync, statSync } from 'node:fs'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import de from '../../../src/i18n/messages/de.json'
import en from '../../../src/i18n/messages/en.json'

// P12.6 Koko, Vorsitzende der Goth Dogs Berlin (U-08) und P13.2 (U-41): Freistellung nach Juttas Malerei als Büste mit
// Brustansatz, Bildbudget, Augäpfel und Lidstriche aus dem Original (keine geglätteten Formen), nur Pupillen animiert
// (reines CSS, endlos), Bewegung reduzieren, DE/EN.

const WEBP = 'public/art/koko.v3.webp'
type Eye = {
  cx: number
  cy: number
  rx: number
  ry: number
  travel: number
  ball: number[][]
  pupil: number[][]
}
const meta = JSON.parse(readFileSync('src/art/koko/koko.json', 'utf8')) as {
  w: number
  h: number
  eyes: Record<'l' | 'r', Eye>
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
const area = (poly: number[][]) =>
  Math.abs(
    poly.reduce((a, [x1 = 0, y1 = 0], i) => {
      const [x2 = 0, y2 = 0] = poly[(i + 1) % poly.length]!
      return a + x1 * y2 - x2 * y1
    }, 0),
  ) / 2
// konvexe Hülle (Monotone Chain) – Vergleich „gemalt“ gegen „geglättet“
const hull = (pts: number[][]) => {
  const p = [...pts].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!)
  const lower: number[][] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: number[][] = []
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 0) upper.pop()
    upper.push(q)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

const raw = () => sharp(WEBP).raw().ensureAlpha().toBuffer({ resolveWithObject: true })

describe('Koko (U-08, U-41): Büste', () => {
  it('Maße, Größe und Alpha: WebP mit transparentem Hintergrund, ≈ 2× Anzeigebreite, im Bildbudget', async () => {
    expect(statSync(WEBP).size).toBeLessThanOrEqual(80_000)
    const m = await sharp(WEBP).metadata()
    expect(m.format).toBe('webp')
    expect(m.hasAlpha).toBe(true)
    expect([m.width, m.height]).toEqual([meta.w, meta.h])
    expect(meta.w).toBeGreaterThanOrEqual(640)
    expect(meta.w).toBeLessThanOrEqual(760)
    const { data, info } = await raw()
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

  it('U-41 Ausschnitt: unter dem Kragen der Ansatz der orangen Brust mit weißem Brustfleck, unten ein gemalter Tuschebogen', async () => {
    const { data, info } = await raw()
    // ≈ ein Drittel länger als die frühere Büste (700 × 690), aber keine ganze Figur
    expect(info.height / info.width).toBeGreaterThan(1.05)
    expect(info.height / info.width).toBeLessThan(1.3)
    // unteres Fünftel: Orange (Brust) und Weiß (Brustfleck) deutlich vorhanden
    let warm = 0
    let white = 0
    let seen = 0
    for (let y = Math.floor(info.height * 0.8); y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const o = (y * info.width + x) * 4
        if (data[o + 3]! < 200) continue
        seen++
        const [r, g, b] = [data[o]!, data[o + 1]!, data[o + 2]!]
        if (r - b > 50) warm++
        else if ((r + g + b) / 3 > 215) white++
      }
    expect(seen).toBeGreaterThan(5000)
    expect(warm / seen).toBeGreaterThan(0.12)
    expect(white / seen).toBeGreaterThan(0.12)
    // Abschluss: in der Mitte endet jede Spalte mit dunkler Tusche (Bogen), nicht mit Weiß/Orange; der Bogen ist
    // gekrümmt (Seiten höher als die Mitte) und nicht glatt (Zittern)
    const bottoms: number[] = []
    for (let x = Math.floor(info.width * 0.3); x < info.width * 0.7; x += 4) {
      let yb = 0
      for (let y = info.height - 1; y >= 0; y--)
        if (data[(y * info.width + x) * 4 + 3]! > 160) {
          yb = y
          break
        }
      bottoms.push(yb)
      const o = ((yb - 1) * info.width + x) * 4
      expect((data[o]! + data[o + 1]! + data[o + 2]!) / 3, `Spalte ${x}`).toBeLessThan(90)
    }
    const mid = bottoms[Math.floor(bottoms.length / 2)]!
    expect(mid - bottoms[0]!).toBeGreaterThan(8)
    expect(mid - bottoms.at(-1)!).toBeGreaterThan(8)
    // nicht der Kragen allein: zwischen Kragenspitzen und Bogen liegen ≥ 12 % der Bildhöhe
    expect(mid / info.height).toBeGreaterThan(0.95)
  })

  it('Pupillen sind übermalt: im Bild liegt am Ausgangsort und auf dem Weg Weiß statt Schwarz', async () => {
    const { data, info } = await raw()
    for (const e of Object.values(meta.eyes))
      for (const x of [e.cx, e.cx + e.travel * 0.5, e.cx + e.travel * 0.9]) {
        const o = (Math.round(e.cy) * info.width + Math.round(x)) * 4
        expect((data[o]! + data[o + 1]! + data[o + 2]!) / 3).toBeGreaterThan(200)
      }
  })

  it('U-41 Augäpfel wie gemalt: Umriss aus dem Original (viele Punkte, nicht konvex, keine Ellipse), Lidstrich ringsum dunkel', async () => {
    const { data, info } = await raw()
    for (const [id, e] of Object.entries(meta.eyes)) {
      expect(e.ball.length, id).toBeGreaterThanOrEqual(40)
      // gemalte Form weicht sichtbar von ihrer geglätteten Hülle ab (frühere Fassung: konvexe Hülle)
      expect(area(e.ball) / area(hull(e.ball)), id).toBeLessThan(0.985)
      // keine Ellipse: größte Abweichung des Umrisses von der Ellipse durch dieselbe Box ≥ 2 px
      const xs = e.ball.map((p) => p[0]!)
      const ys = e.ball.map((p) => p[1]!)
      const [ex, ey] = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ]
      const [ax, ay] = [
        (Math.max(...xs) - Math.min(...xs)) / 2,
        (Math.max(...ys) - Math.min(...ys)) / 2,
      ]
      const dev = Math.max(
        ...e.ball.map(
          ([x = 0, y = 0]) =>
            Math.abs(Math.hypot((x - ex) / ax, (y - ey) / ay) - 1) * Math.min(ax, ay),
        ),
      )
      expect(dev, id).toBeGreaterThan(2)
      // Lidstrich: 4 px außerhalb des Umrisses ist es fast überall dunkel (Juttas Tusche)
      let dark = 0
      for (const [x = 0, y = 0] of e.ball) {
        const [dx, dy] = [x - ex, y - ey]
        const len = Math.hypot(dx, dy) || 1
        const [px, py] = [Math.round(x + (dx / len) * 4), Math.round(y + (dy / len) * 4)]
        const o = (py * info.width + px) * 4
        if ((data[o]! + data[o + 1]! + data[o + 2]!) / 3 < 110) dark++
      }
      expect(dark / e.ball.length, id).toBeGreaterThan(0.75)
    }
  })
})

describe('Koko (U-08, U-41): Augen und Animation', () => {
  it('Pupillen liegen auf dem ganzen Weg innerhalb des gemalten Augapfels, Augen im oberen Teil des Kopfes', () => {
    for (const e of Object.values(meta.eyes)) {
      expect(e.cy).toBeGreaterThan(meta.h * 0.35)
      expect(e.cy).toBeLessThan(meta.h * 0.5)
      expect(e.travel).toBeGreaterThan(e.rx)
      for (const f of [0, 0.5, 1]) {
        const x = e.cx + f * e.travel
        expect(inPoly(x, e.cy, e.ball)).toBe(true)
        expect(inPoly(x - e.rx * 0.5, e.cy, e.ball)).toBe(true)
        expect(inPoly(x + e.rx * 0.5, e.cy, e.ball)).toBe(true)
      }
      // Pupille: getupftes Oval in Größe und Lage der gemalten Pupille (leicht unregelmäßig, kein exaktes Oval); in Ruhe
      // reicht sie bis an Juttas linken Lidstrich (keine helle Naht), der Augapfel-Umriss schneidet den Rest ab
      expect(e.pupil.length).toBeGreaterThanOrEqual(24)
      const radii = e.pupil.map(([dx = 0, dy = 0]) => Math.hypot(dx / e.rx, dy / e.ry))
      expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.04)
      const leftOfBall = Math.min(
        ...e.ball.filter(([, y = 0]) => Math.abs(y - e.cy) < 4).map(([x = 0]) => x),
      )
      expect(e.cx + Math.min(...e.pupil.map(([dx = 0]) => dx))).toBeLessThanOrEqual(leftOfBall + 1)
    }
    expect(meta.eyes.l.cx).toBeLessThan(meta.eyes.r.cx)
    expect(meta.eyes.r.cx + meta.eyes.r.travel).toBeLessThan(meta.w * 0.85)
  })

  it('Komponente: <img> + kleines Overlay-SVG, Bild mit Maßen, nichts Drittes, kein Skript', () => {
    expect(tsx).toContain('<img')
    expect(tsx).toContain('/art/koko.v3.webp')
    expect(tsx).toMatch(/width=\{koko\.w\}/)
    expect(tsx).toMatch(/height=\{koko\.h\}/)
    expect(tsx).not.toMatch(/useEffect|setInterval|setTimeout|requestAnimationFrame|'use client'/)
    expect(tsx).not.toMatch(/https?:\/\//)
    expect(tsx).not.toMatch(/<text|GOTH DOGS BERLIN/)
    expect(tsx).not.toMatch(/<ellipse/) // keine Idealform mehr (U-41)
    expect((tsx.match(/<polygon/g) ?? []).length).toBe(2) // Augapfel-Umriss (Clip) + Pupille, je Auge in der Schleife
    expect(css).toMatch(new RegExp(`aspect-ratio:\\s*${meta.w} / ${meta.h}`))
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
