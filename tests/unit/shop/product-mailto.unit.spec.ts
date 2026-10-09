import { describe, expect, it } from 'vitest'

import { productMailBody, productMailSubject, productMailto } from '@/lib/shop/mailto'

// P14.8 (U-57 a) – „Frag nach diesem Stück“: Betreff mit Stücknummer „Frage zu Nr. 017 – {Titel}“ (EN „Question about No. 017 – …“), Vorlage
// ohne Personendaten, RFC-6068-Kodierung wie die Tattoo-Knöpfe; ohne Adresse kein Link.

const topic = {
  itemNumber: 17,
  title: 'Tasse mit Kater & Mond',
  url: 'https://example.org/de/shop/017-tasse',
}

describe('productMailto (U-57 a)', () => {
  it('Betreff DE/EN mit Nummer und Titel', () => {
    expect(productMailSubject(topic, 'de')).toBe('Frage zu Nr. 017 – Tasse mit Kater & Mond')
    expect(productMailSubject({ ...topic, title: 'Mug with cat' }, 'en')).toBe(
      'Question about No. 017 – Mug with cat',
    )
    expect(productMailSubject({ itemNumber: 5, title: '  ' }, 'de')).toBe('Nr. 005')
  })

  it('Vorlage: Frage-Zeile, Link, Gruß – keine Personendaten', () => {
    const body = productMailBody(topic, 'de')
    expect(body).toContain('ich habe eine Frage zu Nr. 017 („Tasse mit Kater & Mond“):')
    expect(body).toContain('Link zum Stück: https://example.org/de/shop/017-tasse')
    expect(body.startsWith('Hi Jutta,')).toBe(true)
    expect(productMailBody(topic, 'en')).toContain('I have a question about No. 017')
  })

  it('Link kodiert Betreff (& → %26) und Zeilenumbrüche (CRLF); ohne Adresse null', () => {
    const href = productMailto('hallo@planetclairetattoos.com', topic, 'de')!
    expect(
      href.startsWith(
        'mailto:hallo@planetclairetattoos.com?subject=Frage%20zu%20Nr.%20017%20%E2%80%93%20Tasse',
      ),
    ).toBe(true)
    expect(href).toContain('%26')
    expect(href).toContain('%0D%0A')
    expect(productMailto(null, topic, 'de')).toBeNull()
  })
})
