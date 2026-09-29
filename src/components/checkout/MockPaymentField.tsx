import React from 'react'

import { Radio } from '@/components/ui/Choice'

import styles from './Checkout.module.css'

// Test-Zahlungsfeld des Mock-Anbieters (KONZEPT §4.7, ARCHITEKTUR §3.5; PLAN P4.9): gleich groß wie das Payment
// Element, „Testmodus – keine echte Zahlung“, Auswahl Erfolg (Standard) · Abgelehnt · Abbruch (wie PayPal zurück) ·
// Verzögert und Test-Zahlart Karte · Apple Pay · Google Pay · PayPal. Nur mit `PAYMENTS_DRIVER=mock` (nie bei
// `APP_ENV=production`, dort gibt es den Treiber nicht). Die Auswahl geht mit dem Formular an die Server-Action.

export const MOCK_FIELD_OUTCOMES = ['success', 'declined', 'cancelled', 'delayed'] as const
export const MOCK_FIELD_METHODS = ['card', 'apple_pay', 'google_pay', 'paypal'] as const

export interface MockPaymentFieldTexts {
  title: string
  outcomeLegend: string
  methodLegend: string
  success: string
  declined: string
  cancelled: string
  delayed: string
  card: string
  apple_pay: string
  google_pay: string
  paypal: string
}

export function MockPaymentField({
  texts,
  error,
}: {
  texts: MockPaymentFieldTexts
  /** Meldung nach „Abgelehnt“ (S8) – im Zahlungsfeld. */
  error?: string | null
}) {
  return (
    <div className={styles.paymentField} data-payment-field="mock">
      <p className={styles.mockTitle}>{texts.title}</p>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{texts.outcomeLegend}</legend>
        {MOCK_FIELD_OUTCOMES.map((o) => (
          <Radio
            key={o}
            id={`mock-outcome-${o}`}
            name="mockOutcome"
            value={o}
            label={texts[o]}
            checked={o === 'success'}
          />
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{texts.methodLegend}</legend>
        {MOCK_FIELD_METHODS.map((m) => (
          <Radio
            key={m}
            id={`mock-method-${m}`}
            name="mockMethod"
            value={m}
            label={texts[m]}
            checked={m === 'card'}
          />
        ))}
      </fieldset>
      <div aria-live="polite" data-payment-error="">
        {error ? <p className={styles.fieldError}>{error}</p> : null}
      </div>
    </div>
  )
}
