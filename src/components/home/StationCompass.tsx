import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { HomeStation } from '@/lib/data/home'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'
import { PlanetMark, StarMark } from './SpaceMarks'

/** Anker einer Station der Startseite (Ziel des Kompasses, `HomeStation` setzt ihn an die `<section>`). */
export const stationAnchor = (stationId: string) => `station-${stationId}`

/**
 * Marke im Kompass: die Stationsmarke aus dem CMS (`ornament`), sonst abwechselnd Planet (ungerade) und Stern (gerade) –
 * so trägt jede Station ein Zeichen (U-52).
 */
export const compassMark = (
  station: Pick<HomeStation, 'ornament' | 'number'>,
): 'planet' | 'star' =>
  station.ornament === 'planet' || station.ornament === 'star'
    ? station.ornament
    : station.number % 2 === 1
      ? 'planet'
      : 'star'

// Stations-Kompass (U-52, P14.3): kleine Sprungleiste unter dem Kopf der Startseite – je Station die Planeten-/Sternmarke
// und der Name, reine Anker (`#station-…`), kein Skript. Ziele ≥ 44 × 44 px (A11Y), Tastatur über normale Links; die
// Stationen halten mit `scroll-margin-top` Abstand zur klebenden Kopfleiste.
export async function StationCompass({
  stations,
  locale,
}: {
  stations: readonly Pick<HomeStation, 'stationId' | 'heading' | 'ornament' | 'number'>[]
  locale: Locale
}) {
  if (stations.length < 2) return null
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <nav className={styles.compass} aria-label={t('compassLabel')} data-home-compass="">
      <ol className={styles.compassList}>
        {stations.map((s) => {
          const mark = compassMark(s)
          return (
            <li key={s.stationId}>
              <a
                className={styles.compassLink}
                href={`#${stationAnchor(s.stationId)}`}
                data-compass-target={s.stationId}
              >
                <span className={styles.compassMark} data-compass-mark={mark}>
                  {mark === 'planet' ? <PlanetMark /> : <StarMark />}
                </span>
                <span>{s.heading}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
