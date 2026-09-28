import { describe, expect, it } from 'vitest'

import { fnv1a32, mulberry32, valueNoise1D } from '@/leash/random'

// P2.15 Zufall der Tuschelinie (DESIGN §9.1, §9.3): deterministisch, ohne Zeit und ohne Math.random.

describe('leash/random', () => {
  it('fnv1a32 liefert den FNV-1a-32-Hash (Referenzwerte)', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
    expect(fnv1a32('a')).toBe(0xe40c292c)
    expect(fnv1a32('foobar')).toBe(0xbf9cf968)
    expect(fnv1a32('journey:')).toBe(fnv1a32('journey:'))
    expect(fnv1a32('journey:')).not.toBe(fnv1a32('margin:contact'))
  })

  it('mulberry32 ist deterministisch und liegt in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 1000 }, () => a())
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()))
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThan(1)
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
    expect(mulberry32(43)()).not.toBe(mulberry32(42)())
  })

  it('valueNoise1D ist glatt, begrenzt auf [-1, 1] und je Seed reproduzierbar', () => {
    const n = valueNoise1D(7)
    const m = valueNoise1D(7)
    let maxStep = 0
    let prev = n(0)
    for (let x = 0; x < 50; x += 0.01) {
      const v = n(x)
      expect(v).toBe(m(x))
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
      maxStep = Math.max(maxStep, Math.abs(v - prev))
      prev = v
    }
    // stetig: kleine Schritte in x → kleine Schritte im Wert
    expect(maxStep).toBeLessThan(0.05)
    expect(valueNoise1D(8)(3.3)).not.toBe(n(3.3))
    // am Gitterpunkt ohne Sprung
    expect(Math.abs(n(4 - 1e-9) - n(4))).toBeLessThan(1e-6)
  })
})
