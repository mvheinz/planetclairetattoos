import type {
  Access,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Where,
} from 'payload'

import { isAdmin, isAdminRequest, NOT_SEED } from '@/access'
import { seedField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { TATTOO_OFFER_TYPES } from '@/lib/enums'
import { seedPreviewModeActive } from '@/lib/env'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { defaultOfferEnd } from '@/lib/tattoo/offers'
import { registerMediaReference } from '@/lib/media/references'

import { failField } from './hooks/commerce'

// DATENMODELL §6.15 – Angebote (Flash-Days, Aktionen, E-53): verschwinden nach `endsAt` aus öffentlichen Abfragen
// (Uhr injizierbar über `req.context.now`). Keine Buchung, keine Anzahlung, keine Termine. Die Revalidierung nach
// Ablauf (Task `revalidateEndedOffers`) folgt in P7.

const SLUG = 'tattoo-offers'
const fail = (message: string, path: string): never => failField(SLUG, message, path)

type Doc = Record<string, unknown>

registerMediaReference({
  collection: SLUG,
  path: 'image',
  where: { published: { equals: true } },
  label: 'Angebot',
  titleField: 'title',
})

/** Straßenangaben oder Postleitzahlen im Ortshinweis (E-50: öffentlich nur der Bezirk). */
const ADDRESS_RE =
  /\b\d{5}\b|(stra(ß|ss)e|str\.|weg|allee|platz|damm|ufer|gasse|ring|chaussee)\s*\d+/i

const LOCATION_DEFAULT = {
  de: (district: string) => `Privatstudio in ${district}`,
  en: (district: string) => `Private studio in ${district}`,
} as const

/** Öffentlich: veröffentlicht und noch nicht abgelaufen (`endsAt > jetzt`) plus Seed-Filter. */
export const readTattooOffers: Access = ({ req }) => {
  if (isAdminRequest(req)) return true
  const clauses: Where[] = [
    { published: { equals: true } },
    { endsAt: { greater_than: requestNow(req).toISOString() } },
  ]
  if (!seedPreviewModeActive()) clauses.push(NOT_SEED)
  return { and: clauses }
}

/** Standard-Ende vor der Pflichtfeld-Prüfung setzen. */
const defaultEnd: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data || data.endsAt || originalDoc?.endsAt) return data
  const startsAt = new Date(String(data.startsAt ?? originalDoc?.startsAt ?? ''))
  if (!Number.isNaN(startsAt.getTime())) data.endsAt = defaultOfferEnd(startsAt).toISOString()
  return data
}

const guardOffer: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const original = (originalDoc ?? {}) as Doc
  const startsAt = new Date(String(data.startsAt ?? original.startsAt ?? ''))
  if (Number.isNaN(startsAt.getTime())) fail('Bitte den Beginn angeben.', 'startsAt')
  const endsAt = new Date(String(data.endsAt ?? original.endsAt))
  if (!(endsAt.getTime() > startsAt.getTime()))
    fail('Das Ende muss nach dem Beginn liegen.', 'endsAt')

  const note = data.locationNote
  if (typeof note === 'string' && ADDRESS_RE.test(note)) {
    fail(
      'Bitte keine Adresse angeben – nur den Bezirk (z. B. „Privatstudio in Neukölln“).',
      'locationNote',
    )
  }
  if (operation === 'create' && !note) {
    const settings = await preservingReq(req, () =>
      req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
    )
    const district = (settings as { tattoo?: { studioDistrict?: string | null } }).tattoo
      ?.studioDistrict
    if (district) data.locationNote = LOCATION_DEFAULT[req.locale === 'en' ? 'en' : 'de'](district)
  }
  return data
}

const len =
  (min: number, max: number) =>
  (value: unknown): true | string => {
    const s = typeof value === 'string' ? value.trim() : ''
    return s.length >= min && s.length <= max ? true : `Bitte ${min}–${max} Zeichen eingeben.`
  }

export const TattooOffers: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Angebot', plural: 'Angebote' },
  admin: {
    group: 'Tattoo',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'startsAt', 'endsAt', 'published'],
    description:
      'Flash-Days und Aktionen. Nach dem Ende verschwindet ein Angebot automatisch von der Website.',
  },
  access: {
    read: readTattooOffers,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    readVersions: isAdmin,
  },
  versions: { maxPerDoc: 10 },
  defaultSort: '-startsAt',
  fields: [
    {
      name: 'type',
      type: 'select',
      label: 'Art',
      required: true,
      defaultValue: 'flash_day',
      options: enumOptions(TATTOO_OFFER_TYPES, ENUM_LABELS.TATTOO_OFFER_TYPES),
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titel',
      required: true,
      localized: true,
      validate: len(3, 80),
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Beschreibung',
      required: true,
      localized: true,
      validate: len(10, 1500),
    },
    {
      name: 'startsAt',
      type: 'date',
      label: 'Beginn',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'endsAt',
      type: 'date',
      label: 'Ende',
      required: true,
      index: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Leer = Ende des Starttags (23:59 Uhr). Ab hier unsichtbar.',
      },
    },
    {
      name: 'locationNote',
      type: 'text',
      label: 'Ort',
      localized: true,
      maxLength: 120,
      admin: { description: 'Keine Adresse – nur der Bezirk.' },
    },
    { name: 'image', type: 'upload', label: 'Bild', relationTo: 'media' },
    {
      name: 'flashes',
      type: 'relationship',
      label: 'Flash-Motive',
      relationTo: 'flash',
      hasMany: true,
      maxRows: 30,
    },
    {
      name: 'priceNote',
      type: 'text',
      label: 'Preishinweis',
      localized: true,
      maxLength: 160,
      admin: { description: 'Gesamtpreise nennen.' },
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Online',
      defaultValue: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    ...seedField(),
  ],
  hooks: {
    beforeValidate: [defaultEnd],
    beforeChange: [guardOffer],
    afterChange: [
      ({ doc, req }) => {
        revalidateContent(TAGS.tattooOffers, { context: getAppContext(req) })
        return doc
      },
    ],
  },
}
