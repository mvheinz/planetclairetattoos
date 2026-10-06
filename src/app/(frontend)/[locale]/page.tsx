import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { ChairwomanKoko } from '@/components/home/ChairwomanKoko'
import { HomeStation } from '@/components/home/HomeStation'
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
import { getTattooSettings, listFlash, listOffers } from '@/lib/data/tattoo'
import { getShopDisplaySettings, taxSettingsFor } from '@/lib/data/shopSettings'
import { isLocale, localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { organizationJsonLd, serializeJsonLd } from '@/lib/seo/jsonld'
import { routeMetadata } from '@/lib/seo/metadata'
import { currentOrNextOffer } from '@/lib/tattoo/offers'

export const generateMetadata = routeMetadata('R01')

// ISR (ARCHITEKTUR §9.1): gezielt erneuert über die Tags `home`, `products`, `category:<key>`, `page:home` (P3.15),
// `flash` und `tattoo-offers` (Tattoo-Station, P7.3: Task `revalidateEndedOffers` an Beginn/Ende); Rückfall nach einer
// Stunde.
export const revalidate = 3600

// R01 Startseite (KONZEPT §3.1, DESIGN KO-21/§11.4, Preset `journey`): Kopf-Station „Planet Claire“ (H1 mit
// Planet-Marke links vor dem Namen, Anker `orbit` für das Intro MI-10 – die Linie kreuzt so keinen Text) und danach die Stationen aus `pages:home` in fester Reihenfolge
// (Hallo, Keramik, Textil, Zeichnungen, Schmuck, Tattoo, Jutta & Coco). Die Tuschelinie verbindet sie beim Scrollen,
// Coco läuft an der Spitze mit den Posen der Stationen (`cocoPose` → `COCO_POSE_TO_SPRITE`). Ohne JavaScript ist alles
// lesbar (reines Server-HTML). Fehlt `home`: neutraler Leerzustand (DM-PAGE-01). Organization-JSON-LD (KONZEPT
// §3.0.5, ohne Adresse, E-50). Kategorie-Stationen mit bis zu 4 Stücken (P3.12, `listStationProducts`, gecacht mit Tag
// `home`); Preis-Fußnote einmal pro Seite, Live-Zustand der Karten nach dem Laden (`product-status`). Die
// Tattoo-Station zeigt das laufende bzw. nächste Angebot und bis zu 3 freie Flash-Motive (P7.3, ohne Preise).
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const requested = (await params).locale
  if (!isLocale(requested)) notFound()
  const locale: Locale = requested
  setRequestLocale(locale)
  const [t, tCard, nav, home, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'shop.card' }),
    getSiteNavigation(locale),
    getHomeView(locale),
    getShopDisplaySettings(locale),
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
  const [offers, flash, tattooSettings] = hasTattoo
    ? await Promise.all([listOffers(locale), listFlash(locale), getTattooSettings(locale)])
    : [[], [], null]
  const now = new Date()
  const tattoo = tattooSettings
    ? {
        offer: currentOrNextOffer(offers, now),
        flash: flash.filter((f) => f.status === 'available').slice(0, 3),
        settings: tattooSettings,
        now,
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
      <div className={styles.heroRow}>
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
        {/* rechte Spalte: Koko (U-08); der Platz `data-slot="chairwoman"` nimmt später auch „on Tour“ (U-20) darunter auf */}
        <aside className={styles.heroSide} data-slot="chairwoman">
          <ChairwomanKoko locale={locale} />
        </aside>
      </div>

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
              instagramHref={instagramUrl(nav.instagramHandle)}
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
