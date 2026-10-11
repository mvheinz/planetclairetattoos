import { describe, expect, it } from 'vitest'

import base from '../../../content/seed/data/base.json'

import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import {
  buildLegalTokenValues,
  renderLegalContent,
  type LegalTokenSettings,
} from '@/lib/legal/render'
import { toLexical } from '@/lib/seed/lexical'

// P18.5 (Datenschutz- und AGB-Prüfung): Rechtstexte im Grund-Seed
// - nennen Instagram nicht als Anfrage- oder Kontaktweg (U-15, U-42); der beschreibende Satz zur Verarbeitung durch Meta
//   bleibt erlaubt,
// - versprechen den Abruf über den Status-Link nicht „jederzeit“ (der Link läuft 180 Tage nach Abschluss ab, L-05),
// - nennen keine festen Werte, die in den Einstellungen änderbar sind (Reservierung, Erinnerung, Datumsbeispiel).
// Geänderte Typen tragen einen neuen Quellenvermerk, sonst übernimmt `pnpm seed:base` sie nicht (src/lib/seed/base.ts).

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
const raw = (t: LegalText, locale: 'de' | 'en') =>
  [
    (locale === 'de' ? t.intro : t.introEn) ?? '',
    ...(locale === 'de' ? t.sections : t.sectionsEn).flatMap((s) => [s.heading, ...s.paragraphs]),
  ].join('\n')

const settings = {
  ...(base.settings as unknown as LegalTokenSettings),
  business: {
    legalName: 'Jutta Beispiel',
    tradeName: 'Planet Claire',
    street: 'Werkstattweg 7',
    postalCode: '10999',
    city: 'Berlin',
    email: 'jutta@planetclairetattoos.com',
    phone: '+49 30 1234 5678',
    economicId: null,
    vatId: null,
  },
} as LegalTokenSettings

function render(
  type: string,
  locale: 'de' | 'en',
  payment: LegalTokenSettings['payment'] = settings.payment,
) {
  const t = text(type)
  const intro = locale === 'de' ? t.intro : t.introEn
  const md = [
    ...(intro ? [intro] : []),
    ...(locale === 'de' ? t.sections : t.sectionsEn).map((s) =>
      [`## ${s.heading}`, ...s.paragraphs].join('\n\n'),
    ),
  ].join('\n\n')
  const values = buildLegalTokenValues({
    settings: {
      ...settings,
      payment,
      shipping: {
        ...settings.shipping,
        deliveryTimeText: (base.settings.shipping.deliveryTimeText as Record<'de' | 'en', string>)[
          locale
        ],
      },
    } as LegalTokenSettings,
    siteUrl: 'https://planetclairetattoos.com',
    locale,
    returnCostsNote: locale === 'de' ? 'Rücksendekosten trägst du.' : 'You bear the costs.',
  })
  return renderLegalContent(toLexical(md) as never, values).plainText
}

