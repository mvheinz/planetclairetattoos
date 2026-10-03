import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { Coco } from '@/components/Coco'
import { ContactLinks } from '@/components/content/ContactLinks'
import { RichTextContent } from '@/components/content/RichTextContent'
import { Station } from '@/components/leash/Station'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { listAllCategories } from '@/lib/data/categories'
import { getContactInfo } from '@/lib/data/contact'
import { instagramUrl } from '@/lib/data/navigation'
import { getPublicPage } from '@/lib/data/pages'
import { isLocale, localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'
import type { Media, Page as PageDoc } from '@/payload-types'

import styles from './About.module.css'

export const generateMetadata = routeMetadata('R19')
export const revalidate = 3600

// R19 Über mich & Coco (KONZEPT §3.12, SEED-SPEC §13.2, DESIGN §9.7 Preset `about`): H1 „Jutta & Coco“, dann die Blöcke
// der Seite `about` in ihrer Reihenfolge – Text über Jutta, „Wie ich zeichne“ (Bild und Text), Coco (Text und
// Coco-Zeichnung), Bilder aus Werkstatt und Skizzenbuch, „Was ich mache“ (Kategorien, Tattoo, Auftragsarbeiten) und die
// Kontaktwege mit Instagram (`rel="noopener noreferrer"`, R-139). Tuschelinie: drei Stationen Jutta → Coco → Werkstatt
// mit Schlaufen right/left/right; Coco läuft ein Stück mit (Engine, Preset `about`). Bilder mit `showsPerson = jutta`
// erscheinen nicht, bis es die Freigabe `ownerApproved` gibt (R-181, P8.20); Kund:innen-Bilder nie (Media-Sichtbarkeit).
// Fehlt die Seite: neutraler Leerzustand mit den festen Wegen (DM-PAGE-01). Statisch, Tag `pages` (ISR).

type Block = NonNullable<PageDoc['layout']>[number]
type BlockOf<T extends Block['blockType']> = Extract<Block, { blockType: T }>

/** Öffentlich zeigbar auf R19: sichtbar laut Media-Regel und keine Abbildung von Jutta ohne Freigabe (R-181). */
const showable = (m: number | Media | null | undefined): m is Media =>
  typeof m === 'object' && m !== null && isMediaPubliclyVisible(m) && m.showsPerson !== 'jutta'

/** Stationen der Linie: erster Text = Jutta, Text mit Coco = Coco, „Was ich mache“ = Werkstatt. */
const STATIONS = {
  jutta: { loop: 'right', pose: 'sitzen' },
  coco: { loop: 'left', pose: 'kopfschief' },
  werkstatt: { loop: 'right', pose: 'schnueffeln' },
} as const

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const raw = (await params).locale
  const locale: Locale = isLocale(raw) ? raw : 'de'
  setRequestLocale(locale)
  const [t, page, contact, categories] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getPublicPage('about', locale),
    getContactInfo(),
    listAllCategories(locale),
  ])
  const blocks = page?.layout ?? []
  const richTexts = blocks.filter((b): b is BlockOf<'richText'> => b.blockType === 'richText')
  // Der Coco-Abschnitt ist der zweite Textblock (SEED-SPEC §13.2), sonst keiner.
  const cocoText = richTexts[1] ?? null
  const instagram = contact.instagramHandle ? instagramUrl(contact.instagramHandle) : null

  const whatLinks = (heading: string, keys: readonly string[] | null) => {
    const shown = categories.filter(
      (c) => c.key !== 'sonstiges' && (!keys || keys.length === 0 || keys.includes(c.key)),
    )
    return (
      <Station
        id="werkstatt"
        as="section"
        loop={STATIONS.werkstatt.loop}
        pose={STATIONS.werkstatt.pose}
        className={styles.section}
      >
        <h2 className={styles.sectionHeading}>{heading}</h2>
        <ul className={styles.links} data-about-what="">
          {shown.map((c) => (
            <li key={c.key}>
              <Button variant="secondary" href={localizedPath('R03', locale, { slug: c.slug })}>
                {c.name}
              </Button>
            </li>
          ))}
          <li>
            <Button variant="secondary" href={localizedPath('R02', locale)}>
              {t('whatShop')}
            </Button>
          </li>
          <li>
            <Button variant="secondary" href={localizedPath('R11', locale)}>
              {t('whatTattoo')}
            </Button>
          </li>
          <li>
            <Button variant="secondary" href={localizedPath('R10', locale)}>
              {t('whatCommissions')}
            </Button>
          </li>
        </ul>
      </Station>
    )
  }

  const renderBlock = (block: Block, index: number): React.ReactNode => {
    const key = block.id ?? `${block.blockType}-${index}`
    switch (block.blockType) {
      case 'richText': {
        const first = block === richTexts[0]
        const coco = block === cocoText
        if (coco)
          return (
            <Station
              key={key}
              id="coco"
              as="section"
              loop={STATIONS.coco.loop}
              pose={STATIONS.coco.pose}
              className={styles.coco}
            >
              <div className={styles.cocoArt} data-about-coco="">
                <Coco pose="sitzen" size="xl" />
              </div>
              <RichTextContent data={block.content} />
            </Station>
          )
        if (first)
          return (
            <Station
              key={key}
              id="jutta"
              as="section"
              loop={STATIONS.jutta.loop}
              pose={STATIONS.jutta.pose}
              className={styles.section}
            >
              <RichTextContent data={block.content} />
            </Station>
          )
        return (
          <section key={key} className={styles.section}>
            <RichTextContent data={block.content} />
          </section>
        )
      }
      case 'imageText': {
        const image = showable(block.image) ? block.image : null
        return (
          <section
            key={key}
            className={`${styles.section} ${styles.imageText}`}
            data-image-position={block.imagePosition ?? 'left'}
            data-about-image-text=""
          >
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
      case 'categoryTeaser':
        return (
          <React.Fragment key={key}>
            {whatLinks(block.heading || t('whatHeading'), block.categories ?? null)}
          </React.Fragment>
        )
      case 'contactLinks':
        return (
          <ContactLinks
            key={key}
            locale={locale}
            contact={contact}
            heading={block.heading}
            showEmail={block.showEmail}
            showInstagram={block.showInstagram}
            showDistrict={block.showDistrict}
            emailSubject={block.emailSubject}
          />
        )
      default:
        return null
    }
  }

  const hasWhat = blocks.some((b) => b.blockType === 'categoryTeaser')

  return (
    <div className={`u-container ${styles.page}`} data-about-page="">
      <header className={styles.head}>
        <h1>{page?.title || t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>
      {page ? (
        <>
          {blocks.map(renderBlock)}
          {hasWhat ? null : whatLinks(t('whatHeading'), null)}
        </>
      ) : (
        <>
          <EmptyState
            pose="sitzen"
            title={t('emptyTitle')}
            text={t('emptyText')}
            action={{ href: localizedPath('R02', locale), label: t('emptyAction') }}
          />
          {whatLinks(t('whatHeading'), null)}
        </>
      )}
      {instagram ? (
        <p>
          <a href={instagram} rel="noopener noreferrer" data-about-instagram="">
            {t('instagram')}
          </a>
        </p>
      ) : null}
    </div>
  )
}
