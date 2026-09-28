import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { HomeStation } from '@/components/home/HomeStation'
import styles from '@/components/home/Home.module.css'
import { PlanetMark } from '@/components/home/SpaceMarks'
import { Station } from '@/components/leash/Station'
import { EmptyState } from '@/components/ui/EmptyState'
import { getHomeView } from '@/lib/data/home'
import { getSiteNavigation, instagramUrl } from '@/lib/data/navigation'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { organizationJsonLd, serializeJsonLd } from '@/lib/seo/jsonld'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R01')

// R01 Startseite (KONZEPT §3.1, DESIGN KO-21/§11.4, Preset `journey`): Kopf-Station „Planet Claire“ (H1 mit
// Planet-Marke links vor dem Namen, Anker `orbit` für das Intro MI-10 – die Linie kreuzt so keinen Text) und danach die Stationen aus `pages:home` in fester Reihenfolge
// (Hallo, Keramik, Textil, Zeichnungen, Schmuck, Tattoo, Jutta & Coco). Die Tuschelinie verbindet sie beim Scrollen,
// Coco läuft an der Spitze mit den Posen der Stationen (`cocoPose` → `COCO_POSE_TO_SPRITE`). Ohne JavaScript ist alles
// lesbar (reines Server-HTML). Fehlt `home`: neutraler Leerzustand (DM-PAGE-01). Organization-JSON-LD (KONZEPT
// §3.0.5, ohne Adresse, E-50). Noch keine Produktkarten (W-33).
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [t, nav, home] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getSiteNavigation(locale),
    getHomeView(locale),
  ])
  const name = home?.name ?? t('title')

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

      {home && home.stations.length > 0 ? (
        <div className={styles.stations} data-home-stations="">
          {home.stations.map((station) => (
            <HomeStation key={station.stationId} station={station} locale={locale} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t('emptyTitle')}
          text={t('emptyText')}
          pose="kopfschief"
          action={{ href: localizedPath('R20', locale), label: t('emptyAction') }}
        />
      )}
    </div>
  )
}
