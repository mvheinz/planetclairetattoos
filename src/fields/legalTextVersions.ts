import type { GroupField } from 'payload'

// Gespeicherte Rechtstext-Fassungen einer Kasse bzw. Bestellung (DATENMODELL §6.8.1, §6.25.1; R-012, E-41): Stand beim
// Klick auf „Zahlungspflichtig bestellen“. An Bestellungen Pflicht und nach dem Anlegen unveränderlich (Hook).

export const LEGAL_TEXT_VERSION_KEYS = [
  'agb',
  'widerrufsbelehrung',
  'widerrufsformular',
  'datenschutz',
  'versandZahlung',
] as const
export type LegalTextVersionKey = (typeof LEGAL_TEXT_VERSION_KEYS)[number]

/** Rechtstext-Typ je Feld (`versandZahlung` ↔ `versand-zahlung`). */
export const LEGAL_TEXT_VERSION_TYPES = {
  agb: 'agb',
  widerrufsbelehrung: 'widerrufsbelehrung',
  widerrufsformular: 'widerrufsformular',
  datenschutz: 'datenschutz',
  versandZahlung: 'versand-zahlung',
} as const satisfies Record<LegalTextVersionKey, string>

const LABELS: Record<LegalTextVersionKey, string> = {
  agb: 'AGB',
  widerrufsbelehrung: 'Widerrufsbelehrung',
  widerrufsformular: 'Muster-Widerrufsformular',
  datenschutz: 'Datenschutzerklärung',
  versandZahlung: 'Versand & Zahlung',
}

export function legalTextVersionsField(options: { required: boolean }): GroupField {
  return {
    name: 'legalTextVersions',
    type: 'group',
    label: 'Rechtstext-Fassungen',
    admin: { readOnly: true },
    fields: LEGAL_TEXT_VERSION_KEYS.map((key) => ({
      name: key,
      type: 'relationship' as const,
      label: LABELS[key],
      relationTo: 'legal-texts' as const,
      required: options.required,
      admin: { readOnly: true },
    })),
  }
}
