import React from 'react'

import { Icon, type IconName } from '@/components/icons/Icon'
import { translatorFor } from '@/i18n/translator'
import type { Locale } from '@/lib/enums'

import styles from './Badge.module.css'

// Badges (DESIGN KO-10): Höhe 28 px, Bricolage 500 14 px, `--r-badge`, Rand 1.5 px, Grund transparent (auf Fotos
// `--paper`). Hervorhebung, kein Ersatz: Der vollständige Pflichttext steht immer als Text auf der Seite.
// Zustand nie nur über Farbe – Icon und Text tragen die Bedeutung mit.
export const BADGE_KINDS = [
  'unique',
  'decorative',
  'foodSafe',
  'reserved',
  'secondHand',
  'smallParts',
] as const
export type BadgeKind = (typeof BADGE_KINDS)[number]

const ICONS: Record<BadgeKind, IconName | null> = {
  unique: 'star',
  decorative: 'plate-off',
  foodSafe: 'check',
  reserved: 'clock',
  secondHand: null,
  smallParts: 'warn',
}

export interface BadgeProps {
  kind: BadgeKind
  /** Sprache des Standardtexts (Übersetzer ohne Hook, auch in nicht hydriertem HTML – `StaticHtml`, P7). */
  locale: Locale
  /** Eigener Text (z. B. Produktseite „Gerade reserviert – schau in 30 Minuten nochmal“); sonst der Standardtext. */
  children?: React.ReactNode
  /** Lebensmittelecht: Link auf die Konformitätserklärung (R27 `#glaze-<id>`). */
  href?: string
  /** Auf einem Foto: Grund `--paper`. */
  onPhoto?: boolean
  /** Im Markup, aber verborgen (Live-Wechsel durch `product-status`, P3.11). */
  hidden?: boolean
  className?: string
}

export function Badge({
  kind,
  locale,
  children,
  href,
  onPhoto = false,
  hidden = false,
  className,
}: BadgeProps) {
  const t = translatorFor(locale, 'shop.badges')
  const icon = ICONS[kind]
  const classes = [styles.badge, styles[kind], onPhoto ? styles.onPhoto : '', className]
    .filter(Boolean)
    .join(' ')
  const content = (
    <>
      {icon ? <Icon name={icon} size={16} className={styles.icon} /> : null}
      <span>{children ?? t(kind)}</span>
    </>
  )
  return href ? (
    <a className={classes} href={href} data-badge={kind}>
      {content}
    </a>
  ) : (
    <span className={classes} data-badge={kind} hidden={hidden || undefined}>
      {content}
    </span>
  )
}
