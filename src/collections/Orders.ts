import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type Field,
  type PayloadRequest,
} from 'payload'

import { isAdmin, none } from '@/access'
import {
  addressFields,
  legalTextVersionsField,
  moneyField,
  privacyFields,
  seedField,
} from '@/fields'
import { writeAudit } from '@/lib/audit'
import {
  evaluateOrderTransition,
  ORDER_FINAL_STATUSES,
  ORDER_INITIAL,
  ORDER_TIMESTAMP_FIELD,
} from '@/lib/commerce/orderTransitions'
import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  ACTOR_TYPES,
  ATTENTION_REASONS,
  CARRIERS,
  DELIVERED_SOURCES,
  DISPUTE_STATUSES,
  FOOD_CONTACT,
  FULFILLMENT_METHODS,
  LOCALES,
  ORDER_CANCEL_REASONS,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PACKAGING_MATERIALS,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PRODUCT_CATEGORIES,
  REFUND_REASONS,
  REFUND_STATUSES,
  SHIPPING_CLASSES,
  SHIPPING_ZONES,
  TAX_MODES,
  VAT_CATEGORIES,
  type OrderCancelReason,
  type OrderStatus,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import {
  L_05_ORDERS_STAGE_D,
  L_05_SHIPPED_FINAL_STATUS_FALLBACK,
  retainUntil,
  withdrawalRetainUntil,
} from '@/lib/retention/policy'

import { actorTypeOf, failField, groupOf, rejectChanges, SHA256_HEX } from './hooks/commerce'
import { changedFields } from './hooks/immutable'

// DATENMODELL §6.8 – Bestellungen (Gastbestellungen, E-30) mit unveränderlichem Snapshot. Eine Bestellung entsteht
// erst mit bestätigter Zahlung (O1/O19) oder beim Vorkasse-Abschluss (O2) über createOrderFromCheckout() (P4).
// Verweise auf `invoices`/`withdrawals` seit P1.21, `legalTextVersions` seit P1.22; `complaints` folgt in P6.

const SLUG = 'orders'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

export const ORDER_NUMBER_RE = /^PC-\d{4}-\d{5}$/
/** Platzhalter nach der Anonymisierung (wird nie gemailt, §6.22). */
export const ANONYMIZED_EMAIL = 'anonymisiert@example.invalid'
/** Adressen änderbar nur vor dem Versand bzw. der Abholung (§6.8.3 Nr. 3). */
const ADDRESS_EDITABLE: ReadonlySet<OrderStatus> = new Set([
  'awaiting_prepayment',
  'paid',
  'packed',
  'ready_for_pickup',
])

/** Nach der Anlage unveränderlich (§6.8.3 Nr. 2). */
const IMMUTABLE = [
  'orderNumber',
  'subtotalCents',
  'shippingCents',
  'totalCents',
  'currency',
  'taxModeAtOrder',
  'paymentMethod',
  'legalTextVersions',
  'legalSnippetVersions',
  'statusHistory',
] as const
/** Positionsfelder, die sich nach der Anlage noch ändern dürfen. */
const MUTABLE_ITEM_FIELDS = new Set(['id', 'status', 'refundedCents'])

const anonymized = (data: Doc) => !!groupOf(data, 'privacy').anonymizedAt

function checkItems(original: Doc, data: Doc): void {
  if (!('items' in data)) return
  const before = (original.items ?? []) as Doc[]
  const after = (data.items ?? []) as Doc[]
  if (before.length !== after.length)
    fail('Positionen sind nach der Anlage unveränderlich.', 'items')
  after.forEach((row, i) => {
    const keys = Object.keys(row).filter((k) => !MUTABLE_ITEM_FIELDS.has(k))
    if (changedFields(keys, before[i] ?? {}, row).length > 0) {
      fail('Positionen sind nach der Anlage unveränderlich.', `items.${i}`)
    }
  })
}

