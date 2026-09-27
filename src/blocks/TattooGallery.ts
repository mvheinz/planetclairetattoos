import type { Block } from 'payload'

import { heading } from './shared'

export const TattooGalleryBlock: Block = {
  slug: 'tattooGallery',
  labels: { singular: 'Tattoo-Galerie', plural: 'Tattoo-Galerien' },
  fields: [
    heading(),
    {
      name: 'filter',
      type: 'select',
      label: 'Filter',
      defaultValue: 'all',
      options: [
        { label: 'alle', value: 'all' },
        { label: 'fresh', value: 'fresh' },
        { label: 'healed', value: 'healed' },
      ],
    },
    { name: 'limit', type: 'number', label: 'Anzahl', defaultValue: 12, min: 1, max: 48 },
  ],
}
