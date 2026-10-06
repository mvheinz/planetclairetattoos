import { getTranslations } from 'next-intl/server'
import React from 'react'

import koko from '@/art/koko/koko.json'
import type { Locale } from '@/lib/routes/registry'

import styles from './Koko.module.css'

// „Koko, Vorsitzende der Goth Dogs Berlin“ (P12.6, U-08): nach Juttas T-Shirt-Malerei freigestellt und von Hand
// nachgezeichnet (`pnpm art:koko`), ohne Knochenkreuz, Shirt-Falten und Hintergrund. Schwarzes Fell mit Tuschestrich,
// orange Flächen, weiße Brust und Pfoten, Narrenkappe mit grünen Bommeln. **Nur die Pupillen sind animiert** (sie
// wandern gemächlich links → rechts → links, CSS); bei „weniger Bewegung“ stehen sie still. Feste Box (kein CLS),
// Alt-Text DE/EN. Gedacht für den Platz `data-slot="chairwoman"` der rechten Startseiten-Spalte.

type Part = (typeof koko.parts)[number]

const cls = (token: string, kind: 'f' | 's') => styles[`${kind}-${token}`]

export async function ChairwomanKoko({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const path = (p: Part) => (
    <path
      key={p.id}
      className={[cls(p.fill, 'f'), cls(p.stroke, 's')].join(' ')}
      d={p.d}
      {...(p.w ? { strokeWidth: p.w } : {})}
      {...('o' in p ? { opacity: p.o } : {})}
    />
  )
  const pupils = koko.parts.filter((p) => p.id.startsWith('pupil-'))
  return (
    <div className={styles.koko} data-chairwoman="" role="img" aria-label={t('chairwomanAlt')}>
      <svg viewBox={`0 0 ${koko.w} ${koko.h}`} focusable="false" aria-hidden="true">
        {koko.parts.filter((p) => !p.id.startsWith('pupil-')).map(path)}
        <g className={styles.pupils} data-koko-pupils="">
          {pupils.map(path)}
        </g>
      </svg>
    </div>
  )
}
