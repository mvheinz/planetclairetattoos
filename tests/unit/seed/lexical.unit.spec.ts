import { describe, expect, it } from 'vitest'

import { dateTokenExprs, seedRichText, toLexical, withDateTokens } from '@/lib/seed/lexical'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'

// P8.7 – SEED-SPEC §2.4: Klartext → Lexical (`toLexical`: Leerzeilen = Absätze, `- `-Zeilen = Liste, `**fett**`,
// `[Text](url)`) und Text-Token `{{date:<expr>}}` in der Feldsprache (DE `dd.MM.yyyy`, EN `d MMM yyyy`).

const N = new Date(CANONICAL_SEED_NOW)
type Node = { type: string; children?: Node[]; text?: string; format?: number; tag?: string }
const kids = (v: { root: Record<string, unknown> }) => v.root.children as Node[]

describe('toLexical (SEED-SPEC §2.4)', () => {
  it('Leerzeilen trennen Absätze, einfache Zeilenumbrüche bleiben im Absatz', () => {
    const doc = kids(toLexical('Erster Absatz.\nZweite Zeile.\n\nZweiter Absatz.'))
    expect(doc.map((n) => n.type)).toEqual(['paragraph', 'paragraph'])
    expect(doc[0]!.children!.map((c) => c.type)).toEqual(['text', 'linebreak', 'text'])
  })

  it('Zeilen mit „- “ werden zur Liste', () => {
    const [list] = kids(toLexical('- Folie\n- Seife\n- Creme'))
    expect(list!.type).toBe('list')
    expect(list!.children!.map((i) => i.children![0]!.text)).toEqual(['Folie', 'Seife', 'Creme'])
  })

  it('**fett** und [Text](url) im Fließtext; „## “ als Überschrift', () => {
    const doc = kids(
      toLexical('## Hallo\n\n**Und das ist Coco.** Mehr: [Safer Tattoo](https://example.org/x)'),
    )
    expect(doc[0]).toMatchObject({ type: 'heading', tag: 'h2' })
    const inline = doc[1]!.children!
    expect(inline[0]).toMatchObject({ type: 'text', text: 'Und das ist Coco.', format: 1 })
    expect(inline.find((n) => n.type === 'link')).toMatchObject({
      fields: { url: 'https://example.org/x' },
      children: [{ text: 'Safer Tattoo' }],
    })
  })
})

describe('Datums-Token {{date:<expr>}} (SEED-SPEC §2.4)', () => {
  it('DE dd.MM.yyyy, EN d MMM yyyy (kanonisches N)', () => {
    expect(withDateTokens('Bestellung vom {{date:D-50}}', 'de', N)).toBe(
      'Bestellung vom 26.08.2026',
    )
    expect(withDateTokens('ordered on {{date:D-50}}', 'en', N)).toBe('ordered on 26 Aug 2026')
    expect(withDateTokens('am {{date:D-5}} und {{date:SAT>=D+56}}', 'de', N)).toBe(
      'am 10.10.2026 und 12.12.2026',
    )
    expect(withDateTokens('{{date:D+13}}', 'en', N)).toBe('28 Oct 2026')
  })

  it('ohne Token unverändert; ungültiger Ausdruck wirft; Ausdrücke werden gefunden', () => {
    expect(withDateTokens('Kein Datum hier.', 'de', N)).toBe('Kein Datum hier.')
    expect(() => withDateTokens('{{date:gestern}}', 'de', N)).toThrow(/Zeitausdruck/)
    expect(dateTokenExprs('a {{date:D-1}} b {{date: D+6 }}')).toEqual(['D-1', 'D+6'])
  })

  it('seedRichText: Token vor der Umwandlung ersetzt', () => {
    const [p] = kids(seedRichText('Bis {{date:D+6}} melden.', 'de', N))
    expect(p!.children![0]!.text).toBe('Bis 21.10.2026 melden.')
  })
})
