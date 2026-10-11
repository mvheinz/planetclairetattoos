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

import { retainUntilFromInquiry } from './EmailLog'
import { immutableFields } from './hooks/immutable'

// DATENMODELL §6.23. Relationen `checkout`/`order`/`product` seit P1.20, `inquiry` seit P1.24 (Frist wie die
// Anfrage). Änderbar ist nur `withdrawnAt` (Endpoint, P5) sowie der Bezug und seine Frist. `order` setzt die
// Bestellanlage (`createOrderFromCheckout`, P18.5); die Frist folgt dann der Bestellung.

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

const relId = (v: unknown): string | null => {
  const id = typeof v === 'object' && v ? (v as { id?: unknown }).id : v
  return id === null || id === undefined || id === '' ? null : String(id)
}
const sameInstant = (a: unknown, b: unknown) =>
  (a ? new Date(a as string).getTime() : null) === (b ? new Date(b as string).getTime() : null)

/**
 * Frist neu aus dem Bezug? Beim Anlegen, wenn keine Frist mitkommt; beim Ändern, wenn der Bezug neu gesetzt wird
 * (z. B. `order` bei der Bestellanlage) und die Frist nicht ausdrücklich mitgeändert wird. Payload füllt `data` bei
 * Updates mit den bisherigen Werten auf – `'order' in data` und `!data.retainUntil` allein sagen dann nichts.
 */
function relationNeedsRetention(
  field: 'order' | 'inquiry',
  operation: string,
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
): boolean {
  if (relId(data[field]) === null) return false
  if (operation === 'create') return !data.retainUntil
  return (
    relId(data[field]) !== relId(originalDoc?.[field]) &&
    sameInstant(data.retainUntil, originalDoc?.retainUntil)
  )
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
    { name: 'inquiry', type: 'relationship', label: 'Anfrage', relationTo: 'inquiries' },
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
        const original = originalDoc as Record<string, unknown> | undefined
        if (relationNeedsRetention('order', operation, data, original)) {
          const created = data.createdAt ?? originalDoc?.createdAt
          const until = await retainUntilFromOrder(
            req,
            data.order,
            created ? new Date(created as string) : new Date(),
          )
          if (until) data.retainUntil = until
        }
        if (relationNeedsRetention('inquiry', operation, data, original)) {
          const until = await retainUntilFromInquiry(req, data.inquiry)
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
