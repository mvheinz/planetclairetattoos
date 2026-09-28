import { describe, expect, it } from 'vitest'

import {
  buildEpcPayload,
  EPC_MAX_BYTES,
  EpcError,
  formatEpcAmount,
  formatIban,
} from '@/lib/commerce/epc'

// KONZEPT §4.8, KA-22, R-071 (P4.2): EPC-QR-Nutzdaten nach EPC069-12, Verwendungszweck = Bestellnummer.

const example = {
  bic: 'COBADEFFXXX',
  name: 'Jutta Beispiel',
  iban: 'DE89 3704 0044 0532 0130 00',
  amountCents: 5390,
  reference: 'PC-2026-00017',
}

describe('buildEpcPayload (EPC069-12)', () => {
  it('R-071 EPC-Payload eines Beispiels ist byte-gleich mit der Referenz (Betrag „EUR53.90“)', () => {
    const reference =
      'BCD\n002\n1\nSCT\nCOBADEFFXXX\nJutta Beispiel\nDE89370400440532013000\nEUR53.90\n\n\nPC-2026-00017'
    const payload = buildEpcPayload(example)
    expect(payload).toBe(reference)
    expect(Buffer.from(payload, 'utf8').equals(Buffer.from(reference, 'utf8'))).toBe(true)
    expect(payload.endsWith('\n')).toBe(false)
  })

  it('R-071 Verwendungszweck = exakt die Bestellnummer (unstrukturiert, Zeile 11); BIC optional', () => {
    const lines = buildEpcPayload({ ...example, bic: null }).split('\n')
    expect(lines).toHaveLength(11)
    expect(lines[4]).toBe('')
    expect(lines[9]).toBe('')
    expect(lines[10]).toBe('PC-2026-00017')
  })

  it('Umlaute bleiben UTF-8 (Zeichensatz 1), Länge ≤ 331 Byte', () => {
    const payload = buildEpcPayload({ ...example, name: 'Jütta Bäcker' })
    expect(payload).toContain('\nJütta Bäcker\n')
    expect(Buffer.byteLength(payload, 'utf8')).toBeLessThanOrEqual(EPC_MAX_BYTES)
  })

  it('Betrag ganzzahlig formatiert: EUR0.01 … EUR999999999.99', () => {
    expect(formatEpcAmount(5390)).toBe('EUR53.90')
    expect(formatEpcAmount(1)).toBe('EUR0.01')
    expect(formatEpcAmount(100)).toBe('EUR1.00')
    expect(formatEpcAmount(123456)).toBe('EUR1234.56')
    expect(formatEpcAmount(99_999_999_999)).toBe('EUR999999999.99')
    expect(() => formatEpcAmount(0)).toThrow(EpcError)
    expect(() => formatEpcAmount(100_000_000_000)).toThrow(EpcError)
    expect(() => formatEpcAmount(53.9)).toThrow()
  })

  it('lehnt ungültige Eingaben ab (IBAN-Prüfsumme, BIC, Name, Zeilenumbruch, Längen)', () => {
    expect(() => buildEpcPayload({ ...example, iban: 'DE89370400440532013001' })).toThrow(/IBAN/)
    expect(() => buildEpcPayload({ ...example, bic: 'COBA' })).toThrow(/BIC/)
    expect(() => buildEpcPayload({ ...example, name: '  ' })).toThrow(/Kontoinhaberin/)
    expect(() => buildEpcPayload({ ...example, name: 'x'.repeat(71) })).toThrow(/70/)
    expect(() => buildEpcPayload({ ...example, reference: 'PC-2026\n00017' })).toThrow(
      /Zeilenumbruch/,
    )
    expect(() => buildEpcPayload({ ...example, reference: '' })).toThrow(/Verwendungszweck/)
  })
})

describe('formatIban', () => {
  it('Anzeige in 4er-Gruppen', () => {
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
    expect(formatIban(' de89 3704 0044 0532 0130 00 ')).toBe('DE89 3704 0044 0532 0130 00')
    expect(formatIban('DE36000000000000000000')).toBe('DE36 0000 0000 0000 0000 00')
  })
})
