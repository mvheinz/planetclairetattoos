import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { Locale } from '@/lib/enums'

import styles from './Order.module.css'

// Sichtbarer Hinweis „Beispiel“ auf Danke- und Statusseite für Bestellungen/Kassen mit `seed = true` (SEED-SPEC §1.1).
export async function ExampleNote({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'order' })
  return (
    <p className={styles.example} data-example-note="">
      {t('example')}
    </p>
  )
}
