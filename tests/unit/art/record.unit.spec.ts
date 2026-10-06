import { describe, expect, it } from 'vitest'

import {
  framePath,
  makeRunId,
  nextIteration,
  parseRunId,
  parseScope,
  slugLabel,
  specFile,
  tLabel,
  videoPath,
  yLabel,
} from '../../../scripts/art/lib/run'

// P9.2 Aufnahme-Grundgerüst (KUNST-QA §4.1, §4.4): Lauf-ID, Dateinamen, Szenario-Auswahl.

describe('P9.2 Lauf-ID <YYYYMMDD>-iter<NN>-<sha7>', () => {
  it('P9.2 baut und liest die Lauf-ID (UTC-Datum, zweistellige Iteration, 7 Hex-Zeichen)', () => {
    const id = makeRunId(new Date('2026-10-03T23:30:00Z'), 3, 'ABCDEF0123456789')
    expect(id).toBe('20261003-iter03-abcdef0')
    expect(parseRunId(id)).toEqual({ date: '20261003', iteration: 3, sha7: 'abcdef0' })
    expect(parseRunId('20261003-iter3-abcdef0')).toBeNull()
    expect(parseRunId('_adhoc')).toBeNull()
  })

  it('P9.2 lehnt ungültige Iteration oder Commit-Hash ab', () => {
    expect(() => makeRunId(new Date(), 0, 'abcdef0')).toThrow()
    expect(() => makeRunId(new Date(), 100, 'abcdef0')).toThrow()
    expect(() => makeRunId(new Date(), 1, 'xyz')).toThrow()
  })

  it('P9.2 nächste Iteration = höchste vorhandene + 1, fremde Ordner zählen nicht', () => {
    expect(nextIteration([])).toBe(1)
    expect(nextIteration(['20261001-iter01-aaaaaaa', '20261003-iter07-bbbbbbb', '_adhoc'])).toBe(8)
  })
})

describe('P9.2 Dateinamen frames/<SC>/<profil>/<variante>/<nnn>-<label>.webp', () => {
  it('P9.2 Frame- und Videopfade', () => {
    expect(framePath('SC-01', 'art-pixel7', 'motion', 7, 'y1840')).toBe(
      'frames/SC-01/art-pixel7/motion/007-y1840.webp',
    )
    expect(framePath('SC-12', 'art-desktop', 'reduced', 120, 'Station 3 – Ankunft')).toBe(
      'frames/SC-12/art-desktop/reduced/120-station-3-ankunft.webp',
    )
    expect(videoPath('SC-00', 'art-iphone15', 'motion', 'SC-00 Startseite laden')).toBe(
      'videos/SC-00/art-iphone15/motion/sc-00-startseite-laden.webm',
    )
    expect(() => framePath('SC-1', 'art-desktop', 'motion', 1, 'x')).toThrow()
    expect(() => framePath('SC-01', 'art-desktop', 'motion', 1000, 'x')).toThrow()
  })

  it('P9.2 Labels t/y und Slugs', () => {
    expect(tLabel(300)).toBe('t0300')
    expect(tLabel(40.4)).toBe('t0040')
    expect(yLabel(1840.6)).toBe('y1841')
    expect(slugLabel('Über/Größe  A')).toBe('uber-grosse-a')
    expect(slugLabel('***')).toBe('frame')
  })

  it('P9.2 --scope wird normalisiert und geprüft', () => {
    expect(parseScope(undefined)).toEqual([])
    expect(parseScope('sc-00, SC-12,SC-00')).toEqual(['SC-00', 'SC-12'])
    expect(() => parseScope('SC-1')).toThrow()
    expect(specFile('SC-05')).toBe('tests/art/sc-05.art.spec.ts')
  })
})

describe('P9.2 playwright.art.config.ts', () => {
  it('P9.2 Projekte je Profil × Variante plus Tempo; grep wählt genau die Kombination', async () => {
    const { default: config } = await import('../../../playwright.art.config')
    const names = (config.projects ?? []).map((p) => p.name)
    expect(names).toEqual([
      'art-iphone15-motion',
      'art-iphone15-reduced',
      'art-pixel7-motion',
      'art-pixel7-reduced',
      'art-desktop-motion',
      'art-desktop-reduced',
      'art-pixel7-tempo',
    ])
    const grep = (name: string) =>
      (config.projects ?? []).find((p) => p.name === name)!.grep as RegExp
    expect(grep('art-pixel7-reduced').test('SC-02 x @art-pixel7 @art-desktop @reduced')).toBe(true)
    expect(grep('art-pixel7-motion').test('SC-02 x @art-pixel7 @art-desktop @reduced')).toBe(false)
    expect(grep('art-desktop-motion').test('SC-11 x @art-pixel7 @motion @reduced')).toBe(false)
    expect(grep('art-pixel7-tempo').test('SC-18 @art-pixel7 @tempo')).toBe(true)
    expect(grep('art-pixel7-motion').test('SC-18 @art-pixel7 @tempo')).toBe(false)
    const iphone = (config.projects ?? []).find((p) => p.name === 'art-iphone15-motion')!
    expect(iphone.use?.viewport).toEqual({ width: 393, height: 659 })
    const desktop = (config.projects ?? []).find((p) => p.name === 'art-desktop-reduced')!
    expect(desktop.use?.viewport).toEqual({ width: 1440, height: 900 })
    expect(desktop.use?.contextOptions?.reducedMotion).toBe('reduce')
  })
})
