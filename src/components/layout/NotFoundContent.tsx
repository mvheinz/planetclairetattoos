import { getTranslations } from 'next-intl/server'
import React from 'react'

import { handLinePath } from '@/art/handLine'
import { Coco } from '@/components/Coco'
import { RichTextContent } from '@/components/content/RichTextContent'
import { LeashEndArt } from '@/components/errors/ErrorArt'
import styles from '@/components/errors/ErrorPages.module.css'
import { Station } from '@/components/leash/Station'
import { Button } from '@/components/ui/Button'
import { getPublicPage } from '@/lib/data/pages'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

// R28 „Coco hat sich losgerissen“ (DESIGN KO-18, KONZEPT §3.17), Preset `lost`: Die Tuschelinie kommt vom Kopf
// (Aufhängepunkt `data-leash-anchor="start"`) herab und liegt in lockeren Schlingen (`coil`) am Boden; das Ende ist ein
// offener Karabiner mit leerem roten Geschirr. Am Horizont rennt Coco (24 px) einmal aus dem Bild; danach schwingt die
// Leine zweimal (Modul `lost`, MI-11). H1 fest im Code; darunter der Rich Text der Seite `not_found` aus dem CMS
// (Rückfall: „Diese Seite gibt es nicht (mehr).“); Links Start, Shop, Tattoo. Das Nummernfeld kommt mit R31 (P3).
// Variante `home` („Dieses Stück hat schon ein Zuhause gefunden“, verkauft + ausgeblendet) ist vorbereitet (P3):
// Preisschild „sold“ statt Karabiner, Coco sitzt daneben, kein Weglaufen.

export type NotFoundVariant = 'lost' | 'home'

const LINKS = ['R01', 'R02', 'R11'] as const
const HORIZON_PATH = handLinePath(29, { length: 1200, y: 4, amplitude: 1.4, step: 70 })

export async function NotFoundContent({
  locale,
  variant = 'lost',
}: {
  locale: Locale
  variant?: NotFoundVariant
}) {
  const [t, tRoutes, page] = await Promise.all([
    getTranslations({ locale, namespace: 'errors' }),
    getTranslations({ locale, namespace: 'common.routes' }),
    variant === 'lost' ? getPublicPage('not_found', locale) : Promise.resolve(null),
  ])
  const richText = (page?.layout ?? []).flatMap((b) => (b.blockType === 'richText' ? [b] : []))

  return (
    <div
      className={`u-container ${styles.page}`}
      data-not-found=""
      data-variant={variant}
      data-behavior={variant === 'lost' ? 'lost' : undefined}
    >
      <div className={styles.scene} aria-hidden="true">
        <span className={styles.hang} data-leash-anchor="start" />
        <div className={styles.horizonLine}>
          <svg width="1200" height="8" viewBox="0 0 1200 8" focusable="false">
            <path d={HORIZON_PATH} />
          </svg>
        </div>
        <Station id={variant} loop="coil" className={styles.coil} />
        {variant === 'lost' ? (
          <>
            <LeashEndArt className={styles.end} />
            <div className={styles.horizonClip}>
              <Coco
                pose="rennen"
                size="horizon"
                className={styles.horizonCoco}
                data={{ 'data-lost-coco': '' }}
              />
            </div>
          </>
        ) : (
          <>
            <span className={`${styles.end} ${styles.tag}`} data-sold-tag="">
              {t('soldStamp')}
            </span>
            <Coco pose="sitzen" size="xl" className={styles.homeCoco} />
          </>
        )}
      </div>

      <h1 className={styles.title}>{variant === 'lost' ? t('notFoundTitle') : t('homeTitle')}</h1>
      {richText.length > 0 ? (
        <div className={styles.text} data-not-found-text="cms">
          {richText.map((b, i) => (
            <RichTextContent key={b.id ?? i} data={b.content} />
          ))}
        </div>
      ) : (
        <p className={styles.text} data-not-found-text="fallback">
          {variant === 'lost' ? t('notFoundText') : t('homeText')}
        </p>
      )}
      <nav aria-label={t('linksLabel')}>
        <ul className={styles.links}>
          {LINKS.map((id) => (
            <li key={id}>
              <Button variant="secondary" href={localizedPath(id, locale)}>
                {tRoutes(id)}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
