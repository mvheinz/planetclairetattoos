import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { ContactLinks } from '@/components/content/ContactLinks'
import { RichTextContent } from '@/components/content/RichTextContent'
import { Station } from '@/components/leash/Station'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { getContactInfo } from '@/lib/data/contact'
import { getPublicPage } from '@/lib/data/pages'
import { isLocale, localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'
import type { Media, Page as PageDoc } from '@/payload-types'

import styles from './About.module.css'

export const generateMetadata = routeMetadata('R19')
export const revalidate = 3600

// R19 Über mich & Coco (KONZEPT §3.12, SEED-SPEC §13.2, DESIGN §9.7 Preset `about`), gekürzt nach U-48 (P13.9):
// H1 „Jutta & Coco“ mit kurzer Einleitung, das Foto von Jutta und Coco mit dem Text „Zu zweit“ und darunter „Sag
// etwas“ (Kontaktwege). Die Blöcke der Seite `about` erscheinen in ihrer Reihenfolge; Text-, Bild- und Galerie-Blöcke,
// die Jutta später in der Verwaltung ergänzt, werden weiter dargestellt – ohne gezeichnete Coco, ohne feste
// Kategorie-Aufrufe. Tuschelinie: zwei Stationen „Zu zweit“ → „Sag etwas“ mit Schlaufen right/left; Coco läuft ein
// Stück mit (Engine, Preset `about`). Bilder mit `showsPerson = jutta` erscheinen nur mit der Freigabe `ownerApproved`
// (R-181, P8.20, in `isMediaPubliclyVisible`); Kund:innen-Bilder nie. Fehlt die Seite: neutraler Leerzustand
// (DM-PAGE-01). Statisch, Tag `pages` (ISR).

type Block = NonNullable<PageDoc['layout']>[number]

/** Öffentlich zeigbar auf R19: sichtbar laut Media-Regel und keine Abbildung von Jutta ohne Freigabe (R-181). */
const showable = (m: number | Media | null | undefined): m is Media =>
  typeof m === 'object' && m !== null && isMediaPubliclyVisible(m)

/** Stationen der Linie: erster Bild-Text-Block („Zu zweit“) und die Kontaktwege („Sag etwas“). */
const STATIONS = {
  zuZweit: { id: 'zu-zweit', loop: 'right', pose: 'sitzen' },
  sagEtwas: { id: 'sag-etwas', loop: 'left', pose: 'kopfschief' },
} as const

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const raw = (await params).locale
  const locale: Locale = isLocale(raw) ? raw : 'de'
  setRequestLocale(locale)
  const [t, page, contact] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getPublicPage('about', locale),
    getContactInfo(),
  ])
  const blocks = page?.layout ?? []
  const firstImageText = blocks.find((b) => b.blockType === 'imageText') ?? null
  const contactBlock = blocks.find((b) => b.blockType === 'contactLinks') ?? null

  const renderBlock = (block: Block, index: number): React.ReactNode => {
    const key = block.id ?? `${block.blockType}-${index}`
    switch (block.blockType) {
      case 'richText':
        return (
          <section key={key} className={styles.section}>
            <RichTextContent data={block.content} />
          </section>
        )
      case 'imageText': {
        const image = showable(block.image) ? block.image : null
        const inner = (
          <>
            <div>
              <RichTextContent data={block.content} />
            </div>
            {image ? (
              <div className={styles.imageTextMedia}>
                <ResponsiveImage
                  media={image}
                  aspectRatio="4 / 5"
                  sizes="(min-width: 768px) 40vw, 100vw"
                  srcSizes={['thumb', 'card']}
                />
              </div>
            ) : null}
          </>
        )
        const className = `${styles.section} ${styles.imageText}`
        if (block === firstImageText)
          return (
            <Station
              key={key}
              id={STATIONS.zuZweit.id}
              as="section"
              loop={STATIONS.zuZweit.loop}
              pose={STATIONS.zuZweit.pose}
              className={className}
              attrs={{
                'data-image-position': block.imagePosition ?? 'left',
                'data-about-image-text': '',
              }}
            >
              {inner}
            </Station>
          )
        return (
          <section
            key={key}
            className={className}
            data-image-position={block.imagePosition ?? 'left'}
            data-about-image-text=""
          >
            {inner}
          </section>
        )
      }
      case 'imageGallery': {
        const images = (block.images ?? []).filter(showable).slice(0, 12)
        if (images.length === 0) return null
        return (
          <figure key={key} className={styles.gallery} data-about-gallery="">
            <ul className={styles.galleryGrid}>
              {images.map((m) => (
                <li key={m.id}>
                  <ResponsiveImage
                    media={m}
                    aspectRatio="4 / 5"
                    sizes="(min-width: 768px) 30vw, 45vw"
                    srcSizes={['thumb', 'card']}
                  />
                </li>
              ))}
            </ul>
            {block.caption ? (
              <figcaption className={styles.caption}>{block.caption}</figcaption>
            ) : null}
          </figure>
        )
      }
      case 'contactLinks': {
        const links = (
          <ContactLinks
            locale={locale}
            contact={contact}
            heading={block.heading}
            showEmail={block.showEmail}
            showDistrict={block.showDistrict}
            emailSubject={block.emailSubject}
          />
        )
        return block === contactBlock ? (
          <Station
            key={key}
            id={STATIONS.sagEtwas.id}
            loop={STATIONS.sagEtwas.loop}
            pose={STATIONS.sagEtwas.pose}
          >
            {links}
          </Station>
        ) : (
          <React.Fragment key={key}>{links}</React.Fragment>
        )
      }
      default:
        return null
    }
  }

  return (
    <div className={`u-container ${styles.page}`} data-about-page="">
      <header className={styles.head}>
        <h1>{page?.title || t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>
      {page ? (
        blocks.map(renderBlock)
      ) : (
        <EmptyState
          pose="sitzen"
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={{ href: localizedPath('R02', locale), label: t('emptyAction') }}
        />
      )}
    </div>
  )
}
