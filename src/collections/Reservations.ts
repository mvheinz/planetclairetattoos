import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, none } from '@/access'
import { seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  RESERVATION_RELEASE_REASONS,
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'

import { failField, rejectChanges, UUID_V4 } from './hooks/commerce'

// DATENMODELL §6.7 – Reservierungen (je Stück ein Datensatz, alle einer Kasse teilen `ref` und `checkout`). Nur
// Services schreiben (SQL §8.1 folgt in P4); keine Personendaten (L-02). Der partielle UNIQUE-Index „eine aktive
// Reservierung je Stück“ entsteht in `p1_constraints` (§9.3).

const SLUG = 'reservations'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

/** `active → converted` oder `active → released`, sonst nichts. */
export const RESERVATION_TRANSITIONS: Readonly<
  Record<ReservationStatus, readonly ReservationStatus[]>
> = { active: ['converted', 'released'], converted: [], released: [] }

const guardReservation: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Record<string, unknown>
  const status = (data.status ?? original.status ?? 'active') as ReservationStatus
  if (typeof data.ref === 'string' && !UUID_V4.test(data.ref)) {
    fail('Reservierungsreferenz muss eine UUID v4 sein.', 'ref')
  }
  if (operation === 'create' && status !== 'active' && !ctx.seed) {
    fail('Eine neue Reservierung ist immer aktiv.', 'status')
  }
  if (operation === 'update' && !ctx.seed) {
    rejectChanges(SLUG, ['ref', 'checkout', 'product'], original, data, 'Unveränderlich.')
    const from = original.status as ReservationStatus
    if (status !== from) {
      if (!RESERVATION_TRANSITIONS[from].includes(status)) {
        fail(`Eine Reservierung kann nicht von „${from}“ nach „${status}“ wechseln.`, 'status')
      }
      const now = requestNow(req).toISOString()
      if (status === 'converted') data.convertedAt ??= now
      if (status === 'released') data.releasedAt ??= now
    }
  }
  if (status === 'released' && !(data.releaseReason ?? original.releaseReason)) {
    fail('Bitte den Grund der Freigabe angeben.', 'releaseReason')
  }
  return data
}

export const Reservations: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Reservierung', plural: 'Reservierungen' },
  admin: {
    group: 'System',
    useAsTitle: 'ref',
    defaultColumns: ['createdAt', 'product', 'status', 'source', 'expiresAt'],
    description: 'Reservierungen der Kassen und Vorkasse-Bestellungen. Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  indexes: [{ fields: ['status', 'expiresAt'] }],
  fields: [
    { name: 'ref', type: 'text', label: 'Referenz', required: true, index: true, admin: ro },
    {
      name: 'checkout',
      type: 'relationship',
      label: 'Kasse',
      relationTo: 'checkouts',
      required: true,
      index: true,
      admin: ro,
    },
    {
      name: 'product',
      type: 'relationship',
      label: 'Stück',
      relationTo: 'products',
      required: true,
      admin: ro,
    },
    {
      name: 'source',
      type: 'select',
      label: 'Quelle',
      required: true,
      defaultValue: 'checkout_session',
      options: enumOptions(RESERVATION_SOURCES, ENUM_LABELS.RESERVATION_SOURCES),
      admin: ro,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'active',
      options: enumOptions(RESERVATION_STATUSES, ENUM_LABELS.RESERVATION_STATUSES),
      admin: ro,
    },
    { name: 'expiresAt', type: 'date', label: 'Läuft ab', required: true, admin: ro },
    { name: 'displayExpiresAt', type: 'date', label: 'Countdown bis', admin: ro },
    { name: 'order', type: 'relationship', label: 'Bestellung', relationTo: 'orders', admin: ro },
    { name: 'convertedAt', type: 'date', label: 'Umgewandelt am', index: true, admin: ro },
    { name: 'releasedAt', type: 'date', label: 'Freigegeben am', index: true, admin: ro },
    {
      name: 'releaseReason',
      type: 'select',
      label: 'Grund der Freigabe',
      options: enumOptions(RESERVATION_RELEASE_REASONS, ENUM_LABELS.RESERVATION_RELEASE_REASONS),
      admin: ro,
    },
    ...seedField(),
  ],
  hooks: { beforeChange: [guardReservation] },
}
