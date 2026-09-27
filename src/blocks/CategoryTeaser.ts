import type { Block } from 'payload'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { PRODUCT_CATEGORIES } from '@/lib/enums'

import { heading } from './shared'

export const CategoryTeaser: Block = {
  slug: 'categoryTeaser',
  labels: { singular: 'Kategorien', plural: 'Kategorien' },
  fields: [
    heading(),
    {
      name: 'categories',
      type: 'select',
      label: 'Kategorien',
      hasMany: true,
      options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
    },
  ],
}
