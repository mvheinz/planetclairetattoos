import { getTranslations } from 'next-intl/server'
import React from 'react'

import still from '@/art/fitness/still.json'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'

// Fitness-Coco der Startseite (P12.5, U-09): Standbild einer Übung als Server-HTML (feste Box 4:5, kein CLS, LCP
// unberührt – wenige KB Pfaddaten). Das Verhaltensmodul `fitness-coco` holt nach dem `load` die Bildfolge und spielt die
// Endlosschleife (sieben Übungen + erschöpftes Liegen); bei reduzierter Bewegung bleibt das Standbild. Tusche schwarz,
// Buntstift orange mit Papierkörnung (gestrichelt). Keine Beschriftung in der Zeichnung; Alt-Text DE/EN am Bild.

/** Ausgelieferte Bildfolge (Version im Dateinamen, `pnpm art:fitness`). */
export const FITNESS_HREF = '/art/fitness-coco.v1.json'

export async function FitnessCoco({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <div
      className={styles.fitness}
      data-behavior="fitness-coco"
      data-fitness-src={FITNESS_HREF}
      data-station-art="fitness"
      role="img"
      aria-label={t('fitnessAlt')}
    >
      <svg viewBox="0 0 200 250" focusable="false" aria-hidden="true">
        <path className={styles.fitnessPencil} data-fitness-pencil d={still.pencil} />
        <path className={styles.fitnessInk} data-fitness-ink d={still.ink} />
      </svg>
    </div>
  )
}
