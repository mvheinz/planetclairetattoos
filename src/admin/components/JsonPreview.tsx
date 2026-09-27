'use client'

import type { JSONFieldClientComponent } from 'payload'
import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'

// Nur-Lese-Anzeige für JSON-/Code-Felder (ARCHITEKTUR §8.4): Payloads Editor lädt Monaco sonst von einem CDN
// (Drittanbieter-Request in der Verwaltung).
export const JsonPreview: JSONFieldClientComponent = ({ field, path }) => {
  const { value } = useField<unknown>({ path })
  const text = value === undefined || value === null ? '–' : JSON.stringify(value, null, 2)
  return (
    <div className="field-type json-preview">
      <FieldLabel label={field.label} path={path} />
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '24rem',
          overflow: 'auto',
          padding: '0.75rem',
          background: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '4px',
          fontSize: '0.8125rem',
        }}
      >
        {text}
      </pre>
      {field.admin?.description ? (
        <FieldDescription description={field.admin.description} path={path} />
      ) : null}
    </div>
  )
}
