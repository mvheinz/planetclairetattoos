import { getTranslations } from 'next-intl/server'
import React from 'react'

import { handLinePath } from '@/art/handLine'
import { Coco } from '@/components/Coco'
import { RichTextContent } from '@/components/content/RichTextContent'
import { LeashEndArt } from '@/components/errors/ErrorArt'
import styles from '@/components/errors/ErrorPages.module.css'
import { Station } from '@/components/leash/Station'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { getPublicPage } from '@/lib/data/pages'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { NotFoundMarker } from './notFoundState'

// R28 „Coco hat sich losgerissen“ (DESIGN KO-18, KONZEPT §3.17), Preset `lost`: Die Tuschelinie kommt vom Kopf
// (Aufhängepunkt `data-leash-anchor="start"`) herab und liegt in lockeren Schlingen (`coil`) am Boden; das Ende ist ein
// offener Karabiner mit leerem roten Geschirr. Am Horizont rennt Coco (24 px) einmal aus dem Bild; danach schwingt die
// Leine zweimal (Modul `lost`, MI-11). H1 fest im Code; darunter der Rich Text der Seite `not_found` aus dem CMS
// (Rückfall: „Diese Seite gibt es nicht (mehr).“); Links Start, Shop, Tattoo und das Nummernfeld „Du suchst ein Stück?“
// (KO-12): ein GET-Formular auf `/nr?nummer=…` (ohne JavaScript bedienbar), das auf `/nr/[nummer]` (R31) weiterleitet.
// Variante `home` („Dieses Stück hat schon ein Zuhause gefunden“, verkauft + ausgeblendet, R04): Mini-Preisschild
// „sold“ statt Karabiner, Coco sitzt daneben, kein Weglaufen; Links Shop und Archiv. `NotFoundMarker` stellt Preset und
// Route auf R28 (`lost`), auch wenn die 404 unter einer Registry-Route (z. B. R04) steht.

export type NotFoundVariant = 'lost' | 'home'

const LINKS: Record<NotFoundVariant, readonly string[]> = {
  lost: ['R01', 'R02', 'R11'],
  home: ['R02', 'R05'],
}
const HORIZON_PATH = handLinePath(29, { length: 1200, y: 4, amplitude: 1.4, step: 70 })

export async function NotFoundContent({
  locale,
  variant = 'lost',
  marker = true,
}: {
  locale: Locale
  variant?: NotFoundVariant
  /** `false` nur auf der QA-Seite `/qa/motion` (MI-11): kein globales 404-Preset, die Bühne bringt ihre Linie mit. */
  marker?: boolean
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
          {LINKS[variant].map((id) => (
            <li key={id}>
              <Button variant="secondary" href={localizedPath(id, locale)}>
                {tRoutes(id)}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      {variant === 'lost' ? (
        <form className={styles.numberForm} action="/nr" method="get" data-number-form="">
          <Field
            id="nr-nummer"
            name="nummer"
            label={t('numberLabel')}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            required
          />
          <Button type="submit" variant="secondary">
            {t('numberSubmit')}
          </Button>
        </form>
      ) : null}
      {marker ? <NotFoundMarker /> : null}
    </div>
  )
}
