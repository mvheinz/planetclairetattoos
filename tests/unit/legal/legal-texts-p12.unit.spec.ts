import { describe, expect, it } from 'vitest'

import base from '../../../content/seed/data/base.json'

import { LEGAL_SNIPPET_KEYS } from '@/lib/enums'
import { anchorAssigner, PRIVACY_ANCHORS, privacyAnchorFor } from '@/lib/legal/anchors'
import {
  buildLegalTokenValues,
  LEGAL_TOKENS,
  renderLegalContent,
  type LegalTokenSettings,
} from '@/lib/legal/render'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import { LEGAL_SNIPPET_REQUIRES_LAWYER, snippetTokens } from '@/lib/legal/snippets'
import { toLexical } from '@/lib/seed/lexical'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'

// P12.11 / U-22 / U-00: Rechtstexte vollständig ausformuliert (DE verbindlich, EN gleichwertig), mit Platzhaltern aus
// den Einstellungen; Schutz des geistigen Eigentums (Urheberrechtsvermerk, Kaufklausel, KI/TDM-Vorbehalt, Flash).
// R-002 (weiterhin `origin = placeholder`), R-012 (geschlossene Token-Liste), R-020, R-021, R-095, R-190, V-01…V-31.

type Section = { heading: string; paragraphs: string[] }
type LegalText = {
  type: string
  sourceNote: string
  intro?: string
  introEn?: string
  sections: Section[]
  sectionsEn: Section[]
}
const TEXTS = base.legalTexts as unknown as LegalText[]
const text = (type: string) => TEXTS.find((t) => t.type === type)!
const flat = (sections: Section[]) =>
  sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n')
const all = (type: string, locale: 'de' | 'en') => {
  const t = text(type)
  const intro = locale === 'de' ? t.intro : t.introEn
  return `${intro ?? ''}\n${flat(locale === 'de' ? t.sections : t.sectionsEn)}`
}
const tokensOf = (s: string) => [...s.matchAll(/\{\{([^{}]*)\}\}/g)].map((m) => m[1]!)

const SITE = 'https://planetclairetattoos.com'
const PHONE = '+49 30 1234 5678'
const settings = {
  ...(base.settings as unknown as LegalTokenSettings),
  business: {
    legalName: 'Jutta Beispiel',
    tradeName: 'Planet Claire',
    street: 'Werkstattweg 7',
    postalCode: '10999',
    city: 'Berlin',
    email: 'jutta@planetclairetattoos.com',
    phone: PHONE,
    economicId: null,
    vatId: null,
  },
  shipping: {
    ...(base.settings as unknown as LegalTokenSettings).shipping,
  },
} as LegalTokenSettings

function render(type: string, locale: 'de' | 'en') {
  const t = text(type)
  const md = [
    ...(locale === 'de' ? (t.intro ? [t.intro] : []) : t.introEn ? [t.introEn] : []),
    ...(locale === 'de' ? t.sections : t.sectionsEn).map((s) =>
      [`## ${s.heading}`, ...s.paragraphs].join('\n\n'),
    ),
  ].join('\n\n')
  const values = buildLegalTokenValues({
    settings: {
      ...settings,
      shipping: {
        ...settings.shipping,
        deliveryTimeText: (base.settings.shipping.deliveryTimeText as Record<'de' | 'en', string>)[
          locale
        ],
      },
    } as LegalTokenSettings,
    siteUrl: SITE,
    locale,
    returnCostsNote:
      locale === 'de'
        ? 'Die unmittelbaren Kosten der Rücksendung der Waren trägst du.'
        : 'You bear the direct costs of returning the goods.',
  })
  return renderLegalContent(toLexical(md) as never, values).plainText
}

