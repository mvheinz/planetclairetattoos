import React from 'react'

import type { Locale } from '@/lib/enums'
import { formatMoney } from '@/lib/money'

import styles from './MoneyAmount.module.css'

// Neutrale Betragsanzeige (R-030) für Positionen, Versand und Summen: `formatMoney` mit `full` („53,90 €“). Nur ein
// Betrag – es gibt keinen Vergleichs-, Streich- oder Rabattpreis (V-20, R-033).
export function MoneyAmount({
  cents,
  locale,
  className,
}: {
  cents: number
  locale: Locale
  className?: string
}) {
  return (
    <span className={className ? `${styles.amount} ${className}` : styles.amount} data-money="">
      {formatMoney(cents, locale, { style: 'full' })}
    </span>
  )
}
