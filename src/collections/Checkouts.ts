import type { CollectionBeforeChangeHook, CollectionConfig, Field } from 'payload'

import { isAdmin, none } from '@/access'
import { addressFields, moneyField, seedField } from '@/fields'
import {
  CHECKOUT_CLOSE_REASON_REQUIRED,
  CHECKOUT_INITIAL_STATUS,
  CHECKOUT_TIMESTAMP_FIELD,
  canTransitionCheckout,
} from '@/lib/commerce/checkoutTransitions'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  CHECKOUT_CLOSE_REASONS,
  CHECKOUT_PAYMENT_CHOICES,
  CHECKOUT_STATUSES,
  FULFILLMENT_METHODS,
  LOCALES,
  PRODUCT_CATEGORIES,
  SHIPPING_CLASSES,
  SHIPPING_ZONES,
  VAT_CATEGORIES,
  type CheckoutStatus,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'

import { failField, groupOf, rejectChanges, SHA256_HEX, UUID_V4 } from './hooks/commerce'

// DATENMODELL §6.25 – Kasse: interner Datensatz einer laufenden Bezahlung (nicht die Bestellung). Nur Services
// schreiben (P4); Lesen nur Verwaltung. Der Kassen-Token wird nie gespeichert, nur sein SHA-256 (§6.25.2).
// `legalTextVersions` ergänzt P1.22.

const SLUG = 'checkouts'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

/** Snapshot-Felder, die nach dem Anlegen fest sind (KONZEPT §4.11 S7). */
const IMMUTABLE = ['tokenHash', 'reservationRef', 'items'] as const

const guardCheckout: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const status = (data.status ?? original.status ?? CHECKOUT_INITIAL_STATUS) as CheckoutStatus
  if (typeof data.tokenHash === 'string' && !SHA256_HEX.test(data.tokenHash)) {
    fail('Nur der SHA-256-Hash des Tokens wird gespeichert.', 'tokenHash')
  }
  if (typeof data.reservationRef === 'string' && !UUID_V4.test(data.reservationRef)) {
    fail('Reservierungsreferenz muss eine UUID v4 sein.', 'reservationRef')
  }
  if (operation === 'create') {
    if (status !== CHECKOUT_INITIAL_STATUS && !ctx.seed) {
      fail('Eine neue Kasse ist immer „offen“.', 'status')
    }
  } else if (!ctx.seed) {
    rejectChanges(SLUG, IMMUTABLE, original, data, 'Nach dem Anlegen der Kasse unveränderlich.')
    const from = original.status as CheckoutStatus
    if (status !== from) {
      if (!ctx.transition) fail('Der Kassenstatus ändert sich nur über die Kasse.', 'status')
      if (!canTransitionCheckout(from, status)) {
        fail(`Die Kasse kann nicht von „${from}“ nach „${status}“ wechseln.`, 'status')
      }
      const field = CHECKOUT_TIMESTAMP_FIELD[status]
      if (field) {
        const ts = { ...groupOf(original, 'timestamps'), ...groupOf(data, 'timestamps') }
        ts[field] ??= requestNow(req).toISOString()
        data.timestamps = ts
      }
    }
  }
  const closeReason = data.closeReason ?? original.closeReason
  if (CHECKOUT_CLOSE_REASON_REQUIRED.has(status) && !closeReason) {
    fail('Bitte den Grund angeben, warum die Kasse endet.', 'closeReason')
  }
  const sub = (data.subtotalCents ?? original.subtotalCents) as number
  const ship = (data.shippingCents ?? original.shippingCents) as number
  const total = (data.totalCents ?? original.totalCents) as number
  if (total !== sub + ship || !(total > 0)) {
    fail('Summe = Zwischensumme + Versand und größer als 0.', 'totalCents')
  }
  return data
}

const itemFields: Field[] = [
  { name: 'product', type: 'relationship', relationTo: 'products', required: true, label: 'Stück' },
  { name: 'itemNumber', type: 'number', required: true, label: 'Nummer' },
  { name: 'titleDe', type: 'text', required: true, label: 'Titel (DE)' },
  { name: 'titleEn', type: 'text', label: 'Titel (EN)' },
  {
    name: 'category',
    type: 'select',
    required: true,
    label: 'Kategorie',
    options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
  },
  moneyField('priceCents', { label: 'Preis', required: true }),
  {
    name: 'vatCategory',
    type: 'select',
    required: true,
    label: 'Steuersatz',
    options: enumOptions(VAT_CATEGORIES, ENUM_LABELS.VAT_CATEGORIES),
  },
  {
    name: 'shippingClass',
    type: 'select',
    required: true,
    label: 'Versandklasse',
    options: enumOptions(SHIPPING_CLASSES, ENUM_LABELS.SHIPPING_CLASSES),
  },
  { name: 'characteristicsDe', type: 'textarea', label: 'Eigenschaften (DE)' },
  { name: 'characteristicsEn', type: 'textarea', label: 'Eigenschaften (EN)' },
  { name: 'deviationText', type: 'textarea', label: 'Abweichung' },
]

const noAddressRequired = { requiredWhen: () => false }

