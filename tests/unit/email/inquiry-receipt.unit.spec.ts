import { describe, expect, it } from 'vitest'

import { inquiryReceiptDataSchema } from '@/lib/email/templates/inquiry'

import { INQUIRY_RECEIPT_FIXTURE, renderFixture, scanMail } from '../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './templates/helpers'

// P7.12 – M11 `inquiry_receipt` (KONZEPT §6.3 „M11“, §10.4, R-160): Referenz, Eingang, Gegenstand, **Anzahl** der Bilder,
// Antwortzeit-Satz, „Angebot und Bezahlung per Mail“, Baustein `inquiry.autoReply`, Löschung nach 6 Monaten, Link
// Datenschutz – keine Bilder, kein Status-Link, keine Werbung. P18.5: keine Freitexte an die ungeprüfte Adresse.

const render = async (
  locale: 'de' | 'en' = 'de',
  data: Record<string, unknown> = INQUIRY_RECEIPT_FIXTURE,
) => plain(await renderFixture('inquiry_receipt', data, locale))

describe('M11 inquiry_receipt', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe('Deine Anfrage AA-2026-0007 ist angekommen')
    expect((await render('en')).subject).toBe('Your request AA-2026-0007 has arrived')
  })

  it('R-160 Pflichtinhalte: Referenz, Zusammenfassung, Anzahl Bilder, Antwortzeit, kein Vertrag, Löschung, Datenschutz', async () => {
    const m = await render()
    for (const part of [
      'Hallo,',
      'AA-2026-0007',
      'Eingegangen am: 12.10.2026, 14:03 Uhr (MESZ)',
      'Gegenstand: Cap',
      'Bilder: 2',
      'Ich melde mich meist innerhalb einer Woche.',
      'Mit deiner Anfrage kommt noch kein Vertrag zustande, und du zahlst nichts.',
      'Angebot und Bezahlung laufen per Mail, nicht über den Shop.',
      '[Platzhalter – Kanzlei-Wortlaut folgt]',
      'spätestens 6 Monate nach Eingang gelöscht (am 12.04.2027)',
      'Datenschutzerklärung',
    ]) {
      expect(m.text, part).toContain(part)
    }
    expect(m.html).toContain('/de/datenschutz#auftragsarbeiten')
    // keine Bestellmail, keine Bilder
    expect(m.text).not.toContain('Bestellstatus')
    expect(m.images).toEqual([])
  })

  it('eigener Antwortzeit-Satz; „Etwas anderes“ nur als feste Bezeichnung', async () => {
    const m = await render('de', {
      ...INQUIRY_RECEIPT_FIXTURE,
      objectType: 'sonstiges',
      imageCount: 0,
      responseTime: 'Gerade bin ich auf Reisen – ich melde mich ab dem 20.10.',
    })
    expect(m.text).toContain('Gegenstand: Etwas anderes\n')
    expect(m.text).toContain('Bilder: 0')
    expect(m.text).toContain('Gerade bin ich auf Reisen')
    expect(m.text).not.toContain('innerhalb einer Woche')
  })

  it('P18.5 Missbrauchsschutz: keine Freitexte an die ungeprüfte Adresse – das Schema nimmt sie gar nicht erst an', () => {
    for (const [field, value] of [
      ['name', 'Erika Beispiel'],
      ['idea', 'Kauf jetzt bei example.com!'],
      ['objectTypeOther', 'Spiegel'],
      ['desiredTimeframe', 'bis Weihnachten'],
      ['budget', 'ca. 80 €'],
    ] as const) {
      const parsed = inquiryReceiptDataSchema.safeParse({
        ...INQUIRY_RECEIPT_FIXTURE,
        [field]: value,
      })
      expect(parsed.success, field).toBe(false)
    }
  })

  it('P18.5 Anrede ohne Namen, keine Idee, kein Zeitraum, kein Budget (DE und EN)', async () => {
    for (const locale of ['de', 'en'] as const) {
      const m = await render(locale)
      const all = `${m.subject}\n${m.text}\n${m.html}`
      expect(m.text, locale).toContain(locale === 'de' ? 'Hallo,\n' : 'Hi,\n')
      expect(all, locale).not.toMatch(/Erika|Dackel|Weihnachten|80 €/)
      expect(all, locale).not.toMatch(
        /Deine Idee:|Wunschzeitraum|Budget|Your idea:|Preferred timeframe/,
      )
      expect(m.text, locale).toContain(locale === 'de' ? 'Gegenstand: Cap' : 'Object: Cap')
      expect(m.text, locale).toContain(locale === 'de' ? 'Bilder: 2' : 'Images: 2')
    }
  })

  for (const locale of ['de', 'en'] as const) {
    it(`Snapshot M11 ${locale}, R-084 keine unersetzten Tokens, V-09 keine Werbung`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('inquiry_receipt', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('inquiry_receipt', locale, 'html'))
    })
  }
})
