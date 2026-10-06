import { describe, expect, it } from 'vitest'

import { legalHtmlToLexical, legalInputToLexical } from '@/lib/legal/htmlToLexical'

type N = { type: string; [k: string]: unknown }
const kids = (n: unknown): N[] => (n as { children: N[] }).children
const textOf = (n: N): string =>
  n.type === 'text' ? String(n.text) : n.type === 'linebreak' ? '\n' : kids(n).map(textOf).join('')
const convert = (html: string) => kids(legalHtmlToLexical(html).root)

describe('P6.4 HTML → Lexical (Zweige)', () => {
  it('Absätze mit fett, kursiv, Link, Zeilenumbruch, Entitäten', () => {
    const [p] = convert(
      '<p>Eins &amp; <strong>fett <em>und kursiv</em></strong><br>Zwei&nbsp;&#65;&#x42; <a href="https://example.test/x">Link</a><a href="/leer"></a></p>',
    )
    expect(p!.type).toBe('paragraph')
    expect(textOf(p!)).toBe('Eins & fett und kursiv\nZwei AB Link')
    const parts = kids(p)
    expect(parts.find((n) => n.format === 1)).toBeTruthy()
    expect(parts.find((n) => n.format === 3)).toBeTruthy()
    expect(parts.find((n) => n.type === 'linebreak')).toBeTruthy()
    const link = parts.find((n) => n.type === 'link')!
    expect((link.fields as { url: string }).url).toBe('https://example.test/x')
    expect(parts.filter((n) => n.type === 'link')).toHaveLength(1)
  })

  it('Überschriften h2–h4, leere Überschrift und leerer Absatz entfallen', () => {
    const out = convert('<h2>Titel</h2><h3>Unter</h3><h4>Noch</h4><h2> </h2><p> </p>')
    expect(out.map((n) => [n.type, n.tag])).toEqual([
      ['heading', 'h2'],
      ['heading', 'h3'],
      ['heading', 'h4'],
    ])
  })

  it('Listen: geordnet, ungeordnet, verschachtelt, Text außerhalb von li wird ignoriert', () => {
    const [ul, ol] = convert(
      '<ul>text<li>A<ul><li>A1</li></ul></li><li>B</li></ul><ol><li>Eins</li><li>Zwei</li></ol>',
    )
    expect(ul).toMatchObject({ type: 'list', listType: 'bullet', tag: 'ul' })
    expect(kids(ul).map((i) => i.value)).toEqual([1, 2, 3])
    expect(textOf(kids(ul)[0]!)).toBe('A')
    expect(kids(kids(ul)[1]!)[0]).toMatchObject({ type: 'list' })
    expect(ol).toMatchObject({ listType: 'number', tag: 'ol' })
  })

  it('loses außerhalb einer Liste wird zur Liste; loser Text und Inline-Tags davor werden Absatz', () => {
    const out = convert('Vorher <strong>fett</strong><li>Punkt</li>Nachher')
    expect(out.map((n) => n.type)).toEqual(['paragraph', 'list', 'paragraph'])
    expect(textOf(out[0]!)).toBe('Vorher fett')
  })

  it('Tabellen werden zu Absätzen: Zeile = Absatz, Zellen mit „ · “, Kopfzellen fett, leere Zeilen entfallen', () => {
    const out = convert(
      '<table><thead><tr><th>Kopf</th><th>Wert</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr><tr></tr></tbody></table>',
    )
    expect(out).toHaveLength(2)
    expect(textOf(out[0]!)).toBe('Kopf · Wert')
    expect(kids(out[0]!)[0]).toMatchObject({ format: 1 })
    expect(textOf(out[1]!)).toBe('a · b')
  })

  it('Platzhalter bleiben Text bzw. Link-Ziel; unbekannte Tags verlieren nur das Tag', () => {
    const [p] = convert('<p>{{withdrawalUrl}} <a href="{{withdrawalUrl}}">hier</a></p>')
    expect(textOf(p!)).toContain('{{withdrawalUrl}}')
    const link = kids(p).find((n) => n.type === 'link')!
    expect((link.fields as { url: string }).url).toBe('{{withdrawalUrl}}')
  })

  it('legalInputToLexical: Text und HTML; leere Eingabe → null', () => {
    const text = legalInputToLexical('Erste Zeile\n\nZweiter Absatz', 'text')
    expect(text?.root.children.length).toBeGreaterThanOrEqual(2)
    expect(legalInputToLexical('<p>x</p>', 'html')?.root.children).toHaveLength(1)
    expect(legalInputToLexical('   ', 'text')).toBeNull()
    expect(legalInputToLexical('<script>alert(1)</script>', 'html')).toBeNull()
  })
})
