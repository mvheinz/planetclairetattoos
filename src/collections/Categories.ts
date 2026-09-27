import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
} from 'payload'

import { isAdmin, none } from '@/access'
import { sortOrderField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/enums'
import { registerMediaReference } from '@/lib/media/references'
import { getAppContext } from '@/lib/payload/context'

// DATENMODELL §6.5 – Anzeige-Daten der sechs festen Kategorien. Die Fachlogik hängt am Enum `products.category`; Namen
// und Slugs kommen nur aus dieser Collection (nie im Code festgeschrieben). Genau 6 Dokumente aus dem Grund-Seed.

const SLUG = 'categories'
export const CATEGORY_SLUG_RE = /^[a-z0-9-]+$/

registerMediaReference({
  collection: SLUG,
  path: 'coverImage',
  label: 'Kategorie',
  titleField: 'name',
})

function fail(message: string, path: string): never {
  throw new ValidationError({ collection: SLUG, errors: [{ message, path }] })
}

/** Neue Kategorien nur über den Grund-Seed; `key` unveränderlich; Slug je Sprache eindeutig. */
const guardChange: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const ctx = getAppContext(req)
  if (operation === 'create') {
    if (!ctx.seed) fail('Kategorien sind fest vorgegeben und können nicht angelegt werden.', 'key')
    if (data.showInNavigation === undefined || data.showInNavigation === null) {
      data.showInNavigation = data.key !== 'sonstiges'
    }
  } else if (originalDoc && data.key !== undefined && data.key !== originalDoc.key) {
    fail('Der Schlüssel einer Kategorie ist unveränderlich.', 'key')
  }
  const slug = typeof data.slug === 'string' ? data.slug : undefined
  if (slug) {
    const locale = req.locale && req.locale !== 'all' ? req.locale : 'de'
    const clash = await req.payload.find({
      collection: SLUG,
      where: {
        and: [
          { slug: { equals: slug } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
      locale,
      fallbackLocale: false,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
    })
    if (clash.docs.length > 0) fail('Diesen Slug hat schon eine andere Kategorie.', 'slug')
  }
  return data
}

/** Name vorbelegen mit dem Label aus DATENMODELL §4 (je Sprache), solange keiner gesetzt ist. */
const defaultName: CollectionBeforeValidateHook = ({ data, originalDoc, req }) => {
  if (!data || data.name) return data
  const key = (data.key ?? originalDoc?.key) as ProductCategory | undefined
  const label = key ? ENUM_LABELS.PRODUCT_CATEGORIES[key] : undefined
  if (label) data.name = req.locale === 'en' ? (label.en ?? label.de) : label.de
  return data
}

const guardDelete: CollectionBeforeDeleteHook = ({ req }) => {
  if (!getAppContext(req).seed) {
    throw new APIError(
      'Kategorien sind fest vorgegeben und können nicht gelöscht werden.',
      403,
      null,
      true,
    )
  }
}

export const Categories: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Kategorie', plural: 'Kategorien' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'key', 'slug', 'sortOrder', 'showInNavigation'],
    group: 'Shop',
    description: 'Die sechs festen Kategorien: Namen, Adressen (Slugs), Texte und Bilder.',
  },
  access: {
    read: () => true,
    create: none,
    update: isAdmin,
    delete: none,
    readVersions: isAdmin,
  },
  versions: { maxPerDoc: 10 },
  defaultSort: 'sortOrder',
  fields: [
    {
      name: 'key',
      type: 'select',
      label: 'Schlüssel',
      required: true,
      unique: true,
      options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Name',
      required: true,
      localized: true,
      minLength: 2,
      maxLength: 40,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug (Teil der Adresse)',
      required: true,
      localized: true,
      unique: true,
      maxLength: 60,
      validate: (value: unknown): true | string =>
        typeof value === 'string' && CATEGORY_SLUG_RE.test(value)
          ? true
          : 'Nur Kleinbuchstaben a–z, Ziffern und Bindestriche.',
      admin: { description: 'Teil der URL, z. B. „keramik“. Änderungen ändern die Adresse.' },
    },
    {
      name: 'intro',
      type: 'textarea',
      label: 'Text über dem Raster',
      localized: true,
      maxLength: 500,
    },
    { name: 'coverImage', type: 'upload', label: 'Titelbild', relationTo: 'media' },
    { ...sortOrderField(), required: true, admin: { position: 'sidebar' } },
    {
      name: 'showInNavigation',
      type: 'checkbox',
      label: 'In der Navigation zeigen',
      admin: { position: 'sidebar' },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'Suchmaschinen',
      fields: [
        { name: 'metaTitle', type: 'text', label: 'Titel', localized: true, maxLength: 60 },
        {
          name: 'metaDescription',
          type: 'text',
          label: 'Beschreibung',
          localized: true,
          maxLength: 160,
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [defaultName],
    beforeChange: [guardChange],
    beforeDelete: [guardDelete],
    afterChange: [
      ({ doc, req }) => {
        const context = getAppContext(req)
        revalidateContent(TAGS.categories, { context })
        if (doc.key) revalidateContent(TAGS.category(String(doc.key)), { context })
        return doc
      },
    ],
  },
}
