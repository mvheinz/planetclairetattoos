import React from 'react'

import { Button } from './Button'
import styles from './EmptyState.module.css'

// Leerer Zustand (DESIGN KO-17): Coco (`--coco-xl`, statisch) · Satz in Juttas Ton (H2) · ein Satz Erklärung · ein
// Weiter-Link als Sekundärknopf. Mittig, max. 36ch. Der Coco-Platz ist hier nur reserviert (feste Größe, kein CLS);
// das Sprite setzt P2.18 ein (`data-coco-pose`). Texte kommen vom Aufrufer (i18n bzw. CMS, P8).
export interface EmptyStateProps {
  title: React.ReactNode
  text?: React.ReactNode
  action?: { href: string; label: React.ReactNode }
  /** Coco-Pose laut Tabelle KO-17 (z. B. `sitzen`, `kopfschief`); ohne Pose kein Coco-Platz. */
  pose?: string
  /** Überschriften-Ebene (Standard `h2`). */
  headingLevel?: 'h2' | 'h3'
}

export function EmptyState({ title, text, action, pose, headingLevel = 'h2' }: EmptyStateProps) {
  const Heading = headingLevel
  return (
    <section className={styles.empty} data-empty-state="">
      {pose ? (
        <div className={styles.coco} data-coco-slot="" data-coco-pose={pose} aria-hidden="true" />
      ) : null}
      <Heading className={styles.title}>{title}</Heading>
      {text ? <p className={styles.text}>{text}</p> : null}
      {action ? (
        <Button variant="secondary" href={action.href}>
          {action.label}
        </Button>
      ) : null}
    </section>
  )
}
