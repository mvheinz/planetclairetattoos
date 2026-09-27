import type { Block } from 'payload'

import { heading } from './shared'

export const FlashGrid: Block = {
  slug: 'flashGrid',
  labels: { singular: 'Flash-Raster', plural: 'Flash-Raster' },
  fields: [
    heading(),
    { name: 'showClaimed', type: 'checkbox', label: 'Vergebene zeigen', defaultValue: true },
  ],
}