function checkTotals(data: Doc): void {
  const items = (data.items ?? []) as { priceCents?: number }[]
  const subtotal = items.reduce((n, i) => n + (i.priceCents ?? 0), 0)
  if (data.subtotalCents !== subtotal)
    fail('Zwischensumme = Summe der Positionen.', 'subtotalCents')
  const shipping = data.shippingCents as number
  if (data.totalCents !== subtotal + shipping || !((data.totalCents as number) > 0)) {
    fail('Summe = Zwischensumme + Versand und größer als 0.', 'totalCents')
  }
  if (data.fulfillmentMethod === 'pickup' && shipping !== 0) {
    fail('Abholung kostet keinen Versand.', 'shippingCents')
  }
  if (
    data.fulfillmentMethod === 'shipping' &&
    items.some((i) => (i as Doc).shippingClass === 'nur_abholung')
  ) {
    fail('Ein Stück gibt es nur zur Abholung.', 'fulfillmentMethod')
  }
}

/** Setzt Zeitstempel, `finalStatusAt` und `retainUntil` für den neuen Status (§6.8.3 Nr. 1, Nr. 5; §12). */
function stampStatus(data: Doc, original: Doc, status: OrderStatus, now: Date): void {
  const ts = { ...groupOf(original, 'timestamps'), ...groupOf(data, 'timestamps') }
  const field = ORDER_TIMESTAMP_FIELD[status]
  if (field) ts[field] = groupOf(data, 'timestamps')[field] ?? now.toISOString()
  let final: Date | null = null
  if (ORDER_FINAL_STATUSES.has(status)) final = new Date(String(ts[field!]))
  else if (status === 'shipped') {
    final = retainUntil(L_05_SHIPPED_FINAL_STATUS_FALLBACK, new Date(String(ts.shippedAt)))
  }
  if (final) {
    ts.finalStatusAt = final.toISOString()
    data.retainUntil = retainUntil(L_05_ORDERS_STAGE_D, final).toISOString()
  }
  data.timestamps = ts
}

const prepareOrder: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const customer = groupOf(data, 'customer')
  if (typeof customer.email === 'string') {
    data.customer = { ...customer, email: customer.email.trim().toLowerCase() }
  }
  const shipment = groupOf(data, 'shipment')
  if (typeof shipment.trackingNumber === 'string') {
    const tn = shipment.trackingNumber.replace(/\s+/g, '').toUpperCase()
    data.shipment = { ...shipment, trackingNumber: tn || null }
  }
  return data
}

