import type { CollectionConfig } from 'payload'

import { isAdmin, none } from '@/access'
import { adminText } from '@/admin/translations'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { DELETION_ACTIONS, DELETION_TRIGGERS } from '@/lib/enums'
import { L_18_DELETION_LOG, retainUntil } from '@/lib/retention/policy'

import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.27 (L-18, LOESCHKONZEPT §1 Nr. 5): Nachweis jeder Löschung/Anonymisierung/Einschränkung –
// ohne Inhalte, Namen oder E-Mail-Adressen. Geschrieben ausschließlich über writeDeletionLog().

/** `L-xx`, `L-xx a`, `L-xx Stufe C`, `L-04 Stufe 1`, `DSGVO` oder `ADMIN`. */
export const DELETION_RULE_ID_REGEX = /^(?:L-\d{2}(?: [a-h])?(?: Stufe [A-D12])?|DSGVO|ADMIN)$/
/** Interne ID ohne Personenbezug. */
export const DELETION_ENTITY_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/
export const PRIVACY_REQUEST_REF_REGEX = /^DS-\d{4}-\d{4}$/
export const TASK_SLUG_REGEX = /^[a-z][A-Za-z0-9]{2,63}$/

const optionalMatch = (re: RegExp, message: string) => (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'string' && re.test(value))
    ? true
    : message

export const DeletionLog: CollectionConfig = {
  slug: 'deletion-log',
  labels: { singular: 'Löschprotokoll-Eintrag', plural: 'Löschprotokoll' },
  admin: {
    group: 'System',
    useAsTitle: 'ruleId',
    defaultColumns: ['executedAt', 'entityCollection', 'action', 'ruleId', 'trigger'],
    description: 'Nachweis aller Löschungen (ohne Inhalte, Namen oder E-Mail-Adressen). Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-executedAt',
  indexes: [{ fields: ['entityCollection', 'entityId'] }],
  fields: [
    {
      name: 'entityCollection',
      type: 'text',
      label: 'Bereich',
      required: true,
      validate: (v: unknown) =>
        typeof v === 'string' && /^[a-z][a-z0-9-]{1,63}$/.test(v) ? true : adminText('required'),
    },
    {
      name: 'entityId',
      type: 'text',
      label: 'Datensatz-ID',
      required: true,
      validate: (v: unknown) =>
        typeof v === 'string' && DELETION_ENTITY_ID_REGEX.test(v)
          ? true
          : adminText('entityIdInvalid'),
    },
    {
      name: 'ruleId',
      type: 'text',
      label: 'Regel',
      required: true,
      validate: (v: unknown) =>
        typeof v === 'string' && DELETION_RULE_ID_REGEX.test(v) ? true : adminText('ruleIdInvalid'),
    },
    {
      name: 'action',
      type: 'select',
      label: 'Aktion',
      required: true,
      options: enumOptions(DELETION_ACTIONS, ENUM_LABELS.DELETION_ACTIONS),
    },
    {
      name: 'trigger',
      type: 'select',
      label: 'Auslöser',
      required: true,
      options: enumOptions(DELETION_TRIGGERS, ENUM_LABELS.DELETION_TRIGGERS),
    },
    {
      name: 'taskSlug',
      type: 'text',
      label: 'Task',
      validate: optionalMatch(TASK_SLUG_REGEX, adminText('taskSlugInvalid')),
    },
    {
      name: 'privacyRequestRef',
      type: 'text',
      label: 'Datenschutz-Anfrage',
      validate: optionalMatch(PRIVACY_REQUEST_REF_REGEX, adminText('privacyRequestRefInvalid')),
    },
    {
      name: 'storageObjectsCount',
      type: 'number',
      label: 'Gelöschte Dateien',
      required: true,
      defaultValue: 0,
      min: 0,
      validate: (v: unknown) =>
        typeof v === 'number' && Number.isInteger(v) && v >= 0 ? true : adminText('integerMin0'),
    },
    { name: 'executedAt', type: 'date', label: 'Ausgeführt am', required: true, index: true },
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      required: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ operation, data }) => {
        if (!data || operation !== 'create') return data
        if (!data.executedAt) data.executedAt = new Date().toISOString()
        // L-18: executedAt + 3 Jahre
        data.retainUntil = retainUntil(
          L_18_DELETION_LOG,
          new Date(data.executedAt as string),
        ).toISOString()
        return data
      },
    ],
    beforeChange: [immutableFields('none')],
  },
}
