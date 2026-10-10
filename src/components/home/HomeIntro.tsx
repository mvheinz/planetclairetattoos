import { getTranslations } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import type { HomeIntro as HomeIntroData } from '@/lib/data/home'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'

// Oben links auf der Startseite (U-50, P14.1): das Foto von Jutta und Coco – klein, im Goth-Fotorahmen wie alle Fotos
// (U-13) – und direkt darunter der kurze Text der früheren Station „Jutta & Coco“ mit dem Link „Mehr über uns“ (R19).
// Foto und Text kommen aus dem Block „Bild und Text“ der Startseite (Verwaltung → Seiten → Startseite), der Link ist fest.
// Das Foto lädt sofort und mit Vorrang: auf dem Handy ist es das LCP-Element (Lighthouse, P14.14 – ohne Vorrang LCP
// 2,2 s statt ≈ 2,0 s); am Desktop teilt es sich den Vorrang mit Koko (U-54, beide klein). Fehlt die Freigabe des Fotos
// (R-181), steht nur der Text da.
export async function HomeIntro({ intro, locale }: { intro: HomeIntroData; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <>
      {intro.image ? (
        <div className={styles.introPhoto}>
          <ResponsiveImage
            media={intro.image}
            aspectRatio="3 / 4"
            sizes="(min-width: 1100px) 230px, 220px"
            srcSizes={['thumb', 'card']}
            loading="eager"
            fetchPriority="high"
          />
        </div>
      ) : null}
      <div className={styles.introText}>
        <RichTextContent data={intro.content} className={styles.text} />
        <p className={styles.more}>
          <Button variant="secondary" href={localizedPath('R19', locale)}>
            {t('introMore')}
          </Button>
        </p>
      </div>
    </>
  )
}
