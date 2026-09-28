import { useTranslations } from 'next-intl'
import React from 'react'

import { Icon } from '@/components/icons/Icon'

import styles from './PlaceholderBanner.module.css'

// Platzhalter-Band (R-002): „PLATZHALTER – nicht rechtsverbindlich“ / „PLACEHOLDER – not legally binding“ oben auf
// jeder Seite mit Platzhalter-Rechtstext (`origin !== 'lawyer'`). Die Seite rendert das Band, es steht nicht im
// Inhalt. Reines Server-HTML: ohne JavaScript sichtbar, nicht schließbar, nicht animiert.
export function PlaceholderBanner() {
  const t = useTranslations('legal')
  return (
    <p className={styles.banner} role="note" data-placeholder-banner="">
      <Icon name="warn" size={22} className={styles.icon} />
      <strong>{t('placeholderBanner')}</strong>
    </p>
  )
}
