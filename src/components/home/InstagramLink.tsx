import { getTranslations } from 'next-intl/server'
import React from 'react'

import { instagramUrl } from '@/lib/data/navigation'
import type { Locale } from '@/lib/routes/registry'

import styles from './InstagramLink.module.css'

// Instagram-Hinweis unter dem Schaukasten der Startseite (P13.3, U-42 – ändert U-15: Instagram darf zusätzlich hier stehen,
// weiterhin **kein Anfrageweg**, keine Direktnachricht). Einfacher Textlink auf das Profil mit einem **von Hand gezeichneten**
// Instagram-Zeichen in Tusche (abgerundetes Quadrat, Linse, Punkt; zittriger, offener Strich wie Juttas Linien, `currentColor`)
// – nicht das bunte Logo, keine Datei und keine Anfrage bei Instagram (nur Verweis). `rel="me"` kennzeichnet das eigene
// Profil; `noopener noreferrer` gibt keinen Verweis-Header mit.

/** Zittriger Tuschestrich (32er-Raster): Quadrat mit runden Ecken (offen, Enden überlappen), Linse, Punkt. */
const FRAME =
  'M10.5 27.9Q8 26.5 6.8 25.7Q5.6 24.8 4.8 23.5Q4 22.3 3.9 20.7Q3.9 19.1 3.7 17.6Q3.6 16.1 3.7 14.5Q3.9 13 4.2 11.6Q4.5 10.2 5 8.7Q5.5 7.3 6.6 6.3Q7.7 5.4 9.1 4.7Q10.4 4.1 11.9 3.8Q13.3 3.5 14.9 3.7Q16.5 3.9 18 3.9Q19.6 3.9 21 4.1Q22.5 4.4 23.7 5.2Q24.9 6.1 26 7.1Q27.1 8.1 27.6 9.5Q28.1 10.9 28.1 12.4Q28.2 14 28.3 15.5Q28.5 17.1 28.2 18.6Q27.9 20.1 27.6 21.5Q27.3 22.9 26.6 24.2Q25.8 25.5 24.5 26.3Q23.2 27.1 21.9 27.6Q20.6 28.2 19 28.3Q17.5 28.4 15.9 28.3Q14.4 28.1 12.8 28.2Q11.3 28.2 9.9 27.7Q8.6 27.1 7.4 26.2Q6.3 25.2 5.4 24.1L4.4 23'
const LENS =
  'M12.7 11.7Q14.9 10.5 16.2 10.6Q17.4 10.7 18.5 11.3Q19.5 12 20.2 12.9Q20.8 13.9 21.1 15.1Q21.5 16.2 21.3 17.4Q21.2 18.6 20.5 19.7Q19.8 20.7 18.6 21.3Q17.4 21.8 16.2 21.7Q15 21.7 13.9 21.1Q12.8 20.6 11.9 19.8Q11 18.9 10.6 17.8Q10.1 16.6 10.2 15.3Q10.4 14 11.2 13Q12 11.9 13.1 11.4Q14.3 10.9 15.5 10.7L16.7 10.6'
const DOT = 'M23.2 8.1q1.3-.4 1.6.8.2 1.2-1 1.5-1.2.2-1.5-.9-.2-1 .9-1.4z'

export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-instagram-glyph=""
    >
      <path strokeWidth="2" d={FRAME} />
      <path strokeWidth="1.8" d={LENS} />
      <path fill="currentColor" stroke="none" d={DOT} />
    </svg>
  )
}

export async function InstagramLink({ handle, locale }: { handle: string; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <p className={styles.instagram} data-home-instagram="">
      <a
        href={instagramUrl(handle)}
        rel="me noopener noreferrer"
        className={styles.link}
        aria-label={t('instagramLabel', { handle })}
      >
        <InstagramGlyph className={styles.glyph} />
        <span className={styles.handle}>@{handle}</span>
      </a>
    </p>
  )
}
