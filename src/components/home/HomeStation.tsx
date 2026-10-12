import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ICON_EXTERNAL } from '@/components/icons/icons.generated'
import { Station } from '@/components/leash/Station'
import { ProductCard } from '@/components/shop/ProductCard'
import { TattooTeaser, type TattooTeaserData } from '@/components/tattoo/TattooTeaser'
import { Button } from '@/components/ui/Button'
import type { LoopKind } from '@/leash/types'
import { commissionHref, objectTypeForProduct } from '@/lib/commission/link'
import type { HomeStation as HomeStationData } from '@/lib/data/home'
import type { PublicProduct } from '@/lib/data/products'
import type { ProductCategory } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'
import { freshFor, type FreshContext } from '@/lib/shop/fresh'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'
import { PlanetMark, StarMark } from './SpaceMarks'
import { StationArt } from './StationArt'

/** Anker einer Station der Startseite (`#station-…`, z. B. für Links von außen; die Sprungleiste entfiel mit U-75). */
export const stationAnchor = (stationId: string) => `station-${stationId}`

// Station der Startseite (DESIGN KO-21, §11.4): Stationsmarke (Planet/Stern, MI-12) + Kicker „Station 01“ (Plex Mono)
// · H2 (Spectral) · Text · Stationszeichnung · Link „Alle …“. Kategorie-Stationen (P3.12) zeigen darunter bis zu 4 Karten
// (KO-07 ohne Schnur, Schild `pinned` am Kartenfuß, Fotos `lazy`) und danach „Alle {Kategorie}“ → R03; ohne sichtbare
// Stücke den Leerzustand ohne „Alle …“ (keine leeren Seiten, V-11 a): Zeichnungen → „Zeichnung auf Anfrage“ (Formular
// R10 mit Vorauswahl „Zeichnung“), sonst „Ins Archiv“, wenn dort Stücke der Kategorie wohnen, und andernfalls „Auf
// Anfrage“ (KONZEPT §3.1). Anker der Tuschelinie
// (`data-leash-station`) mit Coco-Pose aus `cocoPose` und der Schlaufe laut Choreografie §11.4: am Kicker bzw. – für
// `lasso` (Keramik, Schmuck, ab 1200 px) und `contour` (Textil, Tattoo) – an der Stationszeichnung.

/** Schlaufe je Station (DESIGN §11.4); unbekannte Stationen wechseln rechts/links. */
export const STATION_LOOPS: Readonly<Record<string, LoopKind>> = {
  keramik: 'lasso',
  // U-44: Coco läuft auf der Startseite um mehr Zeichnungen: Textil (immer), Schmuck (Lasso ab 1200 px; mehr
  // Umrundungen sprengten das SVG-Budget der Startseite, PF-10)
  textil: 'contour',
  zeichnungen: 'spiral',
  schmuck: 'lasso',
  tattoo: 'contour',
}

export const loopFor = (stationId: string, number: number): LoopKind =>
  STATION_LOOPS[stationId] ?? (number % 2 === 0 ? 'left' : 'right')

const onArt = (loop: LoopKind) => loop === 'lasso' || loop === 'contour'

export async function HomeStation({
  station,
  locale,
  products = null,
  tattoo = null,
  archiveCategories = [],
  freshCtx = null,
}: {
  station: HomeStationData
  locale: Locale
  /** Tattoo-Station (KONZEPT §3.1 Nr. 7): bis zu 3 freie Flash-Motive (P7.3). */
  tattoo?: TattooTeaserData | null
  /** Karten der Kategorie-Station (`listStationProducts`); `null` bei Stationen ohne Stücke (Tattoo). */
  products?: PublicProduct[] | null
  /** Kategorien mit Stücken im Archiv (`listArchiveCategoryKeys`) – Ziel des Leerzustands (V-11). */
  archiveCategories?: readonly ProductCategory[]
  /** Stempel „frisch im Shop“ auf den Karten (V-60). */
  freshCtx?: FreshContext | null
}) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const loop = loopFor(station.stationId, station.number)
  const anchor = stationAnchor(station.stationId)
  const headingId = `${anchor}-title`
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
  const emptyShelf = shelf && products.length === 0
  const allLink =
    station.link && !emptyShelf ? (
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

  return (
    <section
      id={anchor}
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
                    fresh={freshFor(product, freshCtx)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <StationEmpty
              stationId={station.stationId}
              categories={station.categories ?? []}
              archiveCategories={archiveCategories}
              locale={locale}
            />
          )}
          {allLink}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Leerzustand einer Kategorie-Station (V-11 a): nie ein Weg ins Leere. Zeichnungen → „Zeichnung auf Anfrage“ (R10 mit
 * Vorauswahl), Kategorien mit Archiv-Stücken → „Ins Archiv“, sonst → „Auf Anfrage“ (R10, Vorauswahl wo eindeutig).
 */
async function StationEmpty({
  stationId,
  categories,
  archiveCategories,
  locale,
}: {
  stationId: string
  categories: readonly ProductCategory[]
  archiveCategories: readonly ProductCategory[]
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const first = categories[0]
  const kind =
    stationId === 'zeichnungen' || categories.includes('zeichnung')
      ? 'drawing'
      : categories.some((c) => archiveCategories.includes(c))
        ? 'archive'
        : 'request'
  const href =
    kind === 'archive'
      ? localizedPath('R05', locale)
      : commissionHref(locale, {
          objectType:
            kind === 'drawing' ? 'zeichnung' : first ? objectTypeForProduct(first) : undefined,
        })
  const text = {
    drawing: [t('stationEmptyDrawing'), t('stationDrawingRequest')],
    archive: [t('stationEmpty'), t('stationArchive')],
    request: [t('stationEmptyRequest'), t('stationRequest')],
  }[kind]
  return (
    <p className={styles.empty} data-station-empty={kind}>
      <span>{text[0]}</span>
      <Button variant="secondary" href={href} data={{ 'data-station-empty-action': kind }}>
        {text[1]}
      </Button>
    </p>
  )
}
