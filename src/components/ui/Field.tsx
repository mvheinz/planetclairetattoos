import React from 'react'

import { Icon } from '@/components/icons/Icon'

import styles from './forms.module.css'

// Formular-Basis (DESIGN KO-12): Label über dem Feld (immer per `for`/`id` verknüpft), Hinweis und Fehler per
// `aria-describedby`, Fehler mit Text + Icon und `aria-invalid`, ohne Animation. Pflichtfelder mit „*“; der Satz
// „* Pflichtfeld“ steht einmal oben im Formular (`RequiredNote`). Platzhalter nur als Beispiel, nie statt Label.

export interface FieldBaseProps {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  className?: string
}

/** IDs für Hinweis und Fehler; `describedBy` verknüpft beide (Fehler zuerst, damit er zuerst vorgelesen wird). */
export function fieldIds(id: string, hint: unknown, error: unknown) {
  const hintId = hint ? `${id}-hinweis` : undefined
  const errorId = error ? `${id}-fehler` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return { hintId, errorId, describedBy }
}

export function RequiredMark() {
  return (
    <span className={styles.required} aria-hidden="true">
      {' *'}
    </span>
  )
}

/** Einmal oben im Formular: „* Pflichtfeld“ (Text vom Aufrufer, i18n `ui.form.requiredNote`). */
export function RequiredNote({ children }: { children: React.ReactNode }) {
  return <p className={styles.requiredNote}>{children}</p>
}

export function FieldHint({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!id || !children) return null
  return (
    <p id={id} className={styles.hint}>
      {children}
    </p>
  )
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!id || !children) return null
  return (
    <p id={id} className={styles.error}>
      <Icon name="warn" size={18} className={styles.errorIcon} />
      <span>{children}</span>
    </p>
  )
}

type InputType = 'text' | 'email' | 'tel' | 'number' | 'search' | 'url' | 'password' | 'date'

export interface FieldProps extends FieldBaseProps {
  name: string
  type?: InputType
  /** Mehrzeilig (`<textarea>`, ≥ 120 px). */
  multiline?: boolean
  rows?: number
  defaultValue?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  minLength?: number
  pattern?: string
}

export function Field(props: FieldProps) {
  const { id, label, hint, error, required, className, name, multiline } = props
  const { hintId, errorId, describedBy } = fieldIds(id, hint, error)
  const common = {
    id,
    name,
    required,
    className: styles.control,
    defaultValue: props.defaultValue,
    placeholder: props.placeholder,
    autoComplete: props.autoComplete,
    maxLength: props.maxLength,
    minLength: props.minLength,
    'aria-describedby': describedBy,
    'aria-invalid': error ? ('true' as const) : undefined,
  }
  return (
    <div
      className={[styles.field, error ? styles.invalid : null, className].filter(Boolean).join(' ')}
    >
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <FieldHint id={hintId}>{hint}</FieldHint>
      {multiline ? (
        <textarea {...common} rows={props.rows ?? 5} />
      ) : (
        <input
          {...common}
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          pattern={props.pattern}
        />
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends FieldBaseProps {
  name: string
  options: readonly SelectOption[]
  /** Erste, leere Auswahl („Bitte wählen“); ohne sie ist die erste Option vorausgewählt (Browser-Standard). */
  emptyOption?: string
  defaultValue?: string
  autoComplete?: string
}

/** Natives `<select>` in Feldoptik mit eigenem Pfeil (KO-12). */
export function Select(props: SelectProps) {
  const { id, label, hint, error, required, className, name, options, emptyOption } = props
  const { hintId, errorId, describedBy } = fieldIds(id, hint, error)
  return (
    <div
      className={[styles.field, error ? styles.invalid : null, className].filter(Boolean).join(' ')}
    >
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <FieldHint id={hintId}>{hint}</FieldHint>
      <div className={styles.selectWrap}>
        <select
          id={id}
          name={name}
          required={required}
          className={`${styles.control} ${styles.select}`}
          defaultValue={props.defaultValue ?? (emptyOption !== undefined ? '' : undefined)}
          autoComplete={props.autoComplete}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
        >
          {emptyOption !== undefined ? <option value="">{emptyOption}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="arrow-right" size={20} className={styles.selectArrow} />
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}
