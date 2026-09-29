import { describe, expect, it } from 'vitest'

import { HIGH_VALUE_CENTS } from '@/lib/email/templates/admin'
import type { EmailTemplate } from '@/lib/enums'

import {
  ADMIN_ORDER_FIXTURE,
  MAIL_FIXTURE_DATA,
  renderFixture,
  scanMail,
} from '../../../helpers/mails'

import { plain, rawTokens, snapshotPath } from './helpers'

// P4.15 – Verwaltungs-Mails A01/A02, A03, A06, A07, A08 (KONZEPT §6.4): Deutsch, kurz, Direktlink, Betreff exakt.

const render = async (t: EmailTemplate, data: Record<string, unknown> = MAIL_FIXTURE_DATA[t]!) =>
  plain(await renderFixture(t, data, 'de'))

const ORDER_LINK = 'https://planetclairetattoos.com/werkstatt/bestellungen/17'

describe('A01/A02 admin_order_placed', () => {
  it('A01 Betreff „Neue Bestellung … – Betrag – Versand“, Positionen, Lieferart, Name und Ort, Zahlart, Hinweis Keramik, Direktlink', async () => {
    const m = await render('admin_order_placed')
    expect(m.subject).toBe('Neue Bestellung PC-2026-00017 – 53,90 € – Versand')
    expect(m.text).toContain('- Nr. 017 · Tasse „Coco schläft“')
    expect(m.text).toContain('Name und Ort: Erika Beispiel, Berlin')
    expect(m.text).toContain('Zahlart: Karte')
    expect(m.text).toContain('Keramik')
    expect(m.text).not.toContain('> 500 €')
    expect(m.text).toContain('Zu packen')
    expect(m.html).toContain(`href="${ORDER_LINK}"`)
  })

  it('A01 Abholung und Hinweis „> 500 €“', async () => {
    const m = await render('admin_order_placed', {
      ...ADMIN_ORDER_FIXTURE,
      fulfillmentMethod: 'pickup',
      totalCents: HIGH_VALUE_CENTS + 100,
      items: [{ itemNumber: 17, title: 'Bild', category: 'zeichnung' }],
    })
    expect(m.subject).toBe('Neue Bestellung PC-2026-00017 – 501,00 € – Abholung')
    expect(m.text).toContain('> 500 €')
    expect(m.text).not.toContain('Keramik')
  })

  it('A02 Betreff „Vorkasse offen: … bis 01.10.“ mit Frist', async () => {
    const m = await render('admin_order_placed', {
      ...ADMIN_ORDER_FIXTURE,
      transition: 'O2',
      paymentMethod: 'prepayment',
      paymentMethodType: null,
      dueAt: '2026-10-01T21:59:59.000Z',
    })
    expect(m.subject).toBe('Vorkasse offen: PC-2026-00017 – 53,90 € bis 01.10.')
    expect(m.text).toContain('Frist: 01.10.2026, 23:59 Uhr')
    expect(m.text).toContain('Vorkasse offen')
  })
})

