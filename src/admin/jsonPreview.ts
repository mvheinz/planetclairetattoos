import type { Field } from 'payload'

// JSON- und Code-Felder bekommen in der Verwaltung die Nur-Lese-Anzeige `JsonPreview` statt Monaco (lädt sonst vom
// CDN, ARCHITEKTUR §8.4). Rekursiv für Gruppen, Arrays, Zeilen, Tabs und Blöcke.

export const JSON_PREVIEW_COMPONENT = '/admin/components/JsonPreview#JsonPreview'

export function withJsonPreview(fields: Field[]): Field[] {
  return fields.map((field): Field => {
    if (field.type === 'json' || field.type === 'code') {
      return {
        ...field,
        admin: {
          ...field.admin,
          readOnly: true,
          components: { ...field.admin?.components, Field: JSON_PREVIEW_COMPONENT },
        },
      } as Field
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: withJsonPreview(field.fields) } as Field
    }
    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({ ...tab, fields: withJsonPreview(tab.fields) })),
      }
    }
    if (field.type === 'blocks') {
      return {
        ...field,
        blocks: field.blocks.map((b) => ({ ...b, fields: withJsonPreview(b.fields) })),
      }
    }
    return field
  })
}
