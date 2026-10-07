import jsQR from 'jsqr'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { buildEpcPayload } from '@/lib/commerce/epc'
import { EPC_CID } from '@/lib/email/templates/orderSections'

import {
  MAIL_FIXTURE_BANK,
  MAIL_FIXTURE_PHONE,
  PREPAYMENT_MAIL_FIXTURE,
  renderFixture,
  scanMail,
} from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.14 – M02 `prepayment_instructions` (KONZEPT §6.3 „M02“, R-081, R-071, R-021): Bankdaten, Frist, EPC-QR per CID.

const render = async (
  locale: 'de' | 'en' = 'de',
  data: Record<string, unknown> = PREPAYMENT_MAIL_FIXTURE,
) => renderFixture('prepayment_instructions', data, locale, { withStatusLink: true })

async function decodeQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const code = jsQR(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    info.width,
    info.height,
  )
  return code ? Buffer.from(code.binaryData).toString('utf8') : null
}

describe('M02 prepayment_instructions', () => {
  it('Betreff exakt nach KONZEPT §6.2 (Frist als Berliner Datum)', async () => {
    expect((await render('de')).subject).toBe(
      'Deine Bestellung PC-2026-00017 – bitte überweise bis 19.10.2026',
    )
    expect((await render('en')).subject).toBe(
      'Your order PC-2026-00017 – please transfer by 19 Oct 2026',
    )
  })

  it('R-081 Bankdaten: Kontoinhaberin, IBAN in 4er-Gruppen, BIC, Betrag, Verwendungszweck = Bestellnummer, „bitte bis“', async () => {
    const m = plain(await render())
    expect(m.text).toContain('Kontoinhaberin: Jutta Beispiel')
    expect(m.text).toContain('IBAN: DE36 0000 0000 0000 0000 00')
    expect(m.text).toContain('BIC: TESTDEFFXXX')
    expect(m.text).toContain('Betrag: 90,90 €')
    expect(m.text).toContain('Verwendungszweck: PC-2026-00017')
    expect(m.text).toContain('Bitte überweise bis 19.10.2026.')
    expect(m.text).toContain(
      'Deine Stücke sind bis 19.10.2026 für dich reserviert. Kommt bis dahin keine Zahlung an, wird die Bestellung automatisch storniert.',
    )
    expect(m.text).toContain('Zahlart: Vorkasse per Überweisung')
    expect(m.text).not.toContain('Bezahlt am')
  })

  it('R-081 EPC-QR als CID-Bild; mit jsqr dekodiert byte-gleich die Payload aus buildEpcPayload', async () => {
    const m = await render()
    expect(m.html).toContain(`src="cid:${EPC_CID}"`)
    const img = m.images.find((i) => i.cid === EPC_CID)
    expect(img?.contentType).toBe('image/png')
    const expected = buildEpcPayload({
      name: MAIL_FIXTURE_BANK.accountHolder,
      iban: MAIL_FIXTURE_BANK.iban,
      bic: MAIL_FIXTURE_BANK.bic,
      amountCents: 9090,
      reference: 'PC-2026-00017',
    })
    expect(await decodeQr(img!.content)).toBe(expected)
  })

  it('R-081 Anhänge: nur die Rechtstexte (keine Rechnung) mit Fassung; Anbieterkennung mit Telefon (R-021)', async () => {
    const m = plain(await render())
    expect(m.text).toContain('meine AGB in der Fassung vom 01.09.2026 (AGB_v3.pdf)')
    expect(m.text).toContain('(Widerrufsbelehrung-und-Formular_v2.pdf)')
    expect(m.text).not.toContain('deine Rechnung (')
    expect(m.text).toContain('Die Rechnung bekommst du, sobald deine Zahlung angekommen ist.')
    expect(m.text).toContain(`Telefon: ${MAIL_FIXTURE_PHONE}`)
    expect(m.text).toContain(
      'Vertrag widerrufen: https://planetclairetattoos.com/de/vertrag-widerrufen',
    )
  })

  it('ein Stück: „Dein Stück ist bis … reserviert“', async () => {
    const m = await render('de', {
      ...PREPAYMENT_MAIL_FIXTURE,
      items: [PREPAYMENT_MAIL_FIXTURE.items[0]],
      totalCents: 5190,
    })
    expect(m.text).toContain('Dein Stück ist bis 19.10.2026 für dich reserviert.')
  })

  for (const locale of ['de', 'en'] as const) {
    it(`Snapshot ${locale} (HTML + Text), keine unersetzten Tokens (R-084), keine Werbung`, async () => {
      const m = plain(await render(locale))
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(
        snapshotPath('prepayment_instructions', locale, 'txt'),
      )
      await expect(m.html).toMatchFileSnapshot(
        snapshotPath('prepayment_instructions', locale, 'html'),
      )
    })
  }
})

describe('M02 – Baustein email.vorkasse.paymentInstructions (R-071 Nr. 2)', () => {
  it('Frist als konkretes Datum mit Uhrzeit (Europe/Berlin)', async () => {
    const m = plain(await render())
    expect(m.text).toContain(
      'Bitte überweise 90,90 € bis 19.10.2026, 23:59 Uhr an Jutta Beispiel, IBAN DE36 0000 0000 0000 0000 00, Verwendungszweck: PC-2026-00017.',
    )
  })
})
