import { describe, expect, it } from 'vitest'

import { TEMPLATE_META } from '@/lib/email/registry'

import {
  MAIL_FIXTURE_PHONE,
  PREPAYMENT_RECEIVED_FIXTURE,
  renderFixture,
  scanMail,
} from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.14 – M05 `prepayment_received` (KONZEPT §6.3 „M05“, R-084): Bestellnummer, Betrag, nächster Schritt, Rechnung.

const render = async (
  locale: 'de' | 'en' = 'de',
  data: Record<string, unknown> = PREPAYMENT_RECEIVED_FIXTURE,
) => plain(await renderFixture('prepayment_received', data, locale, { withStatusLink: true }))

describe('M05 prepayment_received', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe('Zahlung erhalten – Bestellung PC-2026-00017')
    expect((await render('en')).subject).toBe('Payment received – order PC-2026-00017')
  })

  it('Bestellnummer, Betrag, nächster Schritt (packen bzw. Abholung)', async () => {
    const m = await render()
    expect(m.text).toContain(
      'Überweisung über 90,90 € für die Bestellung PC-2026-00017 ist angekommen',
    )
    expect(m.text).toContain('packe ich deine Bestellung')
    const pickup = await render('de', {
      ...PREPAYMENT_RECEIVED_FIXTURE,
      fulfillmentMethod: 'pickup',
    })
    expect(pickup.text).toContain('für die Abholung bereit')
  })

  it('Rechnung als Anhang (Registry) und im Text genannt', async () => {
    expect(TEMPLATE_META.prepayment_received.attachments).toEqual(['invoice'])
    expect((await render()).text).toContain(
      'Deine Rechnung (RE-2026-00043.pdf) findest du im Anhang.',
    )
  })

  it('R-021 keine Telefonnummer (nur M01/M02)', async () => {
    const m = await render()
    expect(m.text).not.toContain(MAIL_FIXTURE_PHONE)
    expect(m.html).not.toContain(MAIL_FIXTURE_PHONE)
  })

  for (const locale of ['de', 'en'] as const) {
    it(`Snapshot ${locale} (HTML + Text), keine unersetzten Tokens (R-084), keine Werbung`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('prepayment_received', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('prepayment_received', locale, 'html'))
    })
  }
})
