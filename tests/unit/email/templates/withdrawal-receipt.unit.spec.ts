import { describe, expect, it } from 'vitest'

import { splitReturnAddress } from '@/lib/email/templates/withdrawal'

import { renderFixture, scanMail, WITHDRAWAL_RECEIPT_FIXTURE } from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P6.7 – M08 `withdrawal_receipt` (KONZEPT §6.3 „M08“, R-093): Eingangsbestätigung des Widerrufs.

const render = async (
  locale: 'de' | 'en' = 'de',
  data: Record<string, unknown> = WITHDRAWAL_RECEIPT_FIXTURE,
) => plain(await renderFixture('withdrawal_receipt', data, locale))

describe('M08 withdrawal_receipt', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe(
      'Eingangsbestätigung deines Widerrufs WR-2026-00003 vom 12.10.2026, 14:03 Uhr',
    )
    expect((await render('en')).subject).toBe(
      'Confirmation of receipt of your withdrawal WR-2026-00003 (12 Oct 2026, 14:03)',
    )
  })

  it('R-093 Pflichtinhalte: Erklärung, Eingang mit Zeitzone, Nummer, Bausteine, Rücksendeadresse, Erstattung', async () => {
    const m = await render()
    for (const part of [
      'WR-2026-00003',
      '12.10.2026, 14:03 Uhr (MESZ)',
      'Erika Beispiel',
      'PC-2026-00017',
      'Tasse „Coco schläft“',
      'Passt farblich doch nicht.',
      'erika@example.com',
      'Diese E-Mail bestätigt den Eingang deiner Widerrufserklärung',
      'Bitte sende die Ware an: Jutta Beispiel · Planet Claire, Werkstattweg 7, 10999 Berlin',
      'Die unmittelbaren Kosten der Rücksendung trägst du.',
      'spätestens 14 Tage nach Eingang deines Widerrufs (bis 26.10.2026)',
    ]) {
      expect(m.text, part).toContain(part)
    }
    // keine Bestellmail: kein Status-Link
    expect(m.text).not.toContain('Bestellstatus')
  })

  it('R-093 eigene Rücksendeadresse; unbezahlte Vorkasse: „Bitte nichts überweisen.“ statt Rücksendung', async () => {
    const own = await render('de', {
      ...WITHDRAWAL_RECEIPT_FIXTURE,
      returnAddress: 'Planet Claire Retouren\nPostfach 12 34\n10999 Berlin',
    })
    expect(own.text).toContain(
      'Bitte sende die Ware an: Planet Claire Retouren, Postfach 12 34, 10999 Berlin.',
    )
    const free = await render('de', { ...WITHDRAWAL_RECEIPT_FIXTURE, returnAddress: 'Atelier' })
    expect(free.text).toContain('Bitte sende die Ware an: Atelier')
    expect(free.text).toContain('Die unmittelbaren Kosten der Rücksendung der Waren trägst du.')
    const unpaid = await render('de', { ...WITHDRAWAL_RECEIPT_FIXTURE, unpaidOrderCancelled: true })
    expect(unpaid.text).toContain('Deine Bestellung ist damit storniert. Bitte nichts überweisen.')
    expect(unpaid.text).not.toContain('Bitte sende die Ware an')
    const whole = await render('de', { ...WITHDRAWAL_RECEIPT_FIXTURE, items: [], itemsText: null })
    expect(whole.text).toContain('der ganze Vertrag')
  })

  it('MEZ im Winter', async () => {
    const m = await render('de', {
      ...WITHDRAWAL_RECEIPT_FIXTURE,
      receivedAt: '2026-12-01T13:03:00.000Z',
    })
    expect(m.text).toContain('01.12.2026, 14:03 Uhr (MEZ)')
    const en = await render('en', {
      ...WITHDRAWAL_RECEIPT_FIXTURE,
      receivedAt: '2026-12-01T13:03:00.000Z',
    })
    expect(en.text).toContain('1 Dec 2026, 14:03 (CET)')
  })

  it('splitReturnAddress zerlegt mehrzeilige Adressen', () => {
    expect(splitReturnAddress('A\nB 1\n10115 Berlin')).toEqual({
      name: 'A',
      street: 'B 1',
      postalCode: '10115',
      city: 'Berlin',
    })
    expect(splitReturnAddress('Atelier')).toBeNull()
  })

  for (const locale of ['de', 'en'] as const) {
    it(`AK-6-01 Snapshot ${locale}, R-084 keine unersetzten Tokens, V-09 keine Werbung`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('withdrawal_receipt', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('withdrawal_receipt', locale, 'html'))
    })
  }
})
