import { describe, expect, it } from 'vitest'

import base from '../../../content/seed/data/base.json'

// R-095 (RECHT §7 Teil A, P10.19): Die Platzhalter-Widerrufsbelehrung des Grund-Seeds enthält die Token
// `{{withdrawalUrl}}` und `{{phone}}`; die Beispiel-Fassung ist ausdrücklich als Platzhalter gekennzeichnet.
type Section = { heading: string; paragraphs: string[] }
const belehrung = (
  base.legalTexts as { type: string; sourceNote: string; sections: Section[] }[]
).find((t) => t.type === 'widerrufsbelehrung')!
const text = belehrung.sections.flatMap((s) => s.paragraphs).join('\n')

describe('R-095 Platzhalter-Widerrufsbelehrung (Grund-Seed)', () => {
  it('R-095 enthält {{withdrawalUrl}} und {{phone}}', () => {
    expect(text).toContain('{{withdrawalUrl}}')
    expect(text).toContain('{{phone}}')
  })

  it('R-095 ist als Platzhalter gekennzeichnet und enthält kein Verbotsmuster', () => {
    expect(belehrung.sourceNote).toMatch(/Platzhalter/)
    // P12.11: ausformuliert, aber weiterhin Platzhalter-Herkunft (Kanzlei-Prüfung in P11)
    expect(text).toMatch(/binnen vierzehn Tagen/)
    expect(text).not.toMatch(/ec\.europa\.eu\/consumers\/odr|inkl\.\s*MwSt/i)
  })

  it('R-095 jedes {{Token}} im Text gehört zur geschlossenen Liste', () => {
    const tokens = [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    for (const t of tokens)
      expect([
        'withdrawalUrl',
        'phone',
        'name',
        'street',
        'postalCode',
        'city',
        'email',
        'returnCostsNote',
      ]).toContain(t)
  })
})