describe('R-002 Rechtstexte ausformuliert, Herkunft bleibt Platzhalter (P12.11)', () => {
  it('R-002 alle sechs Typen: kein „Text folgt von der Kanzlei“ mehr, Quellenvermerk nennt Platzhalter und P12.11', () => {
    expect(TEXTS).toHaveLength(6)
    for (const t of TEXTS) {
      expect(t.sourceNote, t.type).toMatch(/Platzhalter/)
      expect(t.sourceNote, t.type).toMatch(/P12\.11/)
      for (const locale of ['de', 'en'] as const) {
        expect(all(t.type, locale), `${t.type} ${locale}`).not.toMatch(
          /folgt von der Kanzlei|to follow from the law firm/i,
        )
        expect(all(t.type, locale).length, `${t.type} ${locale}`).toBeGreaterThan(400)
      }
    }
  })

  it('U-00 Parität: DE und EN haben je Typ gleiche Gliederung, gleiche Platzhalter je Abschnitt und je einen Einstieg', () => {
    for (const t of TEXTS) {
      expect(t.sectionsEn.length, t.type).toBe(t.sections.length)
      expect(!!t.introEn, t.type).toBe(!!t.intro)
      t.sections.forEach((s, i) => {
        const en = t.sectionsEn[i]!
        expect(tokensOf(flat([en])).sort(), `${t.type} §${i + 1} ${s.heading}`).toEqual(
          tokensOf(flat([s])).sort(),
        )
        expect(en.paragraphs.length, `${t.type} §${i + 1}`).toBe(s.paragraphs.length)
        // Listen bleiben Listen
        s.paragraphs.forEach((p, j) =>
          expect(en.paragraphs[j]!.startsWith('- '), `${t.type} §${i + 1}.${j}`).toBe(
            p.startsWith('- '),
          ),
        )
      })
    }
  })

  it('R-012 nur Tokens der geschlossenen Liste (keine Steuernummer, R-020); {{phone}} nur in Impressum und Widerrufsbelehrung (R-021)', () => {
    for (const t of TEXTS)
      for (const locale of ['de', 'en'] as const)
        for (const tok of tokensOf(all(t.type, locale)))
          expect((LEGAL_TOKENS as readonly string[]).includes(tok), `${t.type}: ${tok}`).toBe(true)
    const withPhone = TEXTS.filter((t) => tokensOf(all(t.type, 'de')).includes('phone'))
      .map((t) => t.type)
      .sort()
    expect(withPhone).toEqual(['impressum', 'widerrufsbelehrung'])
    for (const t of TEXTS) expect(all(t.type, 'de')).not.toMatch(/STEUERNUMMER|Steuernummer/)
  })

  it('R-012 jeder Text lässt sich mit den Stammdaten vollständig rendern (DE und EN), ohne Rest-Platzhalter', () => {
    for (const t of TEXTS)
      for (const locale of ['de', 'en'] as const) {
        const out = render(t.type, locale)
        expect(out, `${t.type} ${locale}`).not.toMatch(/\{\{|\}\}/)
      }
  })

  it('V-01…V-31 Verbotsmuster: kein Treffer in DE/EN-Rechtstexten und Bausteinen', () => {
    const corpus = [
      ...TEXTS.flatMap((t) => [all(t.type, 'de'), all(t.type, 'en')]),
      ...LEGAL_SNIPPET_KEYS.filter((k) => k.startsWith('ip.')).flatMap((k) => [
        LEGAL_SNIPPET_SEED[k].de,
        LEGAL_SNIPPET_SEED[k].en,
      ]),
    ].join('\n')
    for (const p of FORBIDDEN_CONTENT_PATTERNS) expect(corpus, p.id).not.toMatch(p.re)
    expect(corpus).not.toMatch(/inkl\.?\s*(MwSt|USt)|OS-Plattform|ec\.europa\.eu/i)
  })
})

describe('R-020/R-021 Impressum aus Stammdaten (P12.11)', () => {
  it('R-020 Pflichtangaben nach § 5 DDG: Name, Anschrift, E-Mail, Telefon, § 19 UStG, Verantwortliche nach § 18 MStV (DE+EN)', () => {
    for (const locale of ['de', 'en'] as const) {
      const out = render('impressum', locale)
      for (const v of [
        'Jutta Beispiel, Planet Claire',
        'Werkstattweg 7',
        '10999 Berlin',
        'jutta@planetclairetattoos.com',
        PHONE,
        locale === 'de' ? '§ 19 UStG' : 'Section 19 of the German VAT Act',
      ])
        expect(out, `${locale}: ${v}`).toContain(v)
      expect(out).toMatch(/MStV/)
      expect(out).toMatch(/@planet\.claire\.tattoos/)
    }
  })

  it('R-190 Barrierefreiheits-Hinweis ohne Konformitätsbehauptung (V-26), Urheberrecht und KI-Vorbehalt vorhanden', () => {
    for (const locale of ['de', 'en'] as const) {
      const out = render('impressum', locale)
      expect(out).toMatch(locale === 'de' ? /Barrierefreiheit/ : /accessibility/i)
      expect(out).not.toMatch(
        /WCAG-konform|BFSG-konform|barrierefrei(e|er|en)?\s+(Shop|Website|Seite)|zertifiziert|certified/i,
      )
      expect(out).toMatch(/§ 44b|44b/)
      expect(out).toMatch(/robots\.txt/)
      expect(out).toMatch(/ai\.txt/)
    }
  })
})

