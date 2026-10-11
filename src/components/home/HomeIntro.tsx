import { getTranslations } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import type { HomeIntro as HomeIntroData } from '@/lib/data/home'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './Home.module.css'

// Oben auf der Startseite (U-50, P14.1; neu geordnet mit U-69/U-70, P15.2): links das Foto von Jutta und Coco im
// Goth-Fotorahmen wie alle Fotos (U-13) – ≈ 30 % größer als in P14 und mit Abstand zur Linie –, der kurze Text der früheren
// Station „Jutta & Coco“ mit dem Link „Mehr über uns“ (R19) steht mittig und größer unter Koko. Foto und Text kommen aus
// dem Block „Bild und Text“ der Startseite (Verwaltung → Seiten → Startseite), der Link ist fest.

/**
 * Das Foto lädt sofort und mit Vorrang: auf dem Handy ist es das LCP-Element (Lighthouse, P14.14 – ohne Vorrang LCP 2,2 s
 * statt ≈ 2,0 s); am Desktop teilt es sich den Vorrang mit Koko (U-54). Fehlt die Freigabe des Fotos (R-181), entfällt es.
 * `sizes` mobil 228 px statt der gezeigten 286 px (P15.2): bis Pixeldichte 1,75 (Lighthouse mobil) bleibt die 400-px-Fassung
 * das LCP-Bild (mit 286 px die 800-px-Fassung, LCP bis 2,4 s); ab Dichte 2 lädt das Handy ohnehin die 800-px-Fassung.
 */
export function HomeIntroPhoto({ intro }: { intro: HomeIntroData }) {
  if (!intro.image) return null
  return (
    <div className={styles.introPhoto}>
      <ResponsiveImage
        media={intro.image}
        aspectRatio="3 / 4"
        sizes="(min-width: 1100px) 300px, (min-width: 600px) 260px, 228px"
        srcSizes={['thumb', 'card']}
        loading="eager"
        fetchPriority="high"
      />
    </div>
  )
}

/** Der Text unter Koko (U-70): mittig, ≈ 40 % größer als Fließtext, darunter „Mehr über uns“. */
export async function HomeIntroText({ intro, locale }: { intro: HomeIntroData; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <div className={styles.introText} data-home-intro-text="">
      <RichTextContent data={intro.content} className={styles.introCopy} />
      <p className={styles.more}>
        <Button variant="secondary" href={localizedPath('R19', locale)}>
          {t('introMore')}
        </Button>
      </p>
    </div>
  )
}
