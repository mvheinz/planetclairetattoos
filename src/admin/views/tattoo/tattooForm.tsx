'use client'

import React, { useId } from 'react'

import type { PiecePhoto } from '../../components/PhotoPicker/photoList'
import { adminText } from '../../translations'
import { issuesFromResponse, type FieldIssue } from '../pieces/pieceForm'
import { tattooText } from './tattooText'

// Gemeinsame Formular-Bausteine der Tattoo-Verwaltung (PLAN P7.6–P7.9): JSON-Anfrage mit Sitzung, Feldfehler aus
// Payload-REST bzw. Admin-Endpunkten, Textfeld mit Fehlertext und `aria-describedby`, Feldpaar Deutsch/Englisch.

type Doc = Record<string, unknown>

export async function requestJson(
  url: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; json?: unknown } = {},
): Promise<{ ok: boolean; status: number; json: Doc }> {
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.json === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    })
  } catch {
    throw new Error(adminText('actionOffline'))
  }
  const json = (await res.json().catch(() => ({}))) as Doc
  return { ok: res.ok, status: res.status, json }
}

/** Fehler einer Antwort als Feldfehler (`path` → Meldung). */
export function issuesOf(json: unknown, prefix = ''): FieldIssue[] {
  return issuesFromResponse(json).map((i) => ({
    field: i.field ? `${prefix}${i.field}` : '',
    message: i.message,
  }))
}

export class IssuesError extends Error {
  constructor(readonly issues: FieldIssue[]) {
    super(issues.map((i) => i.message).join(' '))
  }
}

export type Errors = Record<string, string>

export function errorsOf(issues: readonly FieldIssue[]): Errors {
  const out: Errors = {}
  for (const i of issues) if (i.field && !out[i.field]) out[i.field] = i.message
  return out
}

export function IssueList({ issues, testId }: { issues: readonly FieldIssue[]; testId?: string }) {
  if (issues.length === 0) return null
  return (
    <div className="pc-field__error" role="alert" data-testid={testId}>
      <p>{tattooText('checkFields')}</p>
      <ul>
        {[...new Set(issues.map((i) => i.message))].map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  )
}

export function TextInput(props: {
  path: string
  label: string
  value: string
  onChange: (v: string) => void
  errors: Errors
  hint?: string
  multiline?: boolean
  rows?: number
  maxLength?: number
  required?: boolean
  type?: 'text' | 'date' | 'time' | 'email'
  inputMode?: 'decimal' | 'numeric' | 'email' | 'text'
  disabled?: boolean
}) {
  const id = useId()
  const error = props.errors[props.path]
  const describedBy =
    [props.hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') ||
    undefined
  const common = {
    id,
    name: props.path,
    value: props.value,
    maxLength: props.maxLength,
    disabled: props.disabled,
    required: props.required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    'data-testid': `tf-${props.path}`,
  }
  return (
    <div className="pc-field">
      <label htmlFor={id} className="pc-field__label">
        {props.label}
        {props.required ? <span className="pc-field__required"> *</span> : null}
      </label>
      {props.multiline ? (
        <textarea
          {...common}
          rows={props.rows ?? 4}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          {...common}
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          autoComplete="off"
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
      {props.hint ? (
        <p id={`${id}-hint`} className="pc-piece__hint">
          {props.hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="pc-field__error" data-testid={`tf-error-${props.path}`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface Loc {
  de: string
  en: string
}

/** Feldpaar Deutsch/Englisch (Pfade `<path>.de` / `<path>.en`). */
export function LocInput(props: {
  path: string
  label: string
  value: Loc
  onChange: (v: Loc) => void
  errors: Errors
  hint?: string
  multiline?: boolean
  rows?: number
  maxLength?: number
  required?: boolean
}) {
  return (
    <fieldset className="pc-field pc-settings__group">
      <legend className="pc-field__label">{props.label}</legend>
      {(['de', 'en'] as const).map((l) => (
        <TextInput
          key={l}
          path={`${props.path}.${l}`}
          label={tattooText(l === 'de' ? 'german' : 'english')}
          value={props.value[l]}
          multiline={props.multiline}
          rows={props.rows}
          maxLength={props.maxLength}
          required={props.required && l === 'de'}
          hint={l === 'de' ? props.hint : undefined}
          errors={props.errors}
          onChange={(v) => props.onChange({ ...props.value, [l]: v })}
        />
      ))}
    </fieldset>
  )
}

export function CheckInput(props: {
  path: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  errors: Errors
  hint?: string
  disabled?: boolean
}) {
  const id = useId()
  const error = props.errors[props.path]
  const describedBy =
    [props.hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') ||
    undefined
  return (
    <div className="pc-field">
      <label className="pc-choice">
        <input
          type="checkbox"
          name={props.path}
          checked={props.checked}
          disabled={props.disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-testid={`tf-${props.path}`}
          onChange={(e) => props.onChange(e.target.checked)}
        />
        {props.label}
      </label>
      {props.hint ? (
        <p id={`${id}-hint`} className="pc-piece__hint">
          {props.hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="pc-field__error" data-testid={`tf-error-${props.path}`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Alt-Texte und Fokuspunkt geänderter Fotos speichern (wie „Neues Stück“, P5.5); Alt-Text DE ist Pflicht. */
export async function savePhotoMeta(
  photos: readonly PiecePhoto[],
  field = 'image',
): Promise<PiecePhoto[]> {
  const missing = photos.findIndex((p) => p.altDe.trim() === '')
  if (missing >= 0) {
    throw new IssuesError([{ field, message: tattooText('altRequired', { n: missing + 1 }) }])
  }
  for (const [i, p] of photos.entries()) {
    if (!p.dirty) continue
    const de = await requestJson(`/api/media/${p.id}?locale=de&depth=0`, {
      method: 'PATCH',
      json: { alt: p.altDe, focalX: p.focalX, focalY: p.focalY },
    })
    if (!de.ok) {
      throw new IssuesError(
        issuesOf(de.json).map((x) => ({
          field,
          message: `${adminText('photoNumber', { n: i + 1 })}: ${x.message}`,
        })),
      )
    }
    const en = await requestJson(`/api/media/${p.id}?locale=en&depth=0`, {
      method: 'PATCH',
      json: { alt: p.altEn.trim() === '' ? null : p.altEn },
    })
    if (!en.ok) throw new IssuesError(issuesOf(en.json))
  }
  return photos.map((p) => (p.dirty ? { ...p, dirty: false } : p))
}

/** Entfernte Fotos löschen (nur wenn nichts anderes sie nutzt; sonst bleiben sie liegen). */
export async function deleteRemovedPhotos(ids: readonly number[]): Promise<void> {
  for (const id of ids) {
    await requestJson(`/api/media/${id}`, { method: 'DELETE' }).catch(() => undefined)
  }
}
