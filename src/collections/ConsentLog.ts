import { createHash } from 'node:crypto'

import type { CollectionConfig } from 'payload'

import { isAdmin, none } from '@/access'
import { seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { CONSENT_PURPOSES, LOCALES } from '@/lib/enums'
import { L_19A_CONSENT_WITHOUT_ORDER, retainUntil } from '@/lib/retention/policy'

import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.23. Relationen `checkout`/`order`/`inquiry`/`product` folgen mit den Ziel-Collections
// (P1.16/P1.20/P1.24). Änderbar ist nur `withdrawnAt` (Endpoint, P5) sowie der Bezug und seine Frist.

export const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

export const ConsentLog: CollectionConfig = {
  slug: 'consent-log',
  labels: { singular: 'Einwilligung', plural: 'Einwilligungen' },
  admin: {
    group: 'System',
    useAsTitle: 'purpose',
    defaultColumns: ['createdAt', 'purpose', 'granted', 'withdrawnAt'],
    description: 'Nachweis von Einwilligungen und Vereinbarungen. Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'purpose',
      type: 'select',
      label: 'Zweck',
      required: true,
      options: enumOptions(CONSENT_PURPOSES, ENUM_LABELS.CONSENT_PURPOSES),
    },
    { name: 'granted', type: 'checkbox', label: 'Erteilt', required: true },
    { name: 'textSnapshot', type: 'textarea', label: 'Angezeigter Text', required: true },
    {
      name: 'textSha256',
      type: 'text',
      label: 'Prüfsumme Text',
      required: true,
      admin: { readOnly: true },
    },
    { name: 'snippetKey', type: 'text', label: 'Baustein', admin: { readOnly: true } },
    { name: 'snippetVersion', type: 'text', label: 'Baustein-Version', admin: { readOnly: true } },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache',
      required: true,
      options: enumOptions(LOCALES, ENUM_LABELS.LOCALES),
    },
    { name: 'email', type: 'email', label: 'E-Mail', required: true },
    { name: 'withdrawnAt', type: 'date', label: 'Widerrufen am' },
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      required: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    ...seedField(),
  ],
  hooks: {
    beforeValidate: [
      ({ operation, data }) => {
        if (!data) return data
        if (typeof data.textSnapshot === 'string') data.textSha256 = sha256Hex(data.textSnapshot)
        // L-19 a: ohne Bestellung wie die Kasse (30 Tage, L-03); mit Bestellung setzt der Service die Frist.
        if (operation === 'create' && !data.retainUntil) {
          const at = data.createdAt ? new Date(data.createdAt as string) : new Date()
          data.retainUntil = retainUntil(L_19A_CONSENT_WITHOUT_ORDER, at).toISOString()
        }
        return data
      },
    ],
    beforeChange: [immutableFields(['withdrawnAt', 'retainUntil', 'checkout', 'order', 'inquiry'])],
  },
}
