import type { GroupField, SelectField, TextField } from 'payload'

import { adminText } from '@/admin/translations'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { COUNTRY_CODES } from '@/lib/enums'

// Adressgruppe (DATENMODELL §5). Die Einschränkung auf `settings.shipping.enabledCountries` prüft der
// Kassen-Service (ab P4); hier nur Format und Pflicht.

export interface AddressOptions {
  /** Pflicht nur, wenn die Bedingung auf den Dokumentdaten erfüllt ist (z. B. `fulfillment === 'shipping'`). */
  requiredWhen?: (data: Record<string, unknown>) => boolean
  label?: string
}

type Sibling = { country?: string }

function lengthRule(
  min: number,
  max: number,
  isRequired: (data: Record<string, unknown>) => boolean,
) {
  return (value: unknown, { data }: { data: Record<string, unknown> }) => {
    const s = typeof value === 'string' ? value.trim() : ''
    if (s === '') return isRequired(data ?? {}) && min > 0 ? adminText('required') : true
    return s.length >= min && s.length <= max ? true : adminText('lengthBetween', { min, max })
  }
}

export function validatePostalCode(value: unknown, country: string | undefined, required: boolean) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (s === '') return required ? adminText('required') : true
  if ((country ?? 'DE') === 'DE') return /^\d{5}$/.test(s) ? true : adminText('postalCodeDe')
  return s.length >= 3 && s.length <= 10 ? true : adminText('lengthBetween', { min: 3, max: 10 })
}

export function addressFields(prefix: string, options: AddressOptions = {}): GroupField {
  const isRequired = options.requiredWhen ?? (() => true)
  const text = (name: string, label: string, min: number, max: number): TextField => ({
    name,
    type: 'text',
    label,
    maxLength: max,
    validate: lengthRule(min, max, min > 0 ? isRequired : () => false),
  })
  const country: SelectField = {
    name: 'country',
    type: 'select',
    label: 'Land',
    defaultValue: 'DE',
    options: enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES),
    validate: (value: unknown, { data }: { data: Record<string, unknown> }) =>
      value || !isRequired(data ?? {}) ? true : adminText('required'),
  }
  return {
    name: prefix,
    type: 'group',
    label: options.label,
    fields: [
      text('name', 'Name', 2, 100),
      text('addressLine1', 'Straße und Hausnummer', 3, 100),
      text('addressLine2', 'Adresszusatz', 0, 100),
      {
        name: 'postalCode',
        type: 'text',
        label: 'PLZ',
        maxLength: 10,
        validate: (
          value: unknown,
          { data, siblingData }: { data: Record<string, unknown>; siblingData: Sibling },
        ) => validatePostalCode(value, siblingData?.country, isRequired(data ?? {})),
      },
      text('city', 'Ort', 2, 60),
      country,
    ],
  }
}
