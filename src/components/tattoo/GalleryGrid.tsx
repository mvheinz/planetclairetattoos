import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Icon } from '@/components/icons/Icon'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import galleryStyles from '@/components/shop/product/ProductGallery.module.css'
import type { PublicGalleryEntry } from '@/lib/data/tattoo'
import type { Locale } from '@/lib/routes/registry'

import styles from './Tattoo.module.css'

// Galerie „Fresh & healed“ (KONZEPT §9.2 R15, §9.7, DESIGN KO-20): Raster wie im Shop, ohne Preise und ohne Schnur.
// Nur Einträge, die `isPubliclyVisible` besteht (der Loader filtert). Jedes Foto ist ein Link auf die größte vorhandene
// Datei (ohne JavaScript); das Modul `lightbox` öffnet es im Vollbild mit Bildunterschrift. Angabe „3,5 Jahre
// verheilt“ aus `healedLabel` bzw. `healedDurationMonths`; Seed-Ausnahme im Vorschau-Modus mit Etikett „intern –
// Einwilligung fehlt“ (R-182).

type Translate = (key: string, values?: Record<string, string | number>) => string

/** „3,5 Jahre verheilt“ / „3.5 years healed“; eigene Angabe (`healedLabel`) hat Vorrang. */
export function healedText(entry: PublicGalleryEntry, locale: Locale, t: Translate): string | null {
  if (entry.kind !== 'healed') return null
  if (entry.healedLabel) return entry.healedLabel
  const months = entry.healedDurationMonths
  if (!months || months < 1) return null
  if (months < 12) return t('healedMonths', { months })
  const years = Math.round(months / 6) / 2
  if (years === 1) return t('healedYearOne')
  const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    maximumFractionDigits: 1,
  }).format(years)
  return t('healedYears', { years: formatted })
}

/** Größte vorhandene Datei für Link und Vollbild. */
function zoomOf(image: PublicGalleryEntry['image']) {
  for (const name of ['zoom', 'detail', 'card'] as const) {
    const s = image.sizes?.[name]
    if (s?.url) return { url: s.url, width: s.width ?? undefined, height: s.height ?? undefined }
  }
  return image.url
    ? { url: image.url, width: image.width ?? undefined, height: image.height ?? undefined }
    : null
}

export async function GalleryGrid({
  entries,
  locale,
  label,
  eagerCount = 2,
}: {
  entries: readonly PublicGalleryEntry[]
  locale: Locale
  label: string
  eagerCount?: number
}) {
  const t = await getTranslations({ locale, namespace: 'tattoo.gallery' })
  return (
    <section
      className={styles.gallery}
      aria-label={label}
      data-behavior="lightbox"
      data-tattoo-gallery=""
    >
      <ul className={styles.galleryGrid}>
        {entries.map((entry, i) => {
          const zoom = zoomOf(entry.image)
          const status = entry.kind === 'healed' ? healedText(entry, locale, t) : t('freshLabel')
          const caption = [entry.caption, entry.placement, status].filter(Boolean).join(' · ')
          return (
            <li key={entry.id}>
              <figure
                className={styles.galleryItem}
                data-gallery-entry={entry.id}
                data-gallery-kind={entry.kind}
                data-gallery-internal={entry.internal ? '' : undefined}
              >
                <a
                  className={styles.galleryLink}
                  href={zoom?.url ?? '#'}
                  data-zoom-src={zoom?.url}
                  data-zoom-w={zoom?.width}
                  data-zoom-h={zoom?.height}
                  data-zoom-caption={caption}
                  aria-label={`${entry.image.alt ?? caption} – ${t('open')}`}
                >
                  <ResponsiveImage
                    media={entry.image}
                    aspectRatio="4 / 5"
                    sizes="(min-width: 768px) 30vw, 45vw"
                    srcSizes={['thumb', 'card']}
                    loading={i < eagerCount ? 'eager' : 'lazy'}
                  />
                  {entry.internal ? (
                    <span className={styles.internal} data-gallery-internal-label="">
                      {t('internal')}
                    </span>
                  ) : null}
                </a>
                <figcaption className={styles.galleryCaption}>
                  {entry.caption ? <span>{entry.caption}</span> : null}
                  {status ? (
                    <span className={styles.galleryStatus} data-gallery-status="">
                      {status}
                    </span>
                  ) : null}
                  {entry.creditHandle ? (
                    <span className={styles.muted}>
                      {t('credit', { handle: entry.creditHandle.replace(/^@/, '') })}
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            </li>
          )
        })}
      </ul>
      <dialog className={galleryStyles.lightbox} aria-label={t('dialog')} data-lightbox="">
        <div
          className={galleryStyles.stage}
          data-lightbox-stage=""
          data-img-class={galleryStyles.zoomImg}
        />
        <p className={styles.lightboxCaption} data-lightbox-caption="" />
        <p className={galleryStyles.lightboxCounter} data-lightbox-counter="" aria-live="polite" />
        <button type="button" className={galleryStyles.close} data-lightbox-close="">
          <Icon name="close" size={22} />
          {t('close')}
        </button>
      </dialog>
    </section>
  )
}
