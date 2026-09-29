import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { StatusStep } from '@/lib/commerce/orderStatusLine'
import type { Locale } from '@/lib/enums'
import { formatBerlin } from '@/lib/time'

import styles from './Order.module.css'

// Status-Leine (DESIGN KO-16, R09): statische Tuschelinie mit Knoten – mobil senkrecht, ab 768 px waagerecht. Erledigt =
// gefüllter Knoten, aktuell = gefüllt mit gezeichnetem Kreis und fettem Label (`aria-current="step"`), kommend = Kontur.
// Geordnete Liste mit Text je Schritt (Zustand auch für Screenreader als Text); Widerruf/Erstattung/Storno als eigene
// Einträge hinter der Hauptlinie. Keine Animation.
export async function OrderStatusLine({ steps, locale }: { steps: StatusStep[]; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'orderStatus' })
  const date = (iso: string) =>
    formatBerlin(new Date(iso), locale === 'de' ? 'dd.MM.yyyy' : 'd MMM yyyy', locale)
  return (
    <ol className={styles.statusLine} data-order-status-line="">
      {steps.map((step) => (
        <li
          key={`${step.key}-${step.extra ? 'x' : 'm'}`}
          className={styles.step}
          data-step={step.key}
          data-state={step.state}
          data-extra={step.extra ? '' : undefined}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span className={styles.node} aria-hidden="true" />
          <span className={styles.stepText}>
            <span className={styles.stepLabel}>{t(`steps.${step.key}`)}</span>
            {step.at ? (
              <span className={styles.stepDate}>{t('stepAt', { date: date(step.at) })}</span>
            ) : null}
            {step.state === 'upcoming' ? (
              <span className="u-sr-only">({t('stepUpcoming')})</span>
            ) : step.state === 'done' ? (
              <span className="u-sr-only">({t('stepDone')})</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}
