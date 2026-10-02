import { describe, expect, it } from 'vitest'

import {
  checkBic,
  checkIban,
  IBAN_MESSAGE,
  normalizeSettingValue,
} from '@/admin/views/settings/settingsForm'
import { isValidIban } from '@/lib/settings/rules'

// P5.21 – IBAN mit Prüfziffer mod 97 (Einstellungen → Zahlung, KONZEPT §7.14): die Beispiel-IBAN des Grund-Seeds gilt,
// eine falsche Prüfziffer nicht; Leerzeichen und Kleinschreibung sind erlaubt und werden normalisiert.

describe('IBAN-Prüfung (P5.21)', () => {
  it('Beispiel-IBAN DE36 0000 0000 0000 0000 00 akzeptiert, DE00 0000 0000 0000 0000 00 abgelehnt', () => {
    expect(isValidIban('DE36 0000 0000 0000 0000 00')).toBe(true)
    expect(checkIban('DE36 0000 0000 0000 0000 00')).toBeNull()
    expect(isValidIban('DE00 0000 0000 0000 0000 00')).toBe(false)
    expect(checkIban('DE00 0000 0000 0000 0000 00')).toBe(IBAN_MESSAGE)
  })

  it('echte Prüfziffern (DE, AT), Kleinschreibung und Leerzeichen; falsche Länge abgelehnt', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('de89370400440532013000')).toBe(true)
    expect(isValidIban('AT61 1904 3002 3457 3201')).toBe(true)
    expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false)
    expect(isValidIban('DE89 3704 0044 0532 0130')).toBe(false)
    expect(isValidIban('abc')).toBe(false)
  })

  it('Normalisierung vor dem Speichern und BIC-Format', () => {
    expect(normalizeSettingValue('payment.iban', ' de36 0000 0000 0000 0000 00 ')).toBe(
      'DE36000000000000000000',
    )
    expect(normalizeSettingValue('payment.bic', 'bela de be xxx')).toBe('BELADEBEXXX')
    expect(normalizeSettingValue('payment.iban', '  ')).toBeNull()
    expect(checkBic('BELADEBEXXX')).toBeNull()
    expect(checkBic('BELADEBE')).toBeNull()
    expect(checkBic('BELA')).not.toBeNull()
  })
})
