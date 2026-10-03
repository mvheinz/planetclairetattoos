import React from 'react'

import { Coco } from '@/components/Coco'
import type { SpritePose } from '@/leash/types'

import { Button } from './Button'
import styles from './EmptyState.module.css'

// Leerer Zustand (DESIGN KO-17): Coco (`--coco-xl`, statisch) · Satz in Juttas Ton (H2) · ein Satz Erklärung · ein
// Weiter-Link als Sekundärknopf. Mittig, max. 36ch. Coco in fester Box (`--coco-xl`, kein CLS beim Nachladen des
// Sprites), Frame A ohne Boil. Texte kommen vom Aufrufer (i18n bzw. CMS, P8).
export interface EmptyStateProps {
  title: React.ReactNode
  text?: React.ReactNode
  /** Weiter-Link; externe Ziele (Instagram) mit `rel="noopener noreferrer"` (R-139). */
  action?: { href: string; label: React.ReactNode; rel?: string }
  /** Coco-Pose laut Tabelle KO-17 (z. B. `sitzen`, `kopfschief`); ohne Pose keine Coco. */
  pose?: SpritePose
  /** Überschriften-Ebene (Standard `h2`). */
  headingLevel?: 'h2' | 'h3'
}

export function EmptyState({ title, text, action, pose, headingLevel = 'h2' }: EmptyStateProps) {
  const Heading = headingLevel
  return (
    <section className={styles.empty} data-empty-state="">
      {pose ? (
        <div className={styles.coco} data-coco-slot="" data-coco-pose={pose} aria-hidden="true">
          <Coco pose={pose} size="xl" />
        </div>
      ) : null}
      <Heading className={styles.title}>{title}</Heading>
      {text ? <p className={styles.text}>{text}</p> : null}
      {action ? (
        <Button variant="secondary" href={action.href} rel={action.rel}>
          {action.label}
        </Button>
      ) : null}
    </section>
  )
}
