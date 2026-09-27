import type { Block } from 'payload'

import { cocoPose, heading, textarea } from './shared'

export const Hero: Block = {
  slug: 'hero',
  labels: { singular: 'Kopfbereich', plural: 'Kopfbereiche' },
  fields: [
    heading(true),
    textarea('subheading', 'Unterzeile', { maxLength: 300 }),
    { name: 'image', type: 'upload', label: 'Bild', relationTo: 'media' },
    cocoPose('run'),
  ],
}
