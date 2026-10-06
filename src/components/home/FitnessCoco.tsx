import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'

// Fitness-Coco der Startseite (P12.5, U-09): Standbild einer Übung als <img> (feste Box 4:5, kein CLS, ≈ 3 KB, zählt
// nicht zum Inline-SVG der Startseite, PF-10). Das Verhaltensmodul `fitness-coco` holt nach dem `load` die Bildfolge und
// spielt die Endlosschleife (sieben Übungen + erschöpftes Liegen) auf einer Leinwand über dem Standbild; bei reduzierter
// Bewegung bleibt das Standbild. Tusche schwarz, Buntstift orange mit Papierkörnung (gestrichelt). Keine Beschriftung in
// der Zeichnung; Alt-Text DE/EN am Bild.

/** Ausgelieferte Bildfolge und Standbild (Version im Dateinamen, `pnpm art:fitness`). */
export const FITNESS_HREF = '/art/fitness-coco.v1.json'
export const FITNESS_STILL_HREF = '/art/fitness-still.v1.svg'

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
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG-Zeichnung aus public/art (Vektor, kein Raster zum Optimieren) */}
      <img
        className={styles.fitnessStill}
        data-fitness-still=""
        src={FITNESS_STILL_HREF}
        width={200}
        height={250}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <canvas className={styles.fitnessCanvas} data-fitness-canvas="" hidden />
    </div>
  )
}
