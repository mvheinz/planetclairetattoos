'use client'

import React, { useEffect, useRef, useState } from 'react'

import { adminText } from '../translations'

// Kopier-Knopf (PLAN P5.1, z. B. Adresse fürs Versandportal, KONZEPT §7.6): Clipboard-API; geht das nicht (älterer
// Browser, keine Berechtigung), erscheint der Text markiert in einem Feld mit „Jetzt kopieren“ (execCommand) – klappt
// auch das nicht, ein Hinweis zum Kopieren von Hand. Rückmeldung als Text in einer `aria-live`-Region.

type State = 'idle' | 'done' | 'fallback' | 'manual'

export function CopyButton({
  text,
  label = adminText('copyLabel'),
  'data-testid': testId,
}: {
  text: string
  label?: string
  'data-testid'?: string
}) {
  const [state, setState] = useState<State>('idle')
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (state === 'fallback' || state === 'manual') {
      field.current?.focus()
      field.current?.select()
    }
  }, [state])

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
      setState('done')
    } catch {
      setState('fallback')
    }
  }

  const copyFallback = () => {
    const el = field.current
    if (!el) return
    el.focus()
    el.select()
    let ok = false
    try {
      ok = typeof document.execCommand === 'function' && document.execCommand('copy')
    } catch {
      ok = false
    }
    setState(ok ? 'done' : 'manual')
  }

  return (
    <span className="pc-admin-copy" data-testid={testId}>
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--secondary"
        onClick={() => void copy()}
      >
        {label}
      </button>
      {state === 'fallback' || state === 'manual' ? (
        <span className="pc-admin-copy__fallback">
          <span className="pc-admin-copy__hint">
            {adminText(state === 'manual' ? 'copyFallbackFailed' : 'copyFallbackHint')}
          </span>
          <textarea
            ref={field}
            readOnly
            value={text}
            rows={Math.min(6, text.split('\n').length)}
            aria-label={label}
            className="pc-admin-copy__field"
          />
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--primary"
            onClick={copyFallback}
          >
            {adminText('copyFallbackButton')}
          </button>
        </span>
      ) : null}
      <span role="status" aria-live="polite" className="pc-admin-copy__status">
        {state === 'done' ? adminText('copyDone') : ''}
      </span>
    </span>
  )
}
