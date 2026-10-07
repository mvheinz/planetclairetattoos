import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// P12.10 / U-21: Textinventur. Alle Texte wurden im verträumt-philosophischen Ton neu geschrieben (docs/design/TEXTE.md).
// Der Test stellt sicher, dass kein alter Wortlaut zurückkommt: `tests/fixtures/old-texts-p12.json` enthält jeden vor
// P12.10 vorhandenen Text, der ersetzt wurde (Sprachdateien, Beispielbestand), dazu ein paar kurze Leitsätze unten.

const root = path.resolve(import.meta.dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

const corpusFiles = [
  'src/i18n/messages/de.json',
  'src/i18n/messages/en.json',
  'src/globals/SiteTexts.ts',
  ...readdirSync(path.join(root, 'content/seed/data'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => `content/seed/data/${f}`),
]
// JSON-Dateien liegen wortgleich vor; für die Suche zählen die Texte, nicht die Escape-Schreibweise.
const corpus = corpusFiles
  .map((f) => {
    const raw = read(f)
    return f.endsWith('.json') ? JSON.stringify(JSON.parse(raw), null, 0) : raw
  })
  .join('\n')

const OLD = (JSON.parse(read('tests/fixtures/old-texts-p12.json')) as { phrases: string[] }).phrases

/** Kurze, prägnante Altsätze (Überschriften, Leitsätze), die nirgends mehr stehen dürfen. */
const OLD_SHORT = [
  'Coco hat sich losgerissen',
  'Coco slipped her leash',
  'die Leine hat sich verheddert',
  'Dieses Stück hat schon ein Zuhause gefunden',
  'Hier wird gerade umgeräumt',
  'Hier zieht gerade etwas um',
  'neue Stücke kommen auf Instagram zuerst',
  'Wie ich zeichne',
  'How I draw',
  'Chihuahua-Mix',
  'kleiner Hund mit sehr großen Ohren',
  'Fine Line mit Humor',
  'Hier ist noch nichts drin',
  'Schon ausgezogen',
  'Folge mir auf Instagram',
  'Der Shop macht gerade Pause',
  'Tattoos & handgemachte Unikate aus Berlin',
  'Tattoos, handgemachte Unikat-Keramik und Zeichnungen aus Berlin.',
]

describe('Textinventur (P12.10, U-21)', () => {
  it('die Fixture der Alttexte ist gefüllt', () => {
    expect(OLD.length).toBeGreaterThan(200)
  })

  it('kein ersetzter Alttext steht noch im Bestand', () => {
    const escaped = (s: string) => JSON.stringify(s).slice(1, -1)
    const remnants = OLD.filter((p) => corpus.includes(p) || corpus.includes(escaped(p)))
    expect(remnants).toEqual([])
  })

  it('keine kurzen Altsätze mehr', () => {
    const remnants = OLD_SHORT.filter((p) => corpus.includes(p))
    expect(remnants).toEqual([])
  })

  it('Instagram ist kein Anfrageweg und DM kommt in keinem Text vor (U-15)', () => {
    const messages = read('src/i18n/messages/de.json') + read('src/i18n/messages/en.json')
    const seed = corpusFiles
      .filter((f) => f.startsWith('content/seed/data/'))
      .filter((f) => !/privacy-requests|customers|inquiries|logs|complaints/.test(f))
      .map(read)
      .join('\n')
    for (const text of [messages, seed]) {
      expect(text).not.toMatch(/\bDMs?\b|Direktnachricht|direct message|per Instagram anfragen/i)
    }
  })

  it('Pflichttexte bleiben unverändert (E-xx, R-xxx)', () => {
    const de = JSON.parse(read('src/i18n/messages/de.json')) as Record<
      string,
      Record<string, string>
    >
    const en = JSON.parse(read('src/i18n/messages/en.json')) as Record<
      string,
      Record<string, string>
    >
    expect(de.footer!.withdraw).toBe('Vertrag widerrufen')
    expect(en.footer!.withdraw).toBe('Withdraw from contract here')
    const constants = read('src/lib/legal/constants.ts')
    expect(constants).toContain('Zahlungspflichtig bestellen')
    expect(constants).toContain('Order with obligation to pay')
  })
})
