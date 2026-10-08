import type { Field } from 'payload'

import { adminText } from '@/admin/translations'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { INTERNAL_LINK_TARGETS, PRODUCT_CATEGORIES } from '@/lib/enums'

const filled = (v: unknown) => v !== undefined && v !== null && v !== ''

/**
 * Interner Link für Seitenblöcke und Navigation (DATENMODELL §5). `optional`: der ganze Link darf fehlen (z. B.
 * eine Station ohne Link, SEED-SPEC §13.1); ist Ziel oder Beschriftung gesetzt, sind beide Pflicht.
 */
export function internalLinkFields(options: { optional?: boolean } = {}): Field[] {
  const optional = options.optional === true
  return [
    {
      name: 'target',
      type: 'select',
      label: 'Ziel',
      required: !optional,
      options: enumOptions(INTERNAL_LINK_TARGETS, ENUM_LABELS.INTERNAL_LINK_TARGETS),
      ...(optional
        ? {
            validate: (value: unknown, { siblingData }: { siblingData: { label?: unknown } }) =>
              filled(value) || !filled(siblingData?.label) ? true : adminText('linkTargetRequired'),
          }
        : {}),
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
    {
      name: 'label',
      type: 'text',
      label: 'Beschriftung',
      localized: true,
      required: !optional,
      ...(optional
        ? {
            validate: (value: unknown, { siblingData }: { siblingData: { target?: unknown } }) =>
              filled(value) || !filled(siblingData?.target) ? true : adminText('linkLabelRequired'),
          }
        : {}),
    },
  ]
}
