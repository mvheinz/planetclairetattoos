import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import styles from '@/components/tattoo/Tattoo.module.css'
import { OfferCard } from '@/components/tattoo/OfferCard'
import { TattooShell } from '@/components/tattoo/TattooShell'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'
import { EmptyState } from '@/components/ui/EmptyState'
import { instagramUrl } from '@/lib/data/navigation'
import { blocksOfType, getTattooPage, getTattooSettings, listOffers } from '@/lib/data/tattoo'
import { isOfferVisible } from '@/lib/tattoo/offers'

// R13 Angebote (KONZEPT §9.2, §9.5, DESIGN KO-20): Einleitung, Karten aller laufenden und kommenden Angebote nach
// Beginn, Kontakt-Block. Öffentlich nur `published` und `endsAt > jetzt` (Zugriffsregel + Filter im Loader + Filter beim
// Rendern); der Zustand („läuft gerade“, „in X Tagen“) wird aus `startsAt`/`endsAt` abgeleitet. Der Task
// `revalidateEndedOffers` erneuert die Seite an Beginn und Ende jedes Angebots und täglich ab 00:05 (R-171).
// Leerzustand „Gerade keine Aktion – Folge @planet.claire.tattoos …“ (Text aus `offersList.emptyText`, sonst i18n).

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R13')

export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  const [t, settings, page, all] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.offers' }),
    getTattooSettings(locale),
    getTattooPage(locale),
    listOffers(locale),
  ])
  const now = new Date()
  const offers = all.filter((o) => isOfferVisible(o, now))
  const block = blocksOfType(page, 'offersList')[0]

  return (
    <TattooShell locale={locale} routeId="R13" settings={settings} lead={<p>{t('intro')}</p>}>
      {offers.length > 0 ? (
        <section aria-labelledby="offers-heading" data-offers-list="">
          <h2 id="offers-heading" className="u-sr-only">
            {block?.heading || t('listHeading')}
          </h2>
          <ul className={styles.offerList}>
            {offers.map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} locale={locale} settings={settings} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          pose="kopfschief"
          title={t('emptyTitle')}
          text={block?.emptyText || t('emptyText', { handle: settings.instagramHandle })}
          action={{
            href: instagramUrl(settings.instagramHandle),
            label: t('emptyAction'),
            rel: 'noopener noreferrer',
          }}
        />
      )}
    </TattooShell>
  )
}
