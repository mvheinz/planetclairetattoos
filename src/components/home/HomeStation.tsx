import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Station } from '@/components/leash/Station'
import { Button } from '@/components/ui/Button'
import type { LoopKind } from '@/leash/types'
import type { HomeStation as HomeStationData } from '@/lib/data/home'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'
import { PlanetMark, StarMark } from './SpaceMarks'
import { StationArt } from './StationArt'

// Station der Startseite (DESIGN KO-21, §11.4): Stationsmarke (Planet/Stern, MI-12) + Kicker „Station 01“ (Plex Mono)
// · H2 (Mansalva) · Text · Stationszeichnung · Link „Alle …“. Noch ohne Produktkarten (W-33, P3). Anker der Tuschelinie
// (`data-leash-station`) mit Coco-Pose aus `cocoPose` und der Schlaufe laut Choreografie §11.4: am Kicker bzw. – für
// `lasso` (Keramik, ab 1200 px) und `contour` (Tattoo) – an der Stationszeichnung.

/** Schlaufe je Station (DESIGN §11.4); unbekannte Stationen wechseln rechts/links. */
export const STATION_LOOPS: Readonly<Record<string, LoopKind>> = {
  hallo: 'right',
  keramik: 'lasso',
  textil: 'left',
  zeichnungen: 'spiral',
  schmuck: 'right',
  tattoo: 'contour',
  'jutta-und-coco': 'left',
}

export const loopFor = (stationId: string, number: number): LoopKind =>
  STATION_LOOPS[stationId] ?? (number % 2 === 0 ? 'left' : 'right')

const onArt = (loop: LoopKind) => loop === 'lasso' || loop === 'contour'

export async function HomeStation({
  station,
  locale,
}: {
  station: HomeStationData
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const loop = loopFor(station.stationId, station.number)
  const headingId = `station-${station.stationId}`
  const kicker = (
    <p className={styles.kicker}>
      {station.ornament !== 'none' ? (
        <span className={styles.mark} data-station-mark={station.ornament}>
          {station.ornament === 'planet' ? <PlanetMark /> : <StarMark />}
        </span>
      ) : null}
      <span>{t('stationKicker', { number: String(station.number).padStart(2, '0') })}</span>
    </p>
  )
  const art = <StationArt stationId={station.stationId} />
  const pose = station.pose ?? undefined

  return (
    <section
      className={styles.station}
      aria-labelledby={headingId}
      data-home-station={station.stationId}
    >
      <div className={styles.stationText}>
        {onArt(loop) ? (
          kicker
        ) : (
          <Station id={station.stationId} pose={pose} loop={loop}>
            {kicker}
          </Station>
        )}
        <h2 id={headingId} className={styles.heading}>
          {station.heading}
        </h2>
        {station.text ? <p className={styles.text}>{station.text}</p> : null}
        {station.link ? (
          <p className={styles.more}>
            <Button
              variant="secondary"
              href={station.link.href}
              icon={station.link.external ? 'external' : undefined}
            >
              {station.link.label ?? t('stationMore')}
            </Button>
          </p>
        ) : null}
      </div>
      {onArt(loop) ? (
        <Station id={station.stationId} pose={pose} loop={loop} className={styles.artFrame}>
          {art}
        </Station>
      ) : (
        <div className={styles.artFrame}>{art}</div>
      )}
    </section>
  )
}
