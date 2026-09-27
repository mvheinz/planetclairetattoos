import type { NumberField } from 'payload'

import { adminText } from '@/admin/translations'

// Geld immer Integer-Cent (CLAUDE.md §6, DATENMODELL §1.1). Die Admin-Komponente EuroInput nimmt „45,00“ entgegen
// und speichert 4500; der DB-CHECK auf Ganzzahligkeit folgt in `p1_constraints` (§9.2).
export const EURO_INPUT_COMPONENT = '/admin/components/EuroInput#EuroInput'

export function validateCents(value: unknown, required = false): true | string {
  if (value === null || value === undefined) return required ? adminText('required') : true
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return adminText('moneyNotInteger')
  }
  return true
}

type MoneyOverrides = Partial<Omit<NumberField, 'name' | 'type' | 'hasMany'>>

export function moneyField(name: string, overrides: MoneyOverrides = {}): NumberField {
  const required = overrides.required === true
  return {
    min: 0,
    ...overrides,
    name,
    type: 'number',
    validate: (value: unknown) => validateCents(value, required),
    admin: {
      ...overrides.admin,
      components: { ...overrides.admin?.components, Field: EURO_INPUT_COMPONENT },
    },
  } as NumberField
}
