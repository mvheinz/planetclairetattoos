import { describe, expect, it } from 'vitest'

import {
  CARRIER_TRACKING_HOSTS,
  renderFixture,
  scanMail,
  SHIPPED_FIXTURE,
  SHIPPED_LETTER_FIXTURE,
} from '../../helpers/mails'
import { plain, rawTokens, snapshotPath } from '../email/templates/helpers'

// P5.15 – M06 `order_shipped` (R-082, KONZEPT §6.3 „M06“, DM-ORD-08): versandte Positionen, Versanddienst,
// Sendungsnummer und Verfolgungslink (ohne Nummer entfallen beide), Laufzeit, Transportschaden-Hinweis mit
// „unberührt“, keine Rügefrist (V-11), keine Werbung, keine externen Bilder, kein OS-Link.

/** V-11 (RECHT §5): Rügefristen, die Rechte verkürzen. */
const V11 =
  /(innerhalb|binnen|within)\s+(von\s+)?\d+\s+(Tag(en)?|days?).{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt|otherwise|excluded|expires?)/i

const render = (data: Record<string, unknown>, locale: 'de' | 'en' = 'de') =>
  renderFixture('order_shipped', data, locale, { withStatusLink: true }).then(plain)

describe('M06 order_shipped (R-082)', () => {
  it('R-082 Betreff exakt nach KONZEPT §6.2 (DE/EN)', async () => {
    expect((await render(SHIPPED_FIXTURE)).subject).toBe('Dein Paket ist unterwegs – PC-2026-00017')
    expect((await render(SHIPPED_FIXTURE, 'en')).subject).toBe(
      'Your parcel is on its way – PC-2026-00017',
    )
  })

  it('R-082 Positionen, Versanddienst, Sendungsnummer, Verfolgungslink, Laufzeit, Schadenshinweis „unberührt“, Status-Link', async () => {
    const m = await render(SHIPPED_FIXTURE)
    expect(m.text).toContain('- Nr. 017 · Tasse „Coco schläft“')
    expect(m.text).toContain('Versanddienst: DHL')
    expect(m.text).toContain('Sendungsnummer: 0034043431234567890')
    expect(m.text).toContain('Versanddatum: 14.10.2026')
    expect(m.html).toContain(`href="${SHIPPED_FIXTURE.trackingUrl}"`)
    expect(m.text).toContain('meist 1–3 Werktage')
    expect(m.text).toContain('unberührt')
    expect(m.text).toContain('Bestellstatus')
    expect(m.text).toContain('Vertrag widerrufen')
  })

  it('R-082 Brief ohne Sendungsnummer: kein Verfolgungslink, Versanddatum und Versandart (DM-ORD-08)', async () => {
    const m = await render(SHIPPED_LETTER_FIXTURE)
    expect(m.text).not.toContain('Sendungsnummer')
    expect(m.text).not.toContain('Sendungsverfolgung:')
    for (const host of CARRIER_TRACKING_HOSTS) expect(m.html).not.toContain(host)
    expect(m.text).toContain('Versanddienst: Deutsche Post')
    expect(m.text).toContain('Versanddatum: 14.10.2026')
    expect(m.text).toContain('ohne Sendungsverfolgung')
    expect(m.text).toContain('unberührt')
  })

  for (const locale of ['de', 'en'] as const) {
    for (const [name, data] of [
      ['tracking', SHIPPED_FIXTURE],
      ['letter', SHIPPED_LETTER_FIXTURE],
    ] as const) {
      it(`R-082 Snapshot ${locale} ${name}: kein V-11-Treffer, keine Werbung, keine externen Bilder, kein OS-Link (AK-6-03)`, async () => {
        const m = await render(data, locale)
        expect(rawTokens(m)).toEqual([])
        expect(scanMail(m)).toEqual([])
        expect(`${m.text}\n${m.html}`).not.toMatch(V11)
        expect(m.text).toContain(locale === 'de' ? 'unberührt' : 'unaffected')
        const suffix = name === 'tracking' ? '' : '-letter'
        await expect(m.text).toMatchFileSnapshot(
          snapshotPath(`order_shipped${suffix}`, locale, 'txt'),
        )
        await expect(m.html).toMatchFileSnapshot(
          snapshotPath(`order_shipped${suffix}`, locale, 'html'),
        )
      })
    }
  }
})
