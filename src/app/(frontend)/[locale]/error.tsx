'use client'

import { useLocale, useTranslations } from 'next-intl'
import React, { useEffect } from 'react'

import { Coco } from '@/components/Coco'
import { KnotArt } from '@/components/errors/ErrorArt'
import styles from '@/components/errors/ErrorPages.module.css'
import { enterPageError } from '@/components/layout/pageError'
import { Button } from '@/components/ui/Button'
import { localizedPath } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/routes/registry'

// R29 „Hoppla – die Leine hat sich verheddert“ (DESIGN KO-18, KONZEPT §3.17): statisches Knäuel aus 3 Schlingen,
// Coco `kopfschief` (xl, Frame A, ohne Boil), Knopf „Nochmal versuchen“ und Link zur Startseite. Das Fehler-Boundary
// liegt im Layout von `[locale]`: Kopf und Fußbereich (inkl. „Vertrag widerrufen“, R-011/R-090) bleiben stehen.
// Keine Animation: Die Seite meldet sich als Fehlerzustand an (`pageError`) – kein Preset, keine Linien-Engine,
// `body[data-page-error]` schaltet Übergänge im Inhalt ab. „Nochmal versuchen“ nutzt `retry()` (Next 16.3: lädt die
// Daten neu), sonst `reset()`.
export default function ErrorPage({
  reset,
  retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  retry?: () => void
}) {
  const t = useTranslations('errors')
  const requested = useLocale()
  const locale: Locale = (LOCALES as readonly string[]).includes(requested)
    ? (requested as Locale)
    : DEFAULT_LOCALE
  useEffect(() => enterPageError(), [])

  return (
    <div className={`u-container ${styles.page}`} data-server-error="">
      <div className={styles.tangle} aria-hidden="true">
        <KnotArt className={styles.knot} />
        <div className={styles.cocoSlot}>
          <Coco pose="kopfschief" size="xl" />
        </div>
      </div>
      <h1 className={styles.title}>{t('serverErrorTitle')}</h1>
      <p className={styles.text}>{t('serverErrorText')}</p>
      <div className={styles.actions}>
        <Button type="button" onClick={() => (retry ?? reset)()}>
          {t('retry')}
        </Button>
        <Button variant="link" href={localizedPath('R01', locale)}>
          {t('toHome')}
        </Button>
      </div>
    </div>
  )
}
