import type { Block } from 'payload'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { PRODUCT_CATEGORIES } from '@/lib/enums'

import { heading } from './shared'

export const ProductTeaser: Block = {
  slug: 'productTeaser',
  labels: { singular: 'Stücke-Auswahl', plural: 'Stücke-Auswahlen' },
  fields: [
    heading(),
    {
      name: 'mode',
      type: 'select',
      label: 'Auswahl',
      defaultValue: 'latest',
      options: [
        { label: 'neueste', value: 'latest' },
        { label: 'aus einer Kategorie', value: 'category' },
        { label: 'von Hand', value: 'manual' },
      ],
    },
    {
      name: 'category',
      type: 'select',
      label: 'Kategorie',
      options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
      admin: { condition: (_, sibling) => sibling?.mode === 'category' },
      validate: (value: unknown, { siblingData }: { siblingData: { mode?: string } }) =>
        siblingData?.mode !== 'category' || value ? true : 'Bitte eine Kategorie wählen.',
    },
    {
      name: 'products',
      type: 'relationship',
      label: 'Stücke',
      relationTo: 'products',
      hasMany: true,
      maxRows: 8,
      admin: { condition: (_, sibling) => sibling?.mode === 'manual' },
    },
    { name: 'limit', type: 'number', label: 'Anzahl', defaultValue: 6, min: 1, max: 12 },
    { name: 'onlyAvailable', type: 'checkbox', label: 'Nur verfügbare', defaultValue: true },
  ],
}
