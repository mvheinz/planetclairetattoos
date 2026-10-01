import { POSTBOX_RE, isValidIban, isValidPhone, normalizeIban } from '@/lib/settings/rules'

// Bereiche und Felder der Einstellungen, Teil 1 (PLAN P5.21, KONZEPT §7.14, DATENMODELL §7.1): eine Quelle für das
// Handy-Formular (Client) und den Speicher-Endpunkt (Server, Whitelist). Pfade sind Punkt-Pfade im Global `settings`.
// Rein, ohne Server-Abhängigkeiten.

export type SettingsSectionKey = 'business' | 'payment' | 'notifications' | 'retention'

export interface SettingsFieldSpec {
  path: string
  label: string
  input: 'text' | 'email' | 'tel' | 'textarea' | 'select'
  hint?: string
  required?: boolean
  maxLength?: number
  autoComplete?: string
  /** Optionen (bei `select`); sonst vom Server ergänzt. */
  options?: readonly { value: string; label: string }[]
  /** Clientseitige Vorprüfung (dieselbe Regel prüft der Server). */
  check?: (value: string) => string | null
}

export const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
export const PHONE_HINT =
  'Erscheint nur in Impressum, Widerrufsbelehrung und in der Anbieterkennung der Bestellbestätigung.'
export const POSTBOX_MESSAGE = 'Bitte eine ladungsfähige Anschrift angeben, kein Postfach.'
export const PHONE_MESSAGE =
  'Bitte eine Telefonnummer (z. B. +49 30 1234567 oder 030 1234567) oder „[Telefon folgt]“ eingeben.'
export const IBAN_MESSAGE = 'Die IBAN ist ungültig (Prüfsumme stimmt nicht).'
export const BIC_MESSAGE = 'Die BIC hat 8 oder 11 Zeichen (z. B. BELADEBEXXX).'

export const checkStreet = (v: string) => (POSTBOX_RE.test(v) ? POSTBOX_MESSAGE : null)
export const checkPhone = (v: string) =>
  v.trim() === '' || isValidPhone(v.trim()) ? null : PHONE_MESSAGE
export const checkIban = (v: string) => (v.trim() === '' || isValidIban(v) ? null : IBAN_MESSAGE)
export const checkBic = (v: string) =>
  v.trim() === '' || BIC_RE.test(v.replace(/\s+/g, '').toUpperCase()) ? null : BIC_MESSAGE

export const SETTINGS_SECTIONS: Record<SettingsSectionKey, readonly SettingsFieldSpec[]> = {
  business: [
    {
      path: 'business.legalName',
      label: 'Name (Impressum)',
      input: 'text',
      required: true,
      autoComplete: 'name',
    },
    { path: 'business.tradeName', label: 'Geschäftsbezeichnung', input: 'text', maxLength: 80 },
    {
      path: 'business.street',
      label: 'Straße und Hausnummer',
      input: 'text',
      required: true,
      autoComplete: 'street-address',
      hint: 'Ladungsfähige Anschrift – kein Postfach.',
      check: checkStreet,
    },
    {
      path: 'business.postalCode',
      label: 'PLZ',
      input: 'text',
      required: true,
      maxLength: 5,
      autoComplete: 'postal-code',
    },
    {
      path: 'business.city',
      label: 'Ort',
      input: 'text',
      required: true,
      autoComplete: 'address-level2',
    },
    { path: 'business.country', label: 'Land', input: 'select' },
    {
      path: 'business.email',
      label: 'E-Mail (Impressum)',
      input: 'email',
      required: true,
      autoComplete: 'email',
    },
    {
      path: 'business.phone',
      label: 'Telefon',
      input: 'tel',
      autoComplete: 'tel',
      hint: PHONE_HINT,
      check: checkPhone,
    },
    {
      path: 'business.taxNumber',
      label: 'Steuernummer',
      input: 'text',
      maxLength: 40,
      hint: 'Nie öffentlich – steht nur auf Rechnungen, wenn nötig.',
    },
    {
      path: 'business.vatId',
      label: 'USt-IdNr. (optional)',
      input: 'text',
      maxLength: 11,
      hint: 'Format DE + 9 Ziffern.',
    },
    {
      path: 'business.economicId',
      label: 'Wirtschafts-IdNr. (optional)',
      input: 'text',
      maxLength: 40,
    },
    {
      path: 'business.returnAddress',
      label: 'Rücksendeadresse',
      input: 'textarea',
      maxLength: 300,
      hint: 'Leer = Geschäftsadresse.',
    },
    {
      path: 'tattoo.studioDistrict',
      label: 'Bezirk des Privatstudios',
      input: 'text',
      maxLength: 60,
      hint: 'Nur der Bezirk, keine Adresse.',
    },
    {
      path: 'social.instagramHandle',
      label: 'Instagram-Name (ohne @)',
      input: 'text',
      maxLength: 30,
    },
    { path: 'social.contactEmail', label: 'Kontakt-E-Mail (Website)', input: 'email' },
  ],
  payment: [
    { path: 'payment.accountHolder', label: 'Kontoinhaberin', input: 'text', maxLength: 70 },
    {
      path: 'payment.iban',
      label: 'IBAN',
      input: 'text',
      autoComplete: 'off',
      hint: 'Wird mit Prüfziffer geprüft. Bis zum Start steht hier die Beispiel-IBAN.',
      check: checkIban,
    },
    {
      path: 'payment.bic',
      label: 'BIC',
      input: 'text',
      maxLength: 11,
      autoComplete: 'off',
      check: checkBic,
    },
    { path: 'payment.bankName', label: 'Bank', input: 'text', maxLength: 80 },
  ],
  notifications: [
    {
      path: 'adminNotificationEmail',
      label: 'Hinweise an dich gehen an',
      input: 'email',
      required: true,
      hint: 'Neue Bestellungen, Widerrufe, Anfragen und Warnungen.',
    },
  ],
  retention: [
    {
      path: 'retention.invoiceYears',
      label: 'Rechnungen und Gutschriften aufbewahren',
      input: 'select',
      options: [
        { value: '10', label: '10 Jahre' },
        { value: '8', label: '8 Jahre' },
      ],
      hint: 'Achtung: erst nach Antwort auf Kanzleifrage K-33 umstellen. Wirkt nur auf neue Belege.',
    },
  ],
}

/** Wert eines Punkt-Pfads aus einem Objekt (z. B. dem Global). */
export function getPath(doc: unknown, path: string): unknown {
  let cur: unknown = doc
  for (const key of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/** Normalisierung vor dem Speichern (IBAN/BIC ohne Leerzeichen, groß; Text getrimmt; leer = null). */
export function normalizeSettingValue(path: string, value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (s === '') return null
  if (path === 'payment.iban') return normalizeIban(s)
  if (path === 'payment.bic') return s.replace(/\s+/g, '').toUpperCase()
  if (path === 'social.instagramHandle') return s.replace(/^@/, '')
  return s
}
