import { describe, expect, it } from 'vitest'

import { INQUIRY_RECEIPT_FIXTURE, renderFixture, scanMail } from '../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './templates/helpers'

// P7.12 – M11 `inquiry_receipt` (KONZEPT §6.3 „M11“, §10.4, R-160): Referenz, Zusammenfassung mit **Anzahl** der Bilder,
// Antwortzeit-Satz, „Angebot und Bezahlung per Mail“, Baustein `inquiry.autoReply`, Löschung nach 6 Monaten, Link
// Datenschutz – keine Bilder, kein Status-Link, keine Werbung.

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
      'Hallo Erika Beispiel,',
      'AA-2026-0007',
      'Gegenstand: Cap',
      'Dackel Bruno',
      'Wunschzeitraum: bis Weihnachten',
      'Budget: ca. 80 €',
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

  it('eigener Antwortzeit-Satz und „Etwas anderes: …“; leere Angaben als „–“', async () => {
    const m = await render('de', {
      ...INQUIRY_RECEIPT_FIXTURE,
      objectType: 'sonstiges',
      objectTypeOther: 'Spiegel',
      desiredTimeframe: null,
      budget: '',
      imageCount: 0,
      responseTime: 'Gerade bin ich auf Reisen – ich melde mich ab dem 20.10.',
    })
    expect(m.text).toContain('Gegenstand: Etwas anderes: Spiegel')
    expect(m.text).toContain('Wunschzeitraum: –')
    expect(m.text).toContain('Budget: –')
    expect(m.text).toContain('Bilder: 0')
    expect(m.text).toContain('Gerade bin ich auf Reisen')
    expect(m.text).not.toContain('innerhalb einer Woche')
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
