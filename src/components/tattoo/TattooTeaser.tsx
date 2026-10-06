import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import type { PublicFlash, PublicOffer, TattooSettings } from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { OfferCard } from './OfferCard'
import styles from './Tattoo.module.css'

// Tattoo-Station der Startseite (KONZEPT §3.1 Nr. 7): laufendes bzw. nächstes Angebot als Datums-Karte (dieselbe
// Abfrage wie R11/R13, P7.3) und bis zu 3 verfügbare Flash-Motive als kleine Bilder mit Link auf `R12#f-012` (ohne
// Preis – die Preise mit Fußnote stehen auf R12). Ohne Angebot bzw. ohne freie Motive entfällt der jeweilige Teil.

export interface TattooTeaserData {
  offer: PublicOffer | null
  flash: PublicFlash[]
  settings: TattooSettings
  now: Date
}

export async function TattooTeaser({ data, locale }: { data: TattooTeaserData; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'tattoo.overview' })
  if (!data.offer && data.flash.length === 0) return null
  const r12 = localizedPath('R12', locale)
  return (
    <div className={styles.teaser} data-tattoo-teaser="">
      {data.offer ? (
        <OfferCard
          offer={data.offer}
          locale={locale}
          settings={data.settings}
          now={data.now}
          headingLevel="h3"
          compact
        />
      ) : null}
      {data.flash.length > 0 ? (
        <ul className={styles.offerFlashList} aria-label={t('flashHeading')}>
          {data.flash.map((f) => (
            <li key={f.id}>
              <a
                href={`${r12}#${f.anchor}`}
                className={styles.offerFlashLink}
                data-teaser-flash={f.display}
              >
                <ResponsiveImage
                  media={f.image}
                  aspectRatio="4 / 5"
                  sizes="96px"
                  srcSizes={['thumb']}
                  frameSize="thumb"
                  className={styles.offerFlashImage}
                />
                <span className={styles.flashNumber} data-stamp="">
                  {f.display}
                </span>
                <span>{f.title}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
