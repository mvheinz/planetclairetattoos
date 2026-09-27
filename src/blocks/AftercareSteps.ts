import type { Block } from 'payload'

import { heading } from './shared'

export const AftercareSteps: Block = {
  slug: 'aftercareSteps',
  labels: { singular: 'Pflege-Phasen', plural: 'Pflege-Phasen' },
  fields: [
    heading(),
    {
      name: 'phases',
      type: 'array',
      label: 'Phasen',
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
        { name: 'content', type: 'richText', label: 'Text', localized: true, required: true },
      ],
    },
    { name: 'pdf', type: 'upload', label: 'PDF', relationTo: 'documents' },
  ],
}
