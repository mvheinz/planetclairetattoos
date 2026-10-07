import { getTranslations } from 'next-intl/server'
import React from 'react'

import koko from '@/art/koko/koko.json'
import type { Locale } from '@/lib/routes/registry'

import styles from './Koko.module.css'

// „Koko, Vorsitzende der Goth Dogs Berlin“ (P12.6, U-08): Juttas T-Shirt-Malerei, freigestellt und gesäubert
// (`python3 scripts/art/koko-cutout.py`) als Büste (Kopf, Narrenkappe, Bommeln, spitzer Fellkragen; ohne Körper, Knochenkreuz,
// Schrift, Shirt-Falten und Hintergrund). Das Bild ist ein
// <img> (WebP mit Alpha, zählt nicht zum Inline-SVG der Startseite, PF-10); die beiden Original-Pupillen sind
// übermalt, **nur die Pupillen sind animiert**: je Auge eine kleine SVG-Ellipse darüber, die in reinem CSS endlos
// schnell und ruhig zwischen links und rechts wechselt, mit langen Pausen dazwischen (kein Skript, kein Timer –
// nichts kann anhalten); bei „weniger Bewegung“ stehen sie still im Blick nach links. Feste Box (kein CLS), Alt-Text DE/EN.
// Gedacht für den Platz `data-slot="chairwoman"` der rechten Startseiten-Spalte.

/** Ausgelieferte Zeichnung (Version im Dateinamen, `python3 scripts/art/koko-cutout.py`). */
export const KOKO_HREF = '/art/koko.v2.webp'

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
              <polygon points={e.hull.map((p) => p.join(',')).join(' ')} />
            </clipPath>
          ))}
        </defs>
        {eyes.map((e) => (
          <g key={e.id} clipPath={`url(#koko-eye-${e.id})`} data-koko-eye={e.id}>
            <ellipse
              className={styles.look}
              data-koko-pupil=""
              cx={e.cx}
              cy={e.cy}
              rx={e.rx}
              ry={e.ry}
              style={{ '--koko-travel': `${e.travel}px` } as React.CSSProperties}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
