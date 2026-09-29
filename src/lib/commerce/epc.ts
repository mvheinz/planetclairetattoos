import 'server-only'

import { assertCents } from '@/lib/money'
import { isValidIban, normalizeIban } from '@/lib/settings/rules'

// EPC-QR-Code („GiroCode“) für die Vorkasse (KONZEPT §4.8, KA-22, R-071): Nutzdaten nach EPC069-12 (Version 002,
// Zeichensatz 1 = UTF-8, SEPA Credit Transfer). Verwendungszweck = exakt die Bestellnummer (unstrukturiert, Zeile 11).
// Reine Funktionen ohne DB; das Bild erzeugt `qr.ts`.

export interface EpcInput {
  /** BIC (optional in Version 002 innerhalb des EWR). */
  bic?: string | null
  /** Kontoinhaberin (max. 70 Zeichen). */
  name: string
  iban: string
  /** Betrag in Integer-Cent (1 … 99 999 999 999). */
  amountCents: number
  /** Verwendungszweck = Bestellnummer, z. B. `PC-2026-00017` (max. 140 Zeichen). */
  reference: string
}

export class EpcError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EpcError'
  }
}

/** Höchstlänge der Nutzdaten in Byte (EPC069-12: QR-Version ≤ 13, Fehlerkorrektur M). */
export const EPC_MAX_BYTES = 331
const MAX_AMOUNT_CENTS = 99_999_999_999
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/

/** Betrag im EPC-Format: `EUR` + Euro mit Punkt und zwei Nachkommastellen (5390 → `EUR53.90`), ganzzahlig gebildet. */
export function formatEpcAmount(amountCents: number): string {
  assertCents(amountCents, 'Betrag')
  if (amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    throw new EpcError(`Betrag außerhalb 0,01 … 999.999.999,99 €: ${amountCents} Cent`)
  }
  return `EUR${Math.trunc(amountCents / 100)}.${String(amountCents % 100).padStart(2, '0')}`
}

/** IBAN zur Anzeige in 4er-Gruppen (`DE36 0000 0000 0000 0000 00`). */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, '$1 ')
}

function text(value: string, label: string, max: number, required: boolean): string {
  const v = value.trim()
  if (/[\r\n]/.test(v)) throw new EpcError(`${label} darf keinen Zeilenumbruch enthalten.`)
  if (required && v === '') throw new EpcError(`${label} fehlt.`)
  if ([...v].length > max) throw new EpcError(`${label} ist länger als ${max} Zeichen.`)
  return v
}

/** Nutzdaten des EPC-QR-Codes (EPC069-12, Version 002), Zeilen mit LF getrennt, ohne Zeilenumbruch am Ende. */
export function buildEpcPayload(input: EpcInput): string {
  const iban = normalizeIban(input.iban)
  if (!isValidIban(iban)) throw new EpcError('IBAN ist ungültig (Prüfsumme).')
  const bic = (input.bic ?? '').replace(/\s+/g, '').toUpperCase()
  if (bic && !BIC_RE.test(bic)) throw new EpcError('BIC ist ungültig.')
  const payload = [
    'BCD', // Service Tag
    '002', // Version
    '1', // Zeichensatz UTF-8
    'SCT', // SEPA Credit Transfer
    bic,
    text(input.name, 'Kontoinhaberin', 70, true),
    iban,
    formatEpcAmount(input.amountCents),
    '', // Purpose (leer)
    '', // strukturierte Referenz (nur ISO 11649 „RF…“) – leer
    text(input.reference, 'Verwendungszweck', 140, true), // unstrukturierter Verwendungszweck
  ].join('\n')
  if (Buffer.byteLength(payload, 'utf8') > EPC_MAX_BYTES) {
    throw new EpcError(`EPC-Nutzdaten länger als ${EPC_MAX_BYTES} Byte.`)
  }
  return payload
}
