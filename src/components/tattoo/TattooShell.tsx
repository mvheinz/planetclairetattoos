import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Station } from '@/components/leash/Station'
import { IpNotice } from '@/components/legal/IpNotice'
import type { TattooSettings } from '@/lib/data/tattoo'
import type { Locale } from '@/lib/routes/registry'
import type { TattooMailTopic } from '@/lib/tattoo/mailto'

import styles from './Tattoo.module.css'
import { TattooContactBlock } from './TattooContactBlock'
import { TattooSubNav, type TattooRouteId } from './TattooSubNav'

// Rahmen der Tattoo-Seiten R11–R18 (KONZEPT §9.2, DESIGN KO-20, Preset `stencil`): H1 (Kringel und Coco `kopfschief`
// an der Seiten-H1 über den Stations-Anker), Einleitung, Unter-Navigation, Inhalt und am Ende der Kontakt-Block. Die
// Tuschelinie läuft mit Coco in der Rinne bis zum Seitenende (U-44); Abschnitte setzen ihre Kringel selbst
// (`data-leash-station` an der Abschnitts-Überschrift). Keine Kauf-, Formular- oder Zahlungselemente (E-51, AK-9-01).

/** Seiten mit Flash-Motiven bzw. Preis-/Ablauf-Angaben: R12 Flash, R14 Preise, R16 Ablauf. */
const FLASH_NOTICE_ROUTES: ReadonlySet<string> = new Set(['R12', 'R14', 'R16'])

export async function TattooShell({
  locale,
  routeId,
  settings,
  lead,
  contactTopic = { kind: 'general' },
  contactHeading,
  className,
  children,
}: {
  locale: Locale
  routeId: TattooRouteId
  settings: TattooSettings
  lead?: React.ReactNode
  contactTopic?: TattooMailTopic
  contactHeading?: string | null
  className?: string
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
          <Station
            id="tattoo-title"
            as="span"
            pose="kopfschief"
            loop="right"
            className={styles.titleAnchor}
          >
            {tRoutes(routeId)}
          </Station>
        </h1>
        {lead ? <div className={styles.lead}>{lead}</div> : null}
      </header>
      <TattooSubNav locale={locale} current={routeId} />
      <div className={styles.body}>{children}</div>
      {/* Nachstech-Genehmigung bei Flash-Motiven, Preisen und Ablauf (U-22 d, Baustein `ip.tattooFlashNotice`) */}
      {FLASH_NOTICE_ROUTES.has(routeId) ? <IpNotice locale={locale} kind="flash" /> : null}
      <TattooContactBlock
        locale={locale}
        settings={settings}
        topic={contactTopic}
        heading={contactHeading}
      />
    </div>
  )
}
