import { describe, expect, it } from 'vitest'

import { parseBestandArgs, previewBlockedReason } from '@/lib/bestand/args'
import { reviewNote } from '@/lib/bestand/import'

// P16.2: Aufruf von `pnpm bestand:import` und die interne Notiz aus den Prüfpunkten.

describe('bestand:import – Aufruf', () => {
  it('ohne Angaben: alle Stücke, kein Vorschau-Modus', () => {
    expect(parseBestandArgs([])).toEqual({ preview: false, only: undefined })
    expect(parseBestandArgs(['--'])).toEqual({ preview: false, only: undefined })
  })

  it('--only und --preview', () => {
    expect(parseBestandArgs(['--only=B001,B002', '--preview'])).toEqual({
      preview: true,
      only: ['B001', 'B002'],
    })
  })

  it('unbekannte Angaben und leeres --only brechen ab', () => {
    expect(() => parseBestandArgs(['--yes'])).toThrow(/Unbekannte Angabe --yes/)
    expect(() => parseBestandArgs(['--only='])).toThrow(/--only ohne Stücke/)
  })

  it('--preview nur im Vorschau-Modus und nie in Produktion', () => {
    expect(previewBlockedReason({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'preview' })).toBeNull()
    expect(previewBlockedReason({ SEED_PREVIEW_MODE: 'false' })).toMatch(/SEED_PREVIEW_MODE/)
    expect(previewBlockedReason({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'production' })).toMatch(
      /Produktion/,
    )
  })
})

describe('interne Notiz aus den Prüfpunkten', () => {
  it('Kopfzeile und je Punkt eine Zeile', () => {
    expect(reviewNote(['Preis prüfen', 'Maße nachmessen'])).toBe(
      'Aus deinen Fotos angelegt (Oktober 2026). Bitte prüfen:\n• Preis prüfen\n• Maße nachmessen',
    )
  })

  it('höchstens 1000 Zeichen; was nicht passt, endet mit „…“', () => {
    const note = reviewNote(Array.from({ length: 40 }, (_, i) => `Punkt ${i} ${'x'.repeat(40)}`))
    expect(note.length).toBeLessThanOrEqual(1000)
    expect(note.endsWith('\n…')).toBe(true)
  })
})
