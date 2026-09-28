import { useTranslations } from 'next-intl'
import React from 'react'

import { Icon } from '@/components/icons/Icon'

import styles from './Callout.module.css'

// Hinweis-Kasten (DESIGN KO-22): Grund `--paper-2`, linker Rand 3 px, `--r-card`. Varianten `info` (Rand `--stencil`),
// `warn` (Rand `--warn`, Icon) und `deviation` („Besonderheit dieses Stücks: …“ für abweichende Beschaffenheit, RECHT R-048,
// Rand `--fox-text`, Titel Bricolage 700). Zustand nie nur über Farbe: Icon bzw. Titel tragen die Bedeutung mit.
export type CalloutVariant = 'info' | 'warn' | 'deviation'

const ICONS = { info: 'info', warn: 'warn' } as const

export function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: CalloutVariant
  title?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTranslations('ui.callout')
  const heading = title ?? (variant === 'deviation' ? t('deviationTitle') : undefined)
  return (
    <div className={`${styles.callout} ${styles[variant]}`} role="note" data-callout={variant}>
      {variant !== 'deviation' ? (
        <Icon name={ICONS[variant]} size={22} className={styles.icon} />
      ) : null}
      <div className={styles.body}>
        {heading ? <p className={styles.title}>{heading}</p> : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
