import { getTranslations } from 'next-intl/server'
import React from 'react'

import { ICON_MAIL } from '@/components/icons/icons.generated'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import type { PublicFlash, TattooSettings } from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { tattooMailto } from '@/lib/tattoo/mailto'
import { formatTattooPrice } from '@/lib/tattoo/price'

import styles from './Tattoo.module.css'
import { TakenStamp } from './TakenStamp'
import { TATTOO_PRICE_FOOTNOTE_ID } from './TattooPriceFootnote'

// Flash-Karte (KONZEPT §9.3, DESIGN KO-20): Zeichnung (Grund `--paper-field`; die Karte ist eine Rasterzelle der
// Tuschelinie, `data-leash-anchor="tag"`: Kringel zwischen den Zeilen, nie um die Karte, U-07a), Nummer `F-012` (Plex Mono), Titel, Größe „ca. 9 cm“ + Hinweis, Preis als Text mit Sternchen
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
  photoHref = null,
}: {
  flash: PublicFlash
  locale: Locale
  settings: TattooSettings
  headingLevel?: 'h2' | 'h3'
  eager?: boolean
  /** Teaser (R11): ohne Anfrage-Knöpfe, Link auf die Karte in R12. */
  compact?: boolean
  /** U-56: Link auf ein sichtbares Galerie-Foto dieses Motivs („Schon gestochen – Foto ansehen“). */
  photoHref?: string | null
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
      data-leash-anchor="tag"
    >
      <div className={styles.flashDrawing}>
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
      </div>
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
        {photoHref && !compact ? (
          <p className={styles.flashPhoto}>
            <a href={photoHref} data-flash-photo="">
              {t('photo')}
            </a>
          </p>
        ) : null}
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
          </div>
        ) : null}
      </div>
    </article>
  )
}
