import type { CollectionConfig } from 'payload'

import { isAdmin, none } from '@/access'
import { INVOICE_SERIES } from '@/lib/enums'

// DATENMODELL §6.10 – Nummernkreise der Belege. Zeilen entstehen automatisch per Upsert (§8.6,
// src/lib/commerce/invoiceNumber.ts); nie manuell ändern.
export const InvoiceCounters: CollectionConfig = {
  slug: 'invoice-counters',
  labels: { singular: 'Nummernkreis', plural: 'Nummernkreise' },
  admin: {
    group: 'System',
    useAsTitle: 'series',
    defaultColumns: ['series', 'year', 'lastNumber'],
    description: 'Letzte vergebene Belegnummer je Serie und Jahr. Nur lesen.',
  },
  access: { read: isAdmin, create: none, update: none, delete: none },
  // UNIQUE (series, year): Ziel von ON CONFLICT (§8.6).
  indexes: [{ fields: ['series', 'year'], unique: true }],
  fields: [
    {
      name: 'series',
      type: 'text',
      label: 'Serie',
      required: true,
      admin: { readOnly: true },
      validate: (v: unknown) =>
        (INVOICE_SERIES as readonly string[]).includes(String(v)) ? true : 'Unbekannte Serie.',
    },
    {
      name: 'year',
      type: 'number',
      label: 'Jahr',
      required: true,
      admin: { readOnly: true },
      validate: (v: unknown) =>
        typeof v === 'number' && Number.isInteger(v) && v >= 2026 && v <= 2100
          ? true
          : 'Jahr 2026–2100.',
    },
    {
      name: 'lastNumber',
      type: 'number',
      label: 'Letzte Nummer',
      required: true,
      defaultValue: 0,
      admin: { readOnly: true },
      validate: (v: unknown) =>
        typeof v === 'number' && Number.isInteger(v) && v >= 0 ? true : 'Ganzzahl ≥ 0.',
    },
  ],
}
