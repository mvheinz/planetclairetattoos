import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Station } from '@/components/leash/Station'
import type { TattooSettings } from '@/lib/data/tattoo'
import type { Locale } from '@/lib/routes/registry'
import type { TattooMailTopic } from '@/lib/tattoo/mailto'

import styles from './Tattoo.module.css'
import { TattooContactBlock } from './TattooContactBlock'
import { TattooSubNav, type TattooRouteId } from './TattooSubNav'

// Rahmen der Tattoo-Seiten R11–R18 (KONZEPT §9.2, DESIGN KO-20, Preset `stencil`): H1 (Coco `kopfschief` an der
// Seiten-H1 über den Stations-Anker), Einleitung, Unter-Navigation, Inhalt und am Ende der Kontakt-Block. Keine Kauf-,
// Formular- oder Zahlungselemente (E-51, AK-9-01).

/** Endpunkt der Tuschelinie (DESIGN §9.7 `stencil`): links am Inhalt, ohne Größe. */
export function LeashEnd() {
  return <span className={styles.leashEnd} data-leash-anchor="end" aria-hidden="true" />
}

export async function TattooShell({
  locale,
  routeId,
  settings,
  lead,
  contactTopic = { kind: 'general' },
  contactHeading,
  className,
  leashEnd = 'header',
  children,
}: {
  locale: Locale
  routeId: TattooRouteId
  settings: TattooSettings
  lead?: React.ReactNode
  contactTopic?: TattooMailTopic
  contactHeading?: string | null
  className?: string
  /**
   * Ende der Tuschelinie (Preset `stencil`): unter der Kopfzeile, damit sie nicht durch den Text läuft; Seiten mit
   * Flash-Raster setzen das Ende selbst unter das Raster (`<LeashEnd />`, Konturen um die Karten).
   */
  leashEnd?: 'header' | 'content'
  children: React.ReactNode
}) {
  const tRoutes = await getTranslations({ locale, namespace: 'common.routes' })
  return (
    <div
      className={['u-container', styles.page, className].filter(Boolean).join(' ')}
      data-tattoo-page={routeId}
    >
      <header className={styles.head}>
        <h1 className={styles.title}>
          <Station id="tattoo-title" as="span" pose="kopfschief" className={styles.titleAnchor}>
            {tRoutes(routeId)}
          </Station>
        </h1>
        {lead ? <div className={styles.lead}>{lead}</div> : null}
      </header>
      {leashEnd === 'header' ? <LeashEnd /> : null}
      <TattooSubNav locale={locale} current={routeId} />
      <div className={styles.body}>{children}</div>
      <TattooContactBlock
        locale={locale}
        settings={settings}
        topic={contactTopic}
        heading={contactHeading}
      />
    </div>
  )
}
