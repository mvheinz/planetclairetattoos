import React from 'react'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/monitoring/logger'

import { AnalyticsClient } from './AnalyticsClient'
import { analyticsEnvAllows, analyticsSettingsAllow, type AnalyticsSettingsLike } from './gate'

// Statistik (PLAN P10.11, R-132, R-210 Nr. 10): rendert `<Analytics />` nur bei `NEXT_PUBLIC_ANALYTICS_ENABLED=true`,
// `APP_ENV=production`, ohne `PREVIEW_EXPORT` und mit dokumentierter Entscheidung in den Einstellungen
// (`settings.analytics.enabled` + `confirmedAt` + Notiz). Ohne die Umgebungsschalter wird nichts gelesen (keine DB).
// Bei jedem Fehler beim Lesen: keine Statistik (sicherste Richtung).

const log = createLogger()

async function loadAnalyticsSettings(): Promise<AnalyticsSettingsLike | null> {
  try {
    const { default: config } = await import('@payload-config')
    const { getPayload } = await import('payload')
    const payload = await getPayload({ config })
    const raw = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
      depth: 0,
      select: { analytics: true },
    })) as { analytics?: AnalyticsSettingsLike }
    return raw.analytics ?? null
  } catch (err) {
    log.warn('analytics.settings_failed', { reason: (err as Error).message })
    return null
  }
}

const getAnalyticsSettings = cached(loadAnalyticsSettings, {
  key: 'analytics-settings',
  tags: [TAGS.settings],
})

export async function AnalyticsSlot() {
  if (!analyticsEnvAllows(getEnv())) return null
  return analyticsSettingsAllow(await getAnalyticsSettings()) ? <AnalyticsClient /> : null
}
