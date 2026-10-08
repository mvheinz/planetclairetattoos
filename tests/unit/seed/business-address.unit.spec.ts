import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { customerFooterText, type MailBusiness } from '@/lib/email/layout'
import { clearLegacyPlaceholders, LEGACY_SETTINGS_PLACEHOLDERS } from '@/lib/seed/globals'

import { fixtureLinks } from '../../helpers/mails'

// P13.7 (U-46): Juttas Anschrift „Jutta Dollmann, Anklamer Straße 28, 10115 Berlin“ steht in den Stammdaten des
// Grund-Seeds; Mails (Fuß), Rechtstexte (Tokens), Rechnungen und die Kontaktseite lesen sie von dort. Frühere
// Platzhalter ersetzt ein neuer Grund-Seed, eigene Werte nie.

const base = JSON.parse(
  readFileSync(path.join(process.cwd(), 'content/seed/data/base.json'), 'utf8'),
) as { settings: { business: Record<string, string> } }

describe('U-46 Anschrift in den Stammdaten', () => {
  it('Grund-Seed: Name, Straße, PLZ, Ort, Land', () => {
    expect(base.settings.business).toMatchObject({
      legalName: 'Jutta Dollmann',
      street: 'Anklamer Straße 28',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
    })
  })

  it('Mail-Fuß mit den Seed-Stammdaten (DE/EN)', () => {
    for (const locale of ['de', 'en'] as const) {
      const text = customerFooterText({
        locale,
        business: base.settings.business as unknown as MailBusiness,
        links: fixtureLinks(locale),
        orderMail: false,
      })
      expect(text).toContain('Jutta Dollmann')
      expect(text).toContain('Anklamer Straße 28')
      expect(text).toContain('10115 Berlin')
    }
  })

  it('frühere Platzhalter gelten als leer, eigene Werte bleiben', () => {
    const old = {
      business: {
        legalName: '[Name folgt]',
        street: '[Adresse folgt]',
        postalCode: '00000',
        city: 'Berlin',
      },
    }
    expect(clearLegacyPlaceholders(old, LEGACY_SETTINGS_PLACEHOLDERS)).toEqual({
      business: { legalName: null, street: null, postalCode: null, city: 'Berlin' },
    })
    const own = { business: { street: 'Andere Straße 1', postalCode: '10999' } }
    expect(clearLegacyPlaceholders(own, LEGACY_SETTINGS_PLACEHOLDERS)).toEqual(own)
  })
})
