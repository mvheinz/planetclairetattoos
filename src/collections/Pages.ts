import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, none, publicRead } from '@/access'
import { PAGE_BLOCKS } from '@/blocks'
import { seedField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { PAGE_KEYS } from '@/lib/enums'
import { getAppContext } from '@/lib/payload/context'

import { failField } from './hooks/commerce'
import { adoptOnSave } from './hooks/adopt'

// DATENMODELL §6.19 – Seiten aus Blöcken; die Route legt der Code fest, die Seite wird über `key` gefunden. Entwürfe
// (`maxPerDoc: 25`); öffentlich nur die veröffentlichte Fassung. Löschen ist gesperrt, weil der Code jeden `key` nutzt.

const SLUG = 'pages'

/** `stationId` eindeutig je Seite (Choreografie P9). */
const uniqueStations: CollectionBeforeChangeHook = ({ data }) => {
  const seen = new Set<string>()
  const layout = (data.layout ?? []) as { blockType?: string; stationId?: string }[]
  layout.forEach((block, i) => {
    if (block.blockType !== 'station' || !block.stationId) return
    if (seen.has(block.stationId)) {
      failField(
        SLUG,
        `Die Stations-Kennung „${block.stationId}“ gibt es schon.`,
        `layout.${i}.stationId`,
      )
    }
    seen.add(block.stationId)
  })
  return data
}

export const Pages: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Seite', plural: 'Seiten' },
  admin: {
    group: 'Inhalte',
    useAsTitle: 'title',
    defaultColumns: ['title', 'key', '_status', 'updatedAt'],
  },
  access: {
    read: publicRead({ _status: { equals: 'published' } }),
    create: isAdmin,
    update: isAdmin,
    delete: none,
    readVersions: isAdmin,
  },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    {
      name: 'key',
      type: 'select',
      label: 'Seite',
      required: true,
      unique: true,
      options: enumOptions(PAGE_KEYS, ENUM_LABELS.PAGE_KEYS),
      admin: { position: 'sidebar' },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titel',
      required: true,
      localized: true,
      minLength: 2,
      maxLength: 80,
    },
    {
      name: 'layout',
      type: 'blocks',
      label: 'Inhalt',
      maxRows: 40,
      blocks: PAGE_BLOCKS,
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
        { name: 'ogImage', type: 'upload', label: 'Vorschaubild', relationTo: 'media' },
      ],
    },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [uniqueStations, adoptOnSave],
    afterChange: [
      ({ doc, req }) => {
        if (doc.key) revalidateContent(TAGS.page(String(doc.key)), { context: getAppContext(req) })
        return doc
      },
    ],
  },
}
