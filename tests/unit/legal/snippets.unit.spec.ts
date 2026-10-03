import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { LEGAL_SNIPPET_KEYS, type LegalSnippetKey } from '@/lib/enums'
import { LEGAL_TOKENS } from '@/lib/legal/render'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import {
  LEGAL_SNIPPET_DRAFT_VERSION,
  SNIPPET_CONTEXT_TOKENS_BY_KEY,
  invalidSnippetTokens,
  LEGAL_SNIPPET_REQUIRES_LAWYER,
  SNIPPET_CONTEXT_TOKENS,
  SNIPPET_PLACEHOLDER_TEXT,
  SnippetRenderError,
  getSnippet,
  renderSnippetText,
  snippetTokens,
} from '@/lib/legal/snippets'

// P3.3/P6.1 Rechtsbausteine: Grund-Seed-Texte (RECHT ANFORDERUNGEN §6, DATENMODELL §6.28, R-012). Ohne geladene
// Collection (Unit-Test) liefert `getSnippet` die Seed-Texte mit der Version `draft-1` aus P3–P5.

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')

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

describe('LEGAL_SNIPPET_SEED (ANFORDERUNGEN §6)', () => {
  it('R-012 jeder Schlüssel hat DE und EN und origin; Rückfall mit Version draft-1 und sha256 des DE-Texts', () => {
    expect(Object.keys(LEGAL_SNIPPET_SEED).sort()).toEqual([...LEGAL_SNIPPET_KEYS].sort())
    for (const key of LEGAL_SNIPPET_KEYS) {
      const s = LEGAL_SNIPPET_SEED[key]
      expect(s.de.trim().length, key).toBeGreaterThan(5)
      expect(s.en.trim().length, key).toBeGreaterThan(5)
      expect(s.origin, key).toBe(WITHOUT_DRAFT.includes(key) ? 'placeholder' : 'draft')
      if (s.de.includes('{{')) continue
      const r = getSnippet(key, 'de')
      expect(r.version, key).toBe(LEGAL_SNIPPET_DRAFT_VERSION)
      expect(r.sha256, key).toBe(sha(s.de))
    }
  })

  it('Arbeitsfassungen wörtlich aus ANFORDERUNGEN §6; ohne Arbeitsfassung der Platzhaltertext', () => {
    expect(LEGAL_SNIPPET_SEED['price.kleinunternehmerNote'].de).toBe(
      'Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet',
    )
    expect(LEGAL_SNIPPET_SEED['price.shippingNote'].de).toBe('zzgl. Versandkosten')
    expect(LEGAL_SNIPPET_SEED['delivery.timeShipping'].de).toBe(
      'Lieferzeit: {{deliveryTime}} (bei Vorkasse ab Zahlungseingang)',
    )
    for (const key of WITHOUT_DRAFT) {
      if (key === 'commission.offer') continue
      expect(LEGAL_SNIPPET_SEED[key].de).toBe(SNIPPET_PLACEHOLDER_TEXT.de)
      expect(LEGAL_SNIPPET_SEED[key].en).toBe(SNIPPET_PLACEHOLDER_TEXT.en)
    }
    // R-161 (P7.14): Platzhalter mit Gliederung des Angebots
    const offer = LEGAL_SNIPPET_SEED['commission.offer']
    expect(offer.de.startsWith(SNIPPET_PLACEHOLDER_TEXT.de)).toBe(true)
    expect(offer.en.startsWith(SNIPPET_PLACEHOLDER_TEXT.en)).toBe(true)
    for (const part of [
      'Wesentliche Eigenschaften',
      'Gesamtpreis inkl. Versandkosten',
      'Lieferzeit',
      'Zahlungsweg',
      'Warnhinweise (GPSR)',
      '§ 312g Abs. 2 Nr. 1 BGB',
      'Muster-Widerrufsformular',
    ]) {
      expect(offer.de).toContain(part)
    }
  })

  it('Tokens: nur R-012 plus Kontext-Tokens, DE und EN mit denselben Platzhaltern', () => {
    const allowed = new Set<string>([...LEGAL_TOKENS, ...SNIPPET_CONTEXT_TOKENS])
    for (const key of LEGAL_SNIPPET_KEYS) {
      const de = snippetTokens(LEGAL_SNIPPET_SEED[key].de)
      for (const t of de) expect(allowed.has(t), `${key}: ${t}`).toBe(true)
      expect(snippetTokens(LEGAL_SNIPPET_SEED[key].en).sort(), key).toEqual([...de].sort())
    }
  })

  it('R-012 Kontext-Tokens je Schlüssel nur aus der Arbeitsfassung; andere Tokens werden abgelehnt', () => {
    expect(SNIPPET_CONTEXT_TOKENS_BY_KEY['checkout.deviationAgreement']).toEqual([
      'itemTitle',
      'objectNumber',
      'deviationText',
    ])
    expect(SNIPPET_CONTEXT_TOKENS_BY_KEY['price.shippingNote']).toEqual([])
    expect(invalidSnippetTokens('price.shippingNote', 'zzgl. {{deliveryTime}}')).toEqual([])
    expect(invalidSnippetTokens('price.shippingNote', 'für {{orderNumber}}')).toEqual([
      '{{orderNumber}}',
    ])
    expect(
      invalidSnippetTokens('email.vorkasse.reminder', '{{orderNumber}} {{STEUERNUMMER}}'),
    ).toEqual(['{{STEUERNUMMER}}'])
    expect(invalidSnippetTokens('price.shippingNote', 'kaputt {{name')).toEqual(['{{…}}'])
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
    expect(s.sha256).toBe(sha(LEGAL_SNIPPET_SEED['delivery.timeShipping'].de))
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
