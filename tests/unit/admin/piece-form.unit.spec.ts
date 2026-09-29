import { describe, expect, it } from 'vitest'

import {
  applyCategory,
  emptyPieceForm,
  fieldAnchor,
  formFromDoc,
  issuesFromResponse,
  pieceLocks,
  toEnData,
  toSaveData,
} from '@/admin/views/pieces/pieceForm'

// P5.6 – Formular „Neues Stück“: Kategorie-Vorbelegungen wie DATENMODELL §6.6.3, Sperren nach Status (E-12),
// Umrechnung in die Felder von §6.6.1 und Fehlerliste „Das fehlt noch:“ mit Sprunglinks.

const templates = {
  safety: { keramik: 'Nicht in die Mikrowelle.', textil: 'Von Feuer fernhalten.' },
  care: { textil: '30 °C waschen.' },
}

describe('Formular „Neues Stück“ (P5.6)', () => {
  it('Kategorie setzt Versandklasse, Deko, Vorlagen; Wechsel leert kategoriefremde Angaben', () => {
    const keramik = applyCategory(emptyPieceForm(17), 'keramik', templates)
    expect(keramik.shippingClass).toBe('keramik')
    expect(keramik.foodContact).toBe('deko')
    expect(keramik.de.safetyWarnings).toBe('Nicht in die Mikrowelle.')
    const textil = applyCategory(keramik, 'textil', templates)
    expect(textil.shippingClass).toBe('paket_klein')
    expect(textil.foodContact).toBe('')
    expect(textil.isSecondHand).toBe(true)
    expect(textil.de.safetyWarnings).toBe('Von Feuer fernhalten.')
    expect(textil.de.careInstructions).toBe('30 °C waschen.')
    // Eigener Text bleibt beim Wechsel erhalten.
    const own = { ...textil, de: { ...textil.de, safetyWarnings: 'Eigener Hinweis' } }
    expect(applyCategory(own, 'keramik', templates).de.safetyWarnings).toBe('Eigener Hinweis')
    expect(applyCategory(textil, 'schmuck', templates).smallPartsWarning).toBe(true)
  })

  it('AK-7-03 Nummer nach der ersten Veröffentlichung gesperrt; Preis bei reserviert/verkauft', () => {
    expect(pieceLocks(null, null)).toEqual({ itemNumber: false, category: false, price: false })
    expect(pieceLocks('draft', '2026-09-01T00:00:00Z').itemNumber).toBe(true)
    expect(pieceLocks('sold', '2026-09-01T00:00:00Z')).toEqual({
      itemNumber: true,
      category: true,
      price: true,
    })
    const form = { ...emptyPieceForm(17), category: 'keramik' as const }
    const locked = toSaveData(form, {
      priceCents: 4500,
      images: [],
      locks: pieceLocks('available', '2026-09-01T00:00:00Z'),
    })
    expect(locked).not.toHaveProperty('itemNumber')
    expect(locked).not.toHaveProperty('category')
    expect(locked.priceCents).toBe(4500)
  })

  it('Speicherdaten: Maße mit Komma, Gewicht ganzzahlig, nur Felder der Kategorie', () => {
    const form = {
      ...applyCategory(emptyPieceForm(17), 'keramik', templates),
      widthCm: '14,5',
      weightGrams: '420',
      de: { ...emptyPieceForm().de, title: 'Schale', dimensionsNote: '' },
    }
    const data = toSaveData(form, {
      priceCents: 4550,
      images: [3, 1],
      locks: pieceLocks(null, null),
    })
    expect(data).toMatchObject({
      itemNumber: 17,
      category: 'keramik',
      priceCents: 4550,
      title: 'Schale',
      weightGrams: 420,
      images: [3, 1],
      foodContact: 'deko',
      dimensions: { widthCm: 14.5, heightCm: null, note: null },
    })
    expect(data).not.toHaveProperty('sizeLabel')
    expect(toEnData(form)).not.toHaveProperty('sizeLabel')
  })

  it('Formular aus gespeichertem Stück', () => {
    const f = formFromDoc(
      {
        itemNumber: 17,
        category: 'keramik',
        priceCents: 4550,
        title: 'Schale',
        dimensions: { widthCm: 14.5 },
      },
      { title: 'Bowl' },
    )
    expect(f.price).toBe('45,50')
    expect(f.widthCm).toBe('14,5')
    expect(f.de.title).toBe('Schale')
    expect(f.en.title).toBe('Bowl')
  })

  it('Fehlerliste aus Payload- und Endpunkt-Antworten mit Sprungziel', () => {
    expect(
      issuesFromResponse({
        errors: [
          {
            message: 'The following field is invalid: title',
            data: { errors: [{ path: 'title', message: 'Titel (Deutsch) fehlt.' }] },
          },
        ],
      }),
    ).toEqual([{ field: 'title', message: 'Titel (Deutsch) fehlt.' }])
    expect(
      issuesFromResponse({ error: 'x', errors: [{ path: 'images', message: 'Fotos fehlen.' }] }),
    ).toEqual([{ field: 'images', message: 'Fotos fehlen.' }])
    expect(issuesFromResponse({ error: 'Nicht erlaubt.' })).toEqual([
      { field: '', message: 'Nicht erlaubt.' },
    ])
    expect(fieldAnchor('dimensions.widthCm')).toBe('pf-dimensions')
    expect(fieldAnchor('images.0.alt')).toBe('pf-images')
    expect(fieldAnchor('settings.business')).toBe('')
  })
})
