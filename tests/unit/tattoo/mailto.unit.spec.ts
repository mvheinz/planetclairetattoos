import { describe, expect, it } from 'vitest'

import { buildMailto, tattooMailBody, tattooMailSubject, tattooMailto } from '@/lib/tattoo/mailto'

// P7.1 – Mail-Knöpfe des Tattoo-Bereichs (KONZEPT §9.4, AK-9-02, R-170): Betreff exakt, Kodierung nach RFC 6068.

const decode = (href: string, param: 'subject' | 'body') => {
  const query = href.slice(href.indexOf('?') + 1)
  const pair = query.split('&').find((p) => p.startsWith(`${param}=`))
  return pair ? decodeURIComponent(pair.slice(param.length + 1)) : null
}

describe('tattoo/mailto', () => {
  it('AK-9-02 Flash 12 „Kelch mit Schlange“ ergibt exakt den Betreff (DE/EN)', () => {
    expect(
      tattooMailSubject({ kind: 'flash', number: 12, title: 'Kelch mit Schlange' }, 'de'),
    ).toBe('Flash-Anfrage F-012 – Kelch mit Schlange')
    expect(
      tattooMailSubject({ kind: 'flash', number: 12, title: 'Chalice with snake' }, 'en'),
    ).toBe('Flash request F-012 – Chalice with snake')
    const href = tattooMailto(
      'jutta@planetclairetattoos.com',
      { kind: 'flash', number: 12, title: 'Kelch mit Schlange' },
      'de',
    )!
    expect(href.startsWith('mailto:jutta@planetclairetattoos.com?subject=')).toBe(true)
    expect(href).toContain('subject=Flash-Anfrage%20F-012%20%E2%80%93%20Kelch%20mit%20Schlange&')
    expect(decode(href, 'subject')).toBe('Flash-Anfrage F-012 – Kelch mit Schlange')
  })

  it('R-170 Betreff der übrigen Anlässe: allgemein, eigene Idee', () => {
    expect(tattooMailSubject({ kind: 'general' }, 'de')).toBe('Tattoo-Anfrage')
    expect(tattooMailSubject({ kind: 'general' }, 'en')).toBe('Tattoo request')
    expect(tattooMailSubject({ kind: 'custom' }, 'de')).toBe('Tattoo-Anfrage – eigene Idee')
    expect(tattooMailSubject({ kind: 'custom' }, 'en')).toBe('Tattoo request – custom idea')
  })

  it('R-170 Betreff: Umlaute, „&“, „?“ und Zeilenumbrüche sind korrekt kodiert', () => {
    const href = buildMailto({
      to: 'jutta@planetclairetattoos.com',
      subject: 'Bär & Möwe? – ja',
      body: 'Zeile eins\nZeile zwei\r\nZeile drei',
    })
    expect(href).toContain('subject=B%C3%A4r%20%26%20M%C3%B6we%3F%20%E2%80%93%20ja')
    expect(href).toContain('body=Zeile%20eins%0D%0AZeile%20zwei%0D%0AZeile%20drei')
    expect(href).not.toMatch(/[ \n\r]/)
    // Genau ein „?“ (Trenner) und ein „&“ (zwischen Betreff und Text).
    expect(href.split('?')).toHaveLength(2)
    expect(href.split('&')).toHaveLength(2)
    expect(decode(href, 'subject')).toBe('Bär & Möwe? – ja')
    expect(decode(href, 'body')).toBe('Zeile eins\r\nZeile zwei\r\nZeile drei')
  })

  it('R-170 Text-Vorlage: Gesundheits-Hinweis, keine vorbefüllten Personendaten', () => {
    const de = tattooMailBody({ kind: 'flash', number: 12, title: 'Kelch mit Schlange' }, 'de')
    expect(de).toContain('ich interessiere mich für Flash F-012 („Kelch mit Schlange“).')
    expect(de).toContain('(Bitte keine Gesundheitsinfos – die klären wir persönlich.)')
    expect(de).toContain('Stelle am Körper:')
    expect(de.startsWith('Hi Jutta,\n\n')).toBe(true)
    const en = tattooMailBody({ kind: 'custom' }, 'en')
    expect(en).toContain("(Please no health information – we'll sort that out in person.)")
    for (const text of [de, en]) {
      expect(text).not.toMatch(/@|Name:|Telefon|Phone|E-Mail:/)
    }
  })

  it('fehlende Adresse', () => {
    expect(tattooMailto(null, { kind: 'general' }, 'de')).toBeNull()
    expect(tattooMailto('', { kind: 'general' }, 'de')).toBeNull()
  })
})
