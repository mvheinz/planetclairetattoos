import { describe, expect, it } from 'vitest'

import { AUTO_DELIVERED_AFTER_DAYS } from '@/lib/commerce/shipped'
import { renderAccessReport, type AccessReportInput } from '@/lib/privacy/accessReport'

// P18.5 – `auskunft.html` (R-150, Art. 15 Abs. 1 lit. c und g DSGVO): Empfänger laut DIENSTE samt der Empfänger ohne
// technische Einbindung (DIENSTE §3.13: Apple/Google bei Wallet-Zahlung, Bank bei Vorkasse, Finanzamt/Steuerberatung),
// kein widersprüchliches „Sitz in den USA“ bei Diensten mit Sitz in der EU, und die Herkunft des Versandstatus so, wie
// sie ist (`CARRIER_DRIVER=manual`: Jutta trägt ihn ein, nach {days} Tagen gilt ein Paket als zugestellt).

const base: AccessReportInput = {
  locale: 'de',
  reference: 'DS-2026-0007',
  createdAt: new Date('2026-10-14T09:30:00.000Z'),
  business: {
    legalName: 'Jutta Beispiel',
    street: 'Werkstattweg 7',
    postalCode: '10999',
    city: 'Berlin',
    email: 'jutta@planetclairetattoos.com',
  },
  counts: {
    orders: 2,
    checkouts: 1,
    invoices: 1,
    withdrawals: 0,
    inquiries: 0,
    complaints: 0,
    emailLog: 2,
    mailJobs: 0,
    consentLog: 1,
    privacyRequests: 0,
    files: 1,
  },
  bankName: 'Beispielbank Berlin',
}

const recipients = (html: string) => {
  const start = html.indexOf('<h2>c)')
  return html.slice(start, html.indexOf('<h2>d)', start))
}

describe('R-150 auskunft.html – Empfänger und Herkunft', () => {
  it('DE: Dienste plus Apple, Google, Bank und Finanzamt; EU-Sitz ohne „Sitz in den USA“', () => {
    const html = renderAccessReport(base)
    const c = recipients(html)
    expect(c).toContain(
      'Stripe Payments Europe – im Auftrag und in eigener Verantwortung; Dublin, Irland; Bezug zu den USA (Sitz oder Mutterkonzern in den USA;',
    )
    expect(c).not.toContain('Sitz in den USA (')
    expect(c).toContain(
      'Apple Distribution International Ltd., Cork, Irland – wenn du mit Apple Pay zahlst',
    )
    expect(c).toContain('Google Ireland Limited, Dublin, Irland – wenn du mit Google Pay zahlst')
    expect(c).toContain('Meine Bank (Beispielbank Berlin) – bei Zahlung per Vorkasse')
    expect(c).toContain('Name und IBAN der zahlenden Person')
    expect(c).toContain('Finanzamt und gegebenenfalls Steuerberatung')
    expect(c).toContain('DHL Paket GmbH')
    expect(html).toContain(
      `Sendungsnummer und Versandstatus trage ich selbst ein; der Versanddienstleister übermittelt nichts an die Website. Ohne andere Nachricht gilt ein Paket ${AUTO_DELIVERED_AFTER_DAYS} Tage nach dem Versand als zugestellt.`,
    )
    expect(html).not.toContain('den Zustellstatus der Versanddienstleister')
    expect(html).not.toMatch(/\{\w+\}/)
    expect(html).not.toMatch(/<script|https?:\/\//i)
  })

  it('EN: same recipients, “connection to the USA”, shipping status entered by hand', () => {
    const html = renderAccessReport({ ...base, locale: 'en' })
    const c = recipients(html)
    expect(c).toContain(
      'Stripe Payments Europe – on my behalf and as independent controller; Dublin, Ireland; connection to the USA (registered office or parent company in the USA;',
    )
    expect(c).not.toContain('based in the USA')
    expect(c).toContain(
      'Apple Distribution International Ltd., Cork, Ireland – if you pay with Apple Pay',
    )
    expect(c).toContain('Google Ireland Limited, Dublin, Ireland – if you pay with Google Pay')
    expect(c).toContain('My bank (Beispielbank Berlin) – for payment in advance by bank transfer')
    expect(c).toContain('The tax office and, where applicable, a tax adviser')
    expect(html).toContain(
      `I enter the tracking number and shipping status myself; the carrier does not send anything to the website. Unless I hear otherwise, a parcel counts as delivered ${AUTO_DELIVERED_AFTER_DAYS} days after shipping.`,
    )
    expect(html).not.toContain('the carrier reports the delivery status')
    expect(html).not.toMatch(/\{\w+\}/)
  })

  it('ohne hinterlegten Banknamen nur „Meine Bank“', () => {
    const html = renderAccessReport({ ...base, bankName: '  ' })
    expect(recipients(html)).toContain('Meine Bank – bei Zahlung per Vorkasse')
  })
})
