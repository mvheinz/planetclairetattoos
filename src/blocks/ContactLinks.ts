import type { Block } from 'payload'

import { heading } from './shared'

export const ContactLinks: Block = {
  slug: 'contactLinks',
  labels: { singular: 'Kontakt-Links', plural: 'Kontakt-Links' },
  fields: [
    heading(),
    { name: 'showEmail', type: 'checkbox', label: 'E-Mail zeigen', defaultValue: true },
    { name: 'showDistrict', type: 'checkbox', label: 'Anschrift zeigen', defaultValue: true },
    {
      name: 'emailSubject',
      type: 'text',
      label: 'Betreff der Mail',
      localized: true,
      maxLength: 120,
    },
  ],
}
