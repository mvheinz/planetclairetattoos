import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { LEGAL_SNIPPET_KEYS, type LegalSnippetKey } from '@/lib/enums'
import { LEGAL_TOKENS } from '@/lib/legal/render'
import {
  LEGAL_SNIPPETS,
  LEGAL_SNIPPET_DRAFT_VERSION,
  LEGAL_SNIPPET_REQUIRES_LAWYER,
  SNIPPET_CONTEXT_TOKENS,
  SNIPPET_PLACEHOLDER_TEXT,
  SnippetRenderError,
  getSnippet,
  renderSnippetText,
  snippetTokens,
} from '@/lib/legal/snippets'

// P3.3 Rechtsbausteine als Arbeitsfassung (RECHT ANFORDERUNGEN §6, DATENMODELL §6.28, R-012).

/** Schlüssel ohne Arbeitsfassung in ANFORDERUNGEN §6 („– (Kanzlei)“) → Platzhalter wie im Grund-Seed ab P6. */
const WITHOUT_DRAFT: LegalSnippetKey[] = [
  'email.orderConfirmation.contractSentence',
  'email.vorkasse.cancellation',
  'complaint.repairChoice',
  'inquiry.autoReply',
  'commission.offer',
  'privacyRequest.accessResponse',
  'privacyRequest.erasureResponse',
]

describe('LEGAL_SNIPPETS (ANFORDERUNGEN §6)', () => {
  it('R-012 jeder Schlüssel hat DE und EN, origin, Version draft-1 und sha256 des DE-Texts', () => {
    expect(Object.keys(LEGAL_SNIPPETS).sort()).toEqual([...LEGAL_SNIPPET_KEYS].sort())
    for (const key of LEGAL_SNIPPET_KEYS) {
      const s = LEGAL_SNIPPETS[key]
      expect(s.de.trim().length, key).toBeGreaterThan(5)
      expect(s.en.trim().length, key).toBeGreaterThan(5)
      expect(s.version, key).toBe(LEGAL_SNIPPET_DRAFT_VERSION)
      expect(s.sha256, key).toBe(createHash('sha256').update(s.de, 'utf8').digest('hex'))
      expect(s.origin, key).toBe(WITHOUT_DRAFT.includes(key) ? 'placeholder' : 'draft')
    }
  })

  it('Arbeitsfassungen wörtlich aus ANFORDERUNGEN §6; ohne Arbeitsfassung der Platzhaltertext', () => {
    expect(LEGAL_SNIPPETS['price.kleinunternehmerNote'].de).toBe(
      'Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    )
    expect(LEGAL_SNIPPETS['price.shippingNote'].de).toBe('zzgl. Versandkosten')
    expect(LEGAL_SNIPPETS['delivery.timeShipping'].de).toBe(
      'Lieferzeit: {{deliveryTime}} (bei Vorkasse ab Zahlungseingang)',
    )
    for (const key of WITHOUT_DRAFT) {
      expect(LEGAL_SNIPPETS[key].de).toBe(SNIPPET_PLACEHOLDER_TEXT.de)
      expect(LEGAL_SNIPPETS[key].en).toBe(SNIPPET_PLACEHOLDER_TEXT.en)
    }
  })

  it('Tokens: nur R-012 plus Kontext-Tokens, DE und EN mit denselben Platzhaltern', () => {
    const allowed = new Set<string>([...LEGAL_TOKENS, ...SNIPPET_CONTEXT_TOKENS])
    for (const key of LEGAL_SNIPPET_KEYS) {
      const de = snippetTokens(LEGAL_SNIPPETS[key].de)
      for (const t of de) expect(allowed.has(t), `${key}: ${t}`).toBe(true)
      expect(snippetTokens(LEGAL_SNIPPETS[key].en).sort(), key).toEqual([...de].sort())
    }
  })

  it('LEGAL_SNIPPET_REQUIRES_LAWYER = Spalte „Kanzlei: ja“', () => {
    expect(LEGAL_SNIPPET_REQUIRES_LAWYER).not.toContain('product.noSpecialWarnings')
    expect(LEGAL_SNIPPET_REQUIRES_LAWYER).not.toContain('product.glassFrame')
    expect(LEGAL_SNIPPET_REQUIRES_LAWYER).not.toContain('email.pickup.ready')
    expect(LEGAL_SNIPPET_REQUIRES_LAWYER).toContain('price.kleinunternehmerNote')
    expect(LEGAL_SNIPPET_REQUIRES_LAWYER).toHaveLength(LEGAL_SNIPPET_KEYS.length - 3)
  })
})

describe('getSnippet (Muster R-012)', () => {
  it('ersetzt Platzhalter und liefert Version und sha256', () => {
    const s = getSnippet('delivery.timeShipping', 'de', { deliveryTime: '2–5 Werktage' })
    expect(s).toMatchObject({
      key: 'delivery.timeShipping',
      locale: 'de',
      text: 'Lieferzeit: 2–5 Werktage (bei Vorkasse ab Zahlungseingang)',
      version: 'draft-1',
      origin: 'draft',
    })
    expect(s.sha256).toBe(LEGAL_SNIPPETS['delivery.timeShipping'].sha256)
    expect(getSnippet('checkout.vorkasseInfo', 'en', { vorkasseDays: 7 }).text).toContain(
      'for 7 days',
    )
    expect(getSnippet('price.shippingNote', 'en').text).toBe('plus shipping costs')
  })

  it('fehlender oder leerer Platzhalterwert → Fehler, nie rohe Tokens', () => {
    expect(() => getSnippet('delivery.timeShipping', 'de')).toThrow(SnippetRenderError)
    expect(() => getSnippet('delivery.timeShipping', 'de', { deliveryTime: '  ' })).toThrow(
      /ohne Wert: \{\{deliveryTime\}\}/,
    )
    expect(() =>
      getSnippet('checkout.deviationAgreement', 'de', { itemTitle: 'Schale', objectNumber: '017' }),
    ).toThrow(/deviationText/)
  })

  it('unbekannter Platzhalter oder kaputte Klammern → Fehler', () => {
    expect(() => renderSnippetText('x', 'Hallo {{STEUERNUMMER}}', { STEUERNUMMER: '1' })).toThrow(
      /unbekannte Platzhalter: \{\{STEUERNUMMER\}\}/,
    )
    expect(() => renderSnippetText('x', 'Hallo {{name', { name: 'Jutta' })).toThrow(
      SnippetRenderError,
    )
    expect(renderSnippetText('x', 'Hallo {{name}}', { name: 'Jutta' })).toBe('Hallo Jutta')
  })

  it('unbekannter Schlüssel → Fehler', () => {
    expect(() => getSnippet('price.unknown' as LegalSnippetKey, 'de')).toThrow(SnippetRenderError)
  })
})
