import { getTranslations } from 'next-intl/server'
import React from 'react'

import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './Tattoo.module.css'

// Unter-Navigation des Tattoo-Bereichs (DESIGN KO-20, KO-08): Übersicht · Flash · Preise · Galerie · Ablauf
// · Aftercare · FAQ als Reihe von Chip-Links, mobil seitlich scrollbar; die aktuelle Seite trägt
// `aria-current="page"`. Reines Server-HTML, ohne JavaScript bedienbar.

export const TATTOO_SUBNAV = ['R11', 'R12', 'R14', 'R15', 'R16', 'R17', 'R18'] as const
export type TattooRouteId = (typeof TATTOO_SUBNAV)[number]

export async function TattooSubNav({
  locale,
  current,
}: {
  locale: Locale
  current: TattooRouteId
}) {
  const [t, tRoutes] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo' }),
    getTranslations({ locale, namespace: 'common.routes' }),
  ])
  return (
    <nav className={styles.subnav} aria-label={t('subnavLabel')} data-tattoo-subnav="">
      <ul className={styles.chips}>
        {TATTOO_SUBNAV.map((id) => (
          <li key={id}>
            <a
              className={styles.chip}
              href={localizedPath(id, locale)}
              aria-current={id === current ? 'page' : undefined}
              data-subnav={id}
            >
              {id === 'R11' ? t('subnavOverview') : tRoutes(id)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
