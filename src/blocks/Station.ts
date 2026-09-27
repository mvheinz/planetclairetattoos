import type { Block } from 'payload'

import { internalLinkFields } from '@/fields'

import { cocoPose, heading, textarea } from './shared'

/** Schlüssel einer Station (Choreografie P9), eindeutig je Seite. */
export const STATION_ID_RE = /^[a-z0-9-]+$/

export const Station: Block = {
  slug: 'station',
  labels: { singular: 'Station', plural: 'Stationen' },
  fields: [
    {
      name: 'stationId',
      type: 'text',
      label: 'Stations-Kennung',
      required: true,
      maxLength: 40,
      admin: {
        description: 'z. B. „shop“ – nur a–z, 0–9 und Bindestrich, eindeutig auf der Seite.',
      },
      validate: (value: unknown): true | string =>
        typeof value === 'string' && STATION_ID_RE.test(value)
          ? true
          : 'Nur Kleinbuchstaben a–z, Ziffern und Bindestriche.',
    },
    heading(true),
    textarea('text', 'Text', { maxLength: 400 }),
    { name: 'image', type: 'upload', label: 'Bild', relationTo: 'media' },
    { name: 'link', type: 'group', label: 'Link', fields: internalLinkFields() },
    cocoPose('sniff'),
    {
      name: 'ornament',
      type: 'select',
      label: 'Ornament',
      defaultValue: 'none',
      options: [
        { label: 'Planet', value: 'planet' },
        { label: 'Stern', value: 'star' },
        { label: 'keins', value: 'none' },
      ],
    },
  ],
}