describe('A03, A06, A07, A08', () => {
  it('A03 admin_prepayment_cancelled: Betreff und Positionen wieder online', async () => {
    const m = await render('admin_prepayment_cancelled')
    expect(m.subject).toBe('Vorkasse storniert: PC-2026-00017 (keine Zahlung)')
    expect(m.text).toContain('wieder online')
    expect(m.text).toContain('Nr. 017 · Tasse „Coco schläft“')
  })

  it('A06 admin_oversold: Stücke, Bestellungen, erstatteter Betrag, Erstattungsstatus', async () => {
    const m = await render('admin_oversold')
    expect(m.subject).toBe('ACHTUNG: Nr. 017 doppelt bezahlt – automatisch erstattet')
    expect(m.text).toContain('Bestellungen: PC-2026-00018')
    expect(m.text).toContain('Erstattet: 51,90 €')
    expect(m.text).toContain('Erstattungsstatus: erstattet')
    expect(m.html).toContain('href="https://planetclairetattoos.com/werkstatt/bestellungen/18"')
  })

  it('A07 admin_dispute_opened: Betrag, Grund laut Stripe, Antwortfrist, Belege-Hinweis', async () => {
    const m = await render('admin_dispute_opened')
    expect(m.subject).toBe('ACHTUNG: Zahlung angefochten – PC-2026-00017')
    expect(m.text).toContain('Betrag: 53,90 €')
    expect(m.text).toContain('Grund laut Stripe: Ware nicht erhalten (product_not_received)')
    expect(m.text).toContain('Antwortfrist: 02.11.2026, 23:59 Uhr')
    expect(m.text).toContain(
      'Belege (Sendungsnummer, Rechnung, Packfotos) im Stripe-Dashboard einreichen.',
    )
  })

  it('A08 admin_refund_failed: Betrag, Fehlermeldung, Link zur Bestellung', async () => {
    const m = await render('admin_refund_failed')
    expect(m.subject).toBe('ACHTUNG: Erstattung fehlgeschlagen – PC-2026-00017')
    expect(m.text).toContain('Betrag: 45,00 €')
    expect(m.text).toContain('Fehlermeldung: expired_or_canceled_card')
    expect(m.html).toContain(`href="${ORDER_LINK}"`)
  })
})

describe('A09 admin_revenue_guard (P5.23, KONZEPT §8.4)', () => {
  const SETTINGS_LINK = 'https://planetclairetattoos.com/werkstatt/einstellungen'
  it('R-125 A09 U1: Betreff mit Schwelle, Stand, Handlungsempfehlung, Hinweis Steuerberatung, Direktlink', async () => {
    const m = await render('admin_revenue_guard')
    expect(m.subject).toBe('Umsatz-Wächter: U1 – 80 % der Vorjahresgrenze erreicht')
    expect(m.text).toContain('Stand 2026: 20.000 €')
    expect(m.text).toContain('Schwelle: U1 · 20.000 €')
    expect(m.text).toContain('ab 1. Januar 2027 die Regelbesteuerung')
    expect(m.text).toContain('Der Wächter ersetzt keine Steuerberatung.')
    expect(m.html).toContain(`href="${SETTINGS_LINK}"`)
  })

  it('R-125 A09 U0 zeigt den Vorjahresumsatz, U4 den Rest bis zur Jahresgrenze', async () => {
    const base = MAIL_FIXTURE_DATA.admin_revenue_guard!
    const u0 = await render('admin_revenue_guard', {
      ...base,
      year: 2027,
      stage: 'U0',
      totalCents: 0,
      previousYearTotalCents: 2_600_000,
    })
    expect(u0.text).toContain('Umsatz 2026: 26.000 €')
    expect(u0.text).toContain('Dieses Jahr gilt die Kleinunternehmerregelung nicht')
    const u4 = await render('admin_revenue_guard', {
      ...base,
      stage: 'U4',
      totalCents: 9_600_050,
    })
    expect(u4.text).toContain('Nur noch 3.999,50 € bis 100.000 €')
  })
})

describe('AK-6-01/AK-6-03 Snapshots (DE) und Verbote', () => {
  const templates: EmailTemplate[] = [
    'admin_order_placed',
    'admin_prepayment_cancelled',
    'admin_oversold',
    'admin_dispute_opened',
    'admin_refund_failed',
    'admin_revenue_guard',
  ]
  for (const t of templates) {
    it(`${t}: Snapshot, keine unersetzten Tokens, V-09, immer Deutsch`, async () => {
      const m = await render(t)
      expect(rawTokens(m)).toEqual([])
      expect(scanMail(m)).toEqual([])
      expect(m.html).toContain('<html lang="de">')
      await expect(m.text).toMatchFileSnapshot(snapshotPath(t, 'de', 'txt'))
      await expect(m.html).toMatchFileSnapshot(snapshotPath(t, 'de', 'html'))
    })
  }
})
