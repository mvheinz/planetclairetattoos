import { describe, expect, it } from 'vitest'

import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import { mentionsSchlichtungsstelle, UNIVERSAL_SCHLICHTUNGSSTELLE } from '@/lib/legal/vsbg'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { DISPUTE_VSBG_FIXTURE, renderFixture } from '../../helpers/mails'

// P6.11 – Streitbeilegung nach § 37 VSBG (R-112, KONZEPT M13): die Vorlage nennt die Universalschlichtungsstelle des
// Bundes mit Anschrift und URL, die Arbeitsfassung „nicht bereit und nicht verpflichtet“ (bis K-22) und nie die
// EU-OS-Plattform (V-01).

const V01 = FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-01').map((p) => p.re)

describe('R-112 Streitbeilegung (§ 37 VSBG)', () => {
  it('R-112 Baustein dispute.vsbg37 (Arbeitsfassung DE/EN) enthält Stelle, Anschrift und URL', () => {
    const s = LEGAL_SNIPPET_SEED['dispute.vsbg37']
    expect(s.origin).toBe('draft')
    for (const text of [s.de, s.en]) {
      expect(text).toContain('Universalschlichtungsstelle des Bundes')
      expect(mentionsSchlichtungsstelle(text)).toBe(true)
      for (const re of V01) expect(text).not.toMatch(re)
    }
    expect(s.de).toContain('nicht bereit und nicht verpflichtet')
    expect(UNIVERSAL_SCHLICHTUNGSSTELLE.url).toBe('https://www.universalschlichtungsstelle.de')
  })

  for (const locale of ['de', 'en'] as const) {
    it(`R-112 Mail M13 dispute_vsbg (${locale}) enthält Anschrift und URL der Schlichtungsstelle, keinen OS-Link`, async () => {
      const mail = await renderFixture('dispute_vsbg', DISPUTE_VSBG_FIXTURE, locale)
      for (const body of [mail.text, mail.html]) {
        expect(body).toContain('Universalschlichtungsstelle des Bundes')
        expect(body).toContain('Straßburger Straße 8')
        expect(body).toContain('77694 Kehl am Rhein')
        expect(body).toMatch(/universalschlichtungsstelle\.de/)
        for (const re of V01) expect(body).not.toMatch(re)
      }
      expect(mail.subject).toContain('PC-2026-00017')
    })
  }

  it('R-112 ohne Angaben im Baustein ergänzt die Erkennung sie (Prüffunktion)', () => {
    expect(mentionsSchlichtungsstelle('Ich nehme nicht teil.')).toBe(false)
    expect(
      mentionsSchlichtungsstelle(
        'Universalschlichtungsstelle, Straßburger Straße 8, 77694 Kehl am Rhein, www.universalschlichtungsstelle.de',
      ),
    ).toBe(true)
  })
})
