import { describe, expect, it } from 'vitest'

import { STATUS_TOKEN_PLACEHOLDER } from '@/lib/email/layout'
import { SMALL_BUSINESS_VAT_NOTE } from '@/lib/legal/constants'

import {
  fixtureLinks,
  MAIL_FIXTURE_BUSINESS,
  MAIL_FIXTURE_PHONE,
  ORDER_MAIL_FIXTURE,
  renderFixture,
  scanMail,
} from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.14 – M01 `order_confirmation` (KONZEPT §6.2/§6.3, R-081, R-021, R-049, R-084). Der Versandweg (Mock-Zahlung →
// genau eine M01 mit Anhängen im Datei-Treiber) folgt in P4.16a.

const render = async (
  locale: 'de' | 'en' = 'de',
  data: Record<string, unknown> = ORDER_MAIL_FIXTURE,
) => plain(await renderFixture('order_confirmation', data, locale, { withStatusLink: true }))

describe('M01 order_confirmation – R-081 Pflichtinhalte (DE)', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe('Danke! Deine Bestellung PC-2026-00017')
    expect((await render('en')).subject).toBe('Thank you! Your order PC-2026-00017')
  })

  it('R-081 Nr. 1 Anbieterkennung mit Name, Anschrift, Telefon (business.phone, R-021) und E-Mail', async () => {
    const m = await render()
    for (const part of [m.text, m.html]) {
      expect(part).toContain('Anbieterin')
      expect(part).toContain('Jutta Beispiel · Planet Claire')
      expect(part).toContain('Werkstattweg 7')
      expect(part).toContain('10999 Berlin')
      expect(part).toContain(`Telefon: ${MAIL_FIXTURE_PHONE}`)
      expect(part).toContain(MAIL_FIXTURE_BUSINESS.email)
    }
  })

  it('R-081 Nr. 2 Bestellnummer, Datum und Uhrzeit (Europe/Berlin)', async () => {
    const m = await render()
    expect(m.text).toContain('Bestellnummer: PC-2026-00017')
    // 09:28 UTC = 11:28 MESZ
    expect(m.text).toContain('Bestellt am: 14.10.2026, 11:28 Uhr')
  })

  it('R-081 Nr. 3 Positionen mit Nr., Titel, wesentlichen Eigenschaften, Preis und vereinbarter Abweichung', async () => {
    const m = await render()
    expect(m.text).toContain('Nr. 017 · Tasse „Coco schläft“: 45,00 €')
    expect(m.text).toContain('Keramik · 300 ml · handbemalt')
    expect(m.text).toContain('Nr. 023 · Cap „Planet“: 39,00 €')
    expect(m.text).toContain('Ausdrücklich vereinbarte Abweichung: kleiner Glasurfehler am Henkel')
  })

  it('R-081 Nr. 4 Versandkosten, Gesamtpreis und Kleinunternehmer-Hinweis (kein „inkl. MwSt.“)', async () => {
    const m = await render()
    expect(m.text).toContain('Versand: 6,90 €')
    expect(m.text).toContain('Gesamt: 90,90 €')
    expect(m.text).toContain(SMALL_BUSINESS_VAT_NOTE.de)
    expect(`${m.text}${m.html}`).not.toMatch(/inkl\.|MwSt/)
  })

  it('R-081 Nr. 5 Zahlart und „bezahlt am“', async () => {
    const m = await render()
    expect(m.text).toContain('Zahlart: Karte (Apple Pay)')
    expect(m.text).toContain('Bezahlt am 14.10.2026')
  })

  it('R-081 Nr. 6 Liefer- und Rechnungsadresse, Lieferzeit', async () => {
    const m = await render()
    expect(m.text).toContain('Lieferadresse:\nErika Beispiel\nMusterstraße 1\n10115 Berlin')
    expect(m.text).toContain('Rechnungsadresse:\nMax Rechnung\nRechnungsweg 2\n10117 Berlin')
    expect(m.text).toContain('Lieferzeit: 2–5 Werktage')
  })

  it('R-081 Nr. 6 Abholung: „Ich melde mich wegen der Abholung“, keine Lieferadresse', async () => {
    const m = await render('de', {
      ...ORDER_MAIL_FIXTURE,
      fulfillmentMethod: 'pickup',
      shippingCents: 0,
      totalCents: 8400,
      shippingAddress: null,
      carrierEmailConsent: false,
    })
    expect(m.text).toContain('Ich melde mich wegen der Abholung.')
    expect(m.text).toContain('Abholung in Berlin: 0,00 €')
    expect(m.text).not.toContain('Lieferadresse')
    expect(m.text).not.toContain('DHL')
  })

  it('R-081 Nr. 7 gesetzliche Mängelhaftung mit Link zur harmonisierten Mitteilung (R-049)', async () => {
    const m = await render()
    expect(m.text).toContain('gesetzliche Mängelhaftungsrecht')
    expect(m.html).toContain('href="https://planetclairetattoos.com/de/versand-und-zahlung"')
  })

  it('R-081 Nr. 8 Anhänge mit Versionsnummern „in der Fassung vom“, Rücksendekosten, Link „Vertrag widerrufen“', async () => {
    const m = await render()
    expect(m.text).toContain('deine Rechnung (RE-2026-00042.pdf)')
    expect(m.text).toContain('unsere AGB in der Fassung vom 01.09.2026 (AGB_v3.pdf)')
    expect(m.text).toContain(
      'Widerrufsbelehrung mit Muster-Widerrufsformular in der Fassung vom 15.08.2026 (Widerrufsbelehrung-und-Formular_v2.pdf)',
    )
    expect(m.text).toContain('Die unmittelbaren Kosten der Rücksendung der Waren trägst du.')
    expect(m.html).toContain(`href="${fixtureLinks('de').withdraw}"`)
    expect(m.text).toContain(
      'Vertrag widerrufen: https://planetclairetattoos.com/de/vertrag-widerrufen',
    )
  })

  it('R-081 Nr. 9 DHL-Einwilligung mit Widerrufsweg nur, wenn erteilt', async () => {
    expect((await render()).text).toContain('an DHL weitergebe')
    const without = await render('de', { ...ORDER_MAIL_FIXTURE, carrierEmailConsent: false })
    expect(without.text).not.toContain('DHL')
  })

  it('R-081 Nr. 10 Link zum Bestellstatus (Token-Platzhalter) und zur Datenschutzerklärung', async () => {
    const m = await render()
    expect(m.html).toContain(
      `href="https://planetclairetattoos.com/de/bestellung/${STATUS_TOKEN_PLACEHOLDER}"`,
    )
    expect(m.html).toContain('href="https://planetclairetattoos.com/de/datenschutz"')
  })

  it('R-081 Nr. 11 Rechnung als Anhang genannt; Baustein zum Vertragsschluss als gekennzeichneter Platzhalter', async () => {
    const m = await render()
    expect(m.text).toContain('RE-2026-00042.pdf')
    expect(m.text).toContain(
      '[Platzhalter – Kanzlei-Wortlaut folgt] PLATZHALTER – Text folgt von der Kanzlei.',
    )
  })

  it('S4-Block „Leider schon weg: Nr. … – erstattet: … €“ (Daten aus P4.21)', async () => {
    const m = await render('de', {
      ...ORDER_MAIL_FIXTURE,
      unavailable: [{ itemNumber: 23, refundedCents: 3900 }],
    })
    expect(m.text).toContain('Leider schon weg: Nr. 023 – erstattet: 39,00 €')
    expect((await render()).text).not.toContain('Leider schon weg')
  })

  it('EN-Bestellung: zusätzliche EN-Fassungen werden genannt', async () => {
    const m = await render('en', {
      ...ORDER_MAIL_FIXTURE,
      attachmentFiles: [...ORDER_MAIL_FIXTURE.attachmentFiles, 'AGB_v3_EN.pdf'],
    })
    expect(m.text).toContain('plus the English versions (AGB_v3_EN.pdf)')
    expect(m.text).toMatch(/our terms and conditions, version of 1 Sept? 2026 \(AGB_v3\.pdf\)/)
  })
})

describe('M01 – Snapshots und Verbote (AK-6-01, R-084, R-080)', () => {
  for (const locale of ['de', 'en'] as const) {
    it(`Snapshot ${locale} (HTML + Text), keine unersetzten Tokens, keine Werbung`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('order_confirmation', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('order_confirmation', locale, 'html'))
    })
  }
})
