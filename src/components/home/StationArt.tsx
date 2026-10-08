import React from 'react'

import { STATION_ART } from '@/art/stations'
import { Coco } from '@/components/Coco'
import { fallbackArtSvg, type WashToken } from '@/lib/seed/fallbackArt'

import styles from './Home.module.css'
import { PlanetMark } from './SpaceMarks'

// Stationszeichnung (DESIGN KO-21, §12.4): `src/art/stations/{stationId}.svg` (P8.14, `pnpm art:vectorize`), Tusche über
// `currentColor` (E-73); fehlt eine Datei, die Ersatzzeichnung (`fallbackArtSvg`, SEED-SPEC §4.3) bzw. für
// „Jutta & Coco“ Coco aus dem Sprite. Feste Box 4:5 (kein CLS), `aria-hidden` (reine Dekoration).

type Fallback = { key: string; wash: WashToken | null } | 'coco-planet'

const FALLBACK: Readonly<Record<string, Fallback>> = {
  keramik: { key: 'ph:teller-01', wash: 'clay' },
  textil: { key: 'ph:cap-01', wash: 'pink' },
  zeichnungen: { key: 'ph:zeichnung-01', wash: 'sky' },
  schmuck: { key: 'ph:anhaenger-01', wash: 'mat' },
  tattoo: { key: 'ph:flash-01', wash: null },
  'jutta-und-coco': 'coco-planet',
}

// Inline im HTML braucht das `<svg>` kein `xmlns` (PF-10: SVG-Bytes der Startseite)
const inlineSvg = (svg: string) =>
  svg
    .replace(' xmlns="http://www.w3.org/2000/svg"', '')
    .replace('<svg ', '<svg aria-hidden="true" ')

// „Jutta & Coco“ zeigt Coco `sitzen` aus dem Sprite (DESIGN §12.4), kein zweites Inline-Abbild derselben
// Zeichnung im HTML (PF-10: SVG-Bytes der Startseite ≤ 60 KB).
const SPRITE_STATIONS: ReadonlySet<string> = new Set(['jutta-und-coco'])

export function StationArt({ stationId, className }: { stationId: string; className?: string }) {
  const own = SPRITE_STATIONS.has(stationId) ? undefined : STATION_ART[stationId]
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
  if (fallback === 'coco-planet') {
    return (
      <div
        className={`${cls} ${styles.artCoco}`}
        data-station-art={SPRITE_STATIONS.has(stationId) ? stationId : 'fallback'}
        aria-hidden="true"
      >
        <PlanetMark className={styles.artPlanet} />
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
