'use client'

import { useId, useState, type ChangeEvent } from 'react'

import { formatEuroInput, parseEuroInput } from '@/lib/money'

// Reines Eingabefeld für Euro-Beträge (ohne Payload-Abhängigkeit, im jsdom-Test prüfbar).
// „38,50“ → onChange(3850); ungültige Eingaben („38,555“) → onChange(INVALID_CENTS), damit die serverseitige
// Feldvalidierung (moneyField) das Speichern ablehnt, statt still einen falschen Wert zu übernehmen.
export const INVALID_CENTS = -1

export interface EuroInputControlProps {
  id?: string
  value: number | null | undefined
  onChange: (cents: number | null) => void
  invalidMessage: string
  hint?: string
  readOnly?: boolean
  required?: boolean
}

export function EuroInputControl(props: EuroInputControlProps) {
  const { value, onChange, invalidMessage, hint, readOnly, required } = props
  const autoId = useId()
  const id = props.id ?? autoId
  const [text, setText] = useState(() => formatEuroInput(value))
  const [invalid, setInvalid] = useState(false)
  // Wert von außen geändert (Formular geladen/zurückgesetzt): Text nachziehen, ohne eigene Eingabe zu überschreiben.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    const typed = text.trim() === '' ? null : parseEuroInput(text)
    if (value !== INVALID_CENTS && typed !== (value ?? null)) {
      setText(formatEuroInput(value))
      setInvalid(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setText(next)
    if (next.trim() === '') {
      setInvalid(false)
      onChange(null)
      return
    }
    const cents = parseEuroInput(next)
    setInvalid(cents === null)
    onChange(cents ?? INVALID_CENTS)
  }

  const handleBlur = () => {
    const cents = parseEuroInput(text)
    if (cents !== null) setText(formatEuroInput(cents))
  }

  const errorId = `${id}-error`
  return (
    <div className="pc-euro-input">
      <span className="pc-euro-input__wrap">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          readOnly={readOnly}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          placeholder={hint}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <span aria-hidden="true"> €</span>
      </span>
      {invalid ? (
        <p id={errorId} role="alert" className="pc-euro-input__error">
          {invalidMessage}
        </p>
      ) : null}
    </div>
  )
}
