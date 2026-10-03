import React from 'react'

import { Glyph } from '@/components/icons/Glyph'
import { ICON_WARN } from '@/components/icons/icons.generated'

import styles from './FormAlert.module.css'

// Hinweis bzw. Fehlerzusammenfassung der Formulare R10 (Auftragsarbeiten) und R26 (Widerruf), DESIGN KO-12:
// `role="alert"`, Warn-Icon, optional Titel und Sprunglinks zu den Feldern. Erscheint erst nach dem Absenden – die
// Formulare laden das Modul daher per `React.lazy` nach (nicht im JS beim ersten Laden, Budget firstLoadJs); der Server
// rendert es ohne JavaScript direkt mit.

export interface FormAlertProps {
  /** `data-*`-Attribute für Tests (z. B. `data-error-summary`, `data-withdraw-notice`). */
  data: Record<`data-${string}`, string>
  title?: string
  links?: { href: string; text: React.ReactNode }[]
  children?: React.ReactNode
}

export function FormAlert({ data, title, links, children }: FormAlertProps) {
  return (
    <div className={styles.notice} role="alert" {...data}>
      <Glyph shape={ICON_WARN} size={22} className={styles.noticeIcon} />
      <div>
        {title ? <p className={styles.noticeTitle}>{title}</p> : null}
        {links ? (
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.text}</a>
              </li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>
    </div>
  )
}

export default FormAlert
