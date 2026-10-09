import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Icon } from '@/components/icons/Icon'
import type { Locale } from '@/lib/enums'

import styles from './ShareButton.module.css'

// Teilen-Knopf (U-61, P14.12) an Stückseiten und Flash-Motiven: „Teilen“ öffnet das Teilen-Menü des Geräts (Modul
// `share-button`, Web Share API); wo es das nicht gibt, steht „Link kopieren“ (Modul `copy-button`). Beide Knöpfe sind
// ohne JavaScript verborgen und werden erst nach dem Laden gebunden (nachgeladene Module, kein Erstlade-JS); keine
// Drittanbieter, keine Cookies. Die Rückmeldung („Link kopiert“) erscheint in der Live-Region daneben.

export async function ShareButton({
  url,
  title,
  text,
  locale,
  id,
  className,
}: {
  /** Absolute URL, die geteilt bzw. kopiert wird. */
  url: string
  title: string
  text?: string
  locale: Locale
  /** Eindeutiger Schlüssel je Seite (für die Live-Region), z. B. `f-012`. */
  id: string
  className?: string
}) {
  const t = await getTranslations({ locale, namespace: 'share' })
  const statusId = `share-status-${id}`
  return (
    <p className={className ? `${styles.share} ${className}` : styles.share} data-share="">
      <button
        type="button"
        className={styles.button}
        data-behavior="share-button"
        data-share-url={url}
        data-share-title={title}
        data-share-text={text}
        data-copied-text={t('copied')}
        data-copy-failed-text={t('failed', { url })}
        data-copy-status-id={statusId}
        hidden
      >
        <Icon name="external" size={16} />
        {t('button')}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.fallback}`}
        data-behavior="copy-button"
        data-share-fallback=""
        data-copy={url}
        data-copied-text={t('copied')}
        data-copy-failed-text={t('failed', { url })}
        data-copy-status-id={statusId}
        hidden
      >
        <Icon name="copy" size={16} />
        {t('copy')}
      </button>
      <span id={statusId} className={styles.status} role="status" aria-live="polite" />
    </p>
  )
}
