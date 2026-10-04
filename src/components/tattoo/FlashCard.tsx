import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ICON_MAIL, ICON_INSTAGRAM } from '@/components/icons/icons.generated'
import { Station } from '@/components/leash/Station'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import { instagramDmUrl } from '@/lib/data/contact'
import type { PublicFlash, TattooSettings } from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { flashDmSnippet, tattooMailto } from '@/lib/tattoo/mailto'
import { formatTattooPrice } from '@/lib/tattoo/price'

import styles from './Tattoo.module.css'
import { TakenStamp } from './TakenStamp'
import { TATTOO_PRICE_FOOTNOTE_ID } from './TattooPriceFootnote'

// Flash-Karte (KONZEPT §9.3, DESIGN KO-20): Zeichnung (Grund `--paper-field`, Kontur der Tuschelinie über den
// Stations-Anker `contour`), Nummer `F-012` (Plex Mono), Titel, Größe „ca. 9 cm“ + Hinweis, Preis als Text mit Sternchen
// („120 €*“, kein Preisschild, R-034), Badge „einmalig“/„wiederholbar“. Verfügbar: „Per Mail anfragen“ (Betreff
// „Flash-Anfrage F-012 – {Titel}“), „Per DM anfragen“ und der kopierbare Baustein „F-012 – {Titel}“; vergeben: Stempel
// „vergeben“ in `--stencil`, Text „Schon vergeben – …“, keine Anfrage-Knöpfe. Anker `#f-012`. Hover/Fokus:
// `--shadow-stencil` ohne Übergang (MI-14). Ohne JavaScript vollständig lesbar.

export async function FlashCard({
  flash,
  locale,
  settings,
  headingLevel = 'h3',
  eager = false,
  compact = false,
}: {
  flash: PublicFlash
  locale: Locale
  settings: TattooSettings
  headingLevel?: 'h2' | 'h3'
  eager?: boolean
  /** Teaser (R11): ohne Anfrage-Knöpfe, Link auf die Karte in R12. */
  compact?: boolean
}) {
  const t = await getTranslations({ locale, namespace: 'tattoo.flash' })
  const Heading = headingLevel
  const available = flash.status === 'available'
  const titleId = `${flash.anchor}${compact ? '-teaser' : ''}-title`
  const mailto = available
    ? tattooMailto(
        settings.email,
        { kind: 'flash', number: flash.number, title: flash.title },
        locale,
      )
    : null
  const snippetId = `${flash.anchor}-snippet`
  const size = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    maximumFractionDigits: 1,
  }).format(flash.sizeCm)

  return (
    <article
      id={compact ? undefined : flash.anchor}
      className={styles.flashCard}
      aria-labelledby={titleId}
      data-flash-card={flash.display}
      data-flash-status={flash.status}
    >
      <Station
        id={`${flash.anchor}${compact ? '-teaser' : ''}`}
        loop="contour"
        className={styles.flashDrawing}
      >
        <ResponsiveImage
          media={flash.image}
          aspectRatio={
            flash.image?.width && flash.image?.height
              ? `${flash.image.width} / ${flash.image.height}`
              : '4 / 5'
          }
          sizes="(min-width: 768px) 30vw, 45vw"
          srcSizes={['thumb', 'card']}
          loading={eager ? 'eager' : 'lazy'}
          className={styles.flashImage}
        />
        {!available ? <TakenStamp number={flash.number} label={t('taken')} /> : null}
      </Station>
      <div className={styles.flashBody}>
        <p className={styles.flashMeta}>
          <span className={styles.flashNumber} data-flash-number="" data-stamp="">
            {flash.display}
          </span>
          <span className={styles.badge} data-flash-kind={flash.repeatable ? 'repeatable' : 'once'}>
            {flash.repeatable ? t('repeatable') : t('once')}
          </span>
        </p>
        <Heading id={titleId} className={styles.flashTitle}>
          {compact ? (
            <a href={`${localizedPath('R12', locale)}#${flash.anchor}`}>{flash.title}</a>
          ) : (
            flash.title
          )}
        </Heading>
        <p className={styles.flashSize}>
          {t('size', { size })}
          {flash.sizeNote ? ` · ${flash.sizeNote}` : null}
        </p>
        <p
          className={styles.flashPrice}
          data-flash-price=""
          aria-describedby={TATTOO_PRICE_FOOTNOTE_ID}
        >
          <span className="u-sr-only">{t('price')}: </span>
          {formatTattooPrice(flash.priceCents, locale)}
          <span className={styles.star} aria-hidden="true">
            *
          </span>
        </p>
        {available ? (
          <p className={styles.statusBadge} data-flash-available="">
            {t('statusAvailable')}
          </p>
        ) : (
          <p className={styles.takenText} data-flash-taken="">
            <span className="u-sr-only">{t('taken')}: </span>
            {t('takenText')}
          </p>
        )}
        {available && !compact ? (
          <div className={styles.flashActions}>
            {mailto ? (
              <Button
                variant="secondary"
                href={mailto}
                icon={ICON_MAIL}
                data={{ 'data-flash-mail': '' }}
              >
                {t('mail')}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              href={instagramDmUrl(settings.instagramHandle)}
              rel="noopener noreferrer"
              icon={ICON_INSTAGRAM}
              data={{ 'data-flash-dm': '' }}
            >
              {t('dm')}
            </Button>
            <p className={styles.snippet}>
              <span id={snippetId} className={styles.snippetText} data-flash-snippet="">
                {flashDmSnippet(flash.number, flash.title)}
              </span>{' '}
              <button
                type="button"
                className={styles.copy}
                data-behavior="copy-button"
                data-copy={flashDmSnippet(flash.number, flash.title)}
                data-copy-select={snippetId}
                data-copied-text={t('copied')}
                data-copy-failed-text={t('copyFailed')}
                data-copy-status-id={`${snippetId}-status`}
                aria-describedby={snippetId}
                hidden
              >
                {t('copy')}
              </button>
              <span
                id={`${snippetId}-status`}
                className={styles.copyStatus}
                role="status"
                aria-live="polite"
              />
            </p>
            <p className={styles.snippetHint}>{t('snippetHint')}</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}
