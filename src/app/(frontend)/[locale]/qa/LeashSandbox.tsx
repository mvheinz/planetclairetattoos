import React from 'react'

import appShell from '@/components/layout/AppShell.module.css'
import { LeashLayer } from '@/components/leash/LeashLayer'
import type { PresetId } from '@/lib/routes/registry'

import styles from './qa.module.css'

// Eigene Linien-Ebene mit festem Preset für QA-Seiten (KUNST-QA §3.2): gleicher Aufbau wie `AppShell` (Ebene als
// `aria-hidden`-Geschwister des Inhalts in einem `position: relative`-Container; die Engine misst die Anker im
// Container). Die Rinne (`--leash-gutter`) wie `body[data-preset]` in `global.css`.
const GUTTER_CLASS: Partial<Record<PresetId, string | undefined>> = {
  journey: styles.gutterWide,
  about: styles.gutterWide,
  legal: styles.gutterNarrow,
  margin: styles.gutterNarrow,
}

export function LeashSandbox({
  preset,
  routeKey,
  children,
}: {
  preset: PresetId
  routeKey: string
  children: React.ReactNode
}) {
  return (
    <div
      className={[styles.leashPage, GUTTER_CLASS[preset]].filter(Boolean).join(' ')}
      data-qa-leash={preset}
    >
      <LeashLayer
        className={`${appShell.lineLayer} u-layer-leash`}
        preset={preset}
        routeKey={routeKey}
      />
      {children}
    </div>
  )
}
