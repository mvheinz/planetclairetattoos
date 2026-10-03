import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import styles from '@/components/tattoo/Tattoo.module.css'
import { FlashCard } from '@/components/tattoo/FlashCard'
import { GalleryGrid } from '@/components/tattoo/GalleryGrid'
import { OfferCard } from '@/components/tattoo/OfferCard'
import { TattooPriceFootnote } from '@/components/tattoo/TattooPriceFootnote'
import { LeashEnd, TattooShell } from '@/components/tattoo/TattooShell'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'
import { Button } from '@/components/ui/Button'
import {
  blocksOfType,
  galleryTeaser,
  getTattooPage,
  getTattooSettings,
  listFlash,
  listGallery,
  listOffers,
} from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import { currentOrNextOffer } from '@/lib/tattoo/offers'

// R11 Tattoo-Übersicht (KONZEPT §9.2, DESIGN KO-20, Preset `stencil`): H1 „Tattoo“, „Mein Stil“ (Textblöcke der Seite
// `tattoo`), laufendes bzw. nächstes Angebot als Karte (dieselbe Abfrage wie R13 und die Startseite, P7.3), 3 verfügbare
// Flash-Motive, 3 Galerie-Bilder (bevorzugt `healed`, nur sichtbare – `isPubliclyVisible`, P7.5), Links zu allen
// Unterseiten mit je einem Satz, Kontakt-Block. Leere Blöcke entfallen. Statisch mit gezielter Erneuerung über die Tags
// `flash`, `tattoo-offers`, `tattoo-gallery`, `page:tattoo`, `settings` (Task `revalidateEndedOffers` an Beginn/Ende).

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R11')

const SUBPAGES = ['R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18'] as const

export default async function TattooOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  const [t, tRoutes, settings, page, flash, offers, gallery] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.overview' }),
    getTranslations({ locale, namespace: 'common.routes' }),
    getTattooSettings(locale),
    getTattooPage(locale),
    listFlash(locale),
    listOffers(locale),
    listGallery(locale),
  ])
  const now = new Date()
  const style = blocksOfType(page, 'richText')
  const offer = currentOrNextOffer(offers, now)
  const available = flash.filter((f) => f.status === 'available').slice(0, 3)
  const photos = galleryTeaser(gallery, 3)

  return (
    <TattooShell
      locale={locale}
      routeId="R11"
      settings={settings}
      lead={<p>{t('lead')}</p>}
      leashEnd={available.length > 0 ? 'content' : 'header'}
    >
      {style.length > 0 ? (
        <section className={styles.section} aria-labelledby="tattoo-style" data-tattoo-style="">
          <h2 id="tattoo-style" className={styles.sectionHeading}>
            {t('styleHeading')}
          </h2>
          <div className={styles.prose}>
            {style.map((b, i) => (
              <RichTextContent key={b.id ?? i} data={b.content} />
            ))}
          </div>
        </section>
      ) : null}

      {offer ? (
        <section
          className={styles.section}
          aria-labelledby="tattoo-offer"
          data-tattoo-offer-teaser=""
        >
          <h2 id="tattoo-offer" className={styles.sectionHeading}>
            {t('offerHeading')}
          </h2>
          <OfferCard offer={offer} locale={locale} settings={settings} now={now} compact />
          <p className={styles.more}>
            <Button variant="secondary" href={localizedPath('R13', locale)}>
              {t('offersAll')}
            </Button>
          </p>
        </section>
      ) : null}

      {available.length > 0 ? (
        <section
          className={styles.section}
          aria-labelledby="tattoo-flash"
          data-tattoo-flash-teaser=""
        >
          <h2 id="tattoo-flash" className={styles.sectionHeading}>
            {t('flashHeading')}
          </h2>
          <ul className={styles.flashGrid}>
            {available.map((f, i) => (
              <li key={f.id}>
                <FlashCard flash={f} locale={locale} settings={settings} eager={i < 2} compact />
              </li>
            ))}
          </ul>
          <LeashEnd />
          <p className={styles.more}>
            <Button variant="secondary" href={localizedPath('R12', locale)}>
              {t('flashAll')}
            </Button>
          </p>
          <TattooPriceFootnote locale={locale} taxMode={settings.taxMode} />
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section
          className={styles.section}
          aria-labelledby="tattoo-gallery"
          data-tattoo-gallery-teaser=""
        >
          <h2 id="tattoo-gallery" className={styles.sectionHeading}>
            {t('galleryHeading')}
          </h2>
          <GalleryGrid
            entries={photos}
            locale={locale}
            label={t('galleryHeading')}
            eagerCount={0}
          />
          <p className={styles.more}>
            <Button variant="secondary" href={localizedPath('R15', locale)}>
              {t('galleryAll')}
            </Button>
          </p>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="tattoo-pages" data-tattoo-pages="">
        <h2 id="tattoo-pages" className={styles.sectionHeading}>
          {t('pagesHeading')}
        </h2>
        <ul className={styles.pageLinks}>
          {SUBPAGES.map((id) => (
            <li key={id}>
              <a href={localizedPath(id, locale)} data-tattoo-link={id}>
                {tRoutes(id)}
              </a>
              <p>{t(`pageHints.${id}`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </TattooShell>
  )
}
