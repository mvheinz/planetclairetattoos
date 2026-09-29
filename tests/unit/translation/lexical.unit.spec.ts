import { describe, expect, it } from 'vitest'

import {
  applyLexicalTexts,
  collectLexicalTexts,
  isLexicalState,
  lexicalHasText,
  type LexicalState,
} from '@/lib/translation/lexical'

// P5.4 – Lexical-Rich-Text übersetzen (ARCHITEKTUR §3.6): Textknoten einsammeln und in dieselbe Struktur zurückschreiben.

const text = (t: string, format = 0) => ({
  type: 'text',
  text: t,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const block = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})

const state: LexicalState = {
  root: block('root', [
    block('paragraph', [text('Eine '), text('Schale mit Hund', 1), text(' aus Steinzeug.')]),
    block(
      'list',
      [
        block('listitem', [text('Spülmaschinenfest')], { value: 1 }),
        block('listitem', [text('Handbemalt')], { value: 2 }),
      ],
      { listType: 'bullet', tag: 'ul' },
    ),
    block('paragraph', [
      block('link', [text('Pflege')], { fields: { url: '/pflege', linkType: 'custom' } }),
      block('linebreak', []),
      text('   '),
    ]),
  ]),
}

const shape = (node: unknown): unknown => {
  if (!node || typeof node !== 'object') return node
  const { text: _t, ...rest } = node as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, Array.isArray(v) ? v.map(shape) : shape(v)]),
  )
}

describe('Lexical-Textknoten (P5.4)', () => {
  it('sammelt Texte in Dokumentreihenfolge ohne Ränder und ohne reine Leerzeichen', () => {
    expect(collectLexicalTexts(state)).toEqual([
      'Eine',
      'Schale mit Hund',
      'aus Steinzeug.',
      'Spülmaschinenfest',
      'Handbemalt',
      'Pflege',
    ])
    expect(lexicalHasText(state)).toBe(true)
    expect(lexicalHasText({ root: block('root', [block('paragraph', [])]) })).toBe(false)
    expect(isLexicalState('Schale')).toBe(false)
  })

  it('Mock-Übersetzung: Struktur (Absätze, Listen, fett, Link) bleibt gleich, Ränder bleiben stehen', () => {
    const texts = collectLexicalTexts(state).map((t) => `[EN] ${t}`)
    const out = applyLexicalTexts(state, texts)
    expect(shape(out)).toEqual(shape(state))
    const paragraph = (out.root.children as { children: { text: string; format: number }[] }[])[0]!
    expect(paragraph.children.map((c) => c.text)).toEqual([
      '[EN] Eine ',
      '[EN] Schale mit Hund',
      ' [EN] aus Steinzeug.',
    ])
    expect(paragraph.children[1]!.format).toBe(1) // fett
    expect(collectLexicalTexts(out)).toEqual(texts)
    // Original unverändert
    expect(collectLexicalTexts(state)[1]).toBe('Schale mit Hund')
  })

  it('falsche Anzahl Übersetzungen → Fehler statt verschobener Texte', () => {
    expect(() => applyLexicalTexts(state, ['a'])).toThrow(/Zu wenige/)
    expect(() => applyLexicalTexts(state, Array(7).fill('a'))).toThrow(/Zu viele/)
  })
})
