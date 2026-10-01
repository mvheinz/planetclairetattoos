import { describe, expect, it } from 'vitest'

import {
  carrierEmailConsentActive,
  formatShippingAddress,
  shippingAddressLines,
} from '@/lib/commerce/address'

// P5.10 – „Adresse kopieren“ (KONZEPT §7.6, DATENMODELL §6.8.1 `copyAddressText`): Name ⏎ Adresszusatz ⏎ Straße Nr.
// ⏎ PLZ Ort; E-Mail nur mit erteilter und nicht widerrufener DHL-Einwilligung, nie eine Telefonnummer (R-101).

const base = {
  customer: { name: 'Erika Beispiel', email: 'erika@example.com', phone: '+49 30 1234567' },
  shippingAddress: {
    name: 'Erika Beispiel',
    addressLine1: 'Musterstraße 1',
    addressLine2: 'Hinterhaus, 3. OG',
    postalCode: '10115',
    city: 'Berlin',
    country: 'DE',
    phone: '0176 1234567',
  },
}

describe('formatShippingAddress', () => {
  it('R-101 Reihenfolge Name, Adresszusatz, Straße, PLZ Ort – ohne Land bei DE', () => {
    expect(formatShippingAddress({ ...base, carrierEmailConsent: false })).toBe(
      'Erika Beispiel\nHinterhaus, 3. OG\nMusterstraße 1\n10115 Berlin',
    )
  })

  it('R-101 mit Einwilligung enthält die E-Mail, ohne bzw. nach Widerruf nicht (DM-ORD-09)', () => {
    const consent = { ...base, carrierEmailConsent: true, carrierEmailConsentRevokedAt: null }
    expect(carrierEmailConsentActive(consent)).toBe(true)
    expect(formatShippingAddress(consent, { includeEmail: true }).split('\n').at(-1)).toBe(
      'erika@example.com',
    )
    // ohne ausdrücklichen Wunsch keine E-Mail (Packzettel)
    expect(formatShippingAddress(consent)).not.toContain('@')
    expect(
      formatShippingAddress({ ...base, carrierEmailConsent: false }, { includeEmail: true }),
    ).not.toContain('@')
    const revoked = { ...consent, carrierEmailConsentRevokedAt: '2026-10-01T08:00:00.000Z' }
    expect(carrierEmailConsentActive(revoked)).toBe(false)
    expect(formatShippingAddress(revoked, { includeEmail: true })).not.toContain('@')
  })

  it('R-101 nie eine Telefonnummer – auch nicht, wenn die Daten eine enthalten', () => {
    const text = formatShippingAddress({ ...base, carrierEmailConsent: true } as never, {
      includeEmail: true,
    })
    expect(text).not.toMatch(/\+49|0176|1234567/)
  })

  it('leere Zeilen fallen weg; Name notfalls aus der Bestellung; Ausland mit Land', () => {
    expect(
      shippingAddressLines({
        customer: { name: 'Max Muster' },
        shippingAddress: { addressLine1: 'Weg 2', postalCode: '1010', city: 'Wien', country: 'AT' },
      }),
    ).toEqual(['Max Muster', 'Weg 2', '1010 Wien', 'Österreich'])
  })
})
