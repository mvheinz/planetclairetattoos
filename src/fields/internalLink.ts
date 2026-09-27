import type { Field } from 'payload'

import { adminText } from '@/admin/translations'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { INTERNAL_LINK_TARGETS, PRODUCT_CATEGORIES } from '@/lib/enums'

/** Interner Link für Seitenblöcke und Navigation (DATENMODELL §5). */
export function internalLinkFields(): Field[] {
  return [
    {
      name: 'target',
      type: 'select',
      label: 'Ziel',
      required: true,
      options: enumOptions(INTERNAL_LINK_TARGETS, ENUM_LABELS.INTERNAL_LINK_TARGETS),
    },
    {
      name: 'category',
      type: 'select',
      label: 'Kategorie',
      options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
      admin: { condition: (_, sibling) => sibling?.target === 'category' },
      validate: (value: unknown, { siblingData }: { siblingData: { target?: string } }) =>
        siblingData?.target !== 'category' || value ? true : adminText('categoryRequired'),
    },
    { name: 'label', type: 'text', label: 'Beschriftung', localized: true, required: true },
  ]
}