const guardOrder: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)
  const status = (data.status ?? original.status) as OrderStatus
  for (const field of ['statusTokenHash'] as const) {
    if (typeof data[field] === 'string' && !SHA256_HEX.test(data[field])) {
      fail('Nur der SHA-256-Hash des Tokens wird gespeichert.', field)
    }
  }

  if (operation === 'create') {
    checkTotals(data)
    if (ctx.seed) return data
    const id = ORDER_INITIAL[status]
    if (!id)
      fail('Eine Bestellung entsteht nur als bezahlt, Vorkasse offen oder erstattet.', 'status')
    const history = (data.statusHistory ?? []) as Doc[]
    if (history.length === 0) {
      data.statusHistory = [
        {
          from: null,
          to: status,
          at: now.toISOString(),
          actorType: actorTypeOf(req),
          transition: id,
        },
      ]
    }
    stampStatus(data, {}, status, now)
    return data
  }

  if (ctx.seed) return data
  const transition = ctx.transition
  const isAnonymize = transition === 'anonymize'
  rejectChanges(
    SLUG,
    IMMUTABLE.filter((f) => !(isAnonymize && f === 'statusHistory')),
    original,
    data,
    'Nach der Anlage der Bestellung unveränderlich.',
  )
  checkItems(original, data)

  // Kasse: nur Leeren (retentionAbandonedCheckouts, §6.25.5)
  if ('checkout' in data && data.checkout !== null && data.checkout !== undefined) {
    rejectChanges(SLUG, ['checkout'], original, data, 'Die Kasse einer Bestellung ist fest.')
  }
  // Status-Token: nur Rotation oder Löschen in Stufe B
  for (const field of ['statusTokenHash', 'statusTokenSealed'] as const) {
    if (field in data && data[field] !== null && transition !== 'rotateToken') {
      rejectChanges(
        SLUG,
        [field],
        original,
        data,
        'Der Status-Link ändert sich nur per „Statuslink neu senden“.',
      )
    }
  }
  // Abholtext nach O8 fest
  const pickupBefore = groupOf(original, 'pickup').messageText
  if (pickupBefore && 'pickup' in data && status === original.status) {
    rejectChanges(SLUG, ['pickup'], original, data, 'Der bestätigte Abholtext ist fest.')
  }
  // Anonymisierung nur über retentionOrders
  if (!isAnonymize && anonymized(data) && !anonymized(original)) {
    fail('Anonymisieren nur über die Löschfristen.', 'privacy.anonymizedAt')
  }
  // Adressen nur vor Versand/Abholung
  if (
    !isAnonymize &&
    changedFields(['shippingAddress', 'billingAddress'], original, data).length > 0
  ) {
    if (!ADDRESS_EDITABLE.has(original.status as OrderStatus)) {
      fail(
        'Die Adresse lässt sich nach Versand bzw. Übergabe nicht mehr ändern.',
        'shippingAddress',
      )
    }
  }
  // Verpackung erfasst
  if (
    'packaging' in data &&
    changedFields(['components'], groupOf(original, 'packaging'), groupOf(data, 'packaging'))
      .length > 0
  ) {
    data.packaging = { ...groupOf(data, 'packaging'), recordedAt: now.toISOString() }
  }

  const from = original.status as OrderStatus
  if (status !== from) {
    if (!transition) fail('Der Bestellstatus ändert sich nur über die Aktionsknöpfe.', 'status')
    const result = evaluateOrderTransition(from, status, {
      statusBeforeDispute: original.statusBeforeDispute as OrderStatus | null,
      statusBeforeWithdrawal: original.statusBeforeWithdrawal as OrderStatus | null,
      cancelReason: (data.cancelReason ?? original.cancelReason) as OrderCancelReason | null,
    })
    if (!result.ok) return fail(result.message, 'status')
    if (status === 'disputed') data.statusBeforeDispute = from
    if (status === 'withdrawal_received') data.statusBeforeWithdrawal = from
    if (status === 'cancelled' && !(data.cancelReason ?? original.cancelReason)) {
      fail('Bitte den Grund der Stornierung angeben.', 'cancelReason')
    }
    data.statusHistory = [
      ...((original.statusHistory ?? []) as Doc[]),
      {
        from,
        to: status,
        at: now.toISOString(),
        actorType: actorTypeOf(req),
        transition: result.id,
        note: ctx.note?.slice(0, 300),
      },
    ]
    stampStatus(data, original, status, now)
  }
  const cancelReason = data.cancelReason ?? original.cancelReason
  const cancelNote = (data.cancelNote ?? original.cancelNote) as string | null | undefined
  if (cancelReason === 'admin' && !cancelNote?.trim() && !isAnonymize) {
    fail('Bitte kurz begründen, warum storniert wird.', 'cancelNote')
  }
  return data
}

async function propagateRetention(req: PayloadRequest, orderId: number, until: string) {
  // Widerrufe: wie die Bestellung, mindestens Ende des Eingangsjahres + 6 Jahre (L-08)
  const withdrawals = await preservingReq(req, () =>
    req.payload.find({
      collection: 'withdrawals',
      where: { order: { equals: orderId } },
      pagination: false,
      depth: 0,
      select: { receivedAt: true, spam: true, retainUntil: true },
      overrideAccess: true,
      req,
    }),
  )
  for (const w of withdrawals.docs) {
    const next = withdrawalRetainUntil({
      receivedAt: new Date(w.receivedAt),
      orderRetainUntil: new Date(until),
      spamMarkedAt: w.spam?.markedAt ? new Date(w.spam.markedAt) : null,
    }).toISOString()
    if (next !== w.retainUntil) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'withdrawals',
          id: w.id,
          data: { retainUntil: next } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { system: true, seed: false },
        }),
      )
    }
  }
  for (const collection of ['email-log', 'consent-log'] as const) {
    await preservingReq(req, () =>
      req.payload.update({
        collection,
        where: { order: { equals: orderId } },
        data: { retainUntil: until } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { system: true, skipAudit: true },
      }),
    )
  }
}

const afterOrderChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const ctx = getAppContext(req)
  if (ctx.seed) return doc
  const history = (doc.statusHistory ?? []) as Doc[]
  const last = history.at(-1)
  if (operation === 'create') {
    await writeAudit(req, {
      action: 'order_created',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Bestellung ${doc.orderNumber} angelegt (${doc.status})`,
      changes: { status: [null, doc.status] },
      transition: last?.transition as string | undefined,
    })
  } else if (previousDoc && previousDoc.status !== doc.status) {
    await writeAudit(req, {
      action: 'order_status_changed',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Bestellung ${doc.orderNumber}: ${previousDoc.status} → ${doc.status}`,
      changes: { status: [previousDoc.status, doc.status] },
      transition: last?.transition as string | undefined,
    })
  }
  if (
    operation === 'update' &&
    previousDoc &&
    changedFields(['shippingAddress', 'billingAddress'], previousDoc, doc).length > 0 &&
    ctx.transition !== 'anonymize'
  ) {
    await writeAudit(req, {
      action: 'order_address_changed',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Bestellung ${doc.orderNumber}: Adresse geändert`,
    })
  }
  if (doc.retainUntil && doc.retainUntil !== previousDoc?.retainUntil) {
    await propagateRetention(req, doc.id as number, String(doc.retainUntil))
  }
  return doc
}

const guardOrderDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const ctx = getAppContext(req)
  const doc = await preservingReq(req, () =>
    req.payload.findByID({ collection: SLUG, id, depth: 0, overrideAccess: true, req }),
  )
  if (!(ctx.system || ctx.seed) || doc.seed !== true) {
    throw new APIError(
      'Bestellungen werden nie gelöscht, nur nach Fristende anonymisiert.',
      403,
      undefined,
      true,
    )
  }
}

const select = (
  name: string,
  label: string,
  values: readonly string[],
  labels: Record<string, { de: string }>,
  extra: Record<string, unknown> = {},
): Field =>
  ({
    name,
    type: 'select',
    label,
    options: values.map((value) => ({ value, label: labels[value]!.de })),
    ...extra,
  }) as Field

const itemFields: Field[] = [
  { name: 'product', type: 'relationship', relationTo: 'products', required: true, label: 'Stück' },
  { name: 'itemNumber', type: 'number', required: true, label: 'Nummer' },
  { name: 'titleDe', type: 'text', required: true, label: 'Titel (DE)' },
  { name: 'titleEn', type: 'text', label: 'Titel (EN)' },
  select('category', 'Kategorie', PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES, {
    required: true,
  }),
  { name: 'characteristicsDe', type: 'textarea', required: true, label: 'Eigenschaften (DE)' },
  { name: 'characteristicsEn', type: 'textarea', label: 'Eigenschaften (EN)' },
  {
    ...moneyField('priceCents', { label: 'Preis', required: true }),
    validate: (v: unknown) =>
      typeof v === 'number' && Number.isInteger(v) && v > 0 ? true : 'Preis > 0 (ganze Cent).',
  } as Field,
  select('vatCategory', 'Steuersatz', VAT_CATEGORIES, ENUM_LABELS.VAT_CATEGORIES, {
    required: true,
  }),
  select('shippingClass', 'Versandklasse', SHIPPING_CLASSES, ENUM_LABELS.SHIPPING_CLASSES, {
    required: true,
  }),
  { name: 'coverImage', type: 'upload', relationTo: 'media', label: 'Titelbild' },
  { name: 'coverImageUrl', type: 'text', label: 'Titelbild-URL' },
  select('foodContact', 'Lebensmittelkontakt', FOOD_CONTACT, ENUM_LABELS.FOOD_CONTACT),
  { name: 'deviationText', type: 'textarea', label: 'Abweichung' },
  {
    name: 'deviationAgreedAt',
    type: 'date',
    label: 'Abweichung bestätigt am',
    validate: (v: unknown, { siblingData }: { siblingData: Doc }) =>
      siblingData?.deviationText && !v ? 'Bestätigung der Abweichung fehlt.' : true,
  },
  select('status', 'Status', ORDER_ITEM_STATUSES, ENUM_LABELS.ORDER_ITEM_STATUSES, {
    required: true,
    defaultValue: 'active',
  }),
  {
    ...moneyField('refundedCents', { label: 'Erstattet', required: true, defaultValue: 0 }),
    validate: (v: unknown, { siblingData }: { siblingData: Doc }) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= Number(siblingData?.priceCents)
        ? true
        : 'Erstattet: 0 bis Preis (ganze Cent).',
  } as Field,
]

const shippingRequired = (data: Record<string, unknown>) =>
  data.fulfillmentMethod === 'shipping' && !anonymized(data)
const billingRequired = (data: Record<string, unknown>) =>
  (data.billingAddressDiffers === true || data.fulfillmentMethod === 'pickup') && !anonymized(data)

export const Orders: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Bestellung', plural: 'Bestellungen' },
  admin: {
    group: 'Shop',
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'totalCents', 'fulfillmentMethod', 'createdAt'],
  },
  access: { read: isAdmin, update: isAdmin, create: none, delete: none },
  defaultSort: '-createdAt',
  indexes: [{ fields: ['privacy.legalHold'] }],
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      label: 'Bestellnummer',
      required: true,
      unique: true,
      validate: (v: unknown) =>
        typeof v === 'string' && ORDER_NUMBER_RE.test(v) ? true : 'Format PC-JJJJ-NNNNN.',
      admin: { ...ro, description: 'Verwendungszweck bei Vorkasse.' },
    },
    {
      name: 'checkout',
      type: 'relationship',
      label: 'Kasse',
      relationTo: 'checkouts',
      unique: true,
      admin: ro,
    },
    select('status', 'Status', ORDER_STATUSES, ENUM_LABELS.ORDER_STATUSES, {
      required: true,
      index: true,
      admin: ro,
    }),
    select(
      'statusBeforeWithdrawal',
      'Status vor dem Widerruf',
      ORDER_STATUSES,
      ENUM_LABELS.ORDER_STATUSES,
      {
        admin: ro,
      },
    ),
    select(
      'statusBeforeDispute',
      'Status vor der Anfechtung',
      ORDER_STATUSES,
      ENUM_LABELS.ORDER_STATUSES,
      {
        admin: ro,
      },
    ),
    select(
      'cancelReason',
      'Grund der Stornierung',
      ORDER_CANCEL_REASONS,
      ENUM_LABELS.ORDER_CANCEL_REASONS,
      {
        admin: ro,
      },
    ),
    { name: 'cancelNote', type: 'text', label: 'Begründung der Stornierung', maxLength: 300 },
    {
      name: 'statusHistory',
      type: 'array',
      label: 'Statusverlauf',
      defaultValue: [],
      admin: ro,
      fields: [
        select('from', 'Von', ORDER_STATUSES, ENUM_LABELS.ORDER_STATUSES),
        select('to', 'Nach', ORDER_STATUSES, ENUM_LABELS.ORDER_STATUSES, { required: true }),
        { name: 'at', type: 'date', label: 'Zeitpunkt', required: true },
        select('actorType', 'Auslöser', ACTOR_TYPES, ENUM_LABELS.ACTOR_TYPES, { required: true }),
        {
          name: 'transition',
          type: 'text',
          label: 'Übergang',
          validate: (v: unknown) =>
            v === null || v === undefined || /^O([1-9]|1\d|2[01])$/.test(String(v))
              ? true
              : 'Übergang O1 bis O21.',
        },
        { name: 'note', type: 'text', label: 'Notiz', maxLength: 300 },
      ],
    },
    select('locale', 'Sprache', LOCALES, ENUM_LABELS.LOCALES, { required: true }),
    {
      name: 'customer',
      type: 'group',
      label: 'Kund:in',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Vor- und Nachname',
          maxLength: 100,
          validate: (v: unknown, { data }: { data: Doc }) => {
            const s = typeof v === 'string' ? v.trim() : ''
            if (!s) return anonymized(data ?? {}) ? true : 'Pflichtfeld.'
            return s.length >= 2 ? true : 'Bitte 2–100 Zeichen eingeben.'
          },
        },
        { name: 'email', type: 'email', label: 'E-Mail', required: true, index: true },
      ],
    },
    select('fulfillmentMethod', 'Lieferart', FULFILLMENT_METHODS, ENUM_LABELS.FULFILLMENT_METHODS, {
      required: true,
    }),
    addressFields('shippingAddress', { requiredWhen: shippingRequired, label: 'Lieferadresse' }),
    {
      name: 'billingAddressDiffers',
      type: 'checkbox',
      label: 'Rechnungsadresse weicht ab',
      defaultValue: false,
    },
    addressFields('billingAddress', { requiredWhen: billingRequired, label: 'Rechnungsadresse' }),
    select('shippingZone', 'Versandzone', SHIPPING_ZONES, ENUM_LABELS.SHIPPING_ZONES, {
      admin: ro,
    }),
    select('shippingClass', 'Versandklasse', SHIPPING_CLASSES, ENUM_LABELS.SHIPPING_CLASSES, {
      admin: ro,
    }),
    {
      name: 'items',
      type: 'array',
      label: 'Positionen',
      required: true,
      minRows: 1,
      maxRows: 10,
      fields: itemFields,
    },
    moneyField('subtotalCents', { label: 'Zwischensumme', required: true, admin: ro }),
    moneyField('shippingCents', { label: 'Versand', required: true, admin: ro }),
    moneyField('totalCents', { label: 'Summe', required: true, admin: ro }),
    select(
      'currency',
      'Währung',
      ['EUR'],
      { EUR: { de: 'Euro' } },
      {
        required: true,
        defaultValue: 'EUR',
        admin: ro,
      },
    ),
    select('taxModeAtOrder', 'Steuermodus', TAX_MODES, ENUM_LABELS.TAX_MODES, {
      required: true,
      admin: ro,
    }),
    select('paymentMethod', 'Zahlart', PAYMENT_METHODS, ENUM_LABELS.PAYMENT_METHODS, {
      required: true,
      admin: ro,
    }),
    select(
      'paymentProvider',
      'Zahlungsanbieter',
      PAYMENT_PROVIDERS,
      ENUM_LABELS.PAYMENT_PROVIDERS,
      {
        required: true,
        admin: ro,
      },
    ),
    {
      name: 'stripe',
      type: 'group',
      label: 'Stripe',
      fields: [
        { name: 'checkoutSessionId', type: 'text', unique: true, admin: ro },
        { name: 'paymentIntentId', type: 'text', unique: true, admin: ro },
        { name: 'chargeId', type: 'text', admin: ro },
        { name: 'paymentMethodType', type: 'text', admin: ro },
        { name: 'livemode', type: 'checkbox', defaultValue: false, admin: ro },
        moneyField('amountReceivedCents', { label: 'Erhalten', admin: ro }),
        moneyField('feeCents', { label: 'Gebühr', admin: ro }),
      ],
    },
    {
      name: 'prepayment',
      type: 'group',
      label: 'Vorkasse',
      fields: [
        { name: 'dueAt', type: 'date', label: 'Zahlungsfrist', index: true, admin: ro },
        { name: 'reminderDueAt', type: 'date', label: 'Erinnerung fällig', index: true, admin: ro },
        { name: 'reminderSentAt', type: 'date', label: 'Erinnert am', admin: ro },
        { name: 'receivedAt', type: 'date', label: 'Zahlung erhalten am', admin: ro },
        moneyField('receivedAmountCents', { label: 'Erhaltener Betrag' }),
      ],
    },
    {
      name: 'shipment',
      type: 'group',
      label: 'Versand',
      fields: [
        select('carrier', 'Versanddienst', CARRIERS, ENUM_LABELS.CARRIERS),
        {
          name: 'trackingNumber',
          type: 'text',
          label: 'Sendungsnummer',
          validate: (v: unknown) =>
            v === null || v === undefined || v === '' || /^[A-Z0-9]{8,35}$/.test(String(v))
              ? true
              : 'Sendungsnummer: 8–35 Buchstaben/Ziffern.',
        },
        { name: 'trackingUrl', type: 'text', label: 'Verfolgungslink', admin: ro },
        select(
          'deliveredSource',
          'Zustellung erfasst',
          DELIVERED_SOURCES,
          ENUM_LABELS.DELIVERED_SOURCES,
          {
            admin: ro,
          },
        ),
      ],
    },
    {
      name: 'packaging',
      type: 'group',
      label: 'Verpackung',
      fields: [
        { name: 'templateKey', type: 'text', label: 'Vorlage' },
        { name: 'templateName', type: 'text', label: 'Vorlagenname', admin: ro },
        {
          name: 'components',
          type: 'array',
          label: 'Bestandteile',
          defaultValue: [],
          fields: [
            select('material', 'Material', PACKAGING_MATERIALS, ENUM_LABELS.PACKAGING_MATERIALS, {
              required: true,
            }),
            {
              name: 'grams',
              type: 'number',
              label: 'Gramm',
              required: true,
              validate: (v: unknown) =>
                typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10_000
                  ? true
                  : 'Ganze Gramm von 1 bis 10.000.',
            },
          ],
        },
        { name: 'recordedAt', type: 'date', label: 'Erfasst am', admin: ro },
      ],
    },
    {
      name: 'pickup',
      type: 'group',
      label: 'Abholung',
      fields: [{ name: 'messageText', type: 'textarea', label: 'Abholtext', maxLength: 1500 }],
    },
    { name: 'packingChecklistState', type: 'json', label: 'Packliste', defaultValue: {} },
    {
      name: 'packingPhotos',
      type: 'upload',
      label: 'Packfotos',
      relationTo: 'private-uploads',
      hasMany: true,
      maxRows: 6,
      filterOptions: { purpose: { equals: 'packing_photo' } },
    },
    {
      name: 'returnPhotos',
      type: 'upload',
      label: 'Rückgabefotos',
      relationTo: 'private-uploads',
      hasMany: true,
      maxRows: 6,
      filterOptions: { purpose: { equals: 'return_photo' } },
    },
    legalTextVersionsField({ required: true }),
    {
      name: 'legalSnippetVersions',
      type: 'json',
      label: 'Bausteinfassungen',
      required: true,
      admin: ro,
    },
    {
      name: 'carrierEmailConsent',
      type: 'checkbox',
      label: 'E-Mail an DHL erlaubt',
      defaultValue: false,
      admin: ro,
    },
    {
      name: 'carrierEmailConsentRevokedAt',
      type: 'date',
      label: 'DHL-Einwilligung widerrufen am',
      admin: ro,
    },
    { name: 'invoice', type: 'relationship', label: 'Rechnung', relationTo: 'invoices', admin: ro },
    {
      name: 'creditNotes',
      type: 'join',
      label: 'Gutschriften',
      collection: 'invoices',
      on: 'order',
      where: { type: { equals: 'credit_note' } },
    },
    {
      name: 'withdrawals',
      type: 'join',
      label: 'Widerrufe',
      collection: 'withdrawals',
      on: 'order',
    },
    {
      name: 'emails',
      type: 'join',
      label: 'Mails',
      collection: 'email-log',
      on: 'order',
    },
    {
      name: 'refunds',
      type: 'array',
      label: 'Erstattungen',
      defaultValue: [],
      admin: ro,
      fields: [
        {
          ...moneyField('amountCents', { label: 'Betrag', required: true }),
          validate: (v: unknown) =>
            typeof v === 'number' && Number.isInteger(v) && v > 0
              ? true
              : 'Betrag > 0 (ganze Cent).',
        } as Field,
        select('reason', 'Grund', REFUND_REASONS, ENUM_LABELS.REFUND_REASONS, { required: true }),
        { name: 'itemIds', type: 'json', label: 'Positionen' },
        { name: 'includesShipping', type: 'checkbox', label: 'inkl. Versand', defaultValue: false },
        select('status', 'Status', REFUND_STATUSES, ENUM_LABELS.REFUND_STATUSES, {
          required: true,
          defaultValue: 'pending',
        }),
        { name: 'stripeRefundId', type: 'text', label: 'Stripe-Erstattung' },
        { name: 'manualTransferConfirmedAt', type: 'date', label: 'Überweisung bestätigt am' },
        { name: 'creditNote', type: 'relationship', label: 'Gutschrift', relationTo: 'invoices' },
        { name: 'createdAt', type: 'date', label: 'Angelegt am', required: true },
      ],
    },
    {
      name: 'dispute',
      type: 'group',
      label: 'Anfechtung',
      fields: [
        select('status', 'Status', DISPUTE_STATUSES, ENUM_LABELS.DISPUTE_STATUSES, {
          defaultValue: 'none',
          admin: ro,
        }),
        { name: 'stripeDisputeId', type: 'text', admin: ro },
      ],
    },
    {
      name: 'adminAttention',
      type: 'group',
      label: 'Hinweis für dich',
      fields: [
        { name: 'flag', type: 'checkbox', label: 'Rot markieren', defaultValue: false },
        select('reason', 'Grund', ATTENTION_REASONS, ENUM_LABELS.ATTENTION_REASONS, {
          validate: (v: unknown, { siblingData }: { siblingData: Doc }) =>
            siblingData?.flag && !v ? 'Bitte einen Grund angeben.' : true,
        }),
        { name: 'note', type: 'textarea', label: 'Notiz', maxLength: 500 },
      ],
    },
    {
      name: 'timestamps',
      type: 'group',
      label: 'Zeitpunkte',
      admin: ro,
      fields: [
        { name: 'placedAt', type: 'date', label: 'Bestellt am', required: true, index: true },
        { name: 'paidAt', type: 'date', label: 'Bezahlt am' },
        { name: 'packedAt', type: 'date', label: 'Gepackt am' },
        { name: 'shippedAt', type: 'date', label: 'Versendet am', index: true },
        { name: 'deliveredAt', type: 'date', label: 'Zugestellt am' },
        { name: 'readyForPickupAt', type: 'date', label: 'Abholbereit am' },
        { name: 'pickedUpAt', type: 'date', label: 'Abgeholt am' },
        { name: 'withdrawalReceivedAt', type: 'date', label: 'Widerruf am' },
        { name: 'returnReceivedAt', type: 'date', label: 'Ware zurück am' },
        { name: 'refundedAt', type: 'date', label: 'Erstattet am' },
        { name: 'cancelledAt', type: 'date', label: 'Storniert am' },
        { name: 'disputedAt', type: 'date', label: 'Angefochten am' },
        { name: 'finalStatusAt', type: 'date', label: 'Endstatus am', index: true },
      ],
    },
    {
      name: 'statusTokenHash',
      type: 'text',
      label: 'Status-Token (Hash)',
      unique: true,
      admin: { ...ro, hidden: true },
    },
    {
      name: 'statusTokenSealed',
      type: 'text',
      label: 'Status-Token (versiegelt)',
      // Nie ausgegeben (§6.8.2): nur Server-Code mit overrideAccess liest das Siegel.
      access: { read: () => false, create: () => false, update: () => false },
      admin: { hidden: true },
    },
    { name: 'statusTokenIssuedAt', type: 'date', label: 'Status-Link erstellt am', admin: ro },
    { name: 'notes', type: 'textarea', label: 'Interne Notiz', maxLength: 2000 },
    privacyFields(),
    {
      name: 'retainUntil',
      type: 'date',
      label: 'Aufbewahren bis',
      index: true,
      admin: { ...ro, position: 'sidebar' },
    },
    ...seedField(),
  ],
  hooks: {
    beforeValidate: [prepareOrder],
    beforeChange: [guardOrder],
    afterChange: [afterOrderChange],
    beforeDelete: [guardOrderDelete],
  },
}
