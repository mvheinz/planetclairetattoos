import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Icon } from '@/components/icons/Icon'
import { ResponsiveImage, type MediaSizeName } from '@/components/media/ResponsiveImage'
import type { Locale } from '@/lib/enums'
import type { Media } from '@/payload-types'

import styles from './ProductGallery.module.css'

// Produktgalerie (DESIGN KO-09, KONZEPT §3.4 Nr. 1): Scroll-Snap-Leiste mit Fotos 4:5 (Fokuspunkt, `srcset` aus
// `card`/`detail`), Punkte + Zähler „2 / 5“, ab 768 px Knöpfe „vorheriges/nächstes Foto“ und Miniaturen. Ohne
// JavaScript sind alle Fotos per Scrollen erreichbar; jedes Foto ist ein Link auf die größte vorhandene Datei. Die
// Module `gallery` (Leiste) und `lightbox` (Vollbild-`<dialog>`) machen daraus Knöpfe, Tastatur und Zoom; Knöpfe und
// Miniaturen stehen bis dahin auf `hidden`. Erstes Foto = LCP: `fetchpriority="high"`, ohne `lazy`. Verkaufte Stücke:
// Fotos unverändert (nicht gedämpft).

export const GALLERY_SIZES = '(min-width: 768px) 36rem, 100vw'
const ZOOM_ORDER: readonly MediaSizeName[] = ['zoom', 'detail', 'card']

/** Größte vorhandene Datei für die Lightbox (`zoom`, sonst `detail`, `card`, Original). */
export function zoomSource(media: Media): { url: string; width?: number; height?: number } | null {
  for (const name of ZOOM_ORDER) {
    const s = media.sizes?.[name]
    if (s?.url) return { url: s.url, width: s.width ?? undefined, height: s.height ?? undefined }
  }
  return media.url
    ? { url: media.url, width: media.width ?? undefined, height: media.height ?? undefined }
    : null
}

export async function ProductGallery({
  images,
  title,
  locale,
}: {
  images: (number | Media)[] | null | undefined
  title: string
  locale: Locale
}) {
  const photos = (images ?? []).filter((m): m is Media => typeof m === 'object' && m !== null)
  const t = await getTranslations({ locale, namespace: 'shop.gallery' })
  const total = photos.length
  if (total === 0) {
    return (
      <div className={styles.gallery} data-gallery="" data-gallery-empty="">
        <ResponsiveImage
          media={null}
          aspectRatio="4 / 5"
          sizes={GALLERY_SIZES}
          srcSizes={['card']}
        />
      </div>
    )
  }
  const many = total > 1
  return (
    <section
      className={styles.gallery}
      aria-label={t('label', { title })}
      data-gallery=""
      data-behavior="gallery lightbox"
    >
      <div className={styles.viewport}>
        <ul
          className={styles.track}
          data-gallery-track=""
          tabIndex={0}
          aria-roledescription={t('roledescription')}
          aria-label={t('label', { title })}
        >
          {photos.map((media, i) => {
            const zoom = zoomSource(media)
            return (
              <li
                key={media.id}
                className={styles.slide}
                data-gallery-slide={i}
                aria-label={t('position', { n: i + 1, total })}
              >
                <a
                  className={styles.zoomLink}
                  href={zoom?.url ?? '#'}
                  data-zoom-src={zoom?.url}
                  data-zoom-w={zoom?.width}
                  data-zoom-h={zoom?.height}
                  aria-label={`${media.alt ?? ''} – ${t('zoom')}`}
                >
                  <ResponsiveImage
                    media={media}
                    aspectRatio="4 / 5"
                    sizes={GALLERY_SIZES}
                    srcSizes={['card', 'detail']}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : undefined}
                  />
                  <span className={styles.zoomHint} aria-hidden="true">
                    <Icon name="zoom" size={20} />
                    {t('zoom')}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        {many ? (
          <>
            <button
              type="button"
              className={`${styles.arrow} ${styles.prev}`}
              data-gallery-prev=""
              hidden
            >
              <Icon name="arrow-left" label={t('prev')} />
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.next}`}
              data-gallery-next=""
              hidden
            >
              <Icon name="arrow-right" label={t('next')} />
            </button>
          </>
        ) : null}
      </div>
      {many ? (
        <>
          <div className={styles.status}>
            <span className={styles.dots} aria-hidden="true">
              {photos.map((m, i) => (
                <span
                  key={m.id}
                  className={styles.dot}
                  data-gallery-dot={i}
                  data-active={i === 0 ? '' : undefined}
                />
              ))}
            </span>
            <span className={styles.counter} data-gallery-counter="">
              {`1 / ${total}`}
            </span>
          </div>
          <ul className={styles.thumbs} aria-label={t('thumbs')} data-gallery-thumbs="" hidden>
            {photos.map((media, i) => (
              <li key={media.id}>
                <button
                  type="button"
                  className={styles.thumb}
                  data-gallery-thumb={i}
                  aria-label={t('position', { n: i + 1, total })}
                  aria-current={i === 0 ? 'true' : undefined}
                >
                  <ResponsiveImage
                    media={media}
                    aspectRatio="4 / 5"
                    sizes="64px"
                    srcSizes={['thumb']}
                  />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <dialog className={styles.lightbox} aria-label={t('dialog', { title })} data-lightbox="">
        {/* Das `<img>` legt das Modul `lightbox` an (größte vorhandene Größe, Klasse aus `data-img-class`). */}
        <div className={styles.stage} data-lightbox-stage="" data-img-class={styles.zoomImg} />
        <p className={styles.lightboxCounter} data-lightbox-counter="" aria-live="polite" />
        <button type="button" className={styles.close} data-lightbox-close="">
          <Icon name="close" size={22} />
          {t('close')}
        </button>
      </dialog>
    </section>
  )
}
