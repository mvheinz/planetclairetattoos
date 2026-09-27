import { createHash } from 'node:crypto'

import type { CollectionConfig, PayloadRequest } from 'payload'

import { isAdmin, none } from '@/access'
import { seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { CONSENT_PURPOSES, LOCALES } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import {
  L_19A_CONSENT_WITHOUT_ORDER,
  orderRelatedRetainUntil,
  retainUntil,
} from '@/lib/retention/policy'

import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.23. Relationen `checkout`/`order`/`product` seit P1.20, `inquiry` folgt mit P1.24. Änderbar ist nur
// `withdrawnAt` (Endpoint, P5) sowie der Bezug und seine Frist.

export const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** Frist aus der Bezugsbestellung (L-12/L-19 a mit Bezug), `null` ohne Bestellung. */
async function retainUntilFromOrder(
  req: PayloadRequest,
  order: unknown,
  eventAt: Date,
): Promise<string | null> {
  const id = typeof order === 'object' && order ? (order as { id: number }).id : order
  if (id === null || id === undefined || id === '') return null
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: id as number,
      depth: 0,
      select: { retainUntil: true },
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  const until = doc?.retainUntil ? new Date(doc.retainUntil) : null
  return orderRelatedRetainUntil(until, eventAt).toISOString()
}

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
    { name: 'checkout', type: 'relationship', label: 'Kasse', relationTo: 'checkouts' },
    {
      name: 'order',
      type: 'relationship',
      label: 'Bestellung',
      relationTo: 'orders',
      index: true,
    },
    { name: 'product', type: 'relationship', label: 'Stück', relationTo: 'products' },
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
      async ({ operation, data, originalDoc, req }) => {
        if (!data) return data
        if (typeof data.textSnapshot === 'string') data.textSha256 = sha256Hex(data.textSnapshot)
        // L-19 a: mit Bestellung wie die Bestellung (Stufe D); ohne wie die Kasse (30 Tage, L-03).
        if ((operation === 'create' || 'order' in data) && data.order && !data.retainUntil) {
          const created = data.createdAt ?? originalDoc?.createdAt
          const until = await retainUntilFromOrder(
            req,
            data.order,
            created ? new Date(created as string) : new Date(),
          )
          if (until) data.retainUntil = until
        }
        if (operation === 'create' && !data.retainUntil) {
          const at = data.createdAt ? new Date(data.createdAt as string) : new Date()
          data.retainUntil = retainUntil(L_19A_CONSENT_WITHOUT_ORDER, at).toISOString()
        }
        return data
      },
    ],
    beforeChange: [
      immutableFields(['withdrawnAt', 'retainUntil', 'checkout', 'order', 'inquiry', 'product']),
    ],
  },
}
