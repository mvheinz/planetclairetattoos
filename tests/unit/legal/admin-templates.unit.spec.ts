import { describe, expect, it } from 'vitest'

import {
  ADMIN_TEMPLATE_KEYS,
  ADMIN_TEMPLATE_STATUS,
  ADMIN_TEMPLATES,
  AdminTemplateError,
  mailtoLink,
  renderAdminTemplate,
  templateFitsOrder,
  type AdminTemplateKey,
  type AdminTemplateOrder,
} from '@/lib/legal/templates'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { V09_PATTERNS } from '../../helpers/mails'

// P5.27 – Vorlagen zum Öffnen im Mailprogramm (KONZEPT §7.13, R-084): als „Arbeitsfassung“ gekennzeichnet, mit einer
// versendeten Fixture-Bestellung (analog O10) bzw. einer stornierten Vorkasse-Bestellung (analog O07) ohne offene
// Platzhalter und ohne Treffer für V-01, V-09, V-11. Mit den echten Ankern prüft P8.21.

/** V-11 (RECHT §5): Rügefristen, die Rechte verkürzen. */
const V11 =
  /(innerhalb|binnen|within)\s+(von\s+)?\d+\s+(Tag(en)?|days?).{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt|otherwise|excluded|expires?)/i
const V01 = FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-01').map((p) => p.re)

/** Analog O10: versendet am 14.10.2026 (Berlin) mit DHL. */
const SHIPPED: AdminTemplateOrder & { status: string; paymentMethod: string } = {
  orderNumber: 'PC-2026-00990',
  locale: 'de',
  status: 'shipped',
  paymentMethod: 'paypal',
  customer: { name: 'Frieda Fiktiv', email: 'frieda.fiktiv@example.com' },
  totalCents: 5690,
  shipment: { carrier: 'dhl' },
  timestamps: { shippedAt: '2026-10-14T09:30:00.000Z' },
}
/** Analog O07: stornierte Vorkasse-Bestellung, Überweisung kam verspätet. */
const CANCELLED_PREPAYMENT: AdminTemplateOrder & { status: string; paymentMethod: string } = {
  orderNumber: 'PC-2026-00991',
  locale: 'de',
  status: 'cancelled',
  paymentMethod: 'prepayment',
  customer: { name: 'Greta Gedacht', email: 'greta.gedacht@example.com' },
  totalCents: 7690,
  prepayment: { receivedAmountCents: 7690 },
}
const SIGNATURE = { de: 'Liebe Grüße\nJutta', en: 'Best wishes,\nJutta' }

const fixtureFor = (key: AdminTemplateKey) =>
  key === 'prepayment_refund_iban' ? CANCELLED_PREPAYMENT : SHIPPED

describe('Vorlagen fürs Mailprogramm (P5.27, R-084)', () => {
  for (const key of ADMIN_TEMPLATE_KEYS) {
    for (const locale of ['de', 'en'] as const) {
      it(`R-084 ${key} (${locale}): Arbeitsfassung, keine offenen Platzhalter, kein V-01/V-09/V-11`, () => {
        const order = { ...fixtureFor(key), locale }
        expect(templateFitsOrder(key, order)).toBe(true)
        const r = renderAdminTemplate(key, { order, signature: SIGNATURE[locale] })
        expect(r.status).toBe(ADMIN_TEMPLATE_STATUS)
        expect(ADMIN_TEMPLATE_STATUS).toBe('Arbeitsfassung')
        const all = [r.subject, r.body, r.ownerNote ?? ''].join('\n')
        expect(all).not.toMatch(/\{\{|\}\}/)
        expect(r.subject).toContain(order.orderNumber)
        expect(r.body).toContain(SIGNATURE[locale].split('\n')[1]!)
        for (const re of [...V01, ...V09_PATTERNS, V11]) expect(all).not.toMatch(re)
        expect(r.mailto.startsWith(`mailto:${order.customer.email}?subject=`)).toBe(true)
        expect(decodeURIComponent(r.mailto.split('&body=')[1]!)).toBe(r.body.replace(/\n/g, '\r\n'))
      })
    }
  }

  it('Bruch: Hinweis für Jutta „bis {Datum} bei DHL reklamieren“ = Versanddatum + 7 Tage, nicht in der Mail', () => {
    const r = renderAdminTemplate('breakage_photos', { order: SHIPPED, signature: 'Jutta' })
    expect(r.ownerNote).toBe(
      'Für dich: bis 21.10.2026 bei DHL reklamieren (Versanddatum 14.10.2026 + 7 Tage).',
    )
    expect(r.body).not.toContain('21.10.2026')
    expect(r.body).toContain('Hallo Frieda,')
    expect(r.body).toContain('unberührt')
  })

  it('Bitte um IBAN: Betrag der Überweisung, Kontoinhaber:in und IBAN erbeten, Hinweis „nicht speichern“', () => {
    const r = renderAdminTemplate('prepayment_refund_iban', {
      order: CANCELLED_PREPAYMENT,
      signature: 'Jutta',
    })
    expect(r.body).toContain('76,90')
    expect(r.body).toContain('IBAN')
    expect(r.ownerNote).toContain('nicht in der Verwaltung speichern')
  })

  it('P6.11: Reparatur/Ersatz und § 37 VSBG sind keine mailto-Vorlagen mehr (protokollierte Mails M12/M13)', () => {
    expect([...ADMIN_TEMPLATE_KEYS]).toEqual(['breakage_photos', 'prepayment_refund_iban'])
    expect(Object.keys(ADMIN_TEMPLATES)).not.toContain('dispute_vsbg37')
    expect(Object.keys(ADMIN_TEMPLATES)).not.toContain('repair_or_replacement')
  })

  it('Vorlagen passen nur zu passenden Bestellungen; fehlende Werte → Fehler statt offener Platzhalter', () => {
    expect(templateFitsOrder('breakage_photos', CANCELLED_PREPAYMENT)).toBe(false)
    expect(templateFitsOrder('prepayment_refund_iban', SHIPPED)).toBe(false)
    expect(() =>
      renderAdminTemplate('breakage_photos', { order: CANCELLED_PREPAYMENT, signature: 'J' }),
    ).toThrow(AdminTemplateError)
    expect(() =>
      renderAdminTemplate('breakage_photos', { order: SHIPPED, signature: ' ' }),
    ).toThrow(AdminTemplateError)
  })

  it('mailto: Zeilenumbrüche als %0D%0A, Sonderzeichen kodiert', () => {
    expect(mailtoLink('a@b.de', 'Ä & B', 'x\ny')).toBe(
      'mailto:a@b.de?subject=%C3%84%20%26%20B&body=x%0D%0Ay',
    )
  })
})
