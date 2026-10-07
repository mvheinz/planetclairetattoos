import { getTranslations } from 'next-intl/server'
import React from 'react'

import koko from '@/art/koko/koko.json'
import type { Locale } from '@/lib/routes/registry'

import styles from './Koko.module.css'

// „Koko, Vorsitzende der Goth Dogs Berlin“ (P12.6, U-08): nach Juttas T-Shirt-Malerei freigestellt und von Hand
// nachgezeichnet (`pnpm art:koko`), ohne Knochenkreuz, Shirt-Falten und Hintergrund. Schwarzes Fell mit Tuschestrich,
// orange Flächen, weiße Brust und Pfoten, Narrenkappe mit grünen Bommeln. Die Zeichnung ist ein <img> (≈ 9 KB, zählt
// nicht zum Inline-SVG der Startseite, PF-10); **nur die Pupillen sind animiert**: zwei Elemente darüber wandern
// gemächlich links → rechts → links (CSS), bei „weniger Bewegung“ stehen sie still. Feste Box (kein CLS), Alt-Text DE/EN.
// Gedacht für den Platz `data-slot="chairwoman"` der rechten Startseiten-Spalte.

/** Ausgelieferte Zeichnung (Version im Dateinamen, `pnpm art:koko`). */
export const KOKO_HREF = '/art/koko.v1.svg'

const pct = (v: number, of: number) => `${Math.round((v / of) * 10_000) / 100}%`

export async function ChairwomanKoko({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'home' })
  return (
    <div className={styles.koko} data-chairwoman="" role="img" aria-label={t('chairwomanAlt')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG-Zeichnung aus public/art (Vektor, kein Raster zum Optimieren) */}
      <img
        className={styles.drawing}
        src={KOKO_HREF}
        width={koko.w}
        height={koko.h}
        alt=""
        decoding="async"
      />
      {koko.pupils.map((p) => (
        <span
          key={p.id}
          className={styles.pupil}
          data-koko-pupil=""
          style={{
            left: pct(p.cx - p.rx, koko.w),
            top: pct(p.cy - p.ry, koko.h),
            width: pct(2 * p.rx, koko.w),
            height: pct(2 * p.ry, koko.h),
          }}
        />
      ))}
    </div>
  )
}