export const Checkouts: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Kasse', plural: 'Kassen' },
  admin: {
    group: 'System',
    useAsTitle: 'reservationRef',
    defaultColumns: ['createdAt', 'reservationRef', 'status', 'totalCents', 'expiresAt'],
    description: 'Laufende und beendete Bezahlvorgänge (Fehlersuche). Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  defaultSort: '-createdAt',
  // §6.25.4: (status, expires_at); token_hash, reservation_ref, stripe_checkout_session_id UNIQUE über die Felder.
  indexes: [{ fields: ['status', 'expiresAt'] }],
  fields: [
    {
      name: 'tokenHash',
      type: 'text',
      label: 'Token-Hash',
      required: true,
      unique: true,
      admin: { ...ro, hidden: true },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: CHECKOUT_INITIAL_STATUS,
      options: enumOptions(CHECKOUT_STATUSES, ENUM_LABELS.CHECKOUT_STATUSES),
      admin: ro,
    },
    {
      name: 'locale',
      type: 'select',
      label: 'Sprache',
      required: true,
      options: enumOptions(LOCALES, ENUM_LABELS.LOCALES),
    },
    {
      name: 'reservationRef',
      type: 'text',
      label: 'Reservierung',
      required: true,
      unique: true,
      admin: ro,
    },
    {
      name: 'items',
      type: 'array',
      label: 'Positionen (Snapshot)',
      required: true,
      minRows: 1,
      maxRows: 10,
      admin: ro,
      fields: itemFields,
    },
    {
      name: 'fulfillmentMethod',
      type: 'select',
      label: 'Lieferart',
      required: true,
      options: enumOptions(FULFILLMENT_METHODS, ENUM_LABELS.FULFILLMENT_METHODS),
    },
    {
      name: 'shippingZone',
      type: 'select',
      label: 'Versandzone',
      options: enumOptions(SHIPPING_ZONES, ENUM_LABELS.SHIPPING_ZONES),
      admin: ro,
    },
    {
      name: 'shippingClass',
      type: 'select',
      label: 'Versandklasse',
      options: enumOptions(SHIPPING_CLASSES, ENUM_LABELS.SHIPPING_CLASSES),
      admin: ro,
    },
    moneyField('subtotalCents', { label: 'Zwischensumme', required: true, admin: ro }),
    moneyField('shippingCents', { label: 'Versand', required: true, admin: ro }),
    moneyField('totalCents', { label: 'Summe', required: true, admin: ro }),
    { name: 'expiresAt', type: 'date', label: 'Reserviert bis', required: true, admin: ro },
    {
      name: 'displayExpiresAt',
      type: 'date',
      label: 'Countdown bis',
      required: true,
      admin: ro,
    },
    {
      name: 'paymentChoice',
      type: 'select',
      label: 'Zahlweg',
      options: enumOptions(CHECKOUT_PAYMENT_CHOICES, ENUM_LABELS.CHECKOUT_PAYMENT_CHOICES),
    },
    {
      name: 'customer',
      type: 'group',
      label: 'Kund:in',
      fields: [{ name: 'email', type: 'email', label: 'E-Mail' }],
    },
    addressFields('shippingAddress', { ...noAddressRequired, label: 'Lieferadresse' }),
    {
      name: 'billingAddressDiffers',
      type: 'checkbox',
      label: 'Rechnungsadresse weicht ab',
      defaultValue: false,
    },
    addressFields('billingAddress', { ...noAddressRequired, label: 'Rechnungsadresse' }),
    {
      name: 'carrierEmailConsent',
      type: 'checkbox',
      label: 'E-Mail an DHL erlaubt',
      defaultValue: false,
    },
    {
      name: 'deviationAgreements',
      type: 'array',
      label: 'Bestätigte Abweichungen',
      defaultValue: [],
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'agreedAt', type: 'date', required: true },
      ],
    },
    { name: 'legalSnippetVersions', type: 'json', label: 'Bausteinfassungen', admin: ro },
    { name: 'submittedAt', type: 'date', label: 'Bestellt am', admin: ro },
    {
      name: 'stripe',
      type: 'group',
      label: 'Stripe',
      fields: [
        { name: 'checkoutSessionId', type: 'text', unique: true, admin: ro },
        { name: 'sessionExpiresAt', type: 'date', admin: ro },
        { name: 'sessionSeq', type: 'number', defaultValue: 0, min: 0, admin: ro },
        { name: 'livemode', type: 'checkbox', defaultValue: false, admin: ro },
      ],
    },
    {
      name: 'mock',
      type: 'group',
      label: 'Zahlungs-Mock',
      fields: [{ name: 'state', type: 'json', admin: ro }],
    },
    {
      name: 'order',
      type: 'relationship',
      label: 'Bestellung',
      relationTo: 'orders',
      index: true,
      admin: ro,
    },
    {
      name: 'closeReason',
      type: 'select',
      label: 'Grund für das Ende',
      options: enumOptions(CHECKOUT_CLOSE_REASONS, ENUM_LABELS.CHECKOUT_CLOSE_REASONS),
      admin: ro,
    },
    {
      name: 'timestamps',
      type: 'group',
      label: 'Zeitpunkte',
      fields: [
        { name: 'confirmingAt', type: 'date', index: true, admin: ro },
        { name: 'completedAt', type: 'date', admin: ro },
        { name: 'expiredAt', type: 'date', admin: ro },
        { name: 'cancelledAt', type: 'date', admin: ro },
        { name: 'failedAt', type: 'date', admin: ro },
      ],
    },
    ...seedField(),
  ],
  hooks: { beforeChange: [guardCheckout] },
}
