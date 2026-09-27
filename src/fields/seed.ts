import type { CheckboxField, TextField } from 'payload'

import { adminText } from '@/admin/translations'

// Seed-Kennzeichnung (DATENMODELL §5, SEED-SPEC §1.2). Der partielle UNIQUE-Index auf `seed_key` (WHERE seed_key
// IS NOT NULL) entsteht in der Migration `p1_constraints` (DATENMODELL §9.3).
export const SEED_KEY_REGEX = /^[a-z-]+:[A-Za-z0-9:#._-]{1,80}$/

/** `true`, wenn `value` leer ist oder ein gültiger Schlüssel `<collection>:<schlüssel>` für diese Collection. */
export function validateSeedKey(value: unknown, collectionSlug?: string): true | string {
  if (value === null || value === undefined || value === '') return true
  if (typeof value !== 'string' || !SEED_KEY_REGEX.test(value)) return adminText('seedKeyInvalid')
  if (collectionSlug && !value.startsWith(`${collectionSlug}:`)) return adminText('seedKeyInvalid')
  return true
}

export function seedField(): [CheckboxField, TextField] {
  return [
    {
      name: 'seed',
      type: 'checkbox',
      label: 'Beispieldaten',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'seedKey',
      type: 'text',
      label: 'Seed-Schlüssel',
      index: true,
      admin: { hidden: true, readOnly: true },
      validate: (value: unknown, { collectionSlug }: { collectionSlug?: string }) =>
        validateSeedKey(value, collectionSlug),
    },
  ]
}
