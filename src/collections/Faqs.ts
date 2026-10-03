import type { CollectionConfig } from 'payload'

import { isAdmin, publicRead } from '@/access'
import { faqAdminEndpoints } from '@/endpoints/tattoo'
import { basicRichTextEditor, seedField, sortOrderField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { FAQ_CATEGORIES } from '@/lib/enums'
import { getAppContext } from '@/lib/payload/context'

import { adoptOnSave } from './hooks/adopt'

// DATENMODELL §6.18 – FAQ. Speichern durch Jutta übernimmt Beispiel-Einträge (§13.4).

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  labels: { singular: 'Frage (FAQ)', plural: 'FAQ' },
  admin: {
    group: 'Inhalte',
    useAsTitle: 'question',
    defaultColumns: ['question', 'category', 'published', 'sortOrder'],
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
  endpoints: faqAdminEndpoints,
  fields: [
    {
      name: 'question',
      type: 'text',
      label: 'Frage',
      required: true,
      localized: true,
      minLength: 5,
      maxLength: 200,
    },
    {
      name: 'answer',
      type: 'richText',
      label: 'Antwort',
      required: true,
      localized: true,
      editor: basicRichTextEditor(),
    },
    {
      name: 'category',
      type: 'select',
      label: 'Kategorie',
      required: true,
      defaultValue: 'general',
      index: true,
      options: enumOptions(FAQ_CATEGORIES, ENUM_LABELS.FAQ_CATEGORIES),
    },
    { ...sortOrderField(), required: true, admin: { position: 'sidebar' } },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Online',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [adoptOnSave],
    afterChange: [
      ({ doc, req }) => {
        revalidateContent(TAGS.faqs, { context: getAppContext(req) })
        return doc
      },
    ],
  },
}
