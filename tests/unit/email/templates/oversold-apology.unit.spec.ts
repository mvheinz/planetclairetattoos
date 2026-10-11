import { describe, expect, it } from 'vitest'

import { TEMPLATE_META } from '@/lib/email/registry'

import { OVERSOLD_FIXTURE, renderFixture, scanMail } from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.15 – M10 `oversold_apology` (KONZEPT §6.3 „M10“, O19, R-084): Entschuldigung, volle Erstattung über dasselbe
// Zahlungsmittel in 5–10 Werktagen – keine Rechnung, kein Rabattcode und (P18.5, R-080) kein Link zurück in den Shop.

const render = async (locale: 'de' | 'en' = 'de') =>
  plain(await renderFixture('oversold_apology', OVERSOLD_FIXTURE, locale, { withStatusLink: true }))

describe('M10 oversold_apology', () => {
  it('Betreff exakt nach KONZEPT §6.2', async () => {
    expect((await render('de')).subject).toBe(
      'Leider schon weg – dein Geld kommt zurück (PC-2026-00017)',
    )
    expect((await render('en')).subject).toBe(
      'Sorry, already gone – your money is on its way back (PC-2026-00017)',
    )
  })

  it('Pflichtinhalt: Entschuldigung, Erklärung, volle Erstattung, 5–10 Werktage', async () => {
    const m = await render()
    expect(m.text).toContain('es tut mir wirklich leid')
    expect(m.text).toContain('Jemand war ein paar Sekunden schneller')
    expect(m.text).toContain('Nr. 017 · Tasse „Coco schläft“')
    expect(m.text).toContain('Den vollen Betrag von 51,90 €')
    expect(m.text).toContain('über dasselbe Zahlungsmittel')
    expect(m.text).toContain('5–10 Werktage')
  })

  it('R-080 P18.5 keine Werbung: kein Link in den Shop (Shop, Kategorien, Stücke) und keine Einladung zum Weiterkaufen', async () => {
    for (const locale of ['de', 'en'] as const) {
      const m = await render(locale)
      const all = `${m.text}\n${m.html}`
      expect(all, locale).not.toMatch(/\/(de|en)\/shop(\/|"|\s|$)/)
      expect(all, locale).not.toMatch(/zurück zum Shop|Back to the shop/i)
      // nur Pflicht- und Service-Links: Bestellstatus, Datenschutz, Impressum, „Vertrag widerrufen“, Kontakt
      const hrefs = [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]!)
      expect(hrefs.length, locale).toBeGreaterThan(0)
      for (const href of hrefs)
        expect(href, `${locale}: ${href}`).toMatch(
          /^mailto:|^https:\/\/planetclairetattoos\.com\/(de\/(bestellung|datenschutz|impressum|vertrag-widerrufen)|en\/(order|privacy|legal-notice|withdraw-from-contract))(\/|$)/,
        )
    }
  })

  it('keine Rechnung (kein Anhang), kein Rabattcode', async () => {
    expect(TEMPLATE_META.oversold_apology.attachments).toEqual([])
    const m = await render()
    expect(`${m.text}${m.html}`).not.toMatch(/Rabatt|Gutschein|Code|RE-\d{4}/i)
    expect(m.images).toEqual([])
  })

  for (const locale of ['de', 'en'] as const) {
    it(`AK-6-01 Snapshot ${locale}, R-084 keine unersetzten Tokens, V-09`, async () => {
      const m = await render(locale)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      await expect(m.text).toMatchFileSnapshot(snapshotPath('oversold_apology', locale, 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath('oversold_apology', locale, 'html'))
    })
  }
})
