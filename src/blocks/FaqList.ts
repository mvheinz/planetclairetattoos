import type { Block } from 'payload'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { FAQ_CATEGORIES } from '@/lib/enums'

import { heading } from './shared'

export const FaqList: Block = {
  slug: 'faqList',
  labels: { singular: 'FAQ-Liste', plural: 'FAQ-Listen' },
  fields: [
    heading(),
    {
      name: 'category',
      type: 'select',
      label: 'Kategorie',
      required: true,
      options: enumOptions(FAQ_CATEGORIES, ENUM_LABELS.FAQ_CATEGORIES),
    },
  ],
}
