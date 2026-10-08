import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { ChairwomanKoko } from '@/components/home/ChairwomanKoko'
import { HomeStation } from '@/components/home/HomeStation'
import { InstagramLink } from '@/components/home/InstagramLink'
import { TourDates } from '@/components/home/TourDates'
import styles from '@/components/home/Home.module.css'
import { PlanetMark } from '@/components/home/SpaceMarks'
import { Station } from '@/components/leash/Station'
import { PriceFootnote } from '@/components/shop/PriceFootnote'
import { StaticHtml } from '@/components/StaticHtml'
import { statusLabelAttrs } from '@/components/shop/statusLabels'
import { EmptyState } from '@/components/ui/EmptyState'
import { getHomeView } from '@/lib/data/home'
import { getSiteNavigation, instagramUrl } from '@/lib/data/navigation'
import { listStationProducts } from '@/lib/data/products'
import { getTattooSettings, listFlash } from '@/lib/data/tattoo'
import { listTourDates } from '@/lib/data/tour'
import { tourNow } from '@/lib/tour/now'
import { getShopDisplaySettings, taxSettingsFor } from '@/lib/data/shopSettings'
import { isLocale, localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { organizationJsonLd, serializeJsonLd } from '@/lib/seo/jsonld'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R01')

// ISR (ARCHITEKTUR §9.1): gezielt erneuert über die Tags `home`, `products`, `category:<key>`, `page:home` (P3.15),
// `flash` (Tattoo-Station) und `tour-dates` (Schaukasten oben rechts, P12.8/P13.3); Rückfall nach einer
// Stunde.
export const revalidate = 3600

// R01 Startseite (KONZEPT §3.1, DESIGN KO-21/§11.4, Preset `journey`): Kopf-Station „Planet Claire“ (H1 mit
// Planet-Marke links vor dem Namen, Anker `orbit` für das Intro MI-10 – die Linie kreuzt so keinen Text) und danach die Stationen aus `pages:home` in fester Reihenfolge
// (Keramik, Textil, Zeichnungen, Schmuck, Tattoo, Jutta & Coco; „Hallo“/„Komm näher.“ entfiel mit U-40). Die Tuschelinie verbindet sie beim Scrollen,
// Coco läuft an der Spitze mit den Posen der Stationen (`cocoPose` → `COCO_POSE_TO_SPRITE`). Ohne JavaScript ist alles
// lesbar (reines Server-HTML). Fehlt `home`: neutraler Leerzustand (DM-PAGE-01). Organization-JSON-LD (KONZEPT
// §3.0.5, ohne Adresse, E-50). Kategorie-Stationen mit bis zu 4 Stücken (P3.12, `listStationProducts`, gecacht mit Tag
// `home`); Preis-Fußnote einmal pro Seite, Live-Zustand der Karten nach dem Laden (`product-status`). Die
// Tattoo-Station zeigt bis zu 3 freie Flash-Motive (P7.3, ohne Preise).
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const requested = (await params).locale
  if (!isLocale(requested)) notFound()
  const locale: Locale = requested
  setRequestLocale(locale)
  const [t, tCard, tTour, nav, home, settings, tourItems] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'shop.card' }),
    getTranslations({ locale, namespace: 'home.tour' }),
    getSiteNavigation(locale),
    getHomeView(locale),
    getShopDisplaySettings(locale),
    listTourDates(locale),
  ])
  const name = home?.name ?? t('title')
  const shelves = await Promise.all(
    (home?.stations ?? []).map((s) =>
      // Ohne Datenbank: Station ohne Regal statt Fehlerseite (wie `getHomeView`).
      s.categories ? listStationProducts(s.categories, 4, locale).catch(() => null) : null,
    ),
  )
  const hasCards = shelves.some((p) => !!p?.length)
  const hasTattoo = (home?.stations ?? []).some((s) => s.stationId === 'tattoo')
  const [flash, tattooSettings] = hasTattoo
    ? await Promise.all([listFlash(locale), getTattooSettings(locale)])
    : [[], null]
  const tattoo = tattooSettings
    ? {
        flash: flash.filter((f) => f.status === 'available').slice(0, 3),
        settings: tattooSettings,
      }
    : null

  return (
    <div className={`u-container ${styles.home}`} data-home="">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(organizationJsonLd(instagramUrl(nav.instagramHandle))),
        }}
      />
      <header className={styles.hero} data-home-hero="">
        <h1 className={styles.title}>
          <Station
            id="planet-claire"
            as="span"
            pose="sitzen"
            loop="orbit"
            className={styles.planet}
          >
            <PlanetMark />
          </Station>
          <span>{name}</span>
        </h1>
        {home?.hero ? (
          <>
            <p className={styles.lede}>{home.hero.heading}</p>
            {home.hero.subheading ? <p className={styles.intro}>{home.hero.subheading}</p> : null}
          </>
        ) : (
          <p className={styles.lede}>{t('intro')}</p>
        )}
      </header>

      <aside className={styles.aside} aria-label={tTour('heading')} data-home-aside="">
        {/* oben rechts (U-42): Koko, Vorsitzende der Goth Dogs Berlin (U-08, U-41), direkt rechts daneben der schmale
            Schaukasten „Planet Claire on Tour“ (U-20) mit dem Instagram-Hinweis darunter; mobil untereinander */}
        <div className={styles.chairwomanSlot} data-slot="chairwoman">
          <ChairwomanKoko locale={locale} />
        </div>
        <div className={styles.tourCol} data-slot="tour">
          <TourDates items={tourItems} locale={locale} now={tourNow()} />
          <InstagramLink handle={nav.instagramHandle} locale={locale} />
        </div>
      </aside>

      <div className={styles.body}>
        {home && home.stations.length > 0 ? (
          // Stationen als statisches HTML (nicht hydriert, Lighthouse-TBT P7): reines Server-Markup, Bilder alle
          // `loading="lazy"`; Live-Zustand der Karten und Linie laufen über DOM-Module.
          <StaticHtml
            as="div"
            className={styles.stations}
            data-home-stations=""
            data-behavior={hasCards ? 'product-status' : undefined}
            {...(hasCards ? statusLabelAttrs(tCard) : {})}
          >
            {home.stations.map((station, i) => (
              <HomeStation
                key={station.stationId}
                station={station}
                locale={locale}
                products={shelves[i] ?? null}
                tattoo={station.stationId === 'tattoo' ? tattoo : null}
              />
            ))}
          </StaticHtml>
        ) : (
          <EmptyState
            title={t('emptyTitle')}
            text={t('emptyText')}
            pose="kopfschief"
            action={{ href: localizedPath('R20', locale), label: t('emptyAction') }}
          />
        )}
      </div>
      {hasCards ? (
        <PriceFootnote
          locale={locale}
          settings={taxSettingsFor(settings.taxMode)}
          at={new Date()}
          className={styles.footnote}
        />
      ) : null}
    </div>
  )
}
