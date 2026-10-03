import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, publicRead } from '@/access'
import { moneyField, seedField, sortOrderField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { flashAdminEndpoints } from '@/endpoints/tattoo'
import { FLASH_STATUSES } from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { FLASH_NUMBER_MAX, FLASH_NUMBER_MIN } from '@/lib/tattoo/flash'
import { registerMediaReference } from '@/lib/media/references'

import { failField, idOf } from './hooks/commerce'

// DATENMODELL §6.14 – Flash-Motive (E-52, E-53): Festpreis, einmalig oder wiederholbar, nicht kaufbar (E-51).
// Der DB-CHECK „wiederholbar ⇒ available“ folgt in `p1_constraints` (§9.2); bis dahin prüft der Hook.

const SLUG = 'flash'
const fail = (message: string, path: string): never => failField(SLUG, message, path)

type Doc = Record<string, unknown>

// Bilder veröffentlichter Motive sind nicht löschbar (§6.2).
for (const path of ['image', 'extraImages']) {
  registerMediaReference({
    collection: SLUG,
    path,
    where: { published: { equals: true } },
    label: 'Flash-Motiv',
    titleField: 'title',
  })
}

const guardFlash: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const merged = { ...original, ...data } as Doc

  // Nummer: max + 1 der echten Motive (Seed-Nummern ab 901 zählen nicht)
  if (operation === 'create' && (data.number === undefined || data.number === null)) {
    const last = await preservingReq(req, () =>
      req.payload.find({
        collection: SLUG,
        where: { seed: { equals: false } },
        sort: '-number',
        limit: 1,
        depth: 0,
        select: { number: true },
        overrideAccess: true,
        req,
      }),
    )
    data.number = ((last.docs[0]?.number as number | undefined) ?? 0) + 1
  }
  const number = data.number ?? original.number
  if (
    typeof number !== 'number' ||
    !Number.isInteger(number) ||
    number < FLASH_NUMBER_MIN ||
    number > FLASH_NUMBER_MAX
  ) {
    fail(`Nummer: ganze Zahl von ${FLASH_NUMBER_MIN} bis ${FLASH_NUMBER_MAX}.`, 'number')
  }

  const price = merged.priceCents
  if (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 1000) {
    fail('Festpreis mindestens 10,00 €.', 'priceCents')
  }

  // Wiederholbare Motive werden nie „vergeben“ (Pause = offline nehmen).
  if (merged.repeatable === true && merged.status === 'claimed') {
    fail(
      'Ein wiederholbares Motiv kann nicht „vergeben“ sein. Zum Pausieren nutze „Offline nehmen“.',
      'status',
    )
  }
  if (merged.status === 'claimed') {
    if (original.status !== 'claimed' || !merged.claimedAt) {
      data.claimedAt = ctx.seed && data.claimedAt ? data.claimedAt : requestNow(req).toISOString()
    }
  } else if ('status' in data || operation === 'create') {
    data.claimedAt = null
  }

  // Motivbild darf kein gesperrtes (Kund:innen-)Bild sein.
  const imageId = idOf(merged.image)
  if (imageId !== null) {
    const media = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'media',
        id: imageId,
        depth: 0,
        select: { restricted: true },
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )
    if (media?.restricted)
      fail('Dieses Bild ist gesperrt und kann nicht öffentlich erscheinen.', 'image')
  }
  return data
}

export const Flash: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Flash-Motiv', plural: 'Flash-Motive' },
  admin: {
    group: 'Tattoo',
    useAsTitle: 'title',
    defaultColumns: ['number', 'title', 'status', 'repeatable', 'published'],
    description:
      'Motive mit Festpreis. „Vergeben“ zeigt einen Stempel; wiederholbare Motive bleiben verfügbar.',
  },
  access: {
    read: publicRead({ published: { equals: true } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    readVersions: isAdmin,
  },
  versions: { maxPerDoc: 10 },
  defaultSort: 'sortOrder',
  endpoints: flashAdminEndpoints,
  indexes: [{ fields: ['published', 'status'] }],
  fields: [
    {
      name: 'number',
      type: 'number',
      label: 'Nummer',
      unique: true,
      min: FLASH_NUMBER_MIN,
      max: FLASH_NUMBER_MAX,
      admin: {
        position: 'sidebar',
        description: 'Anzeige „F-012“. Leer lassen = nächste freie Nummer.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titel',
      required: true,
      localized: true,
      minLength: 2,
      maxLength: 60,
    },
    {
      name: 'image',
      type: 'upload',
      label: 'Zeichnung',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'extraImages',
      type: 'upload',
      label: 'Weitere Bilder',
      relationTo: 'media',
      hasMany: true,
      maxRows: 4,
    },
    {
      name: 'sizeCm',
      type: 'number',
      label: 'Größe (cm)',
      required: true,
      admin: { description: 'ungefähre Größe, z. B. 9,5' },
      validate: (value: unknown): true | string =>
        typeof value === 'number' &&
        value > 0 &&
        value <= 60 &&
        Math.round(value * 10) === value * 10
          ? true
          : 'Größer als 0 und höchstens 60 cm, eine Nachkommastelle.',
    },
    {
      name: 'sizeNote',
      type: 'text',
      label: 'Hinweis zur Größe',
      localized: true,
      maxLength: 80,
      admin: { description: 'z. B. „Größe anpassbar“' },
    },
    moneyField('priceCents', {
      label: 'Festpreis',
      required: true,
      min: 1000,
      admin: { description: 'Gesamtpreis (mindestens 10,00 €).' },
    }),
    {
      name: 'repeatable',
      type: 'checkbox',
      label: 'wiederholbar',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'available',
      options: enumOptions(FLASH_STATUSES, ENUM_LABELS.FLASH_STATUSES),
      admin: { position: 'sidebar' },
    },
    {
      name: 'claimedAt',
      type: 'date',
      label: 'Vergeben am',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Online',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    { ...sortOrderField(), required: true, admin: { position: 'sidebar' } },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [guardFlash],
    afterChange: [
      ({ doc, req }) => {
        revalidateContent(TAGS.flash, { context: getAppContext(req) })
        return doc
      },
    ],
  },
}
