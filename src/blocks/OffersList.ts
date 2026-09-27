import type { Block } from 'payload'

import { heading } from './shared'

export const OffersList: Block = {
  slug: 'offersList',
  labels: { singular: 'Angebote', plural: 'Angebote' },
  fields: [
    heading(),
    {
      name: 'emptyText',
      type: 'text',
      label: 'Text ohne Angebote',
      localized: true,
      maxLength: 200,
    },
  ],
}
