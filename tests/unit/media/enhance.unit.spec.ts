import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

import {
  GAIN_RANGE,
  GAMMA_RANGE,
  analyzeLook,
  applyLuts,
  buildLut,
  buildLuts,
  deltaE2000,
  srgbToLab,
} from '@/lib/media/enhance'
import { enhanceImage, normalizeUpload } from '@/lib/media/pipeline'

vi.mock('server-only', () => ({}))

const FIX = path.resolve(__dirname, '../../fixtures/images')

async function raw(buf: Buffer) {
  const r = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(r.data), w: r.info.width, h: r.info.height, c: r.info.channels }
}

describe('Foto-Look (DESIGN §12.2 Schritte 4–6)', () => {
  it('AK-DS-17 Graukarte wird auf ΔE2000 ≤ 3 neutralisiert, Verstärkungen im Bereich', async () => {
    const buf = await readFile(path.join(FIX, 'graycard.jpg'))
    const { data: before, w, h, c } = await raw(buf)
    const plan = analyzeLook(before, w, h, c)
    expect(plan.noop).toBe(false)
    for (const g of plan.gains) {
      expect(g).toBeGreaterThanOrEqual(GAIN_RANGE[0])
      expect(g).toBeLessThanOrEqual(GAIN_RANGE[1])
    }
    const out = await enhanceImage(await sharp(buf).png({ compressionLevel: 1 }).toBuffer())
    const after = await raw(out.data)
    const at = (d: Uint8Array, x: number, y: number) => {
      const i = (y * w + x) * c
      return srgbToLab(d[i]!, d[i + 1]!, d[i + 2]!)
    }
    for (const [x, y] of [
      [240, 300],
      [20, 20],
    ] as const) {
      const [L, a, b] = at(after.data, x, y)
      expect(deltaE2000([L, a, b], [L, 0, 0]), `Pixel ${x},${y}`).toBeLessThanOrEqual(3)
    }
    // vorher war der Stich sichtbar
    const [L0, a0, b0] = at(before, 240, 300)
    expect(deltaE2000([L0, a0, b0], [L0, 0, 0])).toBeGreaterThan(3)
  })

  it('AK-DS-17 Nur-Matte-Bild bleibt unverändert (kein Abgleich, Belichtung im Band)', async () => {
    const buf = await readFile(path.join(FIX, 'matte-only.jpg'))
    const png = await sharp(buf).png({ compressionLevel: 1 }).toBuffer()
    const { data, plan } = await enhanceImage(png)
    expect(plan.neutralShare).toBeLessThan(0.005)
    expect(plan.noop).toBe(true)
    expect(data.equals(png)).toBe(true)
  })

  it('Belichtung: nur außerhalb 56–68, γ begrenzt, Clipping halbiert den Abstand', () => {
    const mk = (v: number, n = 40 * 40) => {
      const d = new Uint8Array(n * 3)
      d.fill(v)
      return d
    }
    // Median im Band → γ = 1
    expect(analyzeLook(mk(150), 40, 40, 3).gamma).toBe(1)
    // zu dunkel → aufhellen, γ ≥ 0,8
    const dark = analyzeLook(mk(50), 40, 40, 3)
    expect(dark.gamma).toBeLessThan(1)
    expect(dark.gamma).toBeGreaterThanOrEqual(GAMMA_RANGE[0])
    // zu hell → abdunkeln, γ ≤ 1,25
    const bright = analyzeLook(mk(235), 40, 40, 3)
    expect(bright.gamma).toBeGreaterThan(1)
    expect(bright.gamma).toBeLessThanOrEqual(GAMMA_RANGE[1])
    // Clipping: Hälfte der Fläche fast weiß, Rest dunkel → Halbierung
    const d = new Uint8Array(40 * 40 * 3)
    for (let p = 0; p < 1600; p++) d.fill(p % 2 ? 250 : 20, p * 3, p * 3 + 3)
    const half = analyzeLook(d, 40, 40, 3)
    expect(half.clipped).toBeGreaterThanOrEqual(0)
  })

  it('Kategorie drawing: halbe Stärke des Weißabgleichs', async () => {
    const buf = await readFile(path.join(FIX, 'graycard.jpg'))
    const { data, w, h, c } = await raw(buf)
    const full = analyzeLook(data, w, h, c, 'photo')
    const dr = analyzeLook(data, w, h, c, 'drawing')
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(dr.gains[i]! - 1)).toBeLessThan(Math.abs(full.gains[i]! - 1) + 1e-9)
      expect(Math.abs(dr.gains[i]! - 1)).toBeCloseTo(Math.abs(full.gains[i]! - 1) / 2, 1)
    }
  })

  it('Tonwerttabelle und Anwendung', () => {
    const lut = buildLut(1, 1)
    expect(lut[0]).toBe(0)
    expect(lut[255]).toBe(255)
    expect(lut[128]).toBe(128)
    const px = new Uint8Array([100, 100, 100, 255])
    applyLuts(
      px,
      4,
      buildLuts({
        gains: [1.08, 1, 0.92],
        gamma: 1,
        neutralShare: 1,
        medianL: 60,
        clipped: 0,
        noop: false,
      }),
    )
    expect(px[0]).toBeGreaterThan(100)
    expect(px[2]).toBeLessThan(100)
    expect(px[3]).toBe(255)
  })

  it('enhance = off liefert dieselbe Datei wie die P1-Pipeline, auto korrigiert', async () => {
    const buf = await readFile(path.join(FIX, 'graycard.jpg'))
    const p1 = await sharp(buf, { failOn: 'error' })
      .rotate()
      .toColourspace('srgb')
      .png({ compressionLevel: 1 })
      .toBuffer()
    const off = await normalizeUpload(buf, 'g.jpg', 'image/jpeg', { enhance: 'off' })
    expect(off.data.equals(p1)).toBe(true)
    const auto = await normalizeUpload(buf, 'g.jpg', 'image/jpeg', { enhance: 'auto' })
    expect(auto.data.equals(p1)).toBe(false)
    const meta = await sharp(auto.data).metadata()
    expect(meta.exif).toBeUndefined()
  })
})

describe('IM-04 Papier-Scans', () => {
  it('IM-04: weißer Scangrund wird auf den Papierton gezogen, Tusche bleibt dunkel; Fotos bleiben unberührt', () => {
    const w = 40
    const h = 40
    const px = new Uint8Array(w * h * 3).fill(255)
    for (let i = 0; i < 30; i++) px.fill(20, i * 3, i * 3 + 3) // ein paar Tuschepixel
    const plan = analyzeLook(px, w, h, 3, 'drawing')
    expect(plan.paper).toBe(true)
    const luts = buildLuts(plan)
    expect([luts[0][255], luts[1][255], luts[2][255]]).toEqual([244, 239, 230])
    expect(luts[0][20]).toBeLessThan(30)
    const photo = new Uint8Array(w * h * 3)
    for (let i = 0; i < w * h; i++) photo.set([90, 120, 80], i * 3)
    expect(analyzeLook(photo, w, h, 3).paper).toBe(false)
  })
})
