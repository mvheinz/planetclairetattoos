import type { Block } from 'payload'

export const RichTextBlock: Block = {
  slug: 'richText',
  labels: { singular: 'Text', plural: 'Texte' },
  fields: [{ name: 'content', type: 'richText', label: 'Text', localized: true, required: true }],
}
