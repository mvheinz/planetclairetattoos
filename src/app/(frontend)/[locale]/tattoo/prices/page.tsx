import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { coil } from '@/components/leash/Station'
import { RichTextContent } from '@/components/content/RichTextContent'
import styles from '@/components/tattoo/Tattoo.module.css'
import { TattooPriceFootnote } from '@/components/tattoo/TattooPriceFootnote'
import { TattooShell } from '@/components/tattoo/TattooShell'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'
import { blocksOfType, getTattooPage, getTattooSettings } from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import { formatTattooPrice } from '@/lib/tattoo/price'

// R14 Preise (KONZEPT §9.2, §9.6, R-034): Mindestpreis aus `settings.tattoo.minPriceCents` („Mindestpreis 80 €*“),
// Preisrahmen eigener Ideen aus `customPriceFromCents`/`customPriceToCents` und `priceNote`, Flash-Hinweis mit Link auf
// R12, Anzahlung „vereinbaren wir persönlich, außerhalb der Website“ – ohne Verfall- oder Nicht-Erstattungs-Klauseln
// (V-24) –, Text des Blocks `priceInfo` der Seite `tattoo`, Fußnote `price.tattooNote` (Gesamtpreise, Kleinunternehmer)
// und der Kontakt-Block mit Betreff „Tattoo-Anfrage – eigene Idee“. Keine Online-Anzahlung (E-53).

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R14')

export default async function PricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  const [t, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.prices' }),
    getTattooSettings(locale),
    getTattooPage(locale),
  ])
  // Betrag ohne Sternchen; die Vorlage setzt es einmal hinter den Preis bzw. Preisrahmen („150–400 €*“).
  const money = (cents: number) => formatTattooPrice(cents, locale)
  const info = blocksOfType(page, 'priceInfo')
  const { minPriceCents: min, customPriceFromCents: from, customPriceToCents: to } = settings

  return (
    <TattooShell
      locale={locale}
      routeId="R14"
      settings={settings}
      lead={<p>{t('intro')}</p>}
      contactTopic={{ kind: 'custom' }}
    >
      <dl className={styles.priceList} data-tattoo-prices="">
        {min ? (
          <>
            <dt>{t('minHeading')}</dt>
            <dd data-price-min="" aria-describedby="tattoo-price-footnote">
              {t('minPrice', { amount: money(min) })}
            </dd>
          </>
        ) : null}
        <dt>{t('customHeading')}</dt>
        <dd data-price-custom="" aria-describedby="tattoo-price-footnote">
          {from && to
            ? t('customRange', { from: money(from), to: money(to) })
            : from
              ? t('customFrom', { from: money(from) })
              : t('customAsk')}
          {settings.priceNote ? (
            <span className={styles.muted} data-price-note="">
              {' '}
              {settings.priceNote}
            </span>
          ) : null}
        </dd>
        <dt>{t('flashHeading')}</dt>
        <dd>
          {t('flashText')} <a href={localizedPath('R12', locale)}>{t('flashLink')}</a>
        </dd>
        <dt>{t('depositHeading')}</dt>
        <dd data-price-deposit="">{t('depositText')}</dd>
      </dl>
      {info.map((b, i) => (
        <section
          key={b.id ?? i}
          className={`${styles.section} ${styles.prose}`}
          aria-label={b.heading ?? undefined}
          data-price-info=""
        >
          {b.heading ? (
            <h2 className={styles.sectionHeading} {...coil(`info-${i}`, i + 1)}>
              {b.heading}
            </h2>
          ) : null}
          {b.content ? <RichTextContent data={b.content} /> : null}
        </section>
      ))}
      <TattooPriceFootnote locale={locale} taxMode={settings.taxMode} />
    </TattooShell>
  )
}
