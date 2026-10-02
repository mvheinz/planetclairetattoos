import { describe, expect, it } from 'vitest'

import {
  MAX_PHOTOS,
  freeSlots,
  focalKey,
  movePhoto,
  refreshAutoAlts,
  removePhoto,
  suggestAlt,
  type PiecePhoto,
} from '@/admin/components/PhotoPicker/photoList'
import {
  PHOTO_ACCEPT,
  PHOTO_UPLOAD_MAX_BYTES,
  isAcceptedPhotoType,
  isUploadTooLarge,
  planResize,
} from '@/admin/components/PhotoPicker/resize'

// P5.5 – Foto-Baustein „Neues Stück“: Zielmaße der Verkleinerung im Browser (lange Kante ≤ 2560 px, nie vergrößern),
// Upload-Grenze 4,5 MB, 12 Fotos, Reihenfolge, Alt-Text-Vorschlag (KONZEPT §7.4).

const MB = 1024 * 1024

describe('Verkleinerung vor dem Upload (AK-7-02, ARCHITEKTUR §8.8)', () => {
  it('6000×4000 → 2560×1707 (Querformat), 4000×6000 → 1707×2560 (Hochformat), neu kodiert', () => {
    expect(planResize(6000, 4000, 8 * MB)).toEqual({ width: 2560, height: 1707, reencode: true })
    expect(planResize(4000, 6000, 8 * MB)).toEqual({ width: 1707, height: 2560, reencode: true })
    expect(planResize(3000, 3000, 2 * MB)).toEqual({ width: 2560, height: 2560, reencode: true })
  })

  it('kleine Fotos bleiben unverändert (nie vergrößert); zu große Dateien werden neu kodiert', () => {
    expect(planResize(1200, 1600, 1 * MB)).toEqual({ width: 1200, height: 1600, reencode: false })
    expect(planResize(2560, 1920, 1 * MB)).toEqual({ width: 2560, height: 1920, reencode: false })
    expect(planResize(2000, 1500, 5 * MB)).toEqual({ width: 2000, height: 1500, reencode: true })
  })

  it('Dateiauswahl nur JPEG/PNG/WebP; Upload höchstens 4,5 MB', () => {
    expect(PHOTO_ACCEPT).toBe('image/jpeg,image/png,image/webp')
    expect(isAcceptedPhotoType('image/jpeg')).toBe(true)
    expect(isAcceptedPhotoType('image/heic')).toBe(false)
    expect(PHOTO_UPLOAD_MAX_BYTES).toBe(4.5 * MB)
    expect(isUploadTooLarge(4.5 * MB)).toBe(false)
    expect(isUploadTooLarge(4.5 * MB + 1)).toBe(true)
  })
})

const photo = (id: number, extra: Partial<PiecePhoto> = {}): PiecePhoto => ({
  id,
  url: null,
  altDe: `Foto ${id}`,
  altEn: '',
  altDeAuto: false,
  focalX: 50,
  focalY: 50,
  dirty: false,
  ...extra,
})

describe('Fotoliste (KONZEPT §7.4)', () => {
  it('höchstens 12 Fotos: freie Plätze', () => {
    expect(MAX_PHOTOS).toBe(12)
    expect(freeSlots(0)).toBe(12)
    expect(freeSlots(11)).toBe(1)
    expect(freeSlots(12)).toBe(0)
    expect(freeSlots(13)).toBe(0)
  })

  it('Hoch/Runter tauscht Nachbarn, an den Rändern keine Änderung; Entfernen', () => {
    const list = [photo(1), photo(2), photo(3)]
    expect(movePhoto(list, 1, -1).map((p) => p.id)).toEqual([2, 1, 3])
    expect(movePhoto(list, 1, 1).map((p) => p.id)).toEqual([1, 3, 2])
    expect(movePhoto(list, 0, -1).map((p) => p.id)).toEqual([1, 2, 3])
    expect(movePhoto(list, 2, 1).map((p) => p.id)).toEqual([1, 2, 3])
    expect(removePhoto(list, 0).map((p) => p.id)).toEqual([2, 3])
  })

  it('Alt-Vorschlag „{Produktart} „{Titel}“, Nr. 017, Foto i von n“', () => {
    expect(
      suggestAlt({
        category: 'keramik',
        title: 'Schale mit Hund',
        itemNumber: 17,
        index: 1,
        total: 3,
      }),
    ).toBe('Keramik „Schale mit Hund“, Nr. 017, Foto 1 von 3')
    expect(suggestAlt({ category: '', title: '', itemNumber: null, index: 2, total: 2 })).toBe(
      'Stück, Foto 2 von 2',
    )
  })

  it('automatische Alt-Texte folgen Titel und Anzahl, eigene bleiben', () => {
    const list = [photo(1, { altDeAuto: true }), photo(2)]
    const next = refreshAutoAlts(list, { category: 'cap', title: 'Blaue Cap', itemNumber: 5 })
    expect(next[0]!.altDe).toBe('Cap „Blaue Cap“, Nr. 005, Foto 1 von 2')
    expect(next[0]!.dirty).toBe(true)
    expect(next[1]).toBe(list[1])
  })

  it('Fokuspunkt: nächste Raster-Position', () => {
    expect(focalKey(50, 50)).toBe('c')
    expect(focalKey(10, 90)).toBe('bl')
    expect(focalKey(75, 25)).toBe('tr')
  })
})
