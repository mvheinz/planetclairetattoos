import type { Block } from 'payload'

import { textarea } from './shared'

export const Callout: Block = {
  slug: 'callout',
  labels: { singular: 'Hinweis', plural: 'Hinweise' },
  fields: [
    textarea('text', 'Text', { required: true, maxLength: 600 }),
    {
      name: 'tone',
      type: 'select',
      label: 'Art',
      defaultValue: 'info',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Tipp', value: 'hint' },
      ],
    },
  ],
}
