import { describe, expect, it } from 'vitest'

import { firstPublishClearsAttention } from '@/lib/commerce/productTransitions'
import {
  missingLine,
  READINESS_LABELS,
  readinessHints,
  readinessLabel,
  readinessOf,
} from '@/lib/products/readiness'

// P20.6 (V-32): „was fehlt noch?“ als kurze Stichworte aus den Meldungen der Veröffentlichungsprüfung; Tipps sperren
// nie (V-15: Schmuck → Foto an der Hand). V-31: erstes Online-Stellen löscht nur die Markierung „von Hand“.

describe('V-32 Stichworte „fehlt: …“', () => {
  it('Feld → Stichwort; Nachmessen, Bildbeschreibung und Wortwahl erkennbar', () => {
    expect(readinessLabel({ field: 'nickelEvidence', message: 'Nickel-Nachweis fehlt.' })).toBe(
      'Nickel-Nachweis',
    )
    expect(readinessLabel({ field: 'fiberFreeText', message: 'x' })).toBe('Faserangabe')
    expect(readinessLabel({ field: 'dimensions.note', message: 'Bitte erst nachmessen: …' })).toBe(
      'nachmessen',
    )
    expect(
      readinessLabel({ field: 'sizeLabel', message: 'Bitte erst nachmessen: … „Größe“' }),
    ).toBe('nachmessen')
    expect(
      readinessLabel({
        field: 'images',
        message: 'Bilder: Foto 1 braucht einen Alt-Text auf Englisch.',
      }),
    ).toBe('Bildbeschreibung')
    expect(
      readinessLabel({
        field: 'title',
        message: 'Titel (Deutsch): fremder Marken- oder Figurenname „X“ ist nicht erlaubt (R-047).',
      }),
    ).toBe('Titel (Wortwahl)')
    expect(readinessLabel({ field: 'unbekannt', message: 'x' })).toBe('unbekannt')
  })

  it('jedes Stichwort ist kurz (Karte am Handy)', () => {
    for (const label of Object.values(READINESS_LABELS))
      expect(label.length).toBeLessThanOrEqual(28)
  })

  it('Doppel zusammengefasst, Reihenfolge der Prüfung; fertig nur ohne Meldung', () => {
    const r = readinessOf(
      [
        { field: 'images', message: 'Bilder: Foto 1 braucht einen Alt-Text auf Deutsch.' },
        { field: 'images', message: 'Bilder: Foto 2 braucht einen Alt-Text auf Deutsch.' },
        { field: 'weightGrams', message: 'Gewicht fehlt.' },
      ],
      [],
    )
    expect(r).toMatchObject({ ready: false, missing: ['Bildbeschreibung', 'Gewicht'] })
    expect(r.issues).toHaveLength(3)
    expect(readinessOf([], [{ id: 'scalePhotoHand', label: 'Foto an der Hand' }]).ready).toBe(true)
  })

  it('höchstens 3 Stichworte, Rest als „+N“', () => {
    expect(missingLine(['A'])).toBe('A')
    expect(missingLine(['A', 'B', 'C'])).toBe('A, B, C')
    expect(missingLine(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2')
  })

  it('V-15 Tipp „Foto an der Hand“ nur bei Schmuck ohne Vergleichsfoto', () => {
    expect(readinessHints({ category: 'schmuck', scalePhoto: null })).toEqual([
      { id: 'scalePhotoHand', label: 'Foto an der Hand' },
    ])
    expect(readinessHints({ category: 'schmuck', scalePhoto: 12 })).toEqual([])
    expect(readinessHints({ category: 'keramik' })).toEqual([])
  })
})

describe('V-31 erstes Online-Stellen und die Markierung', () => {
  it('nur Markierung „von Hand“ beim ersten Mal; Systemgründe und spätere Male bleiben', () => {
    const manual = { flag: true, reason: 'manual', note: 'Bitte prüfen' }
    expect(firstPublishClearsAttention({ adminAttention: manual })).toBe(true)
    expect(
      firstPublishClearsAttention({ adminAttention: manual, firstPublishedAt: '2026-10-01' }),
    ).toBe(false)
    expect(
      firstPublishClearsAttention({
        adminAttention: { flag: true, reason: 'conformity_revoked' },
      }),
    ).toBe(false)
    expect(firstPublishClearsAttention({ adminAttention: { flag: false, reason: 'manual' } })).toBe(
      false,
    )
    expect(firstPublishClearsAttention({})).toBe(false)
  })
})