describe('R-095 Widerrufsbelehrung und Muster-Widerrufsformular (P12.11)', () => {
  it('R-095 DE: genau die R26-URL, Telefon, Rücksendekosten, § 356a-Satz; EN löst zur englischen Adresse auf', () => {
    const de = render('widerrufsbelehrung', 'de')
    expect(de).toContain(`${SITE}/de/vertrag-widerrufen`)
    expect(de).toContain(PHONE)
    expect(de).toContain('Die unmittelbaren Kosten der Rücksendung der Waren trägst du.')
    expect(de).toMatch(/binnen vierzehn Tagen/)
    expect(de).toMatch(/Widerruf bestätigen/)
    const en = render('widerrufsbelehrung', 'en')
    expect(en).toContain(`${SITE}/en/withdraw-from-contract`)
    expect(en).toContain(PHONE)
    expect(en).toContain('You bear the direct costs of returning the goods.')
    expect(en).toMatch(/within fourteen days/)
    expect(en).toMatch(/Confirm withdrawal/)
  })

  it('R-095 Muster-Widerrufsformular (Anlage 2 EGBGB): Anschrift der Anbieterin und alle Formularfelder', () => {
    const de = render('widerrufsformular', 'de')
    for (const v of [
      'Werkstattweg 7',
      'Hiermit widerrufe(n) ich/wir',
      'Bestellt am',
      'Name des/der Verbraucher(s)',
      'Anschrift des/der Verbraucher(s)',
      'Unterschrift',
      'Datum',
      'Unzutreffendes streichen',
    ])
      expect(de, v).toContain(v)
    const en = render('widerrufsformular', 'en')
    for (const v of [
      'Werkstattweg 7',
      'hereby give notice',
      'Ordered on',
      'Name of consumer',
      'Address of consumer',
      'Signature',
      'Date',
      'Delete as appropriate',
    ])
      expect(en, v).toContain(v)
  })

  it('V-08 kein pauschaler Ausschluss („Handmade/Unikat = kein Widerruf“) in AGB, Belehrung und Versandtext', () => {
    for (const type of ['agb', 'widerrufsbelehrung', 'versand-zahlung'])
      for (const locale of ['de', 'en'] as const)
        expect(all(type, locale), `${type} ${locale}`).not.toMatch(
          /kein(e|en)?\s+(Widerruf|Umtausch|Rückgabe|Rücknahme)|no\s+returns|final\s+sale/i,
        )
  })
})

describe('R-012/R-022 Datenschutzerklärung (P12.11)', () => {
  it('Art. 13 DSGVO: alle 19 Anker-Abschnitte in DE und EN, Verantwortliche, Rechtsgrundlagen, Rechte, Aufsicht', () => {
    for (const [locale, sections] of [
      ['de', text('datenschutz').sections],
      ['en', text('datenschutz').sectionsEn],
    ] as const) {
      const assign = anchorAssigner(privacyAnchorFor)
      expect(
        sections.map((s) => assign(s.heading, 'h2')),
        locale,
      ).toEqual([...PRIVACY_ANCHORS])
      const out = render('datenschutz', locale)
      for (const v of [
        'Werkstattweg 7',
        'jutta@planetclairetattoos.com',
        'Art. 6',
        'Art. 15',
        'Art. 17',
        'Art. 21',
        'Alt-Moabit 59',
      ])
        expect(out, `${locale}: ${v}`).toContain(v)
      expect(out).toMatch(/TDDDG/)
      expect(out).not.toContain(PHONE)
    }
  })

  it('R-130 Speicher-/Cookie-Hinweis nennt abschließend alle sechs Einträge (ARCHITEKTUR §8.7) in DE und EN', () => {
    for (const locale of ['de', 'en'] as const) {
      const out = render('datenschutz', locale)
      for (const name of [
        'pc_cart',
        'pc_checkout',
        '__stripe_mid',
        '__stripe_sid',
        'pc-motion',
        'payload-token',
      ])
        expect(out, `${locale}: ${name}`).toContain(name)
    }
  })

  it('V-01 keine EU-OS-Plattform, kein Streitbeilegungs-Hinweis in Rechtstexten (R-112: nur im Wortlaut der Kanzlei)', () => {
    for (const t of TEXTS)
      for (const locale of ['de', 'en'] as const)
        expect(all(t.type, locale)).not.toMatch(
          /OS-Plattform|Streitbeilegung|dispute resolution|ODR\b|ec\.europa\.eu/i,
        )
  })
})

