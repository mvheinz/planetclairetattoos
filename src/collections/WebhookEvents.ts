import type { CollectionConfig } from 'payload'

import { isAdmin, none } from '@/access'
import { adminText } from '@/admin/translations'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { WEBHOOK_EVENT_STATUSES, WEBHOOK_PROVIDERS } from '@/lib/enums'

import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.24 – Idempotenz (Verfahren §8.8). Aufbewahrung 90 Tage ab receivedAt (L-13 d, retentionTechnical).
// Relationen `relatedCheckout`/`relatedOrder` folgen mit `checkouts`/`orders` (P1.20).
export const WebhookEvents: CollectionConfig = {
  slug: 'webhook-events',
  labels: { singular: 'Webhook-Ereignis', plural: 'Webhook-Ereignisse' },
  admin: {
    group: 'System',
    useAsTitle: 'eventId',
    defaultColumns: ['receivedAt', 'provider', 'type', 'status'],
    description: 'Eingegangene Zahlungs-Ereignisse (ohne Personendaten). Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'provider',
      type: 'select',
      label: 'Anbieter',
      required: true,
      options: enumOptions(WEBHOOK_PROVIDERS, ENUM_LABELS.WEBHOOK_PROVIDERS),
    },
    { name: 'eventId', type: 'text', label: 'Ereignis-ID', required: true, unique: true },
    { name: 'type', type: 'text', label: 'Typ', required: true, maxLength: 100 },
    { name: 'livemode', type: 'checkbox', label: 'Live', required: true },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      index: true,
      options: enumOptions(WEBHOOK_EVENT_STATUSES, ENUM_LABELS.WEBHOOK_EVENT_STATUSES),
    },
    {
      name: 'attempts',
      type: 'number',
      label: 'Versuche',
      required: true,
      defaultValue: 1,
      min: 1,
      validate: (v: unknown) =>
        typeof v === 'number' && Number.isInteger(v) && v >= 1 ? true : adminText('integerMin1'),
    },
    {
      name: 'receivedAt',
      type: 'date',
      label: 'Empfangen am',
      index: true,
      admin: { readOnly: true },
    },
    { name: 'processedAt', type: 'date', label: 'Verarbeitet am', admin: { readOnly: true } },
    {
      name: 'lastError',
      type: 'text',
      label: 'Letzter Fehler',
      maxLength: 1000,
      admin: { readOnly: true },
    },
    {
      name: 'payloadSha256',
      type: 'text',
      label: 'Prüfsumme Rohkörper',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ operation, data }) => {
        if (data && operation === 'create' && !data.receivedAt)
          data.receivedAt = new Date().toISOString()
        return data
      },
    ],
    beforeChange: [
      immutableFields([
        'status',
        'attempts',
        'processedAt',
        'lastError',
        'relatedCheckout',
        'relatedOrder',
      ]),
    ],
  },
}
