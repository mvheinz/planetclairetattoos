import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { TATTOO_TABS, TATTOO_TEXT } from '@/admin/views/tattoo/tattooText'
import { lexicalToPlain, toLexical } from '@/lib/richtext/plain'
import { editorTexts, newEditorBlock, TATTOO_TEXT_PAGES } from '@/lib/tattoo/textBlocks'
import { tattooTextWarnings } from '@/lib/tattoo/textWarnings'

// P7.6–P7.9 – reine Bausteine der Tattoo-Verwaltung: Reiter, Warn-Regeln (V-24, V-15), Klartext ↔ Lexical und keine
// Eingabefelder für Gesundheitsdaten (V-25) in den Formularen.

const DIR = path.resolve('src/admin/views/tattoo')

describe('Tattoo-Verwaltung (P7.6–P7.9)', () => {
  it('Reiter Flash · Galerie · Texte mit deutschen Beschriftungen', () => {
    expect(TATTOO_TABS).toEqual(['flash', 'galerie', 'texte'])
    expect(TATTOO_TABS.map((t) => TATTOO_TEXT[`tab_${t}`])).toEqual(['Flash', 'Galerie', 'Texte'])
    expect(TATTOO_TEXT.galleryPublishLocked).toBe(
      'Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen.',
    )
    expect(TATTOO_TEXT.galleryInstagramHint).toBe(
      'Eine Instagram-Freigabe deckt die Website nicht automatisch ab.',
    )
  })

  it('V-24/V-15: Warnung bei Anzahlungs-Verfall und Heilversprechen, nicht bei neutralen Texten', () => {
    expect(tattooTextWarnings(['Anzahlung verfällt bei Absage']).map((w) => w.id)).toEqual(['V-24'])
    expect(tattooTextWarnings(['Deposit is non-refundable']).map((w) => w.id)).toEqual(['V-24'])
    expect(tattooTextWarnings(['heilt garantiert in 2 Wochen']).map((w) => w.id)).toEqual(['V-15'])
    expect(tattooTextWarnings(['Die Anzahlung besprechen wir per Mail.', null])).toEqual([])
  })

  it('Klartext ↔ Lexical: Umkehrung; Formatierung, die das Formular nicht kann, wird gemeldet', () => {
    const text = '## Pflege\n\nZeile eins\nZeile zwei\n\n- **fett**\n- [Link](https://example.com)'
    expect(lexicalToPlain(toLexical(text))).toEqual({ text, lossy: false })
    const italic = toLexical('kursiv')
    ;(italic.root.children as { children: { format: number }[] }[])[0]!.children[0]!.format = 2
    expect(lexicalToPlain(italic).lossy).toBe(true)
    expect(lexicalToPlain(null)).toEqual({ text: '', lossy: false })
  })

  it('Blöcke: neue Blöcke mit Mindestzeilen; nur bekannte Seiten-Blöcke hinzufügbar', () => {
    const steps = newEditorBlock('processSteps')
    expect(steps.rows).toHaveLength(1)
    steps.fields.heading = { de: 'Ablauf', en: '' }
    expect(editorTexts([steps], 'de')).toEqual(['Ablauf'])
    expect(editorTexts([steps], 'en')).toEqual([])
    expect(TATTOO_TEXT_PAGES.tattoo.addable).toEqual(['richText', 'priceInfo', 'processSteps'])
    expect(TATTOO_TEXT_PAGES.tattoo_aftercare.addable).toContain('aftercareSteps')
  })

  it('V-25 keine Eingabefelder oder Beschriftungen für Gesundheitsdaten', () => {
    const re = /Allergi|Krankheit|Medikament|Schwanger|Hauterkrank/i
    for (const file of readdirSync(DIR)) {
      expect(readFileSync(path.join(DIR, file), 'utf8'), file).not.toMatch(re)
    }
  })
})
