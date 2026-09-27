import type { Block } from 'payload'

import { heading, textarea } from './shared'

export const ProcessSteps: Block = {
  slug: 'processSteps',
  labels: { singular: 'Ablauf', plural: 'Abläufe' },
  fields: [
    heading(),
    {
      name: 'steps',
      type: 'array',
      label: 'Schritte',
      minRows: 1,
      maxRows: 8,
      required: true,
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Titel',
          localized: true,
          required: true,
          maxLength: 80,
        },
        textarea('text', 'Text', { required: true, maxLength: 600 }),
      ],
    },
  ],
}
