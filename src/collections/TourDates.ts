import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, publicRead } from '@/access'
import { seedField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { TOUR_STATUSES } from '@/lib/enums'
import { registerMediaReference } from '@/lib/media/references'
import { getAppContext } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { containsStreet, parseTourLink } from '@/lib/tour/address'
import { isTourTime, normalizeTourRange } from '@/lib/tour/dates'
import { tourAdminEndpoints } from '@/endpoints/tattoo'

import { failField } from './hooks/commerce'

// DATENMODELL §6.30 – „Planet Claire on Tour“ (P12.8, U-20): Termine auf Märkten, Flohmärkten und Kunstmärkten. Öffentlich
// lesbar sind veröffentlichte Termine (auch vergangene – sie stehen eingeklappt unter den kommenden); „vorbei“ folgt aus
// `endsAt`, „abgesagt“ setzt Jutta. Nur ein Textlink, keine Karte (R-139, keine Drittanbieter). Schreiben nur Admin.

const SLUG = 'tour-dates'
const fail = (message: string, path: string): never => failField(SLUG, message, path)

type Doc = Record<string, unknown>

registerMediaReference({
  collection: SLUG,
  path: 'image',
  where: { published: { equals: true } },
  label: 'Termin (Planet Claire on Tour)',
  titleField: 'name',
})

const ADDRESS_MESSAGE =
  'Das ist die Adresse des Privatstudios. Bitte nur die Adresse des Marktes angeben (E-50).'

const len =
  (min: number, max: number) =>
  (value: unknown): true | string => {
    const s = typeof value === 'string' ? value.trim() : ''
    return s.length >= min && s.length <= max ? true : `Bitte ${min}–${max} Zeichen eingeben.`
  }

const optionalTime = (value: unknown): true | string =>
  value === undefined ||
  value === null ||
  value === '' ||
  (typeof value === 'string' && isTourTime(value))
    ? true
    : 'Uhrzeit wie 10:00 eingeben.'

/** Zeitraum auf ganze Berliner Kalendertage legen (Beginn 00:00, Ende 23:59:59 des letzten Tages) und Adresse prüfen. */
const guardTour: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const original = (originalDoc ?? {}) as Doc
  const startsRaw = data.startsAt ?? original.startsAt
  const start = new Date(String(startsRaw ?? ''))
  if (Number.isNaN(start.getTime())) fail('Bitte das Startdatum angeben.', 'startsAt')
  const endRaw = data.endsAt ?? original.endsAt ?? startsRaw
  const end = new Date(String(endRaw))
  if (Number.isNaN(end.getTime())) fail('Bitte ein gültiges Enddatum angeben.', 'endsAt')
  const range = normalizeTourRange(start, end)
  if (range.endsAt.getTime() < range.startsAt.getTime())
    fail('Das Enddatum liegt vor dem Startdatum.', 'endsAt')
  data.startsAt = range.startsAt.toISOString()
  data.endsAt = range.endsAt.toISOString()

  if (typeof data.link === 'string' && data.link.trim() !== '') {
    const link = parseTourLink(data.link)
    if (!link) fail('Bitte einen Link wie https://www.beispiel.de angeben.', 'link')
    data.link = link
  }

  const address = data.address
  if (typeof address === 'string' && address.trim() !== '') {
    const settings = (await preservingReq(req, () =>
      req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
    )) as { business?: { street?: string | null } }
    if (containsStreet(address, settings.business?.street)) fail(ADDRESS_MESSAGE, 'address')
  }
  return data
}

export const TourDates: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Termin (on Tour)', plural: 'Termine (on Tour)' },
  admin: {
    group: 'Tattoo',
    useAsTitle: 'name',
    defaultColumns: ['name', 'startsAt', 'endsAt', 'place', 'status', 'published'],
    description:
      'Märkte, Flohmärkte und Kunstmärkte („Planet Claire on Tour“, rechte Spalte der Startseite). Vergangene Termine stehen eingeklappt.',
  },
  access: {
    // öffentlich: veröffentlichte Termine (auch vergangene – sie stehen eingeklappt), Seed-Filter wie bei allen Beispielen
    read: publicRead({ published: { equals: true } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    readVersions: isAdmin,
  },
  defaultSort: '-startsAt',
  endpoints: tourAdminEndpoints,
  indexes: [{ fields: ['published', 'endsAt'] }],
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Name des Marktes',
      required: true,
      localized: true,
      validate: len(3, 100),
    },
    {
      name: 'startsAt',
      type: 'date',
      label: 'Von (Datum)',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'endsAt',
      type: 'date',
      label: 'Bis (Datum)',
      index: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Leer = eintägig. Der letzte Tag zählt bis 23:59 Uhr.',
      },
    },
    {
      name: 'place',
      type: 'text',
      label: 'Ort / Bezirk',
      required: true,
      localized: true,
      validate: len(2, 80),
      admin: { description: 'z. B. „Berlin-Prenzlauer Berg“' },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresse',
      maxLength: 160,
      admin: { description: 'Adresse des Marktes, nicht die des Privatstudios.' },
    },
    {
      name: 'link',
      type: 'text',
      label: 'Link',
      maxLength: 300,
      admin: { description: 'Nur ein Textlink zur Seite des Marktes (keine Karte).' },
    },
    {
      name: 'standNumber',
      type: 'text',
      label: 'Standnummer',
      maxLength: 20,
    },
    {
      name: 'timeFrom',
      type: 'text',
      label: 'Uhrzeit von',
      maxLength: 5,
      validate: optionalTime,
      admin: { description: 'z. B. 10:00' },
    },
    {
      name: 'timeTo',
      type: 'text',
      label: 'Uhrzeit bis',
      maxLength: 5,
      validate: optionalTime,
      admin: { description: 'z. B. 18:00' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Notiz',
      localized: true,
      maxLength: 240,
      admin: { description: 'Kurz, z. B. „Coco ist dabei.“' },
    },
    { name: 'image', type: 'upload', label: 'Foto vom Stand', relationTo: 'media' },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'planned',
      options: enumOptions(TOUR_STATUSES, ENUM_LABELS.TOUR_STATUSES),
      admin: {
        position: 'sidebar',
        description: '„Vorbei“ wird nach dem Datum automatisch gesetzt – du musst nichts tun.',
      },
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
    beforeChange: [guardTour],
    afterChange: [
      ({ doc, req }) => {
        const ctx = getAppContext(req)
        revalidateContent(TAGS.tourDates, { context: ctx })
        revalidateContent(TAGS.home, { context: ctx })
        return doc
      },
    ],
    afterDelete: [
      ({ doc, req }) => {
        const ctx = getAppContext(req)
        revalidateContent(TAGS.tourDates, { context: ctx })
        revalidateContent(TAGS.home, { context: ctx })
        return doc
      },
    ],
  },
}
