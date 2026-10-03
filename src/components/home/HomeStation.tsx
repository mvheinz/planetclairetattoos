import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ICON_EXTERNAL } from '@/components/icons/icons.generated'
import { Station } from '@/components/leash/Station'
import { ProductCard } from '@/components/shop/ProductCard'
import { TattooTeaser, type TattooTeaserData } from '@/components/tattoo/TattooTeaser'
import { Button } from '@/components/ui/Button'
import type { LoopKind } from '@/leash/types'
import type { HomeStation as HomeStationData } from '@/lib/data/home'
import type { PublicProduct } from '@/lib/data/products'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'
import { PlanetMark, StarMark } from './SpaceMarks'
import { StationArt } from './StationArt'

// Station der Startseite (DESIGN KO-21, §11.4): Stationsmarke (Planet/Stern, MI-12) + Kicker „Station 01“ (Plex Mono)
// · H2 (Mansalva) · Text · Stationszeichnung · Link „Alle …“. Kategorie-Stationen (P3.12) zeigen darunter bis zu 4 Karten
// (KO-07 ohne Schnur, Schild `pinned` am Kartenfuß, Fotos `lazy`) und danach „Alle {Kategorie}“ → R03; ohne sichtbare
// Stücke den Leerzustand „Gerade ist hier nichts …“ mit Link aufs Archiv (KONZEPT §3.1). Anker der Tuschelinie
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
  products = null,
  tattoo = null,
  instagramHref = null,
}: {
  station: HomeStationData
  locale: Locale
  /** Tattoo-Station (KONZEPT §3.1 Nr. 7): laufendes/nächstes Angebot und bis zu 3 freie Flash-Motive (P7.3). */
  tattoo?: TattooTeaserData | null
  /** Karten der Kategorie-Station (`listStationProducts`); `null` bei Stationen ohne Stücke (Hallo, Tattoo, …). */
  products?: PublicProduct[] | null
  /** Station „Jutta & Coco“ (KONZEPT §3.1): neben „Mehr über uns“ (R19) auch Auftragsarbeiten (R10) und Instagram. */
  instagramHref?: string | null
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
  const shelf = station.categories !== null && products !== null
  const allLink = station.link ? (
    <p className={shelf ? styles.all : styles.more} data-station-all={shelf ? '' : undefined}>
      <Button
        variant="secondary"
        href={station.link.href}
        icon={station.link.external ? ICON_EXTERNAL : undefined}
      >
        {station.link.label ??
          (shelf && station.categoryName
            ? t('stationAll', { category: station.categoryName })
            : t('stationMore'))}
      </Button>
    </p>
  ) : null
  const juttaLinks =
    station.stationId === 'jutta-und-coco' ? (
      <ul className={styles.moreLinks} data-station-links="">
        <li>
          <Button variant="secondary" href={localizedPath('R10', locale)}>
            {t('stationCommissions')}
          </Button>
        </li>
        {instagramHref ? (
          <li>
            <Button
              variant="secondary"
              href={instagramHref}
              rel="noopener noreferrer"
              icon={ICON_EXTERNAL}
            >
              {t('stationInstagram')}
            </Button>
          </li>
        ) : null}
      </ul>
    ) : null

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
        {tattoo ? <TattooTeaser data={tattoo} locale={locale} /> : null}
        {shelf ? null : allLink}
        {juttaLinks}
      </div>
      {onArt(loop) ? (
        <Station id={station.stationId} pose={pose} loop={loop} className={styles.artFrame}>
          {art}
        </Station>
      ) : (
        <div className={styles.artFrame}>{art}</div>
      )}
      {shelf ? (
        <div className={styles.shelf} data-station-shelf="">
          {products.length > 0 ? (
            <ul
              className={styles.cards}
              data-behavior="price-tag-swing"
              aria-label={t('stationProducts', { station: station.heading })}
            >
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    locale={locale}
                    tag="pinned"
                    lazy
                    stampSlot={false}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty} data-station-empty="">
              <span>{t('stationEmpty')}</span>
              <Button variant="secondary" href={localizedPath('R05', locale)}>
                {t('stationArchive')}
              </Button>
            </p>
          )}
          {allLink}
        </div>
      ) : null}
    </section>
  )
}
