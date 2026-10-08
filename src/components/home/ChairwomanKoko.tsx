import { getTranslations } from 'next-intl/server'
import React from 'react'

import koko from '@/art/koko/koko.json'
import type { Locale } from '@/lib/routes/registry'

import styles from './Koko.module.css'

// „Koko, Vorsitzende der Goth Dogs Berlin“ (P12.6 U-08, P13.2 U-41): Juttas T-Shirt-Malerei, freigestellt und gesäubert
// (`python3 scripts/art/koko-cutout.py`) als Büste: Kopf, Narrenkappe, Bommeln, spitzer Fellkragen und darunter der Ansatz
// der orangen Brust mit weißem Brustfleck, unten ein gemalter Abschlussbogen (ohne Beine, Knochenkreuz, Schrift, Shirt). Das
// Bild ist ein <img> (WebP mit Alpha, zählt nicht zum Inline-SVG der Startseite, PF-10). Augäpfel und Lidstriche sind
// Juttas Original (unregelmäßig, zittrige Tusche); nur die beiden gemalten Pupillen sind mit dem Augenweiß übermalt.
// **Nur die Pupillen sind animiert**: je Auge ein getupftes Oval in Größe und Lage der gemalten Pupille als kleines
// SVG-Vieleck darüber, beschnitten auf den gemalten Augapfel-Umriss; es wechselt in reinem CSS endlos schnell und ruhig zwischen links und rechts wechselt, mit langen
// Pausen dazwischen (kein Skript, kein Timer – nichts kann anhalten); bei „weniger Bewegung“ stehen sie still im Blick
// nach links (= das Original). Feste Box (kein CLS), Alt-Text DE/EN. Platz `data-slot="chairwoman"` der Startseite.

/** Ausgelieferte Zeichnung (Version im Dateinamen, `python3 scripts/art/koko-cutout.py`). */
export const KOKO_HREF = '/art/koko.v3.webp'

const pts = (list: number[][]) => list.map((p) => p.join(',')).join(' ')
const eyes = [
  { id: 'l', ...koko.eyes.l },
  { id: 'r', ...koko.eyes.r },
]

export async function ChairwomanKoko({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <div className={styles.koko} data-chairwoman="" role="img" aria-label={t('chairwomanAlt')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fertig skaliertes WebP aus public/art, feste Maße */}
      <img
        className={styles.drawing}
        src={KOKO_HREF}
        width={koko.w}
        height={koko.h}
        alt=""
        decoding="async"
      />
      <svg
        className={styles.eyes}
        viewBox={`0 0 ${koko.w} ${koko.h}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {eyes.map((e) => (
            <clipPath key={e.id} id={`koko-eye-${e.id}`}>
              <polygon points={pts(e.ball)} />
            </clipPath>
          ))}
        </defs>
        {eyes.map((e) => (
          <g key={e.id} clipPath={`url(#koko-eye-${e.id})`} data-koko-eye={e.id}>
            <g transform={`translate(${e.cx} ${e.cy})`}>
              <polygon
                className={styles.look}
                data-koko-pupil=""
                points={pts(e.pupil)}
                style={{ '--koko-travel': `${e.travel}px` } as React.CSSProperties}
              />
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}
