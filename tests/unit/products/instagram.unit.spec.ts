import { describe, expect, it } from 'vitest'

import { forbiddenPatternsFor } from '@/lib/legal/forbiddenContent'
import { instagramFileName, instagramPostText, plainTitle } from '@/lib/products/instagram'

// V-39 (U-93, P20.6): Text für Instagram – Name, Nummer, „42 € zzgl. Versand“, Kurzlink; DE und EN (U-00); nie
// „inkl. MwSt.“ (R-030, V-02), keine zitierten Schriftzüge (U-77), kein Aufruf zu Direktnachrichten (U-15/U-42).

const input = {
  title: { de: 'Schale „Langohr“ mit Fuchs', en: 'Bowl "Long ear" with fox' },
  itemNumber: 17,
  priceCents: 4200,
  shippingClass: 'keramik' as const,
  shortUrl: 'https://planetclairetattoos.com/nr/17',
}

describe('Instagram-Text (V-39)', () => {
  it('Name, Nummer, Preis zzgl. Versand, Kurzlink – erst Deutsch, dann Englisch', () => {
    const text = instagramPostText(input)
    expect(text).toBe(
      [
        'Schale Langohr mit Fuchs',
        'Nr. 017 · 42 € zzgl. Versand',
        'Ein Unikat – gibt es genau einmal. Jetzt im Shop.',
        '',
        'Bowl Long ear with fox',
        'No. 017 · €42 plus shipping',
        'One of a kind – there is only one. In the shop now.',
        '',
        'https://planetclairetattoos.com/nr/17',
      ].join('\n'),
    )
  })

  it('nur Abholung: kein „zzgl. Versand“, sondern „nur Abholung in Berlin“', () => {
    const text = instagramPostText({ ...input, shippingClass: 'nur_abholung' })
    expect(text).toContain('Nr. 017 · 42 € · nur Abholung in Berlin')
    expect(text).toContain('pickup in Berlin only')
    expect(text).not.toContain('Versand')
  })

  it('ohne englischen Titel: deutscher Titel auch im englischen Teil', () => {
    const text = instagramPostText({ ...input, title: { de: 'Tasse', en: '' } })
    expect(text.split('\n')[4]).toBe('Tasse')
  })

  it('Verbotsliste: kein „inkl. MwSt.“, keine Rabatte, keine Aufrufe zu Direktnachrichten, keine Anführungszeichen', () => {
    const text = instagramPostText(input)
    for (const f of forbiddenPatternsFor('messages')) expect(text, f.id).not.toMatch(f.re)
    expect(text).not.toMatch(
      /MwSt|VAT|\bDM\b|Direktnachricht|direct message|schreib mir|message me/i,
    )
    expect(text).not.toMatch(/["“”„«»]/)
  })

  it('Titel ohne Anführungszeichen, Dateinamen mit Nummer', () => {
    expect(plainTitle("  Cap  „Hallo“ 'Welt' ")).toBe('Cap Hallo Welt')
    expect(instagramFileName(7, 'photo', 'jpg')).toBe('planet-claire-nr-007.jpg')
    expect(instagramFileName(117, 'story', 'png')).toBe('planet-claire-nr-117-story.png')
  })
})
