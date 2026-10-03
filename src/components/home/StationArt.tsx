import React from 'react'

import { STATION_ART } from '@/art/stations'
import { Coco } from '@/components/Coco'
import { fallbackArtSvg, type WashToken } from '@/lib/seed/fallbackArt'

import styles from './Home.module.css'
import { PlanetMark } from './SpaceMarks'

// Stationszeichnung (DESIGN KO-21, §12.4): `src/art/stations/{stationId}.svg` (P8.14, `pnpm art:vectorize`), Tusche über
// `currentColor` (E-73); fehlt eine Datei, die Ersatzzeichnung (`fallbackArtSvg`, SEED-SPEC §4.3) bzw. für „Hallo“ und
// „Jutta & Coco“ Coco aus dem Sprite. Feste Box 4:5 (kein CLS), `aria-hidden` (reine Dekoration).

type Fallback = { key: string; wash: WashToken | null } | 'coco' | 'coco-planet'

const FALLBACK: Readonly<Record<string, Fallback>> = {
  hallo: 'coco',
  keramik: { key: 'ph:teller-01', wash: 'clay' },
  textil: { key: 'ph:cap-01', wash: 'pink' },
  zeichnungen: { key: 'ph:zeichnung-01', wash: 'sky' },
  schmuck: { key: 'ph:anhaenger-01', wash: 'mat' },
  tattoo: { key: 'ph:flash-01', wash: null },
  'jutta-und-coco': 'coco-planet',
}

const inlineSvg = (svg: string) =>
  svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ')

export function StationArt({ stationId, className }: { stationId: string; className?: string }) {
  const own = STATION_ART[stationId]
  const fallback = FALLBACK[stationId] ?? { key: 'ph:zeichnung-01', wash: 'clay' }
  const cls = [styles.art, className].filter(Boolean).join(' ')
  if (own) {
    return (
      <div
        className={cls}
        data-station-art={stationId}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: inlineSvg(own) }}
      />
    )
  }
  if (fallback === 'coco' || fallback === 'coco-planet') {
    return (
      <div className={`${cls} ${styles.artCoco}`} data-station-art="fallback" aria-hidden="true">
        {fallback === 'coco-planet' ? <PlanetMark className={styles.artPlanet} /> : null}
        <Coco pose="sitzen" size="xl" />
      </div>
    )
  }
  return (
    <div
      className={cls}
      data-station-art="fallback"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inlineSvg(fallbackArtSvg(fallback.key, fallback.wash)) }}
    />
  )
}
