import { describe, expect, it } from 'vitest'

import { TEMPLATE_META } from '@/lib/email/registry'
import type { EmailTemplate } from '@/lib/enums'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { MAIL_FIXTURE_DATA, renderFixture, V09_PATTERNS } from '../../helpers/mails'

// P6.11 – Die bis hier gebauten P6-Kund:innen-Mails (M08 Eingangsbestätigung Widerruf, M09 Erstattung, M12 Reparatur
// oder Ersatz, M13 Streitbeilegung) rendern mit Fixture-Daten (Bestellung, Widerruf, Reklamation – gleichartig zum
// Beispielbestand) DE und EN ohne offene Platzhalter (R-084), ohne Werbung (V-09), ohne OS-Hinweis (V-01) und ohne
// „Garantie“ für die Gewährleistung (V-18). P6.18 ergänzt M14 (Auskunft), M15 (Löschung) und M16 (Einwilligungs-
// widerruf); mit den echten Ankern prüft P8.21.

const P6_MAILS: readonly EmailTemplate[] = [
  'withdrawal_receipt',
  'refund_confirmation',
  'complaint_repair_choice',
  'dispute_vsbg',
  'privacy_access_response',
  'privacy_erasure_response',
  'consent_withdrawal_confirmation',
]
/** Kennung, die in der Mail stehen muss (Bestellnummer bzw. Nummer der Datenschutz-Anfrage). */
const IDENT: Partial<Record<EmailTemplate, string>> = {
  privacy_access_response: 'DS-2026-0001',
  privacy_erasure_response: 'DS-2026-0002',
}
const OPEN_TOKEN = /\{\{[^}]*\}\}|\{[a-zA-Z]+\}|\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/
const V01 = FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-01').map((p) => p.re)
const V18 = /Garantie/

describe('R-084 P6-Kund:innen-Mails', () => {
  it('R-084 M08, M09, M12–M16 sind Kund:innen-Mails mit Vorlage', () => {
    expect(P6_MAILS.map((t) => TEMPLATE_META[t].konzeptId)).toEqual([
      'M08',
      'M09',
      'M12',
      'M13',
      'M14',
      'M15',
      'M16',
    ])
    for (const t of P6_MAILS) expect(TEMPLATE_META[t].recipient).toBe('customer')
  })

  for (const template of P6_MAILS) {
    for (const locale of ['de', 'en'] as const) {
      it(`R-084 ${TEMPLATE_META[template].konzeptId} ${template} (${locale}) rendert ohne offene Tokens`, async () => {
        const data = MAIL_FIXTURE_DATA[template]
        expect(data, `Fixture für ${template}`).toBeDefined()
        const mail = await renderFixture(template, data!, locale)
        const all = `${mail.subject}\n${mail.text}`
        expect(all).not.toMatch(OPEN_TOKEN)
        expect(mail.html).not.toMatch(/\{\{|\}\}/)
        for (const re of [...V01, ...V09_PATTERNS, V18]) {
          expect(`${all}\n${mail.html}`).not.toMatch(re)
        }
        expect(mail.text).toContain(IDENT[template] ?? 'PC-2026-00017')
        expect(mail.text).toMatchSnapshot()
      })
    }
  }

  it('R-111 M12 nennt Wahlrecht, Unikat-Hinweis und Verlängerung um 12 Monate (DE/EN)', async () => {
    const data = MAIL_FIXTURE_DATA.complaint_repair_choice!
    const de = await renderFixture('complaint_repair_choice', data, 'de')
    expect(de.text).toContain('reparieren')
    expect(de.text).toContain('Ersatzstück')
    expect(de.text).toContain('Unikat')
    expect(de.text).toContain('um 12 Monate')
    expect(de.text).toContain('Nr. 017')
    const en = await renderFixture('complaint_repair_choice', data, 'en')
    expect(en.text).toContain('repair')
    expect(en.text).toContain('one of a kind')
    expect(en.text).toContain('12 months')
  })

  it('R-150 M14 nennt Download-Link (Platzhalter bis zum Versand), Gültigkeit, Löschtermin und Beschwerderecht', async () => {
    const de = await renderFixture(
      'privacy_access_response',
      MAIL_FIXTURE_DATA.privacy_access_response!,
      'de',
    )
    expect(de.text).toContain('/api/privacy-export/__PRIVACY_EXPORT_TOKEN__')
    expect(de.text).toContain('21.10.2026')
    expect(de.text).toContain('13.11.2026')
    expect(de.text).toContain('Berliner Beauftragten für Datenschutz und Informationsfreiheit')
    const en = await renderFixture(
      'privacy_access_response',
      MAIL_FIXTURE_DATA.privacy_access_response!,
      'en',
    )
    expect(en.text).toContain('Download your data')
  })

  it('R-151 M15 je Bereich gelöscht / eingeschränkt bis / Belege unverändert bis', async () => {
    const de = await renderFixture(
      'privacy_erasure_response',
      MAIL_FIXTURE_DATA.privacy_erasure_response!,
      'de',
    )
    expect(de.text).toContain('Anfragen zu Auftragsarbeiten: gelöscht')
    expect(de.text).toContain('Bestellungen: eingeschränkt bis 01.01.2033')
    expect(de.text).toContain('Rechnungen und Gutschriften: unverändert')
    expect(de.text).toContain('01.01.2037')
    const en = await renderFixture(
      'privacy_erasure_response',
      MAIL_FIXTURE_DATA.privacy_erasure_response!,
      'en',
    )
    expect(en.text).toContain('Orders: restricted until')
  })

  it('R-152 M16 nennt die Einwilligung, den Zeitpunkt und die Wirkung ab sofort (beide Varianten)', async () => {
    const dhl = await renderFixture(
      'consent_withdrawal_confirmation',
      MAIL_FIXTURE_DATA.consent_withdrawal_confirmation!,
      'de',
    )
    expect(dhl.text).toContain('an DHL weitergebe')
    expect(dhl.text).toContain('14.10.2026')
    expect(dhl.text).toContain('ab sofort')
    const portfolio = await renderFixture(
      'consent_withdrawal_confirmation',
      {
        ...MAIL_FIXTURE_DATA.consent_withdrawal_confirmation!,
        purpose: 'portfolio',
        orderNumber: null,
      },
      'en',
    )
    expect(portfolio.text).toContain('portfolio')
    expect(portfolio.text).toContain('applies immediately')
  })
})
