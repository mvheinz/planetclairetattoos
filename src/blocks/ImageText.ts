import type { Block } from 'payload'

export const ImageText: Block = {
  slug: 'imageText',
  labels: { singular: 'Bild und Text', plural: 'Bild und Text' },
  fields: [
    { name: 'image', type: 'upload', label: 'Bild', relationTo: 'media', required: true },
    { name: 'content', type: 'richText', label: 'Text', localized: true, required: true },
    {
      name: 'imagePosition',
      type: 'select',
      label: 'Bild',
      defaultValue: 'left',
      options: [
        { label: 'links', value: 'left' },
        { label: 'rechts', value: 'right' },
      ],
    },
  ],
}
