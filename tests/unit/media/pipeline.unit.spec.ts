import { describe, expect, it } from 'vitest'

import { downscaleDimensions, downscaledName, needsDownscale } from '@/lib/media/downscale'
import { hashedName, imageSizeFilename, isCompleteSize } from '@/lib/media/pipeline'

// DESIGN §12.2 Schritte 1, 3, 7 (DATENMODELL §6.2).
describe('Bildpipeline – reine Funktionen', () => {
  it('Schritt 1: lange Kante auf 2560 px, nie vergrößern', () => {
    expect(downscaleDimensions(4000, 3000)).toEqual({ width: 2560, height: 1920, scaled: true })
    expect(downscaleDimensions(3000, 6000)).toEqual({ width: 1280, height: 2560, scaled: true })
    expect(downscaleDimensions(1200, 800)).toEqual({ width: 1200, height: 800, scaled: false })
    expect(needsDownscale({ size: 1000 }, 2561, 100)).toBe(true)
    expect(needsDownscale({ size: 5 * 1024 * 1024 }, 1000, 1000)).toBe(true)
    expect(needsDownscale({ size: 1000 }, 2560, 2560)).toBe(false)
    expect(downscaledName('IMG_0001.HEIC.png')).toBe('IMG_0001.HEIC.jpg')
  })

  it('Schritt 3/7: nur Größen mit exaktem Zielmaß zählen (sonst entfallen sie)', () => {
    const thumb = { name: 'thumb', width: 400, height: 500 }
    expect(isCompleteSize(thumb, { filename: 'a-400x500.webp', width: 400, height: 500 })).toBe(
      true,
    )
    expect(isCompleteSize(thumb, { filename: 'a-400x427.webp', width: 400, height: 427 })).toBe(
      false,
    )
    expect(isCompleteSize(thumb, { filename: null })).toBe(false)
    const detail = { name: 'detail', width: 1600 }
    expect(
      isCompleteSize(detail, { filename: 'a-1600x1067.webp', width: 1600, height: 1067 }),
    ).toBe(true)
    expect(isCompleteSize(detail, { filename: 'a-640x427.webp', width: 640, height: 427 })).toBe(
      false,
    )
  })

  it('DM-MEDIA-02 Dateiname je Größe eindeutig, auch bei gleichem Ausgabemaß', () => {
    const at = (sizeName: string) =>
      imageSizeFilename({
        originalName: 'vase-0123456789',
        sizeName,
        width: 800,
        height: 1000,
        extension: 'webp',
      })
    expect(at('card')).toBe('vase-0123456789-card-800x1000.webp')
    expect(new Set(['card', 'detail', 'zoom'].map(at)).size).toBe(3)
  })

  it('Dateiname mit Inhalts-Hash (Auslieferung immutable)', () => {
    const a = hashedName('Schale Blau (1).JPG', Buffer.from('a'), 'png')
    const b = hashedName('Schale Blau (1).JPG', Buffer.from('b'), 'png')
    expect(a).toMatch(/^schale-blau-1-[a-f0-9]{10}\.png$/)
    expect(a).not.toBe(b)
  })
})
