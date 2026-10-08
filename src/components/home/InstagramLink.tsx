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
  'M10.5 27.9Q6.8 25.7 4.8 23.5Q3.9 20.7 3.7 17.6Q3.7 14.5 4.2 11.6Q5 8.7 6.6 6.3Q9.1 4.7 11.9 3.8Q14.9 3.7 18 3.9Q21 4.1 23.7 5.2Q26 7.1 27.6 9.5Q28.1 12.4 28.3 15.5Q28.2 18.6 27.6 21.5Q26.6 24.2 24.5 26.3Q21.9 27.6 19 28.3Q15.9 28.3 12.8 28.2Q9.9 27.7 7.4 26.2L5.4 24.1L4.4 23'
const LENS =
  'M12.7 11.7Q16.2 10.6 18.5 11.3Q20.2 12.9 21.1 15.1Q21.3 17.4 20.5 19.7Q18.6 21.3 16.2 21.7Q13.9 21.1 11.9 19.8Q10.6 17.8 10.2 15.3Q11.2 13 13.1 11.4L15.5 10.7L16.7 10.6'
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
