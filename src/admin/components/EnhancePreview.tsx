'use client'

import { useState } from 'react'
import type { UIFieldClientComponent } from 'payload'
import { useDocumentInfo, useTranslation } from '@payloadcms/ui'

// Vorher/Nachher-Vorschau des Foto-Looks (DESIGN §12.2 Schritt 6, P9.14): holt kleine Bilder vom Endpunkt
// `GET /api/media/:id/enhance-preview` und zeigt sie nebeneinander.

interface Preview {
  before: string
  after: string
  noop: boolean
}

export const EnhancePreview: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo()
  const { t } = useTranslation()
  const tr = t as (key: string) => string
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [preview, setPreview] = useState<Preview | null>(null)

  if (!id) return <p className="field-description">{tr('custom:enhanceSaveFirst')}</p>

  const load = async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/media/${id}/enhance-preview`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(String(res.status))
      setPreview((await res.json()) as Preview)
      setState('idle')
    } catch {
      setState('failed')
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button type="button" className="btn btn--style-secondary btn--size-small" onClick={load}>
        {tr('custom:enhanceShow')}
      </button>
      <div aria-live="polite">
        {state === 'failed' ? <p className="field-error">{tr('custom:enhanceFailed')}</p> : null}
        {preview ? (
          <>
            {preview.noop ? <p className="field-description">{tr('custom:enhanceNone')}</p> : null}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {(
                [
                  ['custom:enhanceBefore', preview.before],
                  ['custom:enhanceAfter', preview.after],
                ] as const
              ).map(([label, src]) => (
                <figure key={label} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    style={{ maxWidth: 240, height: 'auto', display: 'block' }}
                  />
                  <figcaption className="field-description">{tr(label)}</figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