describe('R-110/R-036 AGB, Versand und Zahlung (P12.11)', () => {
  it('AGB: Vertragsschluss, Vorkasse-Frist, Transportrisiko, Mängelhaftung, Vertragssprache (DE+EN)', () => {
    const de = render('agb', 'de')
    const en = render('agb', 'en')
    for (const v of [
      'Zahlungspflichtig bestellen',
      '23:59 Uhr',
      '§ 19 UStG',
      '§ 475 Abs. 2 BGB',
      'Mängelhaftung',
      'Vertragssprache',
    ])
      expect(de, v).toContain(v)
    for (const v of [
      'Order with obligation to pay',
      '11:59 pm',
      'Section 19 UStG',
      'Section 475 (2) BGB',
      'liability for defects',
      'contract language',
    ])
      expect(en, v).toContain(v)
    expect(de).not.toMatch(/inkl\.?\s*MwSt/i)
  })

  it('Versand & Zahlung: Tabelle, Lieferzeit und Vorkasse-Frist werden aus den Einstellungen eingesetzt', () => {
    const de = render('versand-zahlung', 'de')
    expect(de).toContain('2–5 Werktage')
    expect(de).toMatch(/5\. Kalendertag/)
    expect(de).toMatch(/4,50|4\.50/)
    const en = render('versand-zahlung', 'en')
    expect(en).toContain('2–5 working days')
    expect(en).toMatch(/calendar day 5/)
  })
})

describe('U-22 Schutz des geistigen Eigentums (P12.11)', () => {
  const IP_KEYS = [
    'ip.copyrightNotice',
    'ip.aiMiningReservation',
    'ip.purchaseClause',
    'ip.tattooFlashNotice',
  ] as const

  it('(a)(b)(c)(d) vier Bausteine DE+EN als Arbeitsfassung (draft), ohne Platzhalter, nicht „Kanzlei: ja“', () => {
    for (const k of IP_KEYS) {
      expect(LEGAL_SNIPPET_KEYS).toContain(k)
      const s = LEGAL_SNIPPET_SEED[k]
      expect(s.origin, k).toBe('draft')
      expect(s.de.length, k).toBeGreaterThan(60)
      expect(s.en.length, k).toBeGreaterThan(60)
      expect(snippetTokens(s.de), k).toEqual([])
      expect(snippetTokens(s.en), k).toEqual([])
      expect(LEGAL_SNIPPET_REQUIRES_LAWYER, k).not.toContain(k)
    }
    expect(LEGAL_SNIPPET_SEED['ip.copyrightNotice'].de).toMatch(/urheberrechtlich geschützt/)
    expect(LEGAL_SNIPPET_SEED['ip.copyrightNotice'].de).toMatch(/Quellenangabe/)
    expect(LEGAL_SNIPPET_SEED['ip.aiMiningReservation'].de).toMatch(/§ 44b/)
    expect(LEGAL_SNIPPET_SEED['ip.aiMiningReservation'].en).toMatch(/44b/)
    const purchase = LEGAL_SNIPPET_SEED['ip.purchaseClause']
    for (const w of ['Nachdruck', 'Merchandise', 'Digitalisierung', 'Reproduktion', 'Serie'])
      expect(purchase.de, w).toContain(w)
    for (const w of ['reprints', 'merchandise', 'digitisation', 'reproduction', 'series'])
      expect(purchase.en, w).toContain(w)
    expect(LEGAL_SNIPPET_SEED['ip.tattooFlashNotice'].de).toMatch(/schriftlichen Genehmigung/)
    expect(LEGAL_SNIPPET_SEED['ip.tattooFlashNotice'].en).toMatch(/written permission/)
  })

  it('AGB und Impressum tragen dieselben Klauseln als eigene Abschnitte (Kaufklausel, KI/TDM, Flash-Nachstechen) in DE und EN', () => {
    const agbDe = flat(text('agb').sections)
    const agbEn = flat(text('agb').sectionsEn)
    for (const h of [
      'Urheberrecht und Kaufklausel',
      'KI-Training und Text- und Data-Mining',
      'Tattoo-Motive und Flash',
    ])
      expect(agbDe, h).toContain(h)
    for (const h of [
      'Copyright and purchase clause',
      'AI training and text and data mining',
      'Tattoo designs and flash',
    ])
      expect(agbEn, h).toContain(h)
    for (const w of [
      'Nachdruck',
      'Merchandise',
      'Digitalisierung',
      'Weiterverkauf als Reproduktion',
      'nicht in Serie',
      '§ 44b Abs. 3 UrhG',
      'schriftliche',
    ])
      expect(agbDe, w).toContain(w)
    for (const w of [
      'reprints',
      'merchandise',
      'digitisation',
      'resale as a reproduction',
      'not made into series',
      'Section 44b (3) UrhG',
      'written permission',
    ])
      expect(agbEn, w).toContain(w)
    const imp = flat(text('impressum').sections)
    expect(imp).toContain('Urheberrecht und Nutzung der Inhalte')
    expect(imp).toContain('Vorbehalt für KI-Training und Text- und Data-Mining')
  })
})
