import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import { instagramDmUrl } from '@/lib/data/contact'
import type { PublicOffer, TattooSettings } from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { tattooMailto } from '@/lib/tattoo/mailto'
import { daysUntilStart, offerDateBadge, offerState, offerTimeParts } from '@/lib/tattoo/offers'

import styles from './Tattoo.module.css'

// Angebotskarte (KONZEPT §9.5, DESIGN KO-20): Datums-Badge in Mansalva im gezeichneten Kreis („Sa 12.10.“, mehrtägig
// „12.–13.10.“), Art, Hinweis „läuft gerade“ bzw. „in X Tagen“, Titel, Text, Uhrzeit aus `startsAt`/`endsAt` (nur wenn
// nicht ganztägig), Ort (`locationNote`, sonst „Privatstudio in Berlin-{Bezirk}“, E-50), Preis-Info, Vorschaubilder der
// verknüpften Flash-Motive mit Link auf `R12#f-012`, Mail-Knopf (Angebots-Betreff) und DM-Knopf. Der Zustand wird beim
// Rendern aus der Uhr abgeleitet (kein gespeicherter Status); die Seite wird an Beginn/Ende neu erzeugt
// (`revalidateEndedOffers`).

export async function OfferCard({
  offer,
  locale,
  settings,
  now,
  headingLevel = 'h3',
  compact = false,
}: {
  offer: PublicOffer
  locale: Locale
  settings: TattooSettings
  now: Date
  headingLevel?: 'h2' | 'h3'
  /** Teaser (R11, Startseite): ohne Motive, Preis-Info und Knöpfe, Titel verlinkt R13. */
  compact?: boolean
}) {
  const [t, tContact] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.offers' }),
    getTranslations({ locale, namespace: 'contact' }),
  ])
  const Heading = headingLevel
  const state = offerState(offer, now)
  const time = offerTimeParts(offer, locale)
  const location =
    offer.locationNote ??
    (settings.studioDistrict ? tContact('studio', { district: settings.studioDistrict }) : null)
  const mailto = tattooMailto(
    settings.email,
    { kind: 'offer', title: offer.title, startsAt: offer.startsAt },
    locale,
  )
  const titleId = `offer-${offer.id}${compact ? '-teaser' : ''}-title`
  const r12 = localizedPath('R12', locale)

  return (
    <article
      className={`${styles.offerCard} ${compact ? styles.offerCompact : ''}`}
      aria-labelledby={titleId}
      data-offer-card={offer.id}
      data-offer-state={state}
    >
      <p className={styles.dateBadge} data-offer-date="">
        <span className="u-sr-only">{t('dateLabel')}: </span>
        <span className={styles.dateText}>{offerDateBadge(offer, locale)}</span>
      </p>
      <div className={styles.offerBody}>
        <p className={styles.offerMeta}>
          <span>{t(`types.${offer.type}`)}</span>
          <span aria-hidden="true"> · </span>
          <strong className={styles.offerState} data-offer-status="">
            {state === 'running'
              ? t('running')
              : t('startsIn', { days: daysUntilStart(offer, now) })}
          </strong>
        </p>
        <Heading id={titleId} className={styles.offerTitle}>
          {compact ? <a href={localizedPath('R13', locale)}>{offer.title}</a> : offer.title}
        </Heading>
        {compact ? null : <p className={styles.offerText}>{offer.description}</p>}
        <ul className={styles.offerFacts}>
          {time ? <li data-offer-time="">{t('time', time)}</li> : null}
          {location ? <li data-offer-location="">{location}</li> : null}
          {offer.priceNote && !compact ? <li data-offer-price="">{offer.priceNote}</li> : null}
        </ul>
        {!compact && offer.flashes.length > 0 ? (
          <div className={styles.offerFlash}>
            <h4 className={styles.offerFlashHeading}>{t('flashHeading')}</h4>
            <ul className={styles.offerFlashList}>
              {offer.flashes.map((f) => (
                <li key={f.number}>
                  <a href={`${r12}#${f.anchor}`} className={styles.offerFlashLink}>
                    <ResponsiveImage
                      media={f.image}
                      aspectRatio="4 / 5"
                      sizes="96px"
                      srcSizes={['thumb']}
                      className={styles.offerFlashImage}
                    />
                    <span className={styles.flashNumber}>{f.display}</span>
                    <span>{f.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!compact ? (
          <div className={styles.offerActions}>
            {mailto ? (
              <Button
                variant="secondary"
                href={mailto}
                icon="mail"
                data={{ 'data-offer-mail': '' }}
              >
                {t('mail')}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              href={instagramDmUrl(settings.instagramHandle)}
              rel="noopener noreferrer"
              icon="instagram"
              data={{ 'data-offer-dm': '' }}
            >
              {t('dm')}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
