import type { CollectionConfig } from 'payload'

import { uploadStorage } from '@/lib/storage'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  // Speicher laut STORAGE_DRIVER (ARCHITEKTUR §3.3); Felder und Bildgrößen folgen mit DATENMODELL §6.2.
  upload: { ...uploadStorage('media') },
}