describe('P18.5 Rechtstexte im Grund-Seed', () => {
  it('U-15/U-42 kein Text nennt Instagram-Nachrichten oder DMs als Anfrage- oder Kontaktweg (DE+EN)', () => {
    for (const t of TEXTS)
      for (const locale of ['de', 'en'] as const) {
        const s = raw(t, locale)
        expect(s, `${t.type} ${locale}`).not.toMatch(
          /Instagram-Nachricht|Instagram message|per DM/i,
        )
        expect(s, `${t.type} ${locale}`).not.toMatch(
          /auf Instagram[^.]*kannst du mir schreiben|write to me on Instagram \(/i,
        )
      }
    // Tattoo-Anfragen nur per E-Mail (AGB und Datenschutzerklärung)
    expect(raw(text('agb'), 'de')).toContain('Tattoo-Anfragen per E-Mail.')
    expect(raw(text('agb'), 'en')).toContain('tattoo enquiries by email.')
    expect(raw(text('datenschutz'), 'de')).toContain('Du schreibst mir per E-Mail;')
    expect(raw(text('datenschutz'), 'en')).toContain('You write to me by email;')
    // Der beschreibende Satz zur Verarbeitung durch Meta bleibt (Datenschutz, Abschnitt Kontakt)
    expect(raw(text('datenschutz'), 'de')).toMatch(
      /Schreibst du mir auf Instagram, verarbeitet Meta/,
    )
    expect(raw(text('datenschutz'), 'en')).toMatch(/If you write to me on Instagram, Meta/)
  })

  it('R-090 Impressum verweist für den Widerruf auf „Vertrag widerrufen“ statt auf „E-Mail oder Post“', () => {
    const de = raw(text('impressum'), 'de')
    const en = raw(text('impressum'), 'en')
    expect(de).not.toMatch(/rechtlich verbindliche Erklärungen/i)
    expect(en).not.toMatch(/legally binding statements/i)
    expect(de).toContain(`„${WITHDRAWAL_LINK_LABEL.de}“ unten auf jeder Seite`)
    expect(en).toContain(`“${WITHDRAWAL_LINK_LABEL.en}” link at the bottom of every page`)
  })

  it('R-067 AGB: Abruf über den Status-Link bis 180 Tage nach Abschluss, danach auf Anfrage per E-Mail', () => {
    const de = raw(text('agb'), 'de')
    const en = raw(text('agb'), 'en')
    expect(de).not.toMatch(/jederzeit erneut abrufen/)
    expect(en).not.toMatch(/retrieve them again at any time/)
    expect(de).toContain(
      'über den Bestellstatus-Link kannst du sie bis 180 Tage nach Abschluss deiner Bestellung erneut abrufen; danach schicke ich sie dir auf Anfrage per E-Mail.',
    )
    expect(en).toContain('until 180 days after your order has been completed')
    expect(en).toContain('I will send them to you by email on request')
  })

  it('R-012 keine festen Einstellungswerte: Reservierung aus {{reservationMinutes}}, Erinnerung ohne Stundenzahl, kein Datumsbeispiel', () => {
    for (const type of ['agb', 'versand-zahlung'])
      for (const locale of ['de', 'en'] as const) {
        const s = raw(text(type), locale)
        expect(s, `${type} ${locale}`).not.toMatch(/\b30 (Minuten|minutes)\b/)
        expect(s, `${type} ${locale}`).not.toMatch(/72 (Stunden|hours)/)
        expect(s, `${type} ${locale}`).not.toMatch(/12\.10\.|17\.10\.|12 October|17 October/)
      }
    expect(raw(text('agb'), 'de')).toContain('{{reservationMinutes}} Minuten')
    expect(raw(text('agb'), 'en')).toContain('{{reservationMinutes}} minutes')
    for (const [type, locale, phrase] of [
      ['agb', 'de', 'Vor Ablauf der Frist erinnere ich dich per E-Mail.'],
      ['agb', 'en', 'Before the period ends, I remind you by email.'],
      ['versand-zahlung', 'de', 'Vor Ablauf der Frist erinnere ich dich per E-Mail.'],
      ['versand-zahlung', 'en', 'Before the period ends, I remind you by email.'],
    ] as const)
      expect(raw(text(type), locale), `${type} ${locale}`).toContain(phrase)
  })

  it('R-012 die Reservierungsdauer kommt live aus den Einstellungen (ohne Wert: 30 wie die Reservierung selbst)', () => {
    expect(render('agb', 'de', { prepaymentDays: 5, reservationMinutes: 45 })).toContain(
      'reserviere ich das Stück 45 Minuten für dich',
    )
    expect(render('agb', 'en', { prepaymentDays: 5, reservationMinutes: 60 })).toContain(
      'I reserve the piece for you for 60 minutes',
    )
    expect(render('agb', 'de', { prepaymentDays: 5 })).toContain(
      'reserviere ich das Stück 30 Minuten für dich',
    )
  })

  it('geänderte Texte tragen einen neuen Quellenvermerk (sonst übernimmt `pnpm seed:base` sie nicht)', () => {
    for (const type of ['impressum', 'datenschutz', 'agb', 'versand-zahlung'])
      expect(text(type).sourceNote, type).toMatch(/P18\.5/)
  })
})
