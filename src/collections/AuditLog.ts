import type { CollectionConfig } from 'payload'

import { isAdmin, none } from '@/access'
import { seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { ACTOR_TYPES, AUDIT_ACTIONS, type AuditAction } from '@/lib/enums'
import { auditRetentionRule, retainUntil } from '@/lib/retention/policy'

import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.21. Geschrieben ausschließlich über writeAudit() (src/lib/audit.ts).
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Protokolleintrag', plural: 'Protokoll' },
  admin: {
    group: 'System',
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'action', 'summary', 'actorType'],
    description: 'Wer hat wann was geändert. Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  indexes: [{ fields: ['entityCollection', 'entityId'] }],
  fields: [
    {
      name: 'action',
      type: 'select',
      label: 'Aktion',
      required: true,
      index: true,
      options: enumOptions(AUDIT_ACTIONS, ENUM_LABELS.AUDIT_ACTIONS),
    },
    {
      name: 'actorType',
      type: 'select',
      label: 'Auslöser',
      required: true,
      options: enumOptions(ACTOR_TYPES, ENUM_LABELS.ACTOR_TYPES),
    },
    { name: 'actorUser', type: 'relationship', relationTo: 'users', label: 'Konto' },
    { name: 'entityCollection', type: 'text', label: 'Bereich', required: true, maxLength: 64 },
    { name: 'entityId', type: 'text', label: 'Datensatz-ID', required: true, maxLength: 64 },
    { name: 'summary', type: 'text', label: 'Zusammenfassung', required: true, maxLength: 300 },
    { name: 'changes', type: 'json', label: 'Änderungen (maskiert)' },
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
        // L-13 h: 10 Jahre ab Jahresende bei Beleg-/Bestell-/Widerrufs-/Rechtstext-Aktionen, sonst 3 Jahre.
        if (operation === 'create' && data?.action) {
          const at = data.createdAt ? new Date(data.createdAt as string) : new Date()
          data.retainUntil = retainUntil(
            auditRetentionRule(data.action as AuditAction),
            at,
          ).toISOString()
        }
        return data
      },
    ],
    beforeChange: [immutableFields('none')],
  },
}
