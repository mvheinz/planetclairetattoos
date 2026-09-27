import type { Block } from 'payload'

import { heading } from './shared'

// Zahlen kommen aus `settings.tattoo` (DATENMODELL §6.19).
export const PriceInfo: Block = {
  slug: 'priceInfo',
  labels: { singular: 'Preise', plural: 'Preise' },
  fields: [heading(), { name: 'content', type: 'richText', label: 'Text', localized: true }],
}
