'use client'

import React from 'react'

import { Coco } from '@/components/Coco'
import { KnotArt } from '@/components/errors/ErrorArt'
import styles from '@/components/errors/ErrorPages.module.css'
import type { ErrorTexts } from '@/components/errors/ErrorTexts'
import { Button } from '@/components/ui/Button'
import { localizedPath } from '@/lib/routes/paths'

// Inhalt der 500-Seite R29 (DESIGN KO-18) für `[locale]/error.tsx`. Next lädt Fehler-Boundaries mit jeder Seite; die
// Zeichnung (Pfadberechnung) und der Rest der Ansicht kommen deshalb erst, wenn die Fehlerseite wirklich gezeigt wird
// (Erstlade-Budget ARCHITEKTUR §7.7, P2.23). Beim Server-Rendering ist sie sofort vollständig im HTML.
export default function ServerErrorView({
  texts,
  onRetry,
}: {
  texts: ErrorTexts
  onRetry: () => void
}) {
  return (
    <div className={`u-container ${styles.page}`} data-server-error="">
      <div className={styles.tangle} aria-hidden="true">
        <KnotArt className={styles.knot} />
        <div className={styles.cocoSlot}>
          <Coco pose="kopfschief" size="xl" />
        </div>
      </div>
      <h1 className={styles.title}>{texts.serverErrorTitle}</h1>
      <p className={styles.text}>{texts.serverErrorText}</p>
      <div className={styles.actions}>
        <Button type="button" onClick={onRetry}>
          {texts.retry}
        </Button>
        <Button variant="link" href={localizedPath('R01', texts.locale)}>
          {texts.toHome}
        </Button>
      </div>
    </div>
  )
}
