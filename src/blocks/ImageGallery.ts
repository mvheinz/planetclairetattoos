import type { Block } from 'payload'

export const ImageGallery: Block = {
  slug: 'imageGallery',
  labels: { singular: 'Bildergalerie', plural: 'Bildergalerien' },
  fields: [
    {
      name: 'images',
      type: 'upload',
      label: 'Bilder',
      relationTo: 'media',
      hasMany: true,
      required: true,
      minRows: 1,
      maxRows: 12,
    },
    { name: 'caption', type: 'text', label: 'Bildunterschrift', localized: true, maxLength: 200 },
  ],
}
