import { describe, expect, it } from 'vitest'

import { galleryAnchor, galleryByFlash, toPublicGallery } from '@/lib/data/tattoo'
import type { Env } from '@/lib/env'
import type { TattooGallery } from '@/payload-types'

// P14.7 (U-56) – Flash ↔ Galerie: Der Galerie-Eintrag kennt die Nummer seines (veröffentlichten) Flash-Motivs, die
// Flash-Karte findet das erste sichtbare Foto. Kund:innen-Fotos ohne Einwilligung fallen schon in `toPublicGallery`
// heraus – also gibt es für sie auch keinen Link (außer Seed-Ausnahme im Vorschau-Modus).

const PROD = { APP_ENV: 'production', SEED_PREVIEW_MODE: false } as Env
const PREVIEW = { APP_ENV: 'preview', SEED_PREVIEW_MODE: true } as Env

const image = { id: 1, alt: 'Foto', url: '/api/media/file/a.jpg', restricted: false }
const flash = (number: number, published = true) => ({ id: number, number, published })

function doc(id: number, data: Partial<TattooGallery> & Record<string, unknown>): TattooGallery {
  return {
    id,
    kind: 'fresh',
    image,
    published: true,
    showsCustomer: true,
    consentGiven: true,
    sortOrder: id,
    ...data,
  } as unknown as TattooGallery
}

describe('Flash ↔ Galerie (U-56)', () => {
  it('Anker und Flash-Nummer nur für veröffentlichte Motive', () => {
    const out = toPublicGallery(
      [
        doc(1, { flash: flash(12) as never }),
        doc(2, { flash: flash(13, false) as never }),
        doc(3, { flash: 14 }),
        doc(4, {}),
      ],
      PROD,
    )
    expect(out.map((e) => [e.anchor, e.flashNumber])).toEqual([
      ['g-1', 12],
      ['g-2', null],
      ['g-3', null],
      ['g-4', null],
    ])
    expect(galleryAnchor(17)).toBe('g-17')
  })

  it('Flash-Karte verlinkt nur Fotos mit Einwilligung; erstes Foto je Motiv gewinnt', () => {
    const docs = [
      doc(1, { flash: flash(12) as never, consentGiven: false }),
      doc(2, { flash: flash(12) as never }),
      doc(3, { flash: flash(12) as never }),
      doc(4, { flash: flash(20) as never, showsCustomer: false, consentGiven: false }),
      doc(5, { flash: flash(21) as never, consentGiven: false, seed: true }),
    ]
    const map = galleryByFlash(toPublicGallery(docs, PROD))
    expect(map.get(12)?.id).toBe(2)
    expect(map.get(20)?.id).toBe(4)
    expect(map.has(21)).toBe(false)

    // Vorschau-Modus: Seed-Ausnahme mit Etikett darf verlinkt werden (wie die Galerie sie zeigt).
    const preview = galleryByFlash(toPublicGallery(docs, PREVIEW))
    expect(preview.get(21)?.internal).toBe(true)
  })

  it('Widerruf: Eintrag offline → kein Link mehr', () => {
    const docs = [doc(1, { flash: flash(12) as never, published: false })]
    expect(galleryByFlash(toPublicGallery(docs, PROD)).size).toBe(0)
  })
})
