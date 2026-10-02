import 'server-only'

import { ENUM_LABELS } from '@/lib/enumLabels'

// Adresse für die DHL-App bzw. das Paketetikett (PLAN P5.10, KONZEPT §7.6 „Adresse kopieren“, DATENMODELL §6.8.1
// virtuelles Feld `copyAddressText`): `Name ⏎ Adresszusatz ⏎ Straße Nr. ⏎ PLZ Ort`. Die E-Mail steht nur darin, wenn
// die Kundin der Weitergabe an DHL zugestimmt und die Einwilligung nicht widerrufen hat; eine Telefonnummer nie
// (R-101, E-26). Reines Modul (ohne Datenbank).

export interface AddressLike {
  name?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
}

export interface AddressOrderLike {
  shippingAddress?: AddressLike | null
  customer?: { name?: string | null; email?: string | null } | null
  carrierEmailConsent?: boolean | null
  carrierEmailConsentRevokedAt?: string | Date | null
}

export interface FormatAddressOptions {
  /** E-Mail anhängen – nur wirksam bei erteilter und nicht widerrufener DHL-Einwilligung. */
  includeEmail?: boolean
}

/** DHL-Einwilligung erteilt und nicht widerrufen (KONZEPT §7.6 „E-Mail an DHL: ja/nein“). */
export function carrierEmailConsentActive(order: AddressOrderLike): boolean {
  return order.carrierEmailConsent === true && !order.carrierEmailConsentRevokedAt
}

const clean = (v: string | null | undefined): string => (v ?? '').replace(/\s+/g, ' ').trim()

/** Zeilen der Lieferadresse (leere Zeilen fallen weg). */
export function shippingAddressLines(
  order: AddressOrderLike,
  options: FormatAddressOptions = {},
): string[] {
  const a = order.shippingAddress ?? {}
  const name = clean(a.name) || clean(order.customer?.name)
  const place = [clean(a.postalCode), clean(a.city)].filter(Boolean).join(' ')
  const country =
    a.country && a.country !== 'DE'
      ? (ENUM_LABELS.COUNTRY_CODES[a.country as keyof typeof ENUM_LABELS.COUNTRY_CODES]?.de ??
        a.country)
      : ''
  const lines = [name, clean(a.addressLine2), clean(a.addressLine1), place, country]
  const email = clean(order.customer?.email)
  if (options.includeEmail && email && carrierEmailConsentActive(order)) lines.push(email)
  return lines.filter(Boolean)
}

/** Text für „Adresse kopieren“ (Grundlage von `copyAddressText`). */
export function formatShippingAddress(
  order: AddressOrderLike,
  options: FormatAddressOptions = {},
): string {
  return shippingAddressLines(order, options).join('\n')
}
