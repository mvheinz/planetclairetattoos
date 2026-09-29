import React from 'react'

import { FieldError, FieldHint, RequiredMark, fieldIds, type FieldBaseProps } from './Field'
import styles from './forms.module.css'

// Checkbox und Radio (DESIGN KO-12): 24 px, handgezeichneter Kasten/Kreis (SVG, 1.5 px `--ink`), Haken bzw. Punkt
// statisch (keine Zeichen-Animation). Das native Eingabeelement liegt unsichtbar darüber (Zielfläche 44 × 44 px) und
// bleibt das Bedienelement. **Nie vorangekreuzt** (CLAUDE.md §6): angehakt nur, wenn `checked === true` ausdrücklich
// übergeben wird.

const BOX = 'M3.4 3.9Q12 3.1 20.5 3.6 21 12 20.3 20.4 12 21 3.7 20.5 3 12.1 3.4 3.9Z'
const TICK = 'M6.6 12.6Q8.9 14.6 10.4 17.2 13.9 10.4 18.2 6.4'
const CIRCLE = 'M20.4 12Q20.3 20.3 12 20.4 3.7 20.3 3.6 12 3.8 3.7 12 3.6 20.2 3.8 20.4 12Z'
const DOT = 'M15.5 12Q15.4 15.5 12 15.5 8.6 15.4 8.5 12 8.6 8.5 12 8.5 15.4 8.6 15.5 12Z'

function ChoiceGlyph({ type }: { type: 'checkbox' | 'radio' }) {
  return (
    <svg
      className={styles.box}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden="true"
      focusable="false"
    >
      <path d={type === 'checkbox' ? BOX : CIRCLE} className={styles.boxLine} />
      <path
        d={type === 'checkbox' ? TICK : DOT}
        className={type === 'checkbox' ? styles.tick : styles.dot}
      />
    </svg>
  )
}

interface ChoiceProps extends Omit<FieldBaseProps, 'label'> {
  name: string
  value?: string
  label: React.ReactNode
  /** Nur `true` hakt an; fehlt der Wert, ist das Feld leer. */
  checked?: boolean
  /** Nicht wählbar (z. B. Versand bei einem Stück „nur Abholung“, KO-13); Grund per `hint`. */
  disabled?: boolean
}

function Choice({
  type,
  id,
  name,
  value,
  label,
  hint,
  error,
  required,
  checked,
  disabled,
  className,
}: ChoiceProps & { type: 'checkbox' | 'radio' }) {
  const { hintId, errorId, describedBy } = fieldIds(id, hint, error)
  return (
    <div
      className={[
        styles.choiceField,
        error ? styles.invalid : null,
        disabled ? styles.choiceDisabled : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.choice}>
        <span className={styles.choiceControl}>
          <input
            id={id}
            type={type}
            name={name}
            value={value}
            required={required}
            disabled={disabled}
            className={styles.choiceInput}
            defaultChecked={checked === true ? true : undefined}
            aria-describedby={describedBy}
            aria-invalid={error ? 'true' : undefined}
          />
          <ChoiceGlyph type={type} />
        </span>
        <label htmlFor={id} className={styles.choiceLabel}>
          {label}
          {required ? <RequiredMark /> : null}
        </label>
      </div>
      <FieldHint id={hintId}>{hint}</FieldHint>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}

export type CheckboxProps = ChoiceProps

export function Checkbox(props: CheckboxProps) {
  return <Choice {...props} type="checkbox" />
}

export type RadioProps = ChoiceProps & { value: string }

export function Radio(props: RadioProps) {
  return <Choice {...props} type="radio" />
}

export interface RadioGroupProps {
  id: string
  name: string
  legend: React.ReactNode
  options: readonly { value: string; label: React.ReactNode }[]
  /** Ausdrücklich gewählter Wert; ohne Angabe ist keine Option gewählt. */
  value?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
}

/** Radiogruppe als `<fieldset>` mit `<legend>`; keine Option vorausgewählt, wenn `value` fehlt. */
export function RadioGroup({
  id,
  name,
  legend,
  options,
  value,
  hint,
  error,
  required,
}: RadioGroupProps) {
  const { hintId, errorId, describedBy } = fieldIds(id, hint, error)
  return (
    <fieldset
      id={id}
      className={[styles.fieldset, error ? styles.invalid : null].filter(Boolean).join(' ')}
      aria-describedby={describedBy}
    >
      <legend className={styles.label}>
        {legend}
        {required ? <RequiredMark /> : null}
      </legend>
      <FieldHint id={hintId}>{hint}</FieldHint>
      {options.map((o, i) => (
        <Radio
          key={o.value}
          id={`${id}-${i + 1}`}
          name={name}
          value={o.value}
          label={o.label}
          required={required}
          checked={value !== undefined && value === o.value}
        />
      ))}
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  )
}
