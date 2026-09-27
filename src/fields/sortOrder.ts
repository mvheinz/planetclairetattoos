import type { NumberField } from 'payload'

import { adminText } from '@/admin/translations'

export function validateSortOrder(value: unknown): true | string {
  if (value === null || value === undefined) return true
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9999
    ? true
    : adminText('sortOrderInvalid')
}

/** `sortOrder`: Ganzzahl 0–9999, Default 100, aufsteigend sortiert (DATENMODELL §5). */
export function sortOrderField(): NumberField {
  return {
    name: 'sortOrder',
    type: 'number',
    label: 'Reihenfolge',
    defaultValue: 100,
    min: 0,
    max: 9999,
    index: true,
    validate: validateSortOrder,
    admin: { description: 'Kleinere Zahl = weiter oben.' },
  }
}
