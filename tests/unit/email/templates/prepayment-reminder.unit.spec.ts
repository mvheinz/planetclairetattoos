import { describe, expect, it } from 'vitest'

import { EPC_CID } from '@/lib/email/templates/orderSections'

import { REMINDER_FIXTURE, renderFixture, scanMail } from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.15 – M03 `prepayment_reminder` (KONZEPT §6.3 „M03“, R-071 Nr. 3, R-084).

const render = async (locale: 'de' | 'en' = 'de') =>
  plain(
    await renderFixture('prepayment_reminder', REMINDER_FIXTURE, locale, { withStatusLink: true }),
  )

describe('M03 prepayment_reminder', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe(
      'Erinnerung: Überweisung für PC-2026-00017 bis 19.10.2026',
    )
    expect((await render('en')).subject).toBe('Reminder: payment for PC-2026-00017 due 19 Oct 2026')
  })

  it('Pflichtinhalt: offener Betrag, Bankdaten + EPC-QR, Frist, „Hast du schon überwiesen?“', async () => {
    const m = await render()
    expect(m.text).toContain('Offener Betrag: 90,90 €')
    expect(m.text).toContain('IBAN: DE36 0000 0000 0000 0000 00')
    expect(m.text).toContain('Verwendungszweck: PC-2026-00017')
    expect(m.text).toContain('Bitte überweise bis 19.10.2026.')
    expect(m.text).toContain(
      'Hast du schon überwiesen? Dann ist alles gut – Überweisungen brauchen manchmal 1–2 Tage.',
    )
    expect(m.html).toContain(`src="cid:${EPC_CID}"`)
    expect(m.images.map((i) => i.cid)).toEqual([EPC_CID])
  })

  for (const locale of ['de', 'en'] as const) {
    it(`AK-6-01 Snapshot ${locale}, R-084 keine unersetzten Tokens, V-09`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('prepayment_reminder', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('prepayment_reminder', locale, 'html'))
    })
  }
})
